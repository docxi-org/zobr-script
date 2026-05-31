# ZS (Zobr Script) v0.2

Язык когнитивных скриптов как MCP-сервис. Скрипт пишется на подмножестве
TypeScript; операции реализуются разными исполнителями (LLM, сервер, внешние
источники, пользователь), каждый шаг помечается классом доверия
(asserted/verified/authority). Трейс — главный продукт, не ответ.

## Состояние проекта

**Реализовано и задеплоено.** 193 теста, 28 MCP tools, typecheck clean.
Срезы 1–8 завершены. Production: `https://zs.docxi.org/mcp`.

## Документация

Спецификация: `spec/` (в .gitignore, не в репо).
UI спека: `spec/ui/` (для дизайнера).

| Документ | Статус |
|---|---|
| `spec/00-overview.md` | актуален — видение, ось доверия |
| `spec/01-language.md` | актуален — TS-подмножество, cog-часть |
| `spec/02-operations.md` | актуален — словарь когнитивных операций |
| `spec/03-execution.md` | актуален — модель исполнения, инстансы, хэндлы |
| `spec/04-parts-and-controller.md` | **ЧАСТИЧНО УСТАРЕЛ** — замещается doc 12 (class-based srv) |
| `spec/05-trust-and-control.md` | актуален — verified-стыки, Shape-валидация |
| `spec/06-failure-model.md` | актуален — каталог отказов |
| `spec/07-trace.md` | актуален — трейс как продукт |
| `spec/08-library-and-authoring.md` | актуален — библиотека, роли |
| `spec/09-tooling.md` | **ЧАСТИЧНО УСТАРЕЛ** — ambient generation → doc 12 |
| `spec/10-mcp-interface.md` | **ДОПОЛНЕН** — doc 12 добавляет zs_register, store tools, abort |
| `spec/11a-executor-runtime.md` | актуален — инструкция исполнителя |
| `spec/11b-authoring-runtime.md` | актуален — инструкция архитектора |
| **`spec/12-storage.md`** | **ГЛАВНЫЙ** — class-based srv, SQLite, agent registration, worker runtime |
| `spec/ui/00-overview.md` | UI спека: стек, страницы, авторизация, дизайн-направление |
| `spec/ui/01-wireframes.md` | ASCII wireframes всех экранов |
| `spec/ui/02-api.md` | REST API для фронтенда |

**Правило:** при противоречии doc 12 выигрывает у doc 04/09/10.

## Архитектура (как СЕЙЧАС реализовано)

### Пакеты (монорепо, pnpm workspaces)

```
packages/
  core/       — доменное ядро (0 deps): Instance, HandleStore, Trace, Shape, Status
  scaffold/   — каноничные ambient .d.ts + tsconfig шаблоны + store.d.ts
  validator/  — tsc-как-библиотека + fence + extractCogShapes + extractClassInfo + extractStoreSchema
  protocol/   — ZsService, InvocationRegistry, zod-контракты, LoadedScript port
  server/     — Express HTTP, MCP SDK, SrvRuntime, SQLite Db, AgentRegistry, tools
```

### Серверный модуль (srv.ts) — CLASS-BASED (doc 12)

```ts
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
- Instance properties — per-invocation state (serializable via snapshot)
- Public methods = callable from cog (serverFunctions)
- Lifecycle: onStart/onCheckpoint/onReport — override

### Worker runtime (SrvRuntime)

Один worker per loaded script. `sandbox-worker.ts` — нормальный TypeScript,
транспилируется в CJS при загрузке модуля. vm.createContext + safe globals.
Собственный SQLite connection (WAL mode). Set/Map serialization с type tags.
`snapshotState()` / `restoreState()` для hot/cold lifecycle.

### Hot/Cold Invocation Lifecycle

- **Hot**: Instance в памяти, class instance в worker, ready for calls
- **Cold**: snapshot в SQLite, worker/memory освобождены, resume возможен
- **TTL eviction**: `sweepExpired()` при zs_start и zs_register
- **LRU eviction**: `evictOldestIfNeeded()` при превышении maxActiveInvocations
- **Resume**: `zs_resume` → полный restore из snapshot (Instance + worker state)
- **Abort**: `zs_abort` → terminal aborted + partial trace + cleanup

### Хранилище (SQLite)

- **Typed collections** — zs_documents (collection, _id, data JSON)
- **Notes** — zs_notes (key, type, data JSON)
- **Infra** — zs_traces, zs_instances, zs_invocations, zs_agents
- Фильтрация: equality match + dot-notation через json_extract

### Agent Registration

- Persistent в SQLite (таблица zs_agents), idempotent by name
- `zs_register({ name })` → `{ agent_id, active_invocations }`
- agent_id обязателен на всех вызовах (кроме zs_register)
- Store write lockout при активном invocation

### HTTP (Express + MCP SDK)

```
Express app:
  /mcp    — MCP Streamable HTTP (POST/GET/DELETE)
  /health — healthcheck
