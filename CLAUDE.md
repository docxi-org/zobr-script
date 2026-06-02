# ZS (Zobr Script) v0.2

Язык когнитивных скриптов как MCP-сервис. Скрипт пишется на подмножестве
TypeScript; операции реализуются разными исполнителями (LLM, сервер, внешние
источники, пользователь), каждый шаг помечается классом доверия
(asserted/verified/authority). Трейс — главный продукт, не ответ.

## Состояние проекта

**Реализовано.** 228 тестов, 27 MCP tools, typecheck clean.
Срезы 1–10 завершены (бэкенд + фронтенд + REST API + i18n + unified guide + per-agent roles).
Production: `https://zs.docxi.org/mcp` (MCP) + SPA на том же домене.
Deploy: GitHub Actions → build frontend → rsync → PM2 reload.

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
| `spec/08-library-and-authoring.md` | **УСТАРЕЛ** — файловая модель заменила папочную (см. 9.7) |
| `spec/09-tooling.md` | **ЧАСТИЧНО УСТАРЕЛ** — ambient generation → doc 12 |
| `spec/10-mcp-interface.md` | **ДОПОЛНЕН** — doc 12 добавляет zs_register, store tools, abort |
| `spec/11a-executor-runtime.md` | **ЗАМЕНЁН** — контент в unified guide (packages/scaffold/guide/) |
| `spec/11b-authoring-runtime.md` | **ЗАМЕНЁН** — контент в unified guide |
| **`spec/13-unified-guide.md`** | **НОВЫЙ** — unified guide, per-agent roles, coverage trust-by-content |
| **`spec/12-storage.md`** | **ГЛАВНЫЙ** — class-based srv, SQLite, agent registration, worker runtime |
| `spec/ui/00-overview.md` | UI спека: стек, страницы, авторизация, дизайн-направление |
| `spec/ui/01-wireframes.md` | ASCII wireframes всех экранов |
| `spec/ui/02-api.md` | REST API для фронтенда |
| `spec/ui/03-scripts-tree.md` | Задание дизайнеру: древовидная структура Scripts |

**Правило:** при противоречии doc 12 выигрывает у doc 04/09/10.

## Архитектура (как СЕЙЧАС реализовано)

### Пакеты (монорепо, pnpm workspaces)

```
packages/
  core/       — доменное ядро (0 deps): Instance, HandleStore, Trace, Shape, Status
  scaffold/   — каноничные ambient .d.ts + tsconfig шаблоны + store.d.ts
  validator/  — tsc-как-библиотека + fence + extractCogShapes + extractClassInfo + extractStoreSchema
  protocol/   — ZsService, InvocationRegistry, zod-контракты, LoadedScript port
  server/     — Express HTTP, MCP SDK, SrvRuntime, SQLite Db, AgentRegistry, REST API, Auth
  web/        — React 19 SPA: Vite 8, Tailwind CSS 4, Monaco Editor, i18n (en/ru)
```

### Frontend SPA (packages/web)

React 19 + Vite 8 + Tailwind CSS 4. Кастомные UI компоненты (не shadcn).

**13 страниц:** Login, Dashboard, Traces, Trace Detail (split code/events),
Scripts (Tree/Cards/Table), Script Detail (Monaco Editor + Contract + Runs), New Script (folder picker),
Store (Collections + Notes), Agents, Agent Detail, Settings, Users, Help (12 статей, 4 категории).

**UI features:**
- Дизайн-токены из прототипа (`ui/`): dark/light themes, 4 accent colors, 2 density modes, 3 font families
- Monaco Editor с ZS autocomplete (8 когнитивных операций) + ambient .d.ts от сервера + inline validation markers
- TypeScript syntax highlighter для Trace Detail code panel
- Command Palette (Cmd+K) — поиск по документации
- Tweaks panel в header (theme, accent, density, font, language)
- Hash router, auth gate, role-based access (admin/architect/executor)
- Error boundary — ошибка на странице не роняет приложение
- Sortable columns во всех DataTables
- Tree view для библиотеки скриптов с collapse/expand, folder picker в New Script

