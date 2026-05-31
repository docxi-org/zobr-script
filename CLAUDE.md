# ZS (Zobr Script) v0.2

Язык когнитивных скриптов как MCP-сервис. Скрипт пишется на подмножестве
TypeScript; операции реализуются разными исполнителями (LLM, сервер, внешние
источники, пользователь), каждый шаг помечается классом доверия
(asserted/verified/authority). Трейс — главный продукт, не ответ.

## Состояние проекта

**Спецификация реализована.** 182 теста, 27 MCP-инструментов, сервер работает.
Срез 7 (class-based srv + SQLite storage + agent registration) завершён — 39/39.

## Документация — что актуально

| Документ | Статус |
|---|---|
| `docs/00-overview.md` | актуален — видение, ось доверия |
| `docs/01-language.md` | актуален — TS-подмножество, cog-часть |
| `docs/02-operations.md` | актуален — словарь когнитивных операций |
| `docs/03-execution.md` | актуален — модель исполнения, инстансы, хэндлы |
| `docs/04-parts-and-controller.md` | **ЧАСТИЧНО УСТАРЕЛ** — контроллер/sandbox → замещается doc 12 (class-based srv) |
| `docs/05-trust-and-control.md` | актуален — verified-стыки, Shape-валидация |
| `docs/06-failure-model.md` | актуален — каталог отказов |
| `docs/07-trace.md` | актуален — трейс как продукт |
| `docs/08-library-and-authoring.md` | актуален — библиотека, роли |
| `docs/09-tooling.md` | **ЧАСТИЧНО УСТАРЕЛ** — ambient generation → doc 12 |
| `docs/10-mcp-interface.md` | **ДОПОЛНЕН** — doc 12 добавляет zs_register, store tools, serverFunctions |
| `docs/11a-executor-runtime.md` | актуален — инструкция исполнителя |
| `docs/11b-authoring-runtime.md` | актуален — инструкция архитектора |
| **`docs/12-storage.md`** | **ГЛАВНЫЙ** — class-based srv, SQLite storage, agent registration, Ctx, worker runtime. Замещает части doc 04, 09, 10 |

**Правило:** при противоречии doc 12 выигрывает у doc 04/09/10.

## Архитектура (как СЕЙЧАС реализовано)

### Пакеты (монорепо, pnpm workspaces)

```
packages/
  core/       — доменное ядро (0 deps): Instance, HandleStore, Trace, Shape, Status
  scaffold/   — каноничные ambient .d.ts + tsconfig шаблоны
  validator/  — tsc-как-библиотека + fence + extractCogShapes + transpileSrvModule
  protocol/   — ZsService, InvocationRegistry, zod-контракты, LoadedScript port
  server/     — Express HTTP, MCP SDK, SrvRuntime, SQLite Db, loader, tools
```

### Серверный модуль (srv.ts) — CLASS-BASED (doc 12)

```ts
// news.srv.ts
export default class NewsScript extends ZsScript {
  private rounds = 0;
  priorAnalyses(topic: string): Analysis[] {
    return this.db.collection<Analysis>("analyses").find({ topic });
  }
  onCheckpoint(label: string, data: unknown): Directive {
    this.db.collection("analyses").insertOne(data);
    this.rounds++;
    return this.rounds >= 3 ? "halt" : "proceed";
  }
}
```

- `this.db` — SQLite persistent storage (own connection в worker)
- `this.config` — per-script config из config.json
- `this.invocation` — { id, scriptRef, depth, parentId }
- Instance properties — per-invocation state (не сериализуется)
- Public methods = callable from cog (serverFunctions)
- Lifecycle: onStart/onCheckpoint/onReport — override

### Когнитивная часть (cog.ts) — функция (без изменений)

```ts
export function analyze(topic: string): Result {
  const prior = priorAnalyses(topic);  // → MCP zs_sandbox → worker
  const fresh = survey(topic, { count: 5 });  // agent cognitive
  checkpoint("save", { topic, summary });  // → MCP → controller
  return conclude<Result>();
}
```

