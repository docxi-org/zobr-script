# Компромиссы по шагам

Фиксация технического долга, заглушек и упрощений, сделанных по ходу реализации.
Чекбокс снимается когда пункт закрыт.

---

## Slice 17 — A2 MCP Apps

- [ ] Smoke test виджетов check/sandbox/checkpoint визуально не подтверждён в claude.ai. Данные в `_input` верны (проверено прогоном), рендер в iframe не видели.
- [ ] `tryParse` в http.ts дублирует `tryParseJson` в ZsService. Нормализация `z.unknown()` строк делается в двух местах. Не ломает, но при рефакторинге — убрать одно из двух (B: нормализовать после parse, убрать из service).
- [ ] Build:apps — список виджетов в двух местах (mcp-apps.ts + package.json). При добавлении нового виджета править оба. Решение: build script сканирует папки автоматически.

## Slice 18 — A1 Artifact Pipeline

- [x] `/artifact/*` эндпоинты открыты без авторизации. → Закрыто: artifact token (18.3).
- [x] WebSocket upgrade не проверяет origin. → Закрыто: artifact token в query string (18.3).
- [x] CORS origins hardcoded. → Закрыто: `origin: true` безопасно с artifact token.
- [ ] Import `ws` как named import из CJS — работает на Node 22 + pnpm + tsx, но хрупко. Менять на `import * as ws` если сломается.

## Slice 19 — Fullscreen A2 Dashboard

- [x] Structured cards per operation type (commit, check, checkpoint, report, sandbox, retrieve). → Закрыто: EventDetail компонент с switch по op/realizer.
- [x] Code panel без syntax highlighting. → Закрыто: highlight.js (core + typescript) бандлится через Vite, тема github-dark. +30KB.
- [x] `trace-conclude/` app в APPS массиве и build:apps. → Закрыто: убран из APPS и build:apps. Директория оставлена (не вредит).
- [x] `trace-dashboard.jsx` в корне проекта с захардкоженным token. → Закрыто: удалён.
- [ ] `zs-templates` GitHub repo оставлен как архив. Не влияет на работу, но мёртвый код.
- [x] Dark/light theme. → Закрыто: `useHostStyles` + объект `T` с CSS variables и fallback. Trust-цвета (ZS-семантика) остаются фиксированными.
- [ ] Visual smoke test dashboard виджета в claude.ai не проведён (19.8).