**i18n (мультиязычность):**
- `src/i18n/` — I18nProvider + useT() hook + useLocale()
- `en.ts` / `ru.ts` — ~180 UI строк каждый, полное покрытие
- Help docs: `public/docs/en/` и `public/docs/ru/` — 12 статей на каждом языке
- Переключение: Settings + Tweaks panel. Автодетект по navigator.language. Persist в localStorage.

**API client:** fetch wrapper с JWT auto-refresh при 401. Все страницы подключены к REST API, mock данных нет.

### REST API (/api/*)

JWT auth (jose), role-based middleware, rate limiting на login (10 req/min per IP).

```
Auth:     POST /api/auth/login, POST /api/auth/refresh, GET /api/auth/me
Users:    GET/POST/PUT/DELETE /api/users (admin)
Status:   GET /api/status (scripts count, agents, invocations, config, uptime)
Traces:   GET /api/traces (SQL LIMIT/OFFSET, filtered), GET /api/traces/:id (with code_snapshot)
Scripts:  GET /api/scripts (with description, runs, last_run),
          GET /api/scripts/* (wildcard, with shapes from extractCogShapes),
          POST /api/scripts, PUT/DELETE /api/scripts/*,
          POST /api/scripts/*/validate
Store:    GET /api/store/collections, GET /api/store/collections/:name, GET /api/store/notes
Agents:   GET /api/agents (with total_runs), GET /api/agents/:id (with history)
Invoc:    GET /api/invocations
Ambients: GET /api/ambients (cognitive + server .d.ts for Monaco)
```

28 API тестов (supertest): auth, CRUD, role-based access, user management.
Seed admin: `admin@docxi.org` / пароль из `ZS_ADMIN_PASSWORD` (default: `admin`).

### Библиотека скриптов — файловая модель (9.7)

Скрипт = файл, не папка. `script_ref` = путь от корня до base name без расширения.

```
zs-lib/
  examples/
    hello.cog.ts                 → script_ref = "examples/hello"
    insight.cog.ts               → script_ref = "examples/insight"
    insight.srv.ts               → парный серверный модуль
  zs.cognitive.d.ts              → scaffold (автогенерация при старте)
  zs.server.d.ts
  tsconfig*.json
  store.d.ts                     → опциональная schema (не перезаписывается)
```

- `.cog.ts` = когнитивная часть (обязательна), `.srv.ts` = серверный модуль (опционален)
- Паринг по имени: `insight.cog.ts` + `insight.srv.ts`
- Папки — чистая группировка, любая вложенность, любое количество скриптов
- Описание из первого JSDoc комментария (`/** ... */`)

### Трейс — события

Каждый вызов записывает в трейс упорядоченный поток событий:

```
start → report(survey) → report(doubt) → checkpoint → conclude → status_transition(done)
```

Явные ops: `start` (при создании Instance), `conclude` (перед done transition).

### Серверный модуль (srv.ts) — CLASS-BASED (doc 12)

```ts
export default class InsightScript extends ZsScript {
  onCheckpoint(label: string, data: unknown): Directive {
    this.db.collection("analyses").insertOne(data);
    return "proceed";
  }
}
```

- `this.db` — SQLite persistent storage (own connection в worker)
- `this.invocation` — { id, scriptRef, depth, parentId }
- Public methods = callable from cog (serverFunctions)
- Lifecycle: onStart/onCheckpoint/onReport/onConclude — override

### Hot/Cold Invocation Lifecycle

- **Hot**: Instance в памяти, class instance в worker, ready for calls
- **Cold**: snapshot в SQLite, worker/memory освобождены, resume возможен
- **TTL eviction**: `sweepExpired()` при zs_start и zs_register
- **LRU eviction**: `evictOldestIfNeeded()` при превышении maxActiveInvocations
- **Resume**: `zs_resume` → полный restore из snapshot (Instance + worker state)
- **Abort**: `zs_abort` → terminal aborted + partial trace + cleanup

### HTTP (Express + MCP SDK)

```
Express app:
  /mcp        — MCP Streamable HTTP (POST/GET/DELETE)
  /api/*      — REST API для фронтенда (JWT auth)
  /health     — healthcheck
```

27 MCP tools: 6 lifecycle + 2 trace records + 3 discovery + 4 CRUD +
8 store + 1 register + 1 abort + 1 guide + 1 retrieve

### Deployment

