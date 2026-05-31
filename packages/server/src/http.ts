// HTTP layer: Express app with MCP Streamable HTTP endpoint.
// Follows the SDK's simpleStreamableHttp.ts pattern.
// Returns { app, zsApp, mcpServer } so REST routes can be added later.
import { randomUUID } from "node:crypto";
import express from "express";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { McpServer, isInitializeRequest } from "@modelcontextprotocol/server";
import type { CallToolResult } from "@modelcontextprotocol/server";
import type { Request, Response } from "express";
import { z } from "zod";
import { ZsApp } from "./app";
import { MCP_TOOLS } from "./mcp-tools";
import type { ScriptLibrary, ScriptSourceReader } from "./loader";
import type { ZsServiceOptions } from "@zobr/protocol";
import type { Logger } from "./logger";
import { log as defaultLog } from "./logger";
import { EXECUTOR_INSTRUCTION, START_PREAMBLE } from "./instructions";

export interface ZsHttpConfig {
  readonly library: ScriptLibrary | ScriptSourceReader;
  readonly serviceOpts?: ZsServiceOptions;
  readonly dbPath?: string;
  readonly invocationTtlMs?: number;
  readonly awaitingTtlMs?: number;
  readonly maxActiveInvocations?: number;
  readonly mcpPath?: string;
  readonly logger?: Logger;
  readonly architectMode?: boolean;
}

export interface ZsHttpApp {
  readonly app: express.Express;
  readonly zsApp: ZsApp;
  readonly mcpServer: McpServer;
}

export function createZsHttpApp(config: ZsHttpConfig): ZsHttpApp {
  const { library, serviceOpts, dbPath, invocationTtlMs, awaitingTtlMs, maxActiveInvocations, mcpPath = "/mcp", logger: parentLog, architectMode = false } = config;
  const logger = (parentLog ?? defaultLog).child({ module: "http" });

  const zsApp = new ZsApp(library, {
    ...serviceOpts,
    ...(dbPath !== undefined ? { dbPath } : {}),
    ...(invocationTtlMs !== undefined ? { invocationTtlMs } : {}),
    ...(awaitingTtlMs !== undefined ? { awaitingTtlMs } : {}),
    ...(maxActiveInvocations !== undefined ? { maxActiveInvocations } : {}),
    startPreamble: START_PREAMBLE,
  });

  const mcpServer = new McpServer(
    { name: "zobr-script", version: "0.2.0" },
    { capabilities: { logging: {} }, instructions: EXECUTOR_INSTRUCTION },
  );

  const visibleTools = MCP_TOOLS.filter((t) => t.role === "executor" || architectMode);
  for (const tool of visibleTools) {
    const inputSchema = tool.name === "zs_register"
      ? tool.input
      : (tool.input as z.ZodObject<z.ZodRawShape>).extend({ agent_id: z.string() });
    mcpServer.registerTool(
      tool.name,
      { description: tool.description, inputSchema },
      async (args): Promise<CallToolResult> => {
        logger.debug({ tool: tool.name }, "tool call");
        const result = await zsApp.callTool(tool.name, args);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      },
    );
  }
  logger.info({ tools: visibleTools.map((t) => t.name), architectMode }, "registered MCP tools");

  const app = express();
  app.use(express.json());
  const transports = new Map<string, NodeStreamableHTTPServerTransport>();

  app.post(mcpPath, async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    try {
      if (sessionId && transports.has(sessionId)) {
        await transports.get(sessionId)!.handleRequest(req, res, req.body);
        return;
      }

      if (!sessionId && isInitializeRequest(req.body)) {
        const transport = new NodeStreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            transports.set(sid, transport);
            logger.info({ sessionId: sid }, "session initialized");
          },
        });
        transport.onclose = () => {
          if (transport.sessionId) {
            logger.info({ sessionId: transport.sessionId }, "session closed");
            transports.delete(transport.sessionId);
          }
        };
        await mcpServer.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      logger.warn({ sessionId, method: req.method }, "bad MCP request");
      res.status(sessionId ? 404 : 400).json({
        jsonrpc: "2.0",
        error: { code: sessionId ? -32001 : -32000, message: sessionId ? "Session not found" : "Bad Request" },
        id: null,
      });
    } catch (error) {
      logger.error({ err: error }, "MCP POST error");
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
      }
    }
  });

  app.get(mcpPath, async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports.has(sessionId)) {
      res.status(sessionId ? 404 : 400).send(sessionId ? "Session not found" : "Missing session ID");
      return;
    }
    try {
      await transports.get(sessionId)!.handleRequest(req, res);
    } catch (error) {
      logger.error({ err: error }, "MCP GET error");
      if (!res.headersSent) res.status(500).send("Internal server error");
    }
  });

  app.delete(mcpPath, async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports.has(sessionId)) {
      res.status(sessionId ? 404 : 400).send(sessionId ? "Session not found" : "Missing session ID");
      return;
    }
    try {
      logger.info({ sessionId }, "session DELETE request");
      await transports.get(sessionId)!.handleRequest(req, res);
    } catch (error) {
      logger.error({ err: error }, "MCP DELETE error");
      if (!res.headersSent) res.status(500).send("Internal server error");
    }
  });

  return { app, zsApp, mcpServer };
}
