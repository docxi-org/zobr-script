# ZS v0.2 — MCP Refactor Review Action Plan

Составлен: 2026-06-03. Источник: `reviews/review-mcp-refactor.md`.
При закрытии пункта: `- [x]`, коммит ref, дата.

---

## P0 — CRITICAL

- [ ] **P0-1. Security: Plaintext passwords in OAuth**
  - Источник: OAUTH-001
  - Проблема: `oauth_users` хранит пароли без хеширования, `verifyCredentials()` сравнивает `===`
  - Решение: scrypt hash (из `node:crypto`, 0 deps) на insert, verify через `scryptSync` + `timingSafeEqual`
  - Файлы: `oauth.ts`
  - Effort: 1h

---

## P1 — HIGH

- [ ] **P1-1. OAuth: Auth code not consumed in completeAuthorization()**
  - Источник: OAUTH-002
  - Проблема: код не удаляется при callback — replay возможен
  - Решение: DELETE code в `completeAuthorization()` после чтения
  - Файлы: `oauth.ts`
  - Effort: 15 min

- [ ] **P1-2. OAuth: Auth codes without TTL**
  - Источник: OAUTH-003
  - Проблема: `created_at` не проверяется, коды живут вечно
  - Решение: TTL 10 min, проверка в `challengeForAuthorizationCode()` + `completeAuthorization()`
  - Файлы: `oauth.ts`
  - Effort: 30 min

- [ ] **P1-3. Deploy: SQLite WAL copy while server running**
  - Источник: DEPLOY-02
  - Проблема: `cp -a data/` при активном PM2 — corruption risk
  - Решение: `pm2 stop` перед копированием data
  - Файлы: `deploy.yml`
  - Effort: 15 min

- [ ] **P1-4. Deploy: node_modules mv without fallback**
  - Источник: DEPLOY-01
  - Проблема: `mv` оставляет LIVE без node_modules если pnpm install fails
  - Решение: `cp -a` вместо `mv`
  - Файлы: `deploy.yml`
  - Effort: 15 min

---

## P2 — MEDIUM

- [ ] **P2-1. Session: zombie transport on onsessioninitialized error**
  - Источник: MCP-SESS-01
  - Проблема: exception оставляет transport в Map без McpServer
  - Решение: try/catch, transports.set после connect, cleanup on failure
  - Файлы: `http.ts`
  - Effort: 30 min

- [ ] **P2-2. Session: McpServer.close() never called**
  - Источник: MCP-SESS-02
  - Проблема: McpServer не закрывается при session teardown
  - Решение: Map<string, { transport, server }>, close() в onsessionclosed
  - Файлы: `http.ts`
  - Effort: 30 min

- [ ] **P2-3. OAuth: /oauth/callback without rate limiting**
  - Источник: OAUTH-006
  - Проблема: brute-force паролей через auth code
  - Решение: rateLimit middleware на /oauth/callback
  - Файлы: `http.ts`
  - Effort: 15 min

- [ ] **P2-4. OAuth: XSS in renderLoginError**
  - Источник: OAUTH-005
  - Проблема: error message не экранируется
  - Решение: `esc()` на `opts.error`
  - Файлы: `oauth.ts`
  - Effort: 5 min

- [ ] **P2-5. Session: no idle timeout**
  - Источник: MCP-SESS-03
  - Проблема: transports Map растёт без ограничений
  - Решение: lastActivity tracking + periodic sweep (5 min interval, 30 min TTL)
  - Файлы: `http.ts`
  - Effort: 1h

- [ ] **P2-6. Deploy: rm -rf OLD before health check**
  - Источник: DEPLOY-03, DEPLOY-05
  - Проблема: нет rollback если новый релиз не работает
  - Решение: defer cleanup до после health check
  - Файлы: `deploy.yml`
  - Effort: 30 min

---

## P3 — LOW

- [ ] **P3-1. SDK in devDependencies**
  - Источник: SDK-COMPAT-07
  - Решение: move to dependencies
  - Файлы: `package.json`
  - Effort: 5 min

- [ ] **P3-2. Stale cast and comment**
  - Источник: SDK-COMPAT-08
  - Решение: remove `as Parameters<...>` cast and comment
  - Файлы: `http.ts`
  - Effort: 5 min

- [ ] **P3-3. config num() NaN guard**
  - Источник: CFG-03
  - Решение: throw on NaN
  - Файлы: `config.ts`
  - Effort: 5 min

- [ ] **P3-4. process.env stragglers**
  - Источник: CFG-01, CFG-02
  - Решение: centralize NODE_ENV и LOG_LEVEL в config.ts
  - Файлы: `config.ts`, `api-routes.ts`, `logger.ts`
  - Effort: 15 min

- [ ] **P3-5. Deploy: first deploy guard**
  - Источник: DEPLOY-09
  - Решение: `[ -d "$LIVE" ] && mv "$LIVE" "$OLD"`
  - Файлы: `deploy.yml`
  - Effort: 5 min

---

## Счётчики

| Priority | Items | Estimated Effort |
|----------|-------|-----------------|
| P0 CRITICAL | 1 | ~1h |
| P1 HIGH | 4 | ~1h 15m |
| P2 MEDIUM | 6 | ~3h |
| P3 LOW | 5 | ~35m |
| **TOTAL** | **16** | **~6h** |