```

- `createMcpExpressApp({ host: "0.0.0.0" })` — DNS rebinding off для remote
- `McpServer` (SDK 2.0-alpha.2) — tool registration
- 28 MCP tools: 6 lifecycle + 2 trace records + 4 discovery + 4 CRUD +
  8 store + 1 register + 1 abort + 2 status/resume

### Deployment

- **Production**: `https://zs.docxi.org/mcp`
- **VPS**: `/opt/zobr-script`, PM2 `zobr-script`, порт 1978
- **CI/CD**: GitHub Actions → rsync → pnpm install → PM2 reload → health check
- **SSL**: Let's Encrypt (certbot, auto-renew)
- **Nginx**: reverse proxy, IP-bound listen (ISPmanager compatible)

## Стек

- Node 22 LTS, pnpm, ESM
- TypeScript 6, Vitest
- Zod 4 (Standard Schema, MCP SDK requirement)
- `@modelcontextprotocol/server` 2.0.0-alpha.2 + `/node` + `/express`
- `better-sqlite3` — SQLite driver (WAL mode)
- `pino` + `pino-pretty` — structured logging
- `tsx` — dev runner (no build step)
- `dotenv` — .env config

## Команды

```
pnpm start          # запуск сервера
pnpm dev            # dev-сервер с auto-restart
pnpm test           # vitest run (193 tests)
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
ZS_INVOCATION_TTL=3600          # seconds, default 1h
ZS_AWAITING_TTL=86400           # seconds, default 24h
ZS_MAX_ACTIVE_INVOCATIONS=100
ZS_ARCHITECT_MODE=true          # enables create/update/delete/authoring_guide tools
LOG_LEVEL=info
```

## Правила работы

Соблюдай `step-announcement-rule.md` — перед каждым шагом: что / на каком
основании / как проверю / границы. После — честный отчёт о компромиссах.

## TODO / ISSUES

- `TODO.md` — срезы 1–8 завершены. Срез 8: hot/cold lifecycle, TTL, eviction, restore, abort.
- `ISSUES.md` — открытые: callTool god-method (порог 40+), run composition (3 пункта), act gating, commit/check enforcement.

## Ключевые решения

- **Чистый Express** (не NestJS) — ZsApp = composition root
- **Class-based srv** — ZsScript base class, единый worker runtime
- **sandbox-worker.ts** — нормальный TypeScript, transpile при загрузке (не строковая константа)
- **SQLite** — better-sqlite3, WAL mode, worker own connection
- **Typed collections + Notes** — два слоя хранилища
- **Agent registration persistent** — idempotent by name, SQLite backed
- **Hot/cold lifecycle** — TTL/LRU eviction, full snapshot/restore (Instance + worker state + Set/Map)
- **Shape-валидация** — conclude, checkpoint, report shapes из cog types
- **Ambient auto-generation** — srv class public methods → declare function для cog env
- **store.d.ts auto-extraction** — extractStoreSchema → storeShapes в ZsApp
- **Evicted invocation detection** — error kind "evicted" с hint "call zs_resume"
- **lastActivityAt** — TTL/LRU по времени последней активности, не создания
- **Язык agent-facing текстов: EN** — единый
