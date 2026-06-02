# ZS v0.2 — Plan to address review findings

Составлен: 2026-06-03. Источник: `reviews/SUMMARY.md` + 8 детальных отчётов.
При закрытии пункта: `- [x]`, коммит ref, дата.

---

## P0 — CRITICAL (перед production)

- [x] **P0-1. Security: Secure flag на cookies** ✅ 2026-06-03
  - Источник: E-17
  - Проблема: JWT cookies без `Secure` — уязвимы при HTTP fallback в production
  - Решение: `Secure` conditional на `NODE_ENV=production`, `SameSite=Strict`
  - Файлы: `api-routes.ts` (setTokenCookies, clearTokenCookies)

- [x] **P0-2. Security: Rate limiting на все auth endpoints** ✅ 2026-06-03
  - Источник: E-19
  - Проблема: Только `/auth/login` защищён. `/auth/refresh`, `/auth/password` открыты для brute-force
  - Решение: `rateLimit` на refresh (10/min), password (5/min). Cleanup interval для Map (prevent OOM)
  - Файлы: `api-routes.ts`

- [x] **P0-3. Security: XSS в OAuth login page** ✅ 2026-06-03
  - Источник: E-16
  - Проблема: URLSearchParams из query без экранирования → XSS через `redirect` параметр
  - Решение: HTML-escape `q.toString()` в inline template
  - Файлы: `oauth.ts` (router.get "/oauth/sign-in")

- [x] **P0-4. Runtime: Max depth check** ✅ 2026-06-03
  - Источник: D-15, H-30
  - Проблема: `run()` может вызывать бесконечно вложенные скрипты, нет depth limit
  - Решение: `ZS_MAX_RUN_DEPTH` env (default 10), проверка в `ZsService.start()` при `depth >= max`
  - Файлы: `protocol/src/service.ts`, `server/src/main.ts`

- [ ] **P0-5. Security: OAuth E2E тест**
  - Источник: E-16, H-35
  - Проблема: OAuth flow (401 → Bearer → 200) не протестирован
  - Решение: Ручная проверка на VPS с `ZS_OAUTH=true` или E2E тест с better-auth roundtrip
  - Effort: 2h

---

## P1 — HIGH (сразу после production)

- [x] **P1-1. Frontend: ErrorBoundary key сбрасывает state** ✅ 2026-06-03
  - Источник: F-24
  - Решение: `key={route.path}` → `resetKey={route.path}`. ErrorBoundary сбрасывает ошибку при навигации через `getDerivedStateFromProps`, но не пересоздаёт дочерние компоненты.
  - Файлы: `error-boundary.tsx`, `app.tsx`

- [x] **P1-2. MCP: EXECUTOR_INSTRUCTION слишком скудна** ✅ 2026-06-03
  - Источник: B-8
  - Решение: Расширено до 7 правил: error handling, fail-closed, Sem handles, checkpoint directives, TTL, roles.
  - Файлы: `instructions.ts`

- [x] **P1-3. MCP: zs_register namespace collision** — BY DESIGN, 2026-06-03
  - Источник: B-7
  - Решение: idempotent-by-name — это reconnect mechanism (агент сохраняет agent_id, роль и invocations при переподключении). Не баг.

- [ ] **P1-4. Deployment: Бэкапы SQLite**
  - Источник: G-28
  - Проблема: Нет бэкапов. Потеря VPS = потеря всех данных (traces, agents, users, OAuth)
  - Решение: cron-бэкап на VPS (ежедневно) → sync в S3 или remote storage
  - Файлы: deploy.yml или отдельный cron на VPS
  - Effort: 4h

- [x] **P1-5. Trust: Coverage metric — final_result_trust** ✅ 2026-06-03
  - Источник: C-10
  - Решение: `final_result_trust: TrustClass | null` в Coverage interface. Берётся из conclude event. Отображается в Trace Detail Coverage Summary.
  - Файлы: `core/src/trace.ts`, `web/src/api/types.ts`, `trace-detail.tsx`, i18n en/ru

- [x] **P1-6. Server: Empty catch blocks** ✅ 2026-06-03
  - Источник: H-33
  - Решение: pino logger пробросён в ZsApp (`opts.logger`, child `{ module: "app" }`). Критичные catch → `this.#log.warn`. Intentional catch (file checks, JWT verify, migrations) — пояснительные комментарии.
  - Файлы: `app.ts`, `api-routes.ts`, `sandbox-worker.ts`

