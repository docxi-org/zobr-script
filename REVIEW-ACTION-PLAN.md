# ZS v0.2 — Plan to address review findings

Составлен: 2026-06-03. Источник: `reviews/SUMMARY.md` + 8 детальных отчётов.
При закрытии пункта: `- [x]`, коммит ref, дата.
Закрыто: P0 5/5, P1 7/8, P2 8/12, P3 0/15. Итого 20/40.

---

## P0 — CRITICAL ✅ COMPLETE (5/5)

Все пункты закрыты 2026-06-03.

---

## P1 — HIGH (7/8 closed)

- [ ] **P1-4. Deployment: Бэкапы SQLite**
  - Источник: G-28
  - Проблема: Нет бэкапов. Потеря VPS = потеря всех данных (traces, agents, users, OAuth)
  - Решение: cron-бэкап на VPS (ежедневно) → sync в S3 или remote storage
  - Файлы: deploy.yml или отдельный cron на VPS
  - Effort: 4h

---

## P2 — MEDIUM (8/12 closed, 4 deferred)

- [ ] ⏸️ **P2-1. Architecture: callTool refactor** — ОТЛОЖЕНО (рефакторинг без изменения поведения)
  - Источник: A-2, H-32
  - Проблема: God-method с 24 case ветками, store methods дублируются
  - Решение: Extract auth/eviction в отдельные функции, store methods в StoreHandler class
  - Файлы: `app.ts`
  - Effort: 4h

- [ ] ⏸️ **P2-2. MCP Guide: расширить паттерны** — ОТЛОЖЕНО (после реальных сценариев)
  - Источник: B-6
  - Проблема: Только 2 примера (hello, insight). Нет: error handling, HITL, act, deep run, long-running
  - Решение: +5-8 паттернов в guide/08-patterns.md + debugging guide + performance playbook
  - Файлы: `packages/scaffold/guide/`
  - Effort: 8h

- [ ] ⏸️ **P2-6. Frontend: Mobile tabs для Trace Detail** — ОТЛОЖЕНО
  - Источник: F-21, H-30
  - Проблема: Split view code/events неудобен на narrow screens
  - Решение: Conditional rendering: split на desktop, tabs на mobile (media query)
  - Файлы: `pages/trace-detail.tsx`
  - Effort: 4h

- [ ] ⏸️ **P2-11. Architecture: config.json per-folder** — ОТЛОЖЕНО → ISSUES.md
  - Источник: A-4
  - Проблема: Заявлена в спеке, не реализована. Reader не читает, runtime не передаёт
  - Решение пересмотрено: config.json per-folder (пакет скриптов), не per-script. Подробное описание в ISSUES.md
  - Файлы: `server/src/reader.ts`, `server/src/srv-runtime.ts`
  - Effort: 4h

---

## P3 — LOW (backlog / tech debt, 9/15)

- [x] **P3-1. Frontend: Router state persistence** ✅ 2026-06-03
  - Источник: F-21
  - Решение: `useQueryParam` hook. Script Detail tab, Traces фильтры, Scripts view mode — persist в URL query params.
  - Файлы: `router.ts`, `script-detail.tsx`, `traces.tsx`, `scripts.tsx`

- [ ] ⏸️ **P3-2. Frontend: Web тесты** — ОТЛОЖЕНО (16h, нужны mock для API/Monaco)
  - Источник: H-35
  - Решение: Vitest + React Testing Library
  - Effort: 16h

- [x] **P3-3. Frontend: i18n плюрализация** ✅ 2026-06-03
  - Источник: F-23
  - Решение: `usePlural` hook, `pluralIndex` (en 2 формы, ru 3 формы). Pipe-separated plural keys. Applied: Scripts, Agents, ValidationBar.
  - Файлы: `i18n/context.tsx`, `en.ts`, `ru.ts`, `scripts.tsx`, `agents.tsx`, `script-detail.tsx`

- [x] **P3-4. Frontend: Monaco chunk splitting** ✅ 2026-06-03
  - Источник: F-22
  - Решение: `React.lazy` для ScriptDetailPage/NewScript + `Suspense`. `manualChunks` выделяет Monaco в отдельный chunk. Main bundle 300KB (было ~1.8MB).
  - Файлы: `app.tsx`, `vite.config.ts`

- [x] **P3-5. Server: Type bypasses cleanup** ✅ 2026-06-03
  - Источник: H-33
  - Решение: 13 → 7 кастов (better-auth удалён). Оставшиеся обоснованы: Zod type erasure, SDK Transport mismatch, JSON.parse. Zero `as any`.

- [x] **P3-6. Server: Hardcoded values → config** ✅ 2026-06-03
  - Источник: H-34
  - Решение: `config.ts` — centralized config с env defaults. Подключён в main.ts, api-routes.ts, auth.ts, oauth.ts.
  - Файлы: `config.ts` (new), `main.ts`, `api-routes.ts`, `auth.ts`, `oauth.ts`

- [x] **P3-7. Architecture: validator в runtime** — НЕ НУЖНО
  - Источник: A-1
  - Решение: 20MB TypeScript compiler не проблема на VPS + PM2. Загружается лениво при первом validate. Актуально только для serverless/edge — не наш случай.

- [x] **P3-8. Core: Trace hierarchy (cause/effect graph)** → ISSUES.md
  - Источник: H-31
  - Решение: подробный дизайн с parent_seq, tree view, coverage по поддеревьям вынесен в ISSUES.md. Реализация при появлении сложных скриптов с ветвлениями.

- [x] **P3-9. Trust: @sandbox explicit verified events в трейсе** ✅ 2026-06-03
  - Источник: C-9
  - Решение: Проверено: dispatch.ts записывает sandbox events с `realizer: "sandbox"`, `trust: "verified"`. Frontend рендерит через TrustBadge (green) + realizer text. Нет фильтрации — всё видно. Тестовых скриптов с sandbox нет (визуально не проверено).

- [x] **P3-10. MCP: Soft-reset invocation** — НЕ НУЖНО
  - Источник: B-5
  - Решение: abort + start покрывает сценарий. Старый trace полезен для диагностики.

- [x] **P3-11. Server: SQLite transactions для critical paths** ✅ 2026-06-03
  - Источник: G-27
  - Решение: `db.transaction()` обёртка в Db interface. Conclude и abort атомарны: saveTrace + finishInvocation + deleteSnapshot в одной транзакции.
  - Файлы: `db.ts`, `app.ts`

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

| Priority | Done | Total | Remaining Effort |
|----------|------|-------|-----------------|
| P0 CRITICAL | 5 | 5 | — |
| P1 HIGH | 7 | 8 | ~4h |
| P2 MEDIUM | 8 | 12 | ~20h (deferred) |
| P3 LOW | 9 | 15 | ~37h |
| **TOTAL** | **29** | **40** | **~61h** |

Дополнительно реализовано за рамками плана:
- SDK миграция 2.0-alpha.2 → 1.29.0 (per-session McpServer, StreamableHTTPServerTransport)
- OAuth переписан: better-auth → SDK OAuthServerProvider + mcpAuthRouter + login form в стиле сайта
- pino logger в ZsApp
- zs_retrieve — agent-side retrieval (срез 13 в TODO.md)
