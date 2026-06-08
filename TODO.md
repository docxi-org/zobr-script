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

### 19.1 Расширить ответ zs_conclude — включить trace events
- [ ] В `_input` или в основной ответ `zs_conclude` добавить `events: TraceEvent[]`
- [ ] Включить `code_snapshot` (исходный код скрипта)
- [ ] Включить `script_ref`, `invocation_id`
- [ ] Ограничить размер: последние N events или полный trace если < 100 events
- [ ] Изменения в `app.ts` callTool dispatch для zs_conclude
- [ ] Проверить что виджет получает данные через ontoolresult

### 19.2 Новый conclude-dashboard виджет
- [ ] Новый app в `packages/server/apps/trace-dashboard/`
- [ ] Заменяет текущий `trace-conclude` виджет (или новый resource URI)
- [ ] Привязка: `zs_conclude` → `ui://zs-conclude-dashboard/app.html`
- [ ] `availableDisplayModes: ["inline", "fullscreen"]` в `appCapabilities`
- [ ] React app: `useApp` → `ontoolresult` → рендер полного дашборда

### 19.3 UI дашборда (inline режим — компактный)
- [ ] Заголовок: script_ref, invocation_id, status badge
- [ ] Coverage donut chart (verified / asserted / authority)
- [ ] Result: structured fields с trust-цветами
- [ ] Кнопка "Expand" или хост показывает свою кнопку fullscreen
- [ ] Компактный вид: ~300px высоты, ключевая информация

### 19.4 UI дашборда (fullscreen режим — полный)
- [ ] Всё из inline +
- [ ] Лента событий: полный timeline с expandable rows
  - seq, timestamp, op icon, operation name, trust badge
  - Preview (свёрнуто по умолчанию, раскрывается по клику)
  - Для commit: what/basis/verify/boundaries structured card
  - Для check: commit_seq reference, results, PASS/FAIL
  - Для checkpoint: directive badge (proceed/warn/halt)
  - Для sandbox: fn(), args, result
  - Для report: label, параметры из data
- [ ] Code snapshot: подсветка синтаксиса (highlight.js из CDN — разрешён CSP)
- [ ] Coverage breakdown: verified count, asserted count, authority gates
- [ ] Result panel: JSON tree с раскрытием полей
- [ ] Timeline visualization: вертикальная линия с точками событий
- [ ] Переключатель inline ↔ fullscreen через `app.requestDisplayMode()`

### 19.5 Серверные изменения
- [ ] Обновить TOOL_UI_META: `zs_conclude` → новый resource URI
- [ ] Зарегистрировать новый resource `ui://zs-conclude-dashboard/app.html`
- [ ] В ответ zs_conclude: добавить trace events (через расширение _input или
  отдельное поле в CallToolResult)
- [ ] Возможно: добавить третий content block в tool result с trace JSON
  (первый — основной JSON, второй — ACTION REQUIRED для dashboard если есть,
  третий — trace data для виджета)

### 19.6 Очистка A1 артефактов
- [ ] Убрать dashboard config из ответа zs_start (или оставить для будущего)
- [ ] Убрать ACTION REQUIRED block из tool result zs_start
- [ ] Убрать hint про dashboard из START_PREAMBLE
- [ ] Убрать секцию "Live Dashboard" из guide-executor.md
- [ ] Обновить zs_dashboard tool description (или удалить tool)
- [ ] Решить: оставить zs-templates repo как архив или удалить

### 19.7 Стиль и UX
- [ ] Dark/light theme: `useHostStyles` из ext-apps React SDK
- [ ] Согласованные цвета: trust (verified=#22c55e, asserted=#f59e0b, authority=#3b82f6)
- [ ] Иконки операций: emoji set из текущих виджетов
- [ ] Responsive: inline компактный, fullscreen — полная раскладка
- [ ] Анимация перехода inline → fullscreen

### 19.8 Тестирование
- [ ] tsc clean, build:apps собирает новый виджет
- [ ] Smoke: claude.ai — conclude → inline виджет с coverage + result
- [ ] Smoke: claude.ai — expand → fullscreen с полным timeline
- [ ] Smoke: ChatGPT — проверить что ext-apps fullscreen работает
- [ ] Проверить что данные events корректны и полны
- [ ] Проверить что CDN-ресурсы (highlight.js) загружаются из CSP whitelist

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
