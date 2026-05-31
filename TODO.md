# ZS v0.2 — План реализации 6b-мяса

> Исполняемая спецификация: 13 `it.todo` в `packages/server/test/6b-contract.test.ts`.
> Порядок — вертикальные срезы (от автономного к интеграционному), как в START.md.
> Дисциплина: после каждого шага `pnpm run typecheck && pnpm test` — оба зелёные.

---

## Срез 1 — WorkerSandboxHost (worker_threads)

Цель: исполнять замороженную `@sandbox`-функцию из `*.srv.ts` в воркере.
Порт: `SandboxHost` (`@zobr/core`), реализация: `packages/server/src/worker-host.ts`.

### Подготовка

- [x] **1.1** Решение: `ts.transpileModule()` — нулевая новая зависимость, typescript
  уже есть через @zobr/validator. Транспиляция в loader, host получает JS.

- [x] **1.2** Inline `new Worker(WORKER_SCRIPT, { eval: true })` — CJS worker-скрипт,
  модуль загружается через `vm.createContext` + export-stripping.

### Основная реализация

- [x] **1.3** `WorkerSandboxHost.invoke()` реализован: spawn Worker → workerData →
  vm.runInContext → postMessage результата. Контракт порта соблюдён (never throws).

- [x] **1.4** Таймаут: `setTimeout` + `worker.terminate()` → `sandbox_error("timeout")`.
  OOM → тот же путь через exit code non-zero.

- [x] **1.5** Defense-in-depth: `vm.createContext` с `SANDBOX_GLOBALS` allowlist.
  Нет fetch/require/process/fs/net — ReferenceError в sandbox → sandbox_error.

### Тесты (it.todo → it)

- [x] **1.6** `runs a frozen @sandbox function in a worker and returns ok+value`
- [x] **1.7** `maps a thrown error in the function body to { ok:false, kind:'sandbox_error' }`
- [x] **1.8** `terminates the worker and returns sandbox_error on timeout/OOM (doc 06 B7)`
- [x] **1.9** `denies network/fs at runtime even if validation were bypassed (defense-in-depth)`

---

## Срез 2 — ScriptSourceReader (файловая система)

Цель: читать папку скрипта из библиотеки в `RawScript`, материализовать scaffold.
Интерфейс: `ScriptSourceReader` (`packages/server/src/loader.ts`).

- [x] **2.1** `FsScriptSourceReader` в `packages/server/src/reader.ts`:
  readdir → фильтр по суффиксам → VirtualFile[] с путями `/zs/{filename}`.

- [x] **2.2** `materializeScaffold()` в `packages/server/src/scaffold.ts`:
  `scaffoldFiles` из @zobr/scaffold → запись 6 файлов в libraryRoot.

### Тесты (it.todo → it)

- [x] **2.3** `reads a script folder (*.cog.ts/*.srv.ts) from the library into RawScript`
- [x] **2.4** `materializes the zs.* scaffold into a library folder (doc 09 §8)`

---

## Срез 3 — Вывод Shape/Specs/Capabilities из серверного модуля

Цель: при загрузке скрипта с `*.srv.ts` — извлечь `sandboxSpecs`, `capabilities`,
`concludeShape`, `sandboxOutShapes` через TypeScript-компилятор. Дом: `@zobr/validator`
(там уже подключён ts). Потребитель: `FsScriptLoader`.

- [x] **3.1** `extractSandboxInfo()` в `@zobr/validator/src/extract.ts`: находит
  `@sandbox`-функции по JSDoc, извлекает имена + return-type Shapes.
  Capabilities sandbox-функций = `[]` (корректно: чистые, без Ctx/KB).

- [x] **3.2** `tsTypeToShape()` там же: string, number, boolean, literal unions,
  arrays, объекты с полями, optional. `unknown`/`Sem` → `{ kind: "unknown" }`.

- [x] **3.3** `FsScriptLoader.load()` обрабатывает серверные модули:
  extractSandboxInfo → transpileSrvModule → WorkerSandboxHost + SrvModuleController.
  NotImplemented throw убран.

