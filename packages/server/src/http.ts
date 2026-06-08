// HTTP layer: Express app with MCP Streamable HTTP endpoint.
// Follows the SDK's simpleStreamableHttp.ts pattern.
// Returns { app, zsApp } so REST routes can be added later.
import { randomUUID } from "node:crypto";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Request, Response } from "express";
import { z } from "zod";
import { ZsApp } from "./app";
import { MCP_TOOLS } from "./mcp-tools";
import type { ScriptLibrary, ScriptSourceReader } from "./loader";
import type { ZsServiceOptions } from "@zobr/protocol";
import type { Logger } from "./logger";
import { log as defaultLog } from "./logger";
import { EXECUTOR_INSTRUCTION, START_PREAMBLE } from "./instructions";
import { createApiRouter } from "./api-routes";
import { AuthService } from "./auth";
import type { ZsOAuthProvider } from "./oauth";
import { registerZsApps, TOOL_UI_META } from "./mcp-apps";

export interface OAuthConfig {
  readonly provider: ZsOAuthProvider;
  readonly issuerUrl: string;
  readonly mcpUrl: string;
}

export interface ZsHttpConfig {
  readonly library: ScriptLibrary | ScriptSourceReader;
  readonly serviceOpts?: ZsServiceOptions;
  readonly dbPath?: string;
  readonly invocationTtlMs?: number;
  readonly awaitingTtlMs?: number;
  readonly maxActiveInvocations?: number;
  readonly mcpPath?: string;
  readonly logger?: Logger;
  readonly oauth?: OAuthConfig | undefined;
}

export interface ZsHttpApp {
  readonly app: ReturnType<typeof createMcpExpressApp>;
  readonly zsApp: ZsApp;
  readonly authService?: AuthService | undefined;
}