- [x] **P1-7. Security: OAuth seed admin only on first boot** ✅ 2026-06-03
  - Источник: E-16
  - Решение: `seedAdmin()` проверяет `SELECT COUNT(*) FROM user` — создаёт admin только если таблица пуста. Предупреждение в лог при default пароле.
  - Файлы: `oauth.ts`

- [x] **P1-8. Security: Refresh token rotation** ✅ 2026-06-03
  - Источник: E-17
  - Решение: `auth.refresh()` возвращает `{ token, refreshToken }`. Оба cookie перезаписываются через `setTokenCookies`. SPA прозрачно — cookies обновляются сервером.
  - Файлы: `auth.ts`, `api-routes.ts`

---

## P2 — MEDIUM (v0.3 планирование)

- [ ] ⏸️ **P2-1. Architecture: callTool refactor** — ОТЛОЖЕНО (рефакторинг без изменения поведения)
  - Источник: A-2, H-32
  - Файлы: `app.ts`
  - Effort: 4h

- [ ] ⏸️ **P2-2. MCP Guide: расширить паттерны** — ОТЛОЖЕНО (после реальных сценариев)
  - Источник: B-6
  - Файлы: `packages/scaffold/guide/`
  - Effort: 8h

- [x] **P2-3. Validator: Fence rules для commit/check** ✅ 2026-06-03
  - Источник: H-30
  - Решение: 3 fence warnings: `fence/unpaired-commit`, `fence/check-without-commit`, `fence/ungated-act`. Анализ per-function body. 5 тестов.
  - Файлы: `packages/validator/src/fence.ts`, `test/fence.test.ts`

- [x] **P2-4. Runtime: Per-script budgets** ✅ 2026-06-03
  - Источник: D-15
  - Решение: `@budget steps=N iterations=N` в JSDoc `.cog.ts`. Парсинг в loader, merge с defaults в service.start().
  - Файлы: `protocol/src/ports.ts`, `protocol/src/service.ts`, `server/src/loader.ts`

- [x] **P2-5. Core: Shape validation — union support** ✅ 2026-06-03
  - Источник: D-14
  - Решение: `{ kind: "union", members: Shape[] }` — checkShape проверяет хотя бы один member. extract.ts генерирует union вместо fallback unknown. shapeToTypeText поддерживает union. Tuple и рекурсия — отложены (не востребованы). 3 теста.
  - Файлы: `core/src/shape.ts`, `validator/src/extract.ts`, `core/test/shape.test.ts`

- [ ] ⏸️ **P2-6. Frontend: Mobile tabs для Trace Detail** — ОТЛОЖЕНО
  - Источник: F-21, H-30
  - Effort: 4h

- [x] **P2-7. Frontend: Monaco/DiffEditor adaptive height** ✅ 2026-06-03
  - Источник: F-25
  - Решение: `isTallPage` включён для `/scripts/*`, корневой div = flex-col flex-1, editor container = flex:1 minHeight:200, DiffEditor height=100%. Редактор растягивается до футера.
  - Файлы: `app.tsx`, `ui/monaco-editor.tsx`, `pages/script-detail.tsx`

- [x] **P2-8. Deployment: Atomic deploy** ✅ 2026-06-03
  - Источник: G-26
  - Решение: rsync → staging dir, cp .env+data+node_modules, pnpm install в staging, pm2 stop → mv live→old → mv staging→live → pm2 start, rm old. Init .env вынесен в отдельный шаг.
  - Решение: rsync в staging dir → atomic mv → PM2 reload
  - Файлы: `.github/workflows/deploy.yml`
  - Effort: 4h

- [x] **P2-9. Deployment: Schema migrations** ✅ 2026-06-03
  - Источник: G-28
  - Решение: `_schema_version` таблица + `MIGRATIONS[]` массив в db.ts. `migrate()` применяет непримёненные в транзакции. v1 = полная схема. ALTER TABLE try/catch удалён. Идемпотентно на существующих базах. 2 теста.
  - Файлы: `server/src/db.ts`, `server/test/db.test.ts`

- [x] **P2-10. Trust: checkpoint schema_mismatch trust class** ✅ 2026-06-03
  - Источник: C-9
  - Решение: `#recordFail` trust `"verified"` → `"n/a"`. Техническая ошибка формата не влияет на coverage. Retry с правильными данными учтётся как verified.
  - Файлы: `core/src/control.ts`