- [x] **3.4** `WorkerSandboxHost` инстанциируется с транспилированным JS и fnNames.

- [x] **3.5** `SrvModuleController` в `packages/server/src/srv-controller.ts`:
  загрузка модуля через vm, мост Ctx ↔ HandleStore через CtxStoreAdapter,
  `BindableController` + `isBindable()` type guard в protocol.

### Тесты (it.todo → it)

- [x] **3.6** `derives sandboxSpecs/capabilities/shapes from the server module at load`
- [x] **3.7** `instantiates WorkerSandboxHost over the frozen *.srv.ts at start`

---

## Срез 4 — Express + MCP Streamable HTTP (решение: чистый Express, без NestJS)

Цель: HTTP-сервер с MCP Streamable HTTP эндпоинтом, ZsApp как composition root.
Решение NestJS → чистый Express: ZsApp уже composition root, MCP SDK даёт Express app.

### Подготовка

- [x] **4.1** Runtime: `tsx` для dev-запуска .ts напрямую. Build-шаг отложен.

- [x] **4.2** Зависимости: `@modelcontextprotocol/server` 2.0.0-alpha.2,
  `@modelcontextprotocol/node`, `@modelcontextprotocol/express`,
  `@cfworker/json-schema`, `express`. Zod обновлён 3.25 → 4.4.

- [x] **4.3** API SDK изучен по эталону `C:\~AGI\typescript-sdk-1.29.0`:
  `McpServer.registerTool()` + `NodeStreamableHTTPServerTransport` +
  `createMcpExpressApp()`. Streamable HTTP на POST/GET/DELETE `/mcp`.

### Реализация

- [x] **4.4** `main.ts` — точка входа: scaffold → ZsApp → Express → listen.
  `tsx packages/server/src/main.ts` для запуска.

- [x] **4.5** `createZsHttpApp()` в `http.ts` — composition root:
  FsScriptLoader → ZsApp → McpServer → tool registration → Express routes.
  Возвращает `{ app, zsApp, mcpServer }` для расширения REST API.

- [x] **4.6** MCP Streamable HTTP: POST/GET/DELETE `/mcp` с session management,
  `NodeStreamableHTTPServerTransport`, per-session transport map.

- [x] **4.7** Role-guards: `McpTool.role` (`executor` | `architect`),
  `architectMode` config в `createZsHttpApp`, фильтрация tools при регистрации.

### Тесты

- [x] **4.8** `boots an Express app and mounts the MCP Streamable HTTP endpoint`
- [x] **4.9** `registers every MCP_TOOLS entry as an MCP tool with its zod input schema`
- [x] **4.10** `routes a tool call over HTTP into ZsApp.callTool and returns the result`
- [x] **4.11** `provides ZsApp as composition root (loader + registry + service wired)`
- [x] **4.12** `guards architect-only tools by role (doc 08) — executor mode hides them`

### Дополнительно

- [x] Удалены `.js` расширения из всех относительных import/export (moduleResolution: bundler)
- [x] Pino structured logging (http, loader, sandbox, controller, main)
- [x] Типизированные тестовые хелперы (McpResponse, parseToolResult, MCP_PROTOCOL_VERSION)

---

## Срез 5a — Verified-стыки: извлечение Shape из когнитивной части

Цель: закрыть gaps рантайм-валидации на всех verified-стыках (doc 05 §3).
Единый источник правды — `.cog.ts`: типы объявляются в когнитивной части,
серверный модуль их импортирует через `import type`.

### Подготовка

- [x] **5a.1** `extractCogShapes()` в `@zobr/validator/src/extract.ts`:
  AST-walk по `.cog.ts`, извлекает conclude/checkpoint/report shapes.

### Реализация

- [x] **5a.2** `concludeShape`: из type argument `T` в `conclude<T>()`.
- [x] **5a.3** `checkpointShapes` / `reportShapes`: per-label, из типа expression
  второго аргумента. Динамические метки пропускаются.