### Единый worker-runtime (SrvRuntime)

Один worker per loaded script. `Map<invocationId, classInstance>` в worker.
CommonJS emit (ts.transpileModule module: CommonJS). vm.createContext + safe
globals. Собственный SQLite connection (WAL mode). Graceful shutdown.
**Заменил:** WorkerSandboxHost + SrvModuleController (удалены).

### Хранилище (SQLite)

- **Typed collections** — zs_documents (collection, _id, data JSON)
- **Notes** — zs_notes (key, type, data JSON)
- **Infra** — zs_traces, zs_instances, zs_invocations
- **Db API** — Collection (insertOne/find/update/delete/count) + Notes (put/get/delete/list)
- Фильтрация: equality match + dot-notation через json_extract (параметризованный path)

### HTTP (Express + MCP SDK)

```
pnpm start → tsx packages/server/src/main.ts
Express app:
  /mcp — MCP Streamable HTTP (POST/GET/DELETE)
  /health — healthcheck
```

- `createZsHttpApp()` — composition root
- `McpServer` (SDK 2.0-alpha.2) — tool registration
- `NodeStreamableHTTPServerTransport` — session management
- 27 MCP tools (6 lifecycle, 2 trace records, 4 discovery, 4 CRUD, 8 store, 1 register, 2 status/resume)

## Стек

- Node 22 LTS, pnpm, ESM
- TypeScript 6, Vitest
- Zod 4.4 (Standard Schema, MCP SDK requirement)
- `@modelcontextprotocol/server` 2.0.0-alpha.2 + `/node` + `/express`
- `better-sqlite3` — SQLite driver
- `pino` + `pino-pretty` — structured logging
- `tsx` — dev runner (no build step)
- `dotenv` — .env config

## Команды

```
pnpm start          # запуск сервера
pnpm dev            # dev-сервер с auto-restart
pnpm test           # vitest run
pnpm run typecheck  # tsc по всем пакетам
start-dev.cmd       # Windows: двойной клик
```

## Конфиг (.env)

```
ZS_HOST=127.0.0.1
ZS_PORT=1978
ZS_LIBRARY=./zs-lib
ZS_STORE_PATH=./data/store.sqlite
ZS_BUDGET_STEPS=1000
ZS_BUDGET_ITERATIONS=100
ZS_INVOCATION_TTL=3600      # seconds, default 1h
ZS_AWAITING_TTL=86400        # seconds, default 24h
LOG_LEVEL=info
```

## Правила работы

Соблюдай `step-announcement-rule.md` — перед каждым шагом: что / на каком
основании / как проверю / границы. После — честный отчёт о компромиссах.

## TODO

Прогресс в `TODO.md`. Срез 7 завершён (39/39).
Открытые компромиссы в `ISSUES.md`.

## ISSUES

Открытые пункты в `ISSUES.md`:
- Worker script как строковая константа (ждёт build step)
- kb.read заглушка (KB убран, заменён на ctx.db)

## Ключевые решения (зафиксированы)

- **Чистый Express** (не NestJS) — ZsApp = composition root
- **Class-based srv** — ZsScript base class, единый worker runtime
- **CommonJS emit** — вместо regex export stripping
- **SQLite** — better-sqlite3, WAL mode, worker own connection
- **Typed collections + Notes** — два слоя хранилища
- **ctx = { db, state→instance props, config, invocation }** — нет ctx.store, нет ctx.kb
- **onStart returns data** — сервер кладёт в HandleStore
- **serverFunctions auto-discovery** — из class prototype public methods
- **Shape-валидация** — conclude, checkpoint, report shapes из cog types
- **fence/duplicate-label** — уникальные checkpoint/report labels
- **fence/no-reexport + no-default-fn** — srv export form enforcement
- **Язык agent-facing текстов: EN** — единый
