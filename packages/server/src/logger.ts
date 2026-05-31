import pino from "pino";

export type Logger = pino.Logger;

const VALID_LEVELS = new Set(["fatal", "error", "warn", "info", "debug", "trace", "silent"]);

export function createLogger(opts?: { level?: string; pretty?: boolean }): Logger {
  const raw = opts?.level ?? process.env["LOG_LEVEL"] ?? "info";
  const level = VALID_LEVELS.has(raw) ? raw : "info";
  const pretty = opts?.pretty ?? process.env["NODE_ENV"] !== "production";

  return pino({
    level,
    ...(pretty ? { transport: { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } } } : {}),
  });
}

export const log: Logger = createLogger();
