const env = (key: string, fallback: string) => process.env[key] ?? fallback;
const num = (key: string, fallback: number) => Number(process.env[key] ?? fallback);

export const config = {
  host: env("ZS_HOST", "127.0.0.1"),
  port: num("ZS_PORT", 1978),
  library: env("ZS_LIBRARY", "./zs-lib"),
  storePath: env("ZS_STORE_PATH", "./data/store.sqlite"),

  budgetSteps: num("ZS_BUDGET_STEPS", 1000),
  budgetIterations: num("ZS_BUDGET_ITERATIONS", 100),
  maxRunDepth: num("ZS_MAX_RUN_DEPTH", 10),

  invocationTtlMs: num("ZS_INVOCATION_TTL", 3600) * 1000,
  awaitingTtlMs: num("ZS_AWAITING_TTL", 86400) * 1000,
  maxActiveInvocations: num("ZS_MAX_ACTIVE_INVOCATIONS", 100),

  jwtSecret: process.env["ZS_JWT_SECRET"],
  adminEmail: "admin@docxi.org",
  adminPassword: env("ZS_ADMIN_PASSWORD", "admin"),

  oauth: process.env["ZS_OAUTH"] === "true",
  publicUrl: process.env["ZS_PUBLIC_URL"],

  tokenTtlSec: 3600,
  refreshTtlSec: 7 * 86400,
  oauthTokenTtlSec: 3600,

  rateLimitWindowMs: 60_000,
  rateLimitLogin: 10,
  rateLimitRefresh: 10,
  rateLimitPassword: 5,

  tracesDefaultLimit: 20,
  tracesMaxLimit: 100,
} as const;