- [x] **5a.4** Интеграция в `FsScriptLoader.load()`: вызов `extractCogShapes()`
  для всех скриптов, shapes подставляются в LoadedScript.
- [x] **5a.5** `LoadedScript` расширен: `checkpointShapes`, `reportShapes`.
- [x] **5a.6** `ZsService`: передаёт per-label shapes в ControlDriver.
- [x] **5a.7** `ControlDriver.report()` / `checkpoint()` — shapes передаются из ZsService.

### Тесты

- [x] **5a.8** Unit: `extractCogShapes` → `concludeShape` из `conclude<T>()`
- [x] **5a.9** Unit: `extractCogShapes` → `checkpointShapes` per label
- [x] **5a.10** Unit: `extractCogShapes` → `reportShapes` per label
- [x] **5a.11** Integration: `zs_conclude` с невалидным result → `schema_mismatch`
- [x] **5a.12** Integration: `zs_checkpoint` с невалидными data → `schema_mismatch`,
  валидные (включая Sem-поле) → ok
- [x] **5a.13** Integration: `zs_report` с невалидными data → `schema_mismatch`,
  валидные → ok
- [x] **5a.14** Покрыто в 5a.12 и 5a.13 (happy path assertions).

### Мелкие исправления (попутно)

- [x] **5a.15** `clearTimeout` в `WorkerSandboxHost.invoke()` при нормальном завершении.
- [x] **5a.16** try-catch в GET/DELETE хэндлерах http.ts.

### Дополнительно (из обсуждения)

- [x] **5a.17** Fence `fence/duplicate-label`: ошибка при дублировании string-literal
  label для checkpoint/report в одном файле. Уникальный label = однозначный
  трейс + один Shape на label (конфликт shapes невозможен).
- [x] **5a.18** `vitest.config.ts` с `testTimeout: 15_000` — устранены flaky таймауты.

---

## Срез 5b — MCP-операции (все 18 инструментов doc 10)

Все операции реализованы и зарегистрированы в MCP_TOOLS.

- [x] **5b.1** `zs_retrieve` — заглушка (KB not available). Метод + tool.
- [x] **5b.2** `zs_ask_record` — authority event в трейс.
- [x] **5b.3** `zs_act_record` — asserted event с handle + provenance.
- [x] **5b.4** `zs_resume` — suspended/awaiting_user → running.
- [x] **5b.5** Discovery / authoring:
  - [x] `zs_operations` — содержимое cognitive ambient
  - [x] `zs_validate` — validateScript (tsc + fence)
  - [x] `zs_list` — перечисление скриптов в библиотеке
  - [x] `zs_read` — чтение исходника скрипта
  - [x] `zs_create` / `zs_update` — validate-then-save (architect)
  - [x] `zs_delete` — удаление (architect)
  - [x] `zs_authoring_guide` — инструкция архитектора (architect)

### Дополнительно (из отчёта о компромиссах)

- [x] `ScriptLibrary` интерфейс (убран duck-typing на libraryRoot)
- [x] `callTool` switch + единый zod parse (убран if-chain с кастами)
- [x] Тесты: validate (ok + reject), list, create (ok + reject), delete, read
- [x] Язык agent-facing текстов: EN (единый, по решению)

---

## Финализация

- [x] **6.1** `trace_ref` в ConcludeRes = invocation_id (in-memory). Файловая/БД
  персистентность — при появлении REST API для трейсов.

- [x] **6.2** `EXECUTOR_INSTRUCTION` — MCP server instructions при handshake (doc 11a).

- [x] **6.3** `START_PREAMBLE` — краткое эхо дисциплины в ответе `zs_start`.

- [x] **6.4** Пул воркеров: long-lived workers с vm-контекстом, переиспользуются
  через postMessage. Очередь при исчерпании пула, таймаут покрывает ожидание +
  исполнение. `poolSize` конфигурируется (default 4).

- [x] **6.5** E2E тест: start → report → conclude с реальным скриптом из библиотеки
  на диске, проверка trace_ref.

