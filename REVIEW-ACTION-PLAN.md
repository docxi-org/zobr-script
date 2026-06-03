# ZS v0.2 — Review Action Plan (remaining)

Ревью 2026-06-03. Закрыто 36/40. Осталось 4 (все deferred ⏸️).
Бэкапы, callTool refactor, config.json per-folder — вынесены в ISSUES.md.

---

## P2 — MEDIUM (deferred ⏸️)

- [ ] ⏸️ **P2-2. MCP Guide: расширить паттерны**
  - Источник: B-6
  - Проблема: Только 2 примера (hello, insight). Нет: error handling, HITL, act, deep run, long-running
  - Решение: +5-8 паттернов в guide/08-patterns.md + debugging guide + performance playbook
  - Файлы: `packages/scaffold/guide/`
  - Effort: 8h

- [ ] ⏸️ **P2-6. Frontend: Mobile tabs для Trace Detail**
  - Источник: F-21, H-30
  - Проблема: Split view code/events неудобен на narrow screens
  - Решение: Conditional rendering: split на desktop, tabs на mobile (media query)
  - Файлы: `pages/trace-detail.tsx`
  - Effort: 4h

---

## P3 — LOW (deferred ⏸️)

- [ ] ⏸️ **P3-2. Frontend: Web тесты**
  - Источник: H-35
  - Решение: Vitest + React Testing Library
  - Effort: 16h
