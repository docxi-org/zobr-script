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

- [ ] **P2-1. Architecture: callTool refactor**
  - Источник: A-2, H-32
  - Проблема: God-method с 24 case ветками, store methods дублируются
  - Решение: Extract auth/eviction в отдельные функции, store methods в StoreHandler class
  - Файлы: `app.ts`
  - Effort: 4h

- [ ] **P2-2. MCP Guide: расширить паттерны**
  - Источник: B-6
  - Проблема: Только 2 примера (hello, insight). Нет: error handling, HITL, act, deep run, long-running
  - Решение: +5-8 паттернов в guide/08-patterns.md + debugging guide + performance playbook
  - Файлы: `packages/scaffold/guide/`
  - Effort: 8h

- [ ] **P2-3. Validator: Fence rules для commit/check**
  - Источник: H-30
  - Проблема: commit без парного check, check без commit, act без checkpoint — не детектируются
  - Решение: 3 fence warnings: `fence/unpaired-commit`, `fence/check-without-commit`, `fence/ungated-act`
  - Файлы: `packages/validator/src/fence.ts`
  - Effort: 4h

- [ ] **P2-4. Runtime: Per-script budgets**
  - Источник: D-15
  - Проблема: Budgets глобальные (env). Дорогой скрипт не может получить больше ресурсов
  - Решение: JSDoc comment `@budget steps=5000` или `script.json` metadata + StartReq override
  - Файлы: `protocol/src/service.ts`, `server/src/loader.ts`
  - Effort: 4h

- [ ] **P2-5. Core: Shape validation — discriminated unions, tuples**
  - Источник: D-14
  - Проблема: Сложные типы fallback на `unknown` → валидация отключена
  - Решение: Расширить Shape type: `{ kind: "union", members: Shape[] }`, `{ kind: "tuple", elements: Shape[] }`
  - Файлы: `core/src/shape.ts`, `validator/src/extract.ts`
  - Effort: 8h

- [ ] **P2-6. Frontend: Mobile tabs для Trace Detail**
  - Источник: F-21, H-30
  - Проблема: Split view code/events неудобен на narrow screens
  - Решение: Conditional rendering: split на desktop, tabs на mobile (media query)
  - Файлы: `pages/trace-detail.tsx`
  - Effort: 4h

- [ ] **P2-7. Frontend: Monaco/DiffEditor adaptive height**
  - Источник: F-25
  - Проблема: Фиксированные 400/500px
  - Решение: flex-based layout с `height: 100%` в grid-контейнере
  - Файлы: `pages/script-detail.tsx`, `ui/monaco-editor.tsx`
  - Effort: 2h

- [ ] **P2-8. Deployment: Atomic deploy**
  - Источник: G-26
  - Проблема: rsync с --delete не атомарен
  - Решение: rsync в staging dir → atomic mv → PM2 reload
  - Файлы: `.github/workflows/deploy.yml`
  - Effort: 4h

- [ ] **P2-9. Deployment: Schema migrations**
  - Источник: G-28
  - Проблема: CREATE TABLE IF NOT EXISTS + ALTER TABLE в try/catch. Нет версионирования
  - Решение: `_schema_version` таблица, numbered migration files, apply-on-start
  - Файлы: `server/src/db.ts` + `migrations/`
  - Effort: 4h

- [ ] **P2-10. Trust: checkpoint schema_mismatch trust class**
  - Источник: C-9
  - Проблема: Checkpoint fail записывается как trust=verified, хотя данные отвергнуты
  - Решение: Отдельный trust class для fail events или trust=asserted для rejected data
  - Файлы: `core/src/control.ts`
  - Effort: 1h

- [ ] **P2-11. Architecture: config.json per-script**
  - Источник: A-4
  - Проблема: Заявлена в спеке, не реализована. Reader не читает, runtime не передаёт
  - Решение: reader.ts: загрузка config.json рядом со скриптом → передача в worker
  - Файлы: `server/src/reader.ts`, `server/src/srv-runtime.ts`
  - Effort: 4h

- [ ] **P2-12. Protocol: zs_retrieve stub**
  - Источник: B-5, H-35
  - Проблема: Полностью stub, возвращает "not_implemented"
  - Решение: Интеграция с KB или минимальный file-based retrieval
  - Effort: 16h+

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
