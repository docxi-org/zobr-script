# Компромиссы по шагам

Фиксация технического долга, заглушек и упрощений, сделанных по ходу реализации.
Чекбокс снимается когда пункт закрыт.

---

## Slice 17 — A2 MCP Apps

- [ ] Smoke test виджетов check/sandbox/checkpoint визуально не подтверждён в claude.ai. Данные в `_input` верны (проверено прогоном), рендер в iframe не видели.
- [ ] `tryParse` в http.ts дублирует `tryParseJson` в ZsService. Нормализация `z.unknown()` строк делается в двух местах. Не ломает, но при рефакторинге — убрать одно из двух (B: нормализовать после parse, убрать из service).
- [ ] Build:apps — список виджетов в двух местах (mcp-apps.ts + package.json). При добавлении нового виджета править оба. Решение: build script сканирует папки автоматически.

## Slice 18 — A1 Artifact Pipeline

- [ ] `/artifact/*` эндпоинты открыты без авторизации. Закроется artifact token'ом (18.3).
- [ ] WebSocket upgrade не проверяет origin. Закроется artifact token'ом (18.3) — token в query string.
- [ ] CORS origins hardcoded (`claude.ai`, `chatgpt.com`). Пересмотреть после 18.3 — с token'ом можно ставить `*` или env-переменную. Зафиксировано в ISSUES.md.
- [ ] Import `ws` как named import из CJS — работает на Node 22 + pnpm + tsx, но хрупко. Менять на `import * as ws` если сломается.