---

## Срез 7 — Class-based srv + SQLite storage + agent registration (doc 12)

Спецификация: `docs/12-storage.md`. Радикальный рефакторинг srv-layer:
class-based серверный модуль, единый worker-runtime, SQLite persistent
storage, agent registration.

### 7.1. SQLite инфраструктура

- [x] **7.1.1** `better-sqlite3` + `@types/better-sqlite3` в `@zobr/server`.
- [x] **7.1.2** `db.ts` — Db/Collection/Notes wrapper. CRUD + equality filter
  через `json_extract` (параметризованный path). Dot-notation. 11 тестов.
- [x] **7.1.3** Инфраструктурные таблицы + InfraStore API:
  `saveTrace`, `getTrace`, `recordInvocation`, `finishInvocation`.
- [x] **7.1.4** `.env`: `ZS_STORE_PATH=./data/store.sqlite`.
- [x] **7.1.5** Тесты: Collection CRUD, Notes put/get/list, dot-notation filter,
  collections() introspection.

### 7.2. Class-based SrvRuntime

- [x] **7.2.1** `ZsScript` base class — в worker vm.createContext.
  `this.db`, `this.config`, `this.invocation`. Lifecycle по override.
- [x] **7.2.2** `SrvRuntime` — worker + class instantiation + method dispatch.
  `Map<invocationId, instance>`, serverFunctions auto-discovery.
- [x] **7.2.3** CommonJS emit: `transpileSrvModule(module: CommonJS)`.
  `sandbox.require` убран (defense-in-depth).
- [x] **7.2.4** Error handling: try/catch → `controller_error`.
- [x] **7.2.5** Timeout test: stuck method → sandbox_error("timeout").
- [x] **7.2.6** Удалён старый код: `WorkerSandboxHost`, `SrvModuleController`,
  `CtxStoreAdapter`, `BindableController`, `isBindable`, `worker-host.ts`,
  `srv-controller.ts`. SANDBOX_GLOBALS перенесён в srv-runtime.ts.
  Все fixtures обновлены на class-based srv. Worker тесты заменены
  на SrvRuntime-based. -298 строк нетто.
- [x] **7.2.7** `FsScriptLoader` создаёт `SrvRuntime` + адаптеры
  (`SrvSandboxAdapter`, `SrvControllerAdapter`). `LoadedScript` расширен
  полями `runtime` и `serverFunctions`.
- [x] **7.2.8** `zs.server.d.ts` переписан: `ZsScript` base class +
  `Db`, `Collection`, `Notes`, `StoreEntry`, `Directive`.
- [x] **7.2.9** 9 тестов SrvRuntime: pure method, db access, config, invocation,
  lifecycle state, checkpoint db write, error, instance isolation.
- [x] **7.2.10** Graceful shutdown (`runtime.shutdown()`: db.close → terminate).

### 7.3. serverFunctions + ambient generation

- [x] **7.3.1** `extractClassInfo()` в `@zobr/validator` — из srv class: public
  method names (без lifecycle), сигнатуры для ambient.
- [x] **7.3.2** `StartRes` → `serverFunctions: string[]`.
- [x] **7.3.3** Ambient auto-generation: public methods класса → `declare function`
  для cognitive environment. Без стрипинга ctx (нет ctx — это `this`).
  Shape → structural type text. Интеграция в validateScript.
- [x] **7.3.4** Тесты: serverFunctions в start response, cog с вызовом srv-метода
  проходит tsc-валидацию. Service-level + validate integration.

### 7.4. Agent registration

- [x] **7.4.1** `zs_register({ name })` → `{ agent_id }`. Zod schema, MCP tool.
  AgentRegistry class + integration into ZsApp.
- [x] **7.4.2** Agent registry: `Map<agentId, { name, activeInvocations }>`.
  agentId — собственный идентификатор сервера, не связан с MCP sessionId.