export async function createZsHttpApp(config: ZsHttpConfig): Promise<ZsHttpApp> {
  const { library, serviceOpts, dbPath, invocationTtlMs, awaitingTtlMs, maxActiveInvocations, mcpPath = "/mcp", logger: parentLog } = config;
  const logger = (parentLog ?? defaultLog).child({ module: "http" });

  const zsApp = new ZsApp(library, {
    ...serviceOpts,
    ...(dbPath !== undefined ? { dbPath } : {}),
    ...(invocationTtlMs !== undefined ? { invocationTtlMs } : {}),
    ...(awaitingTtlMs !== undefined ? { awaitingTtlMs } : {}),
    ...(maxActiveInvocations !== undefined ? { maxActiveInvocations } : {}),
    startPreamble: START_PREAMBLE,
    logger: parentLog ?? defaultLog,
  });

  function createMcpServerInstance(): McpServer {
    const srv = new McpServer(
      { name: "zobr-script", version: "0.2.0" },
      { capabilities: { logging: {} }, instructions: EXECUTOR_INSTRUCTION },
    );
    for (const tool of MCP_TOOLS) {
      const inputSchema = tool.name === "zs_register"
        ? tool.input
        : (tool.input as z.ZodObject<z.ZodRawShape>).extend({ agent_id: z.string() });
      const uiMeta = TOOL_UI_META[tool.name];
      srv.registerTool(
        tool.name,
        { description: tool.description, inputSchema, ...(uiMeta ? { _meta: { ui: uiMeta } } : {}) },
        async (args): Promise<CallToolResult> => {
          logger.debug({ tool: tool.name }, "tool call");
          const result = await zsApp.callTool(tool.name, args);
          const parsed = args as Record<string, unknown>;
          let payload = result;
          if (uiMeta) {
            const tryParse = (v: unknown) => { if (typeof v === "string") { try { return JSON.parse(v); } catch {} } return v; };
            payload = { ...result as Record<string, unknown>, _input: { label: parsed.label, fn: parsed.fn, args: parsed.args, data: tryParse(parsed.data), query: parsed.query, what: parsed.what, basis: parsed.basis, verify: parsed.verify, boundaries: parsed.boundaries, commit_seq: parsed.commit_seq, results: tryParse(parsed.results), result: tryParse(parsed.result), script_ref: parsed.script_ref, provenance: parsed.provenance } };
          }
          return { content: [{ type: "text", text: JSON.stringify(payload) }] };
        },
      );
    }
    registerZsApps(srv);
    return srv;
  }
  logger.info({ tools: MCP_TOOLS.map((t) => t.name) }, "registered MCP tools");

  const app = createMcpExpressApp({ host: "0.0.0.0" });
  app.set("trust proxy", 1);
  const sessions = new Map<string, { transport: StreamableHTTPServerTransport; server: McpServer; lastActivity: number }>();

  const SESSION_TTL_MS = 30 * 60 * 1000;
  const sweepInterval = setInterval(() => {
    const now = Date.now();
    for (const [sid, s] of sessions) {
      if (now - s.lastActivity > SESSION_TTL_MS) {
        s.server.close();
        s.transport.close();
        sessions.delete(sid);
        logger.info({ sessionId: sid }, "session expired (idle)");
      }
    }
  }, 5 * 60 * 1000);
  sweepInterval.unref();

  if (config.oauth) {
    const { mcpAuthRouter } = await import("@modelcontextprotocol/sdk/server/auth/router.js");
    const { requireBearerAuth } = await import("@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js");
    const { getOAuthProtectedResourceMetadataUrl } = await import("@modelcontextprotocol/sdk/server/auth/router.js");
    const { provider, issuerUrl, mcpUrl } = config.oauth;

    const issuer = new URL(issuerUrl);
    const resourceServer = new URL(mcpUrl);
    const oauthLog = logger.child({ module: "oauth" });

    // Log every request to OAuth-related paths
    app.use((req, _res, next) => {
      const p = req.path;
      if (p.includes(".well-known") || p.startsWith("/authorize") || p.startsWith("/token") || p.startsWith("/register") || p.startsWith("/revoke") || p.startsWith("/oauth")) {
        oauthLog.info({ method: req.method, path: p, query: req.query, headers: { origin: req.headers.origin, host: req.headers.host, "content-type": req.headers["content-type"] } }, "OAuth request");
      }
      next();
    });

    const authRouter = mcpAuthRouter({
      provider,
      issuerUrl: issuer,
      resourceServerUrl: resourceServer,
    });
    app.use(authRouter);

    // SDK mounts /.well-known/oauth-authorization-server without path suffix,
    // but claude.ai requests /.well-known/oauth-authorization-server/mcp per RFC 8414.
    const rsPath = resourceServer.pathname;
    if (rsPath !== "/") {
      const pathSuffixedUrl = `/.well-known/oauth-authorization-server${rsPath}`;
      app.get(pathSuffixedUrl, (_req, res) => {
        oauthLog.info({ path: pathSuffixedUrl }, "serving path-suffixed OAuth metadata (RFC 8414)");
        res.json({
          issuer: issuer.href,
          authorization_endpoint: `${issuer.href}authorize`,
          token_endpoint: `${issuer.href}token`,
          registration_endpoint: `${issuer.href}register`,
          revocation_endpoint: `${issuer.href}revoke`,
          response_types_supported: ["code"],
          code_challenge_methods_supported: ["S256"],
          token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
          grant_types_supported: ["authorization_code", "refresh_token"],
          revocation_endpoint_auth_methods_supported: ["client_secret_post"],
        });
      });
      oauthLog.info({ pathSuffixedUrl }, "registered RFC 8414 path-suffixed metadata endpoint");
    }

    const { urlencoded } = await import("express");
    const { renderLoginError, renderLoginSuccess } = await import("./oauth");
    const { rateLimit } = await import("./api-routes");
    const callbackLimiter = rateLimit(60_000, 10);
    app.post("/oauth/callback", urlencoded({ extended: false }), callbackLimiter, (req: Request, res: Response) => {
      const { email, password, code } = req.body as { email: string; password: string; code: string };
      oauthLog.info({ email, hasCode: !!code }, "OAuth callback attempt");
      if (!code) { oauthLog.warn("OAuth callback: missing code"); res.status(400).send(renderLoginError("", "Invalid request")); return; }
      if (!provider.verifyCredentials(email, password)) {
        oauthLog.warn({ email }, "OAuth callback: invalid credentials");
        res.status(401).send(renderLoginError(code, "Invalid email or password"));
        return;
      }
      const pending = provider.completeAuthorization(code);
      if (!pending) { oauthLog.warn({ code }, "OAuth callback: code expired or not found"); res.status(400).send(renderLoginError("", "Authorization code expired. Please try again.")); return; }
      const redirectUrl = new URL(pending.redirectUri);
      redirectUrl.searchParams.set("code", code);
      if (pending.state) redirectUrl.searchParams.set("state", pending.state);
      oauthLog.info({ email, redirectUri: pending.redirectUri }, "OAuth callback: success, redirecting");
      res.send(renderLoginSuccess(redirectUrl.toString()));
    });

    const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(new URL(mcpUrl));
    const bearerMiddleware = requireBearerAuth({ verifier: provider, resourceMetadataUrl });
    app.post(mcpPath, (req, res, next) => {
      const hasAuth = !!req.headers.authorization;
      oauthLog.info({ method: "POST", hasAuth, sessionId: req.headers["mcp-session-id"] }, "MCP request (pre-auth)");
      bearerMiddleware(req, res, (err?: unknown) => {
        if (err) oauthLog.error({ err }, "Bearer auth failed");
        else next();
      });
    });
    app.get(mcpPath, bearerMiddleware);
    app.delete(mcpPath, bearerMiddleware);
    oauthLog.info({ mcpUrl, issuerUrl, resourceMetadataUrl }, "OAuth enabled for MCP");
  }

  const mcpHandler = async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    try {
      if (sessionId && sessions.has(sessionId)) {
        const s = sessions.get(sessionId)!;
        s.lastActivity = Date.now();
        await s.transport.handleRequest(req, res, req.body);
        return;
      }
      if (!sessionId && isInitializeRequest(req.body)) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: async (sid) => {
            try {
              const mcpServer = createMcpServerInstance();
              await mcpServer.connect(transport as Parameters<typeof mcpServer.connect>[0]);
              sessions.set(sid, { transport, server: mcpServer, lastActivity: Date.now() });
              logger.info({ sessionId: sid }, "session initialized");
            } catch (err) {
              logger.error({ err, sessionId: sid }, "session init failed");
              transport.close();
            }
          },
          onsessionclosed: (sid) => {
            const s = sessions.get(sid);
            if (s) { s.server.close(); sessions.delete(sid); }
            logger.info({ sessionId: sid }, "session closed");
          },
        });
        await transport.handleRequest(req, res, req.body);
        return;
      }
      res.status(sessionId ? 404 : 400).json({
        jsonrpc: "2.0",
        error: { code: sessionId ? -32001 : -32000, message: sessionId ? "Session not found" : "Bad Request" },
        id: null,
      });
    } catch (error) {
      logger.error({ err: error }, "MCP request error");
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
      }
    }
  };

  app.post(mcpPath, mcpHandler);
  app.get(mcpPath, mcpHandler);
  app.delete(mcpPath, mcpHandler);

  let authService: AuthService | undefined;
  const db = zsApp.getDb();
  if (db) {
    authService = new AuthService(db.rawDb, { logger });
    app.use("/api", createApiRouter(zsApp, authService, logger));
  }

  return { app, zsApp, authService };
}