- **Production MCP**: `https://zs.docxi.org/mcp`
- **VPS**: `/opt/zobr-script`, PM2 `zobr-script`, порт 1978
- **CI/CD**: GitHub Actions → rsync → pnpm install → PM2 reload → health check
- **Frontend**: пока локально (`start-ui.cmd`, порт 1980). Deploy: 9.4

## Стек

- Node 22 LTS, pnpm, ESM
- TypeScript 6, Vitest
- Zod 4 (Standard Schema, MCP SDK requirement)
- `@modelcontextprotocol/server` 2.0.0-alpha.2 + `/node` + `/express`
- `better-sqlite3` — SQLite driver (WAL mode)
- `jose` — JWT signing/verification
- `supertest` — API tests
- `pino` + `pino-pretty` — structured logging
- `tsx` — dev runner (no build step)
- `dotenv` — .env config
- React 19, Vite 8, Tailwind CSS 4, `@monaco-editor/react`, `monaco-editor`

## Команды

```
pnpm start          # запуск сервера
pnpm dev            # dev-сервер с auto-restart
pnpm test           # vitest run (221 tests)
pnpm run typecheck  # tsc по всем пакетам (включая web)
start-dev.cmd       # Windows: сервер
start-ui.cmd        # Windows: SPA dev-сервер (порт 1980)
start-prototype.cmd # Windows: прототип дизайнера (порт 1981)
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
ZS_JWT_SECRET=...               # random if not set (tokens lost on restart)
ZS_ADMIN_PASSWORD=admin         # seed admin password
ZS_OAUTH=true                   # enable MCP OAuth 2.1 (opt-in)
LOG_LEVEL=info
```

## Правила работы

Соблюдай `step-announcement-rule.md` — перед каждым шагом: что / на каком
основании / как проверю / границы. После — честный отчёт о компромиссах
с записью в `COMPROMISES.md`.

## TODO / ISSUES

- `TODO.md` — срезы 1–9 завершены. 9.4 (deploy) следующий.
- `ISSUES.md` — открытые: callTool god-method, run composition, act gating, commit/check enforcement.
- `COMPROMISES.md` — реестр технического долга с чекбоксами.

## Ключевые решения

- **Чистый Express** (не NestJS) — ZsApp = composition root
- **Class-based srv** — ZsScript base class, единый worker runtime
- **Файловая модель скриптов** — script = файл (ref.cog.ts + ref.srv.ts), не папка. Папки — группировка.
- **SQLite** — better-sqlite3, WAL mode, worker own connection
- **Hot/cold lifecycle** — TTL/LRU eviction, full snapshot/restore (Instance + worker state + Set/Map)
- **Явные start/conclude в трейсе** — op:"start" при создании, op:"conclude" перед done
- **Shape-валидация** — conclude, checkpoint, report shapes из cog types; Contract tab через extractCogShapes
- **Вложенная библиотека** — script_ref с `/`, wildcard routes, tree view
- **JWT auth (jose)** — access + refresh tokens, role-based middleware, rate limiting
- **Monaco Editor** — ZS ambient .d.ts от сервера, кастомные темы, autocomplete snippets, inline markers
- **i18n** — кастомный lightweight (0 deps): I18nProvider + useT(), en/ru, Help docs per locale
- **Кастомные UI компоненты** — не shadcn, портированы из дизайнерского прототипа
- **Error boundary** — key={route.path} сбрасывается при навигации
- **store.d.ts** — опциональная schema, не перезаписывается при рестарте (scaffold skip-if-exists)
- **Язык agent-facing текстов: EN** — единый
- **Unified guide** — `zs_guide({ topic? })`: 11 топиков, заменяет zs_operations + zs_authoring_guide
- **Per-agent roles** — executor (default) / architect. Gating в callTool, не скрытие tools. UI переключатель на /agents
- **Coverage trust-by-content** — report=asserted, start/transition=n/a, coverage() пропускает n/a
- **ZS_ARCHITECT_MODE удалён** — роль per-agent, не глобальный env-флаг
- **MCP OAuth 2.1** — `ZS_OAUTH=true` opt-in. better-auth + MCP plugin, Bearer middleware на /mcp, discovery endpoints, login page. Executor-пользователь не может назначить architect-агента
