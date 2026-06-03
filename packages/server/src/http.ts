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
      srv.registerTool(
        tool.name,
        { description: tool.description, inputSchema },
        async (args): Promise<CallToolResult> => {
          logger.debug({ tool: tool.name }, "tool call");
          const result = await zsApp.callTool(tool.name, args);
          return { content: [{ type: "text", text: JSON.stringify(result) }] };
        },
      );
    }
    return srv;
  }
  logger.info({ tools: MCP_TOOLS.map((t) => t.name) }, "registered MCP tools");

  const app = createMcpExpressApp({ host: "0.0.0.0" });
  app.set("trust proxy", 1);
  const transports = new Map<string, StreamableHTTPServerTransport>();

  if (config.oauth) {
    const { mcpAuthRouter } = await import("@modelcontextprotocol/sdk/server/auth/router.js");
    const { requireBearerAuth } = await import("@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js");
    const { getOAuthProtectedResourceMetadataUrl } = await import("@modelcontextprotocol/sdk/server/auth/router.js");
    const { provider, issuerUrl, mcpUrl } = config.oauth;

    app.use(mcpAuthRouter({
      provider,
      issuerUrl: new URL(issuerUrl),
      resourceServerUrl: new URL(mcpUrl),
    }));

    const { urlencoded } = await import("express");
    const { renderLoginError, renderLoginSuccess } = await import("./oauth");
    app.post("/oauth/callback", urlencoded({ extended: false }), (req: Request, res: Response) => {
      const { email, password, code } = req.body as { email: string; password: string; code: string };
      if (!code) { res.status(400).send(renderLoginError("", "Invalid request")); return; }
      if (!provider.verifyCredentials(email, password)) {
        res.status(401).send(renderLoginError(code, "Invalid email or password"));
        return;
      }
      const pending = provider.completeAuthorization(code);
      if (!pending) { res.status(400).send(renderLoginError("", "Authorization code expired. Please try again.")); return; }
      const redirectUrl = new URL(pending.redirectUri);
      redirectUrl.searchParams.set("code", code);
      if (pending.state) redirectUrl.searchParams.set("state", pending.state);
      res.send(renderLoginSuccess(redirectUrl.toString()));
    });

    const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(new URL(mcpUrl));
    const bearerMiddleware = requireBearerAuth({ verifier: provider, resourceMetadataUrl });
    app.post(mcpPath, bearerMiddleware);
    app.get(mcpPath, bearerMiddleware);
    app.delete(mcpPath, bearerMiddleware);
    logger.info({ mcpUrl }, "OAuth enabled for MCP");
  }

  const mcpHandler = async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    try {
      if (sessionId && transports.has(sessionId)) {
        await transports.get(sessionId)!.handleRequest(req, res, req.body);
        return;
      }
      if (!sessionId && isInitializeRequest(req.body)) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: async (sid) => {
            transports.set(sid, transport);
            const mcpServer = createMcpServerInstance();
            await mcpServer.connect(transport as Parameters<typeof mcpServer.connect>[0]);
            logger.info({ sessionId: sid }, "session initialized");
          },
          onsessionclosed: (sid) => {
            logger.info({ sessionId: sid }, "session closed");
            transports.delete(sid);
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

  const db = zsApp.getDb();
  if (db) {
    const authService = new AuthService(db.rawDb, { logger });
    app.use("/api", createApiRouter(zsApp, authService, logger));
  }

  return { app, zsApp };
}
