# ZS v0.2 — MCP Refactor Review Action Plan

Составлен: 2026-06-03. Источник: `reviews/review-mcp-refactor.md`.
**16/16 закрыто.**

---

## P0 — CRITICAL ✅

- [x] **P0-1. Security: Plaintext passwords in OAuth** ✅ 2026-06-03

## P1 — HIGH ✅

- [x] **P1-1. OAuth: Auth code not consumed** ✅ 2026-06-03
- [x] **P1-2. OAuth: Auth codes without TTL** ✅ 2026-06-03
- [x] **P1-3. Deploy: SQLite WAL copy while running** ✅ 2026-06-03
- [x] **P1-4. Deploy: node_modules mv without fallback** ✅ 2026-06-03

## P2 — MEDIUM ✅

- [x] **P2-1. Session: zombie transport** ✅ 2026-06-03
- [x] **P2-2. Session: McpServer.close()** ✅ 2026-06-03
- [x] **P2-3. OAuth: /oauth/callback rate limiting** ✅ 2026-06-03
- [x] **P2-4. OAuth: XSS in renderLoginError** ✅ 2026-06-03
- [x] **P2-5. Session: idle timeout** ✅ 2026-06-03
- [x] **P2-6. Deploy: rm -rf OLD after health check** ✅ 2026-06-03

## P3 — LOW ✅

- [x] **P3-1. SDK in dependencies** ✅ 2026-06-03
- [x] **P3-2. Stale cast** — cast required by exactOptionalPropertyTypes, comment removed
- [x] **P3-3. config num() NaN guard** ✅ 2026-06-03
- [x] **P3-4. process.env stragglers centralized** ✅ 2026-06-03
- [x] **P3-5. Deploy: first deploy guard** ✅ 2026-06-03
