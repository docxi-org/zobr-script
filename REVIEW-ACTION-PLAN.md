# ZS v0.2 — Review Action Plan (remaining items)

Составлен: 2026-06-03. Закрыто 20/40 пунктов (P0 5/5, P1 7/8, P2 8/12).

---

## P1 — HIGH (open)

- [ ] **P1-4. Deployment: Бэкапы SQLite**
  - Источник: G-28
  - Проблема: Нет бэкапов. Потеря VPS = потеря всех данных
  - Решение: cron-бэкап на VPS (ежедневно) → sync в S3 или remote storage
  - Effort: 4h

---

## P2 — MEDIUM (deferred ⏸️)

- [ ] ⏸️ **P2-1. Architecture: callTool refactor** — рефакторинг без изменения поведения
  - Файлы: `app.ts`
  - Effort: 4h

- [ ] ⏸️ **P2-2. MCP Guide: расширить паттерны** — после реальных сценариев
  - Файлы: `packages/scaffold/guide/`
  - Effort: 8h

- [ ] ⏸️ **P2-6. Frontend: Mobile tabs для Trace Detail**
  - Effort: 4h

- [ ] ⏸️ **P2-11. Architecture: config.json per-folder** → ISSUES.md
  - Effort: 4h

---

## P3 — LOW (backlog)

- [ ] **P3-1. Frontend: Router state persistence** — query params для tab/filter (4h)
- [ ] **P3-2. Frontend: Web тесты** — Vitest + React Testing Library (16h)
- [ ] **P3-3. Frontend: i18n плюрализация** — `pluralize(key, count)` (4h)
- [ ] **P3-4. Frontend: Monaco chunk splitting** — React.lazy + manualChunks (2h)
- [ ] **P3-5. Server: Type bypasses cleanup** — 13 `as never`/`as unknown` (4h)
- [ ] **P3-6. Server: Hardcoded values → config** — centralized config (4h)
- [ ] **P3-7. Architecture: validator в runtime** — lazy-loaded compiler (8h)
- [ ] **P3-8. Core: Trace hierarchy (cause/effect)** — parent_event_seq (8h)
- [ ] **P3-9. Trust: @sandbox events в UI** — проверить rendering (1h)
- [ ] **P3-10. MCP: Soft-reset invocation** — `zs_restart` (4h)
- [ ] **P3-11. Server: SQLite transactions** — critical paths (2h)
- [ ] **P3-12. Architecture: Orphaned .srv.ts validation** — createScript check (30min)
- [ ] **P3-13. Security: store.d.ts integrity** — checksum validation (2h)
- [ ] **P3-14. MCP: Store API consolidation** — 8 → fewer tools (8h)
- [ ] **P3-15. Trust: Reporting convention enforcement** — post-hoc analysis (4h)

---

## Итого

| Priority | Open | Deferred | Status |
|----------|------|----------|--------|
| P0 | 0 | 0 | ✅ COMPLETE |
| P1 | 1 | 0 | 1 VPS task |
| P2 | 0 | 4 | ⏸️ deferred |
| P3 | 15 | 0 | backlog |
