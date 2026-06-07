# ZS v0.2 — TODO

## Slice 17 — A2: MCP Apps (ext-apps) — inline виджеты в чате

Инлайн-визуализации в потоке чата через стандарт MCP Apps (`ext-apps`).
Рендерятся в iframe, работают в Claude.ai, ChatGPT, VS Code и других хостах.

### 17.1 Серверная интеграция ext-apps SDK
- [ ] `pnpm add @modelcontextprotocol/ext-apps` в packages/server
- [ ] Utility: `registerAppResource` + `registerAppTool` обёртки для ZS tools
- [ ] Vite build pipeline для MCP App HTML (single-file bundle из React → HTML)
- [ ] Структура: `packages/server/apps/` — исходники UI виджетов

### 17.2 Виджет: Trace Progress (A2)
- [ ] Inline-виджет прогресса прогона: coverage-bar + последние N событий + статус
- [ ] Привязка: `zs_start` возвращает `_meta.ui.resourceUri` → хост рендерит
- [ ] React app: `useApp` → `ontoolresult` → обновление coverage/events
- [ ] `app.callServerTool("zs_status")` для refresh по кнопке
- [ ] Компактный вид: занимает ~200px высоты, не перегружает чат

### 17.3 Виджет: HITL Form (A2)
- [ ] Форма для `ask_user` — структурированный ввод с choices
- [ ] Привязка: checkpoint с `{ ask }` директивой → сервер шлёт notification → UI показывает форму
- [ ] `app.sendMessage({ role: "user", content: [...] })` → ответ идёт в чат → агент вызывает `zs_ask_record`
- [ ] Поддержка: free-text и choices (radio buttons / select)

### 17.4 Виджет: Conclude Result (A2)
- [ ] Структурированный результат `conclude` — JSON-tree + coverage-badge
- [ ] Привязка: `zs_conclude` возвращает `_meta.ui.resourceUri`
- [ ] `ontoolresult` → рендер Result type с подсветкой trust-класса полей
- [ ] Кликабельные поля → раскрытие preview → полное значение

### 17.5 Ресурсы и маршрутизация
- [ ] `ui://zs-trace-progress/app.html` — trace progress виджет
- [ ] `ui://zs-hitl-form/app.html` — HITL form виджет
- [ ] `ui://zs-conclude-result/app.html` — conclude result виджет
- [ ] Каждый ресурс = single-file HTML (Vite + vite-plugin-singlefile)
- [ ] `registerAppResource` для каждого в createMcpServerInstance()

### 17.6 Тестирование
- [ ] Unit: tool возвращает `_meta.ui.resourceUri`
- [ ] Unit: ресурс отдаёт HTML с правильным MIME type
- [ ] Smoke: подключить к Claude.ai → zs_start → виджет рендерится в чате
- [ ] Smoke: HITL → форма появляется → ответ проходит

---

## Slice 18 — A1: Artifact Pipeline — live дашборд в боковой панели

Постоянный интерактивный дашборд в боковой панели Claude.ai.
Работает автономно после сборки — подключается к ZS-серверу через HTTP/WS.
Использует pipeline из `docs/artifact-pipeline/mcp-artifact-pipeline.md`.

### 18.1 Серверные дополнения: REST API для артефакта
- [ ] `GET /api/trace/:id/events?since=:seq` — инкрементальная дозагрузка событий
- [ ] `GET /api/instance/:id` — метаданные инстанса (status, cursor, script_ref, depth, parent)
- [ ] `GET /api/instance/:id/children` — дерево дочерних run
- [ ] CORS: `Access-Control-Allow-Origin: https://claude.ai` (prod), `*` (dev)
- [ ] Эндпоинты доступны без JWT (по artifact token) или с Bearer

### 18.2 WebSocket gateway для реального времени
- [ ] `GET /ws/trace/:id` → upgrade → WS (JSON фреймы)
- [ ] Фреймы: `{ type: "event", data: TraceEvent }`, `{ type: "status", data }`, `{ type: "coverage", data }`
- [ ] Pub/sub: `Trace.append()` → emit → WS gateway broadcast по invocation_id
- [ ] Reconnect: клиент переподключается и дозагружает `?since=lastSeq`
- [ ] Heartbeat / ping-pong для keep-alive

### 18.3 Artifact token
- [ ] `zs_dashboard` tool — возвращает visualization URLs + config с artifact token
- [ ] Token: короткоживущий (1h), привязан к invocation_id + agent_id
- [ ] Сервер валидирует token на REST и WS эндпоинтах
- [ ] Генерация: jose, хранение в памяти (не SQLite — эфемерный)

### 18.4 GitHub-репозиторий шаблонов (zs-templates)
- [ ] Создать репозиторий `docxi-org/zs-templates`
- [ ] `inject.js` — универсальный инжектор (placeholder → config JSON)
- [ ] `templates/trace-dashboard.jsx` — React-шаблон дашборда
- [ ] Использует: React, Tailwind, Recharts, Lucide React, WebSocket API
- [ ] Плейсхолдер: `const CONFIG = "__MCP_CONFIG_PLACEHOLDER__";`

### 18.5 Шаблон дашборда: UI
- [ ] Заголовок: script_ref, invocation_id, status (пульсирует при running), elapsed
- [ ] Coverage-bar: % verified / % asserted / authority gates
- [ ] Лента событий: seq, op, trust badge, realizer, preview (раскрывается)
- [ ] Commit/check: критерии + вердикт
- [ ] Checkpoint: directive badge (proceed/warn/halt/ask)
- [ ] Дерево run: parent → children (кликабельно → переключает ленту)
- [ ] Панель conclude: результат JSON-tree + финальный coverage
- [ ] Состояния: running (лента растёт), awaiting_user, done/halted/errored (замирает)

### 18.6 MCP tool `zs_dashboard`
- [ ] Zod-схема в protocol: `zDashboardReq` (invocation_id)
- [ ] Ответ: `{ ok, visualization: { template, injector }, config: { apiUrl, wsUrl, agentId, invocationId, token } }`
- [ ] Регистрация в MCP_TOOLS
- [ ] Tool description с пошаговой инструкцией для Claude (curl + node + present_files)

### 18.7 Интеграция и тестирование
- [ ] Smoke: zs_start → zs_dashboard → Claude собирает артефакт → дашборд в боковой панели
- [ ] Smoke: исполнение скрипта → WS → дашборд обновляется в реальном времени
- [ ] Smoke: conclude → дашборд показывает результат, лента замирает
- [ ] Fallback: если WS отвалился → REST polling с ?since=lastSeq

---

## Slice 19 — Совместная работа A1 + A2

### 19.1 Сценарий полного прогона
- [ ] zs_start → A1 дашборд в боковой панели
- [ ] Исполнение: события → A1 обновляется через WS
- [ ] HITL: checkpoint { ask } → A2 форма в чате → ответ → A1 отражает
- [ ] Conclude: A2 виджет результата в чате + A1 показывает финальный coverage
- [ ] Документация: `docs/artifact-pipeline/a1-a2-integration.md`

### 19.2 Общий стиль
- [ ] Единые CSS variables для A1 и A2 (trust colors, status colors, fonts)
- [ ] Dark/light theme respect (A2: `useHostStyles`, A1: prefers-color-scheme)
- [ ] Согласованные иконки операций (Lucide set)
