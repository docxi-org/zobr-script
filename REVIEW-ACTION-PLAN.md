# ZS v0.2 — Review Action Plan (remaining)

Ревью 2026-06-03. Закрыто 35/40. Осталось 5 (1 open + 4 deferred).

---

## P1 — HIGH

- [ ] **P1-4. Deployment: Бэкапы SQLite**
  - Источник: G-28
  - Проблема: Нет бэкапов. Потеря VPS = потеря всех данных (traces, agents, users, OAuth)
  - Решение: cron-бэкап на VPS (ежедневно) → sync в S3 или remote storage
  - Файлы: deploy.yml или отдельный cron на VPS
  - Effort: 4h

---

## P2 — MEDIUM (deferred ⏸️)

- [ ] ⏸️ **P2-1. Architecture: callTool refactor**
  - Источник: A-2, H-32
  - Проблема: God-method с 24 case ветками, store methods дублируются
  - Решение: Extract auth/eviction в отдельные функции, store methods в StoreHandler class
  - Файлы: `app.ts`
  - Effort: 4h

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

- [ ] ⏸️ **P2-11. Architecture: config.json per-folder** → ISSUES.md
  - Источник: A-4
  - Проблема: Заявлена в спеке, не реализована. Reader не читает, runtime не передаёт
  - Решение пересмотрено: config.json per-folder (пакет скриптов), не per-script. Подробное описание в ISSUES.md
  - Файлы: `server/src/reader.ts`, `server/src/srv-runtime.ts`
  - Effort: 4h

---

## P3 — LOW

- [ ] ⏸️ **P3-2. Frontend: Web тесты**
  - Источник: H-35
  - Решение: Vitest + React Testing Library
  - Effort: 16h
