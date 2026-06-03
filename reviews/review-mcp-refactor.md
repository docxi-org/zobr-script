# MCP Refactor Review — 2026-06-03

6 параллельных ревьюеров: session management, OAuth provider, OAuth flow, SDK compatibility, config, deploy.

## Оценки по блокам

| Блок | Тема | Severity | Critical Issues |
|------|------|----------|-----------------|
| Session | MCP session lifecycle | medium | zombie transport, no close(), no timeout |
| OAuth Provider | OAuthServerProvider impl | critical | plaintext passwords, no code TTL |
| OAuth Flow | http.ts integration | high | no rate limit on callback, XSS risk |
| SDK Compat | SDK 1.29.0 usage | low | devDeps, stale cast |
| Config | config.ts centralization | medium | NaN risk, no prod enforcement |
| Deploy | deploy.yml pipeline | high | WAL copy while running, no rollback |

## Findings

### CRITICAL

**OAUTH-001. Passwords stored in plaintext**
- File: `oauth.ts:110`
- `#seedAdmin()` stores raw password. `verifyCredentials()` uses `===`. No hashing.
- Fix: bcrypt/scrypt hash on insert, verify on check.

### HIGH

**OAUTH-002. completeAuthorization() does not delete auth code**
- File: `oauth.ts:184`
- Code not consumed until token exchange. Login callback replayable.
- Fix: delete or mark code as consumed in completeAuthorization().

**OAUTH-003. Auth codes have no expiry TTL**
- File: `oauth.ts:119`
- `created_at` stored but never checked. Codes live forever.
- Fix: TTL check (10 min), periodic cleanup.

**DEPLOY-01. node_modules mv leaves no fallback**
- File: `deploy.yml:62`
- `mv` instead of `cp` — if `pnpm install` fails, LIVE has no node_modules.
- Fix: `cp -a` instead of `mv`, or restore on failure.

**DEPLOY-02. SQLite WAL copied while server running**
- File: `deploy.yml:61`
- `cp -a data/` while PM2 active — WAL corruption risk.
- Fix: `pm2 stop` before data copy, or use `sqlite3 .backup`.

### MEDIUM

**MCP-SESS-01. Exception in onsessioninitialized leaks zombie transport**
- File: `http.ts:134`
- If `createMcpServerInstance()` or `connect()` throws, transport stays in Map without McpServer.
- Fix: try/catch, remove from Map on failure, close transport.

**MCP-SESS-02. McpServer.close() never called on session teardown**
- File: `http.ts:135`
- Only transport deleted from Map. McpServer relies on GC.
- Fix: store McpServer alongside transport, call close() in onsessionclosed.

**OAUTH-005. XSS risk in renderLoginError — error not escaped**
- File: `oauth.ts:275`
- Error message interpolated into HTML without escaping.
- Fix: apply esc() to error param.

**OAUTH-006. /oauth/callback without rate limiting**
- File: `http.ts:108`
- Brute-force passwords via auth code. No throttle.
- Fix: add rateLimit middleware.

**MCP-SESS-03. No session idle timeout**
- File: `http.ts:85`
- Transports Map unbounded. Clients that never DELETE leak sessions.
- Fix: idle sweep, max sessions limit.

**DEPLOY-03/05. rm -rf OLD before health check — no rollback**
- File: `deploy.yml:69-79`
- Old release deleted before confirming new one works.
- Fix: defer cleanup until after health check.

**DEPLOY-08. reset_db no safeguards**
- File: `deploy.yml:112`
- No confirmation, no backup, anyone with push access can wipe DB.
- Fix: separate workflow, environment approval.

### LOW

**SDK-COMPAT-07. SDK in devDependencies**
- File: `package.json:29`
- Runtime dependency listed as dev. Works because `--prod` not used.
- Fix: move to dependencies.

**SDK-COMPAT-08. Stale cast and comment**
- File: `http.ts:137-138`
- `as Parameters<typeof mcpServer.connect>[0]` unnecessary in SDK 1.29.0.
- Fix: remove cast and comment.

**CFG-03. num() silent NaN**
- File: `config.ts:2`
- `Number("abc")` = NaN, no error.
- Fix: NaN guard with throw.

**CFG-04. Default admin password no enforcement**
- File: `config.ts:20`
- `adminPassword = "admin"` in production — warning only.
- Fix: refuse to start in production with default.

**CFG-01/02. process.env stragglers**
- Files: `api-routes.ts:36`, `logger.ts:8`
- NODE_ENV and LOG_LEVEL read directly, not from config.ts.
- Fix: centralize.

**DEPLOY-09. First deploy fails**
- File: `deploy.yml:71`
- `mv LIVE OLD` when LIVE doesn't exist.
- Fix: `[ -d "$LIVE" ] && mv`.

### INFO (positive)

- Token generation (randomBytes(32)) cryptographically sound
- All SQL queries parameterized — no injection risk
- Token expiry verification correct
- Per-session McpServer creation safe — no race conditions
- Trust proxy = 1 correct for single Nginx
- requireBearerAuth on all 3 MCP methods
- OAuth metadata URLs per RFC 9728
- SDK pinned at exact 1.29.0, no deprecated APIs
