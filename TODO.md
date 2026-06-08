# ZS v0.2 — TODO

## Slice 17 — A2: MCP Apps (ext-apps) — inline виджеты в чате ✅

Инлайн-визуализации в потоке чата через стандарт MCP Apps (`ext-apps`).
Рендерятся в iframe, работают в Claude.ai, ChatGPT, VS Code и других хостах.

### 17.1–17.9 — Все выполнены
- 8 inline виджетов: start, report, checkpoint, sandbox, commit, check, retrieve, conclude
- ext-apps SDK + Vite per-app build pipeline
- _input fallback в tool result, tryParse, .sandbox.d.ts авто-генерация
- Smoke tested на claude.ai prod

---

## Slice 18 — Серверная инфраструктура для дашборда ✅ (частично)

REST API, WebSocket, artifact token — реализованы. Используются SPA (Trace Detail)
и будут использоваться fullscreen A2 дашбордом.

### 18.1 REST API `/artifact/*` ✅
### 18.2 WebSocket gateway ✅
### 18.3 Artifact token ✅

### 18.4–18.7 A1 Pipeline — ОТМЕНЁН ❌

**Причина:** CSP sandbox claude.ai (`claudeusercontent.com`) жёстко блокирует
`connect-src` к внешним серверам. Fetch и WebSocket из iframe артефакта к
`zs.docxi.org` невозможен. MCP Apps `_meta.ui.csp.connectDomains` тоже
игнорируется claude.ai (известный баг: Issue #40, #54 в anthropics/claude-ai-mcp).
A1 sidebar дашборд не может получать данные — нежизнеспособен.

**Что сохранено из slice 18:**
- REST API `/artifact/*` — используется SPA Trace Detail
- WebSocket gateway — используется SPA Trace Detail (useTraceWs hook)
- Artifact token — готов, будет использоваться когда CSP починят
- `zs_dashboard` tool (30-й) — реализован, возвращает visualization URLs + token
- GitHub repo `docxi-org/zs-templates` — создан, inject.js + шаблон с debug console

**Что отменено:**
- A1 sidebar dashboard в claude.ai — невозможен из-за CSP
- Dashboard config в ответе zs_start — остаётся, но не используется пока CSP не починят
- Пошаговая инструкция в preamble и ACTION REQUIRED block — не работает

---

## Slice 19 — Full-screen A2 Dashboard (замена A1)

### Концепция

Вместо A1 sidebar (заблокирован CSP) — **fullscreen A2 виджет** на `zs_conclude`.
Ext-apps спецификация поддерживает три display mode: `inline`, `fullscreen`, `pip`.
Виджет объявляет `availableDisplayModes: ["inline", "fullscreen"]` — хост показывает
кнопку expand, пользователь разворачивает дашборд на весь экран.

Данные приходят через MCP (ontoolinput/ontoolresult), не через fetch/WS — CSP не
мешает. Виджет рендерит **полную картину прогона** после завершения скрипта.

### Почему на conclude, а не на start

- На `zs_start` виджет получает только начальные данные (invocation_id, script_ref)
- Промежуточные tool calls (report, checkpoint) создают свои отдельные inline виджеты
- На `zs_conclude` доступны ВСЕ данные: полный trace, events, coverage, result
- Сервер включает полный trace в ответ `zs_conclude` (через `_input`)

### Что виджет получает

Через `ontoolresult` при вызове `zs_conclude`:
```json
{
  "ok": true,
  "status": "done",
  "coverage": { "verified": 3, "asserted": 4, "authority_gates": 0 },
  "trace_ref": "inv_xxx",
  "_input": { "result": { "answer": "...", "score": 0.75 } }
}
```

Проблема: в `ontoolresult` нет полного списка events — только coverage summary
и result. Для полного дашборда нужны все events.

### 19.1 Расширить ответ zs_conclude ✅
- [x] `_trace: { events, script_ref, code_snapshot }` в ответе zs_conclude (app.ts)
- [x] `invocation_id` добавлен в `_input` (http.ts)
- [x] Лимит 200 events

### 19.2–19.4 Виджет trace-dashboard ✅
- [x] `packages/server/apps/trace-dashboard/` — новый React app
- [x] `ui://zs-conclude-dashboard/app.html` resource, TOOL_UI_META переключён
- [x] `availableDisplayModes: ["inline", "fullscreen"]` в capabilities
- [x] Inline: coverage donut, status badge, result fields, expand button
- [x] Fullscreen: header, coverage, result, event timeline (expandable), code panel
- [x] `app.requestDisplayMode()` + `onhostcontextchanged` для переключения
- [x] Build: 540KB single-file, добавлен в `build:apps` и deploy workflow

### 19.5 Серверные изменения ✅
- [x] Объединено с 19.1 — данные уже в ответе zs_conclude

### 19.6 Очистка A1 артефактов ✅
- [x] Dashboard config убран из ответа zs_start (app.ts)
- [x] ACTION REQUIRED block убран (http.ts)
- [x] Dashboard hint убран из START_PREAMBLE (instructions.ts)
- [x] Секция "Live Dashboard" удалена из guide-executor.md
- [x] zs_start description: убран IMPORTANT
- [x] zs_dashboard description: переориентирован на SPA
- [ ] zs-templates repo — оставлен как архив (не влияет)
- [ ] trace-conclude/ app — оставлен (TOOL_UI_META уже не ссылается)

### 19.7 Стиль и UX
- [x] Цвета: trust (verified=#22c55e, asserted=#f59e0b, authority=#3b82f6) — из существующих виджетов
- [x] Иконки операций: emoji set (OP_ICONS)
- [x] Responsive: inline ~480px, fullscreen ~720px centered
- [ ] Dark/light theme через `useHostStyles` — для следующей итерации
- [ ] Анимация перехода inline → fullscreen — зависит от хоста

### 19.8 Тестирование
- [x] tsc clean
- [x] 241 тест зелёный
- [x] build:apps собирает trace-dashboard (540KB)
- [ ] Smoke: claude.ai — conclude → inline виджет
- [ ] Smoke: claude.ai — expand → fullscreen
- [ ] Деплой и прод-тест

---

## Slice 20 — HITL Form виджет (A2)

Отложен из slice 17.3. Делаем после fullscreen dashboard.

- [ ] Форма для `ask_user` — структурированный ввод с choices
- [ ] Привязка: checkpoint с `{ ask }` директивой
- [ ] `app.sendMessage()` → ответ в чат → агент вызывает `zs_ask_record`
- [ ] Free-text и choices (radio buttons / select)

---

## Известные ограничения (не TODO, а контекст)

### CSP sandbox claude.ai
- `claudeusercontent.com` имеет жёсткий `connect-src` whitelist
- Артефакты (A1) не могут делать fetch/WS к внешним серверам
- MCP Apps `_meta.ui.csp.connectDomains` игнорируется claude.ai (Issues #40, #54)
- A2 виджеты работают потому что данные идут через MCP (ontoolresult), не через fetch
- Когда Anthropic починит CSP — A1 pipeline можно будет активировать
  (серверная инфраструктура 18.1-18.3 полностью готова)

### Серверная инфраструктура (готова, ждёт CSP fix)
- REST API `/artifact/*` с token auth
- WebSocket `/artifact/ws/trace/:id` с real-time стримом
- Artifact token (jose HS256, scope check, 1h TTL)
- GitHub repo `docxi-org/zs-templates` с inject.js + шаблоном
- `zs_dashboard` MCP tool (30-й)