- [x] **7.4.3** Middleware: все MCP-вызовы (кроме `zs_register`) требуют
  `agent_id`. Нет → reject. Pre-schema validation в callTool.
  MCP inputSchema расширен z.intersection(zAgentId, tool.input).
- [x] **7.4.4** Блокировка: при активном invocation → standalone store writes
  (`zs_store_insert/update/delete/put`) blocked для agent_id. Reads разрешены.
  Tracking: start→addActiveInvocation, conclude→removeActiveInvocation.
  Проверка hasActiveInvocation готова для store tools (7.5).
- [x] **7.4.5** Тесты: register → get agent_id, call without agent_id → reject,
  active invocation tracking. Покрыто в 7.4.1–7.4.4.

### 7.5. Standalone store MCP-инструменты

- [x] **7.5.1** `zs_store_insert`, `zs_store_find`, `zs_store_update`,
  `zs_store_delete`, `zs_store_collections` — typed collections.
  Lockout при активном invocation. Db в ZsApp через dbPath.
- [x] **7.5.2** `zs_store_put`, `zs_store_get`, `zs_store_list` — notes.
  Put lockout при активном invocation.
- [x] **7.5.3** Shape-валидация при записи (если коллекция в store.d.ts).
  Insert: полная проверка. Update: по-полевая проверка patch.
  storeShapes в ZsAppOptions (ручная подача, auto из store.d.ts → 7.6).
- [x] **7.5.4** Тесты: CRUD typed, notes put/get, shape validation,
  collections introspection. Покрыто в 7.5.1–7.5.3.

### 7.6. store.d.ts schema extraction

- [x] **7.6.1** Материализация пустого `store.d.ts` при scaffold.
- [x] **7.6.2** `extractStoreSchema()` в validator — извлечь exported interfaces
  из store.d.ts, конвертировать в Shape per interface name.
- [x] **7.6.3** Тесты. Покрыто в 7.6.1–7.6.2 (scaffold + extractStoreSchema).

### 7.7. Persist трейсов и инстансов

- [x] **7.7.1** InfraStore API: `saveTrace`, `getTrace`, `recordInvocation`,
  `finishInvocation`. Таблицы: zs_traces, zs_instances, zs_invocations.
- [x] **7.7.2** Интеграция: `ZsApp.callTool("zs_conclude")` → `infra.saveTrace()`.
- [x] **7.7.3** Интеграция: `ZsApp.callTool("zs_start")` → `infra.recordInvocation()`,
  `zs_conclude` → `infra.finishInvocation()`.
- [x] **7.7.4** Suspended instances → persist/restore (doc 12 §8.5).
  Snapshot save (InfraStore.saveSnapshot) после каждого state-changing call.
  Delete snapshot при conclude. Instance.snapshot()/restore() в core.
  Автоматический restore при рестарте сервера — отложен (ISSUES.md).
- [x] **7.7.5** Тесты: conclude persists trace, invocation history, snapshot
  save/delete. Покрыто в 7.7.2–7.7.4.

### 7.8. Fence: srv export forms

- [x] **7.8.1** `fence/no-default-fn`: export default non-class → error.
- [x] **7.8.2** `fence/no-reexport`: export { } / export * from → error.
- [x] **7.8.3** Тесты: re-export error, default class allowed.

---

## Срез 8 — Invocation lifecycle: hot/cold, TTL, eviction, restore

Invocation живёт в двух состояниях:
- **Hot**: Instance в памяти, class instance в worker, ready for calls
- **Cold**: snapshot в SQLite, worker/memory освобождены, resume возможен

Переход hot → cold: по TTL, по давлению (LRU), явно (zs_abort).
Переход cold → hot: zs_resume → полный restore из snapshot.

### 8.1. Worker state serialization

- [x] **8.1.1** Worker message `snapshot_state` → сериализация instance properties
  (все own properties кроме db/config/invocation).
  SrvRuntime.snapshotState(invocationId). 2 теста.
- [x] **8.1.2** Worker message `restore_state` → `Object.assign(instance, state)`
  после createInstance. Set/Map reviver. SrvRuntime.restoreState().