- [ ] ⏸️ **P2-11. Architecture: config.json per-folder** — ОТЛОЖЕНО → ISSUES.md
  - Источник: A-4
  - Решение пересмотрено: config.json per-folder (пакет скриптов), не per-script. Подробное описание в ISSUES.md.
  - Effort: 4h

- [ ] **P2-12. Protocol: zs_retrieve — agent-side retrieval** → TODO.md срез 13
  - Источник: B-5, H-35
  - Решение пересмотрено: агент выполняет retrieval своими host-tools, сервер фиксирует результат. Trust по provenance (verified/asserted). Не KB интеграция.
  - Effort: 2-3h

---

## P3 — LOW (backlog / tech debt)

- [ ] **P3-1. Frontend: Router state persistence**
  - Источник: F-21
  - Проблема: Tab, filter state теряется при F5
  - Решение: Query params в URL для tab/filter/status
  - Effort: 4h

- [ ] **P3-2. Frontend: Web тесты**
  - Источник: H-35
  - Проблема: 0 тестов на frontend
  - Решение: Vitest + React Testing Library
  - Effort: 16h

- [ ] **P3-3. Frontend: i18n плюрализация**
  - Источник: F-23
  - Проблема: Плюралы кодируются в компонентах
  - Решение: `pluralize(key, count)` + правила per-locale
  - Effort: 4h

- [ ] **P3-4. Frontend: Monaco chunk splitting**
  - Источник: F-22
  - Проблема: ~1.5MB Monaco chunk
  - Решение: React.lazy + `manualChunks`
  - Effort: 2h

- [ ] **P3-5. Server: Type bypasses cleanup**
  - Источник: H-33
  - Проблема: 13 `as never`/`as unknown` кастов
  - Решение: Proper typing где возможно, документировать где нет
  - Effort: 4h

- [ ] **P3-6. Server: Hardcoded values → config**
  - Источник: H-34
  - Проблема: 21 хардкод
  - Решение: Centralized config object с defaults из env
  - Effort: 4h

- [ ] **P3-7. Architecture: validator в runtime**
  - Источник: A-1
  - Проблема: server → validator тащит TypeScript compiler в production
  - Решение: @zobr/compiler промежуточный пакет, lazy-loaded
  - Effort: 8h

- [ ] **P3-8. Core: Trace hierarchy (cause/effect graph)**
  - Источник: H-31
  - Проблема: Trace events — flat array, нет причинно-следственных связей
  - Решение: parent_event_seq в TraceEvent
  - Effort: 8h

- [ ] **P3-9. Trust: @sandbox explicit verified events в трейсе**
  - Источник: C-9
  - Проблема: Проверить видимость @sandbox events в UI
  - Решение: Уже в dispatch.ts — проверить frontend rendering
  - Effort: 1h

- [ ] **P3-10. MCP: Soft-reset invocation**
  - Источник: B-5
  - Проблема: Нет мягкого рестарта
  - Решение: `zs_restart(invocation_id, inputs?)`
  - Effort: 4h

- [ ] **P3-11. Server: SQLite transactions для critical paths**
  - Источник: G-27
  - Проблема: Snapshot + trace save не атомарны
  - Решение: `db.transaction()`
  - Effort: 2h

- [ ] **P3-12. Architecture: Orphaned .srv.ts validation**
  - Источник: A-4
  - Проблема: createScript позволяет .srv.ts без .cog.ts
  - Решение: Валидация в createScript
  - Effort: 30 min

- [ ] **P3-13. Security: store.d.ts integrity check**
  - Источник: E-20
  - Проблема: Подмена store.d.ts отключает type checking
  - Решение: Checksum validation при load
  - Effort: 2h

- [ ] **P3-14. MCP: Store API consolidation**
  - Источник: B-5
  - Проблема: 8 store tools — избыточно
  - Решение: Объединение в меньше tools (breaking change)
  - Effort: 8h

- [ ] **P3-15. Trust: Reporting convention enforcement**
  - Источник: C-11
  - Проблема: Honor system, не enforceable
  - Решение: Post-hoc analysis после conclude
  - Effort: 4h

---

## Счётчики

| Priority | Items | Estimated Effort |
|----------|-------|-----------------|
| P0 CRITICAL | 5 | ~6h |
| P1 HIGH | 8 | ~16h |
| P2 MEDIUM | 12 | ~63h |
| P3 LOW | 15 | ~71h |
| **TOTAL** | **40** | **~156h** |
