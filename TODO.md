# ZS v0.2 — TODO

## Slice 17 — A2: MCP Apps (ext-apps) — inline виджеты в чате

Инлайн-визуализации в потоке чата через стандарт MCP Apps (`ext-apps`).
Рендерятся в iframe, работают в Claude.ai, ChatGPT, VS Code и других хостах.

### 17.1 Серверная интеграция ext-apps SDK ✅
- [x] `@modelcontextprotocol/ext-apps` + React + Vite в server
- [x] `mcp-apps.ts`: registerZsApps() + TOOL_UI_META (декларативная привязка tool→resource)
- [x] Vite per-app build pipeline (vite-plugin-singlefile, ZS_APP env var)
- [x] `packages/server/apps/` — исходники виджетов, `dist-apps/` — собранные HTML
- [x] `build:apps` script в package.json

### 17.2 Виджет: Trace Progress (A2) ✅
- [x] script_ref, status badge, coverage bar, events count, refresh кнопка
- [x] Привязка: `zs_start` → `_meta.ui.resourceUri` → `ui://zs-trace-progress/app.html`
- [x] `ontoolinput` → agent_id + script_ref, `ontoolresult` → invocation_id + status

### 17.3 Виджет: HITL Form (A2) — отложен
- [ ] Делаем в последнюю очередь (зафиксировано)

### 17.4 Виджет: Report (A2) ✅
- [x] label, trust badge (asserted), data preview (JSON, collapsible)
- [x] Привязка: `zs_report` → `ui://zs-report/app.html`

### 17.5 Виджет: Conclude Result (A2) ✅
- [x] status badge, coverage bar (verified/asserted/authority), result JSON tree
- [x] Привязка: `zs_conclude` → `ui://zs-conclude/app.html`

### 17.6 Дополнительные виджеты ✅
- [x] Checkpoint: 🚦 label, data, directive badge (proceed/warn/halt), verified
- [x] Sandbox: ⚙️ fn(), args, result, verified
- [x] Commit: 📋 what/basis/verify/boundaries structured card
- [x] Check: ✅ commit_seq, results, PASS/FAIL
- [x] Retrieve: 📡 query, provenance, trust badge

### 17.7 Ресурсы и маршрутизация ✅
- [x] 8 `ui://` ресурсов зарегистрированы на каждый McpServer instance
- [x] 8 привязок в TOOL_UI_META (start, report, checkpoint, sandbox, commit, check, retrieve, conclude)
- [x] Каждый виджет = single-file HTML (~530KB с React)
- [x] CI: `build:apps` в deploy pipeline

### 17.8 Улучшения виджетов ✅
- [x] Start: JSDoc описание, entry function, serverFunctions
- [x] Report: иконка + цвет операции, параметры из data
- [x] Conclude: donut chart, structured result fields
- [x] _input в tool result: сервер включает input-поля для fallback (ontoolinput не всегда срабатывает)
- [x] tryParse: десериализация stringified data/results
- [x] Авто-генерация .sandbox.d.ts для @sandbox методов (Monaco + tsc)

### 17.9 Тестирование ✅
- [x] tsc clean, 34/34 mcp-tools тесты
- [x] `pnpm run build:apps` — 8 виджетов собираются
- [x] Smoke: claude.ai — start + conclude виджеты работают
- [x] Smoke: прогон test/widget-test через prod MCP — все _input корректны
- [x] `examples/widget-test` в git — деплоится автоматически

---

## Slice 18 — A1: Artifact Pipeline — live дашборд в боковой панели

Постоянный интерактивный дашборд в боковой панели Claude.ai.
Работает автономно после сборки — подключается к ZS-серверу через HTTP/WS.
Использует pipeline из `docs/artifact-pipeline/mcp-artifact-pipeline.md`.

### 18.1 REST API для артефакта ✅
- [x] `/artifact/trace/:id` — полный трейс (live из registry или saved)
- [x] `/artifact/trace/:id/events?since=N` — инкрементальная дозагрузка
- [x] `/artifact/instance/:id` — метаданные инстанса (status, depth, parent)
- [x] `/artifact/instance/:id/children` — дерево дочерних run
- [x] CORS: claude.ai + chatgpt.com в prod, permissive в dev
- [x] Отдельный prefix `/artifact/` — без JWT (token в 18.3)

### 18.2 WebSocket gateway ✅
- [x] `/artifact/ws/trace/:id` → upgrade → WS (JSON фреймы)
- [x] Фреймы: `{ type: "event", data }`, `{ type: "status", data }`
- [x] Pub/sub: EventEmitter, emit после каждого callTool (refactored → #dispatchTool)
- [x] Ping/pong keepalive 30s
- [x] SPA Trace Detail: polling заменён на WebSocket (useTraceWs hook)

### 18.3 Artifact token ✅
- [x] createArtifactToken / verifyArtifactToken — jose HS256, отдельный секрет (base + ":artifact")
- [x] TTL конфигурируемый: `ZS_ARTIFACT_TOKEN_TTL` (default "1h")
- [x] REST middleware: token из ?token= или Bearer header, scope check (invocation_id vs :id)
- [x] WS upgrade: token из ?token= query param
- [x] JWT cookie bypass: SPA-пользователи с zs_token проходят без artifact token
- [x] Shared parseCookieToken utility (убран дубликат из api-routes)
- [x] createArtifactToken экспортирован — готов для zs_dashboard (18.6)

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