- [x] **8.1.3** `SrvRuntime.snapshotState(invocationId)` / `restoreState(invocationId, state)`.
  Реализовано в 8.1.1 + 8.1.2.
- [x] **8.1.4** Полный snapshot: Instance state + worker state → zs_instances.
  snapshotState/restoreState в ScriptRuntime interface.
  ZsService.getRuntimeForInvocation(). #saveSnapshot async.
- [x] **8.1.5** Тесты: snapshot/restore worker state round-trip.
  SrvRuntime: snapshot Set/Map, restore full state. ZsApp: workerState в DB.

### 8.2. TTL и eviction

- [x] **8.2.1** Конфиг: `ZS_INVOCATION_TTL` (default 1h), `ZS_AWAITING_TTL` (default 24h).
- [x] **8.2.2** Eviction: `ZsApp.evictInvocation()` — snapshot full state →
  transition suspended → destroy worker instance → remove from registry →
  clear activeInvocations → cleanup RunCtx. ZsService.cleanup(),
  InvocationRegistry.remove(), AgentRegistry.findAgentByInvocation().
- [x] **8.2.3** TTL checker: sweepExpired() при каждом zs_start.
  Running дольше TTL → evict. Awaiting_user дольше AWAITING_TTL → evict.
  Safe iteration (collect IDs first, then evict).
- [x] **8.2.4** LRU eviction: evictOldestIfNeeded() при zs_start.
  ZS_MAX_ACTIVE_INVOCATIONS (default 100) в .env.
- [x] **8.2.5** Тесты: TTL expiry → evicted, LRU under pressure.
  Покрыто в 8.2.2–8.2.4.

### 8.3. Resume from cold

- [x] **8.3.1** `zs_resume(invocation_id)`: если Instance нет в registry →
  проверить zs_instances → загрузить snapshot → full restore.
- [x] **8.3.2** Full restore: Instance.restore() → loader.load(script_ref) →
  runtime.createInstance → runtime.restoreState → registerRestoredInstance.
  ZsService.registerRestoredInstance(). ZsApp.#restoreFromCold().
- [x] **8.3.3** Тесты: start → checkpoint (counter=2) → evict → resume →
  checkpoint (counter=3 → halt). Full round-trip с worker state.

### 8.4. zs_abort

- [x] **8.4.1** `zs_abort({ invocation_id? })`: invocation_id опционален.
  Есть → сбросить конкретный. Нет → сбросить все active для agent_id.
- [x] **8.4.2** Abort = transition to terminal `aborted` + cleanup
  (destroy worker instance, remove from registry, clear activeInvocations,
  save partial trace, delete snapshot). Uses isTerminal() from core.
- [x] **8.4.3** Zod schema (zAbortReq), MCP tool registration.
- [x] **8.4.4** Тесты: abort specific, abort all, abort clears lockout.

### 8.5. zs_register response enhancement

- [x] **8.5.1** Ответ `zs_register` включает `active_invocations: string[]`.
- [x] **8.5.2** Тест: register → start → register → shows active invocation.

---

## Решения, которые нужно принять до начала кодирования

Зафиксировать здесь после обсуждения:

- [x] **D1** Сборка/запуск ESM → `tsx` (dev-runner, .ts напрямую, без build-шага).
  NestJS отброшен в пользу чистого Express (ZsApp = composition root).
- [x] **D2** Транспиляция `*.srv.ts` → JS для воркера → `ts.transpileModule()` (нулевая
  новая зависимость, typescript уже есть). Транспиляция в loader, host получает JS.
- [x] **D3** Версии: NestJS → не используется. MCP SDK = `@modelcontextprotocol/server`
  2.0.0-alpha.2 + `/node` + `/express`. Zod = 4.4.x.
- [x] **D4** Defense-in-depth в воркере → `vm.createContext` с `SANDBOX_GLOBALS` allowlist.
  Воркер исполняет код в изолированном контексте, опасные API недоступны.
