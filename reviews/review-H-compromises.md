# Review H — Compromises (Full Debt Inventory)

## Summary Table

| Component | Missing | Simplified | Corners Cut | Hacks | Hardcode | TODO/Stubs |
|-----------|---------|-----------|-------------|-------|----------|------------|
| Core | 4 | 2 | 1 | 1 | 0 | 0 |
| Scaffold | 2 | 1 | 0 | 1 | 0 | 0 |
| Validator | 4 | 1 | 1 | 0 | 1 | 1 |
| Protocol | 3 | 1 | 1 | 2 | 0 | 3 |
| Server | 4 | 4 | 7 | 7 | 8 | 2 |
| Web | 4 | 4 | 2 | 1 | 3 | 1 |
| REST API | 4 | 2 | 2 | 0 | 7 | 1 |
| MCP | 2 | 1 | 1 | 1 | 2 | 1 |
| **TOTAL** | **27** | **16** | **15** | **13** | **21** | **9** |

## Critical (must fix before production)

1. **Max depth check отсутствует** — бесконечная рекурсия run() не блокируется
2. **OAuth E2E не тестировано** — production OAuth может быть broken
3. **Web: 0 тестов** — UI regression risk
4. **zs_retrieve — полная заглушка** — KB не реализован

## High Priority

5. **callTool god-method** (24 case) — maintenance burden
6. **Empty catch blocks** (10 instances) — скрывают ошибки
7. **Rate limiting** только на /login — остальные endpoints открыты
8. **Cookies без Secure flag** — уязвимо в production HTTPS
9. **run composition** не E2E тестировано
10. **Fence rules** для commit/check не реализованы

## Type Bypasses (13 total)

- oauth.ts: 4 instances (`as never`, `as unknown`)
- app.ts: 2 instances (CreateReq casting)
- mcp-tools.ts: 1 instance (tool erasure)
- service.ts: 1 instance (SandboxArg[])
- i18n/context.tsx: 1 instance (Messages)
- shape.ts: 1 instance (literal value check)
- db.ts: 1 instance (JSON.parse)
- scaffold/ambients.ts: 1 instance (guide topic meta)

## Hardcoded Values (21 total)

- Port 1978, budgets 1000/100, TTL 3600/86400, max active 100
- Rate limit 60_000ms / 10 attempts
- Cookie paths "/api", "/api/auth"
- Admin email "admin@docxi.org"
- Pagination limits (50, 20)
- Monaco height 400/500px
- createMcpExpressApp host "0.0.0.0"

## Missing vs Spec

- doc 06: halted_budget depth check, pre-flight gating for act
- doc 09: fence/ungated-act, fence/unpaired-commit, fence/check-without-commit
- doc 03: runtime contract validation parent↔child
- config.json per-script: заявлена в spec, не реализована

## Test Coverage

- Server: 228 tests (good)
- Web: 0 tests (critical gap)
- OAuth E2E: not tested
- run composition E2E: not tested
