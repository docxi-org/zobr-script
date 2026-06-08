// Entry point: boots the ZS MCP server.
// Run: pnpm start | pnpm dev | tsx packages/server/src/main.ts
import "dotenv/config";
import { existsSync } from "node:fs";
import { join } from "node:path";
import express from "express";
import cors from "cors";
import { createZsHttpApp } from "./http";
import { FsScriptSourceReader } from "./reader";
import { materializeScaffold } from "./scaffold";
import { log } from "./logger";

import { config as C } from "./config";
const { port: PORT, library: LIB_ROOT, storePath: STORE_PATH } = C;

log.info({ library: LIB_ROOT }, "materializing scaffold");
await materializeScaffold(LIB_ROOT);

let oauth: import("./http").OAuthConfig | undefined;
let authServiceRef: import("./auth").AuthService | undefined;

if (C.oauth) {
  const { ZsOAuthProvider } = await import("./oauth");
  const publicBase = C.publicUrl ?? `http://${C.host}:${PORT}`;
  const mcpUrl = `${publicBase}/mcp`;
  const oauthDbPath = STORE_PATH.replace(/\.sqlite$/, "-oauth.sqlite");
  const provider = new ZsOAuthProvider({
    dbPath: oauthDbPath,
    issuerUrl: publicBase,
    checkCredentials: (email, password) => authServiceRef?.verifyCredentials(email, password) ?? false,
  });
  oauth = { provider, issuerUrl: publicBase, mcpUrl };
  log.info({ mcpUrl, oauthDbPath }, "OAuth enabled");
}

const { app, zsApp, authService } = await createZsHttpApp({
  library: new FsScriptSourceReader(LIB_ROOT),
  dbPath: STORE_PATH,
  invocationTtlMs: C.invocationTtlMs,
  awaitingTtlMs: C.awaitingTtlMs,
  maxActiveInvocations: C.maxActiveInvocations,
  serviceOpts: { defaultBudgets: { steps: C.budgetSteps, iterations: C.budgetIterations }, maxRunDepth: C.maxRunDepth },
  logger: log,
  oauth,
});
authServiceRef = authService;

const CORS_ORIGINS = C.production
  ? ["https://claude.ai", "https://chatgpt.com"]
  : true;
app.use("/artifact", cors({ origin: CORS_ORIGINS, credentials: true }));

const { createArtifactRouter } = await import("./artifact-routes");
app.use("/artifact", createArtifactRouter(zsApp, log));

const SPA_DIR = join(import.meta.dirname, "../../web/dist");
if (existsSync(SPA_DIR)) {
  app.use(express.static(SPA_DIR));
  log.info({ dir: SPA_DIR }, "serving SPA static files");
}

app.get("/health", (_req, res) => { res.json({ ok: true }); });


const HOST = C.host;

import { setupTraceWs } from "./trace-ws";

const httpServer = app.listen(PORT, HOST, () => {
  log.info({
    url: `http://${HOST}:${PORT}`,
    mcp: `http://${HOST}:${PORT}/mcp`,
    health: `http://${HOST}:${PORT}/health`,
    library: LIB_ROOT,
    budgets: { steps: C.budgetSteps, iterations: C.budgetIterations },
  }, "ZS MCP server started");
});

setupTraceWs(httpServer, log);
