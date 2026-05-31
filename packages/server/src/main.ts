// Entry point: boots the ZS MCP server.
// Run: pnpm start | pnpm dev | tsx packages/server/src/main.ts
import "dotenv/config";
import { createZsHttpApp } from "./http";
import { FsScriptSourceReader } from "./reader";
import { materializeScaffold } from "./scaffold";
import { log } from "./logger";

const PORT = Number(process.env["ZS_PORT"] ?? 1978);
const LIB_ROOT = process.env["ZS_LIBRARY"] ?? "./zs-lib";
const STORE_PATH = process.env["ZS_STORE_PATH"] ?? "./data/store.sqlite";
const BUDGET_STEPS = Number(process.env["ZS_BUDGET_STEPS"] ?? 1000);
const BUDGET_ITERATIONS = Number(process.env["ZS_BUDGET_ITERATIONS"] ?? 100);
const INVOCATION_TTL = Number(process.env["ZS_INVOCATION_TTL"] ?? 3600) * 1000;
const AWAITING_TTL = Number(process.env["ZS_AWAITING_TTL"] ?? 86400) * 1000;
const MAX_ACTIVE = Number(process.env["ZS_MAX_ACTIVE_INVOCATIONS"] ?? 100);

log.info({ library: LIB_ROOT }, "materializing scaffold");
await materializeScaffold(LIB_ROOT);

const { app } = createZsHttpApp({
  library: new FsScriptSourceReader(LIB_ROOT),
  dbPath: STORE_PATH,
  invocationTtlMs: INVOCATION_TTL,
  awaitingTtlMs: AWAITING_TTL,
  maxActiveInvocations: MAX_ACTIVE,
  serviceOpts: { defaultBudgets: { steps: BUDGET_STEPS, iterations: BUDGET_ITERATIONS } },
  logger: log,
});

app.get("/health", (_req, res) => { res.json({ ok: true }); });

app.get("/.well-known/oauth-protected-resource", (_req, res) => {
  res.json({ resource: `https://${_req.headers.host ?? "localhost"}` });
});

const HOST = process.env["ZS_HOST"] ?? "127.0.0.1";

app.listen(PORT, HOST, () => {
  log.info({
    url: `http://${HOST}:${PORT}`,
    mcp: `http://${HOST}:${PORT}/mcp`,
    health: `http://${HOST}:${PORT}/health`,
    library: LIB_ROOT,
    budgets: { steps: BUDGET_STEPS, iterations: BUDGET_ITERATIONS },
  }, "ZS MCP server started");
});
