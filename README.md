# ZS (Zobr Script) v0.2

A cognitive scripting language implemented as an MCP service. Scripts are written in a TypeScript subset; operations are realized by different executors (LLM, server, external sources, user), and every step is tagged with a trust class (asserted / verified / authority). The trace is the product, not the answer.

## What is ZS

ZS is an orchestration layer for structured reasoning. A ZS script describes *how* a task is worked through — making the process explicit, typed, traceable, and partially verifiable.

- **Not a prompt template.** It has computation, control flow, failure handling, and a runtime that holds state between steps.
- **Not a black box.** Every step is a named operation with fixed semantics and a recorded outcome.
- **Not an agent platform.** In v0.2 it *directs* the host agent to use its own tools; it does not execute external actions itself.

## Architecture

```
Agent (LLM)                          ZS MCP Server
   │                                    │
   │  zs_register → agent_id           │
   │  zs_start → invocation_id + code  │  Instance, HandleStore, Trace
   │  zs_sandbox → verified result     │  SrvRuntime (worker_threads + vm)
   │  zs_checkpoint → Directive        │  SQLite (collections, notes, traces)
   │  zs_conclude → coverage + trace   │  Shape validation on seams
   │                                    │
   Agent-driven: agent reads code       Server: stateful service,
   and dispatches MCP calls             responds with verified results

Browser                              REST API (/api/*)
   │                                    │
   │  POST /api/auth/login → JWT       │  Auth + role-based middleware
   │  GET /api/traces → list           │  SQL pagination, filtering
   │  GET /api/scripts → tree          │  Shape extraction, validation
   │  GET /api/ambients → .d.ts        │  Monaco Editor support
   │                                    │
   React 19 SPA (Vite 8)              Express endpoints on same server
```

## Packages (monorepo, pnpm workspaces)

| Package | Purpose |
|---------|---------|
| `packages/core` | Framework-free domain kernel: Instance, HandleStore, Trace, Shape, Status, Budgets |
| `packages/scaffold` | Canonical ambient declarations (`zs.*.d.ts`) + tsconfig templates |
| `packages/validator` | TypeScript compiler as a library + structural fence + shape extraction |
| `packages/protocol` | ZsService, InvocationRegistry, zod contracts, transport-agnostic |
| `packages/server` | Express + MCP SDK, SrvRuntime, SQLite storage, agent registry, REST API, JWT auth |
| `packages/web` | React 19 SPA: Vite 8, Tailwind CSS 4, Monaco Editor, i18n (en/ru) |

## Features

### MCP Server (27 tools)
- Full lifecycle: start / sandbox / checkpoint / report / conclude / resume / abort
- Agent registration with per-agent roles (executor / architect)
- Unified guide: `zs_guide({ topic? })` — 11 topics covering operations, trust, patterns
- Standalone store operations (collections + notes)
- Script discovery / CRUD (gated by agent role, not global flag)
- OAuth 2.1 (`ZS_OAUTH=true`) — better-auth + MCP plugin, Bearer auth on /mcp

### Script Runtime
- **File-based model** — script = `ref.cog.ts` + optional `ref.srv.ts`, not a folder
- **Class-based srv modules** — `export default class extends ZsScript` with `this.db`, lifecycle overrides
- **Shape validation** — conclude, checkpoint, report data validated against types from `.cog.ts`
- **Hot/cold lifecycle** — TTL eviction, LRU under pressure, full restore from snapshot
- **Trace events** — explicit `start` and `conclude` ops, every step tagged with trust class

### REST API
- JWT auth (jose) with access + refresh tokens
- Role-based middleware (admin / architect / executor)
- Rate limiting on login (10 req/min per IP)
- SQL LIMIT/OFFSET pagination for traces
- Shape extraction via `extractCogShapes` for Script Detail contract tab
- 33 API tests (supertest)

### Frontend SPA
- **13 pages** — Login, Dashboard, Traces, Trace Detail, Scripts (Tree/Cards/Table), Script Detail (Monaco Editor), New Script, Store, Agents, Settings, Users, Help
- **Monaco Editor** — ZS autocomplete, ambient `.d.ts` from server, inline validation markers
- **i18n** — English + Russian, ~180 UI strings, 12 Help articles per locale
- **Tree view** — collapsible script library with folder counts, breadcrumb navigation
- **Error boundary** — page errors show fallback, navigation still works
- **Sortable DataTables** — click column headers to sort

## Quick Start

```bash
# Install
pnpm install

# Run tests (228 tests)
pnpm test

# Type check all packages
pnpm run typecheck

# Start MCP server (auto-restart)
pnpm dev

# Start frontend dev server (port 1980)
pnpm --filter @zobr/web dev
```

Open `http://localhost:1980` — login with `admin@docxi.org` / password from `ZS_ADMIN_PASSWORD` (default: `admin`).

## Configuration (.env)

```env
ZS_HOST=127.0.0.1
ZS_PORT=1978
ZS_LIBRARY=./zs-lib
ZS_STORE_PATH=./data/store.sqlite
ZS_BUDGET_STEPS=1000
ZS_BUDGET_ITERATIONS=100
ZS_INVOCATION_TTL=3600          # seconds
ZS_AWAITING_TTL=86400           # seconds
ZS_MAX_ACTIVE_INVOCATIONS=100
ZS_JWT_SECRET=...               # random if not set (tokens lost on restart)
ZS_ADMIN_PASSWORD=admin         # seed admin password
ZS_OAUTH=true                   # enable MCP OAuth 2.1 (opt-in, default off)
LOG_LEVEL=info
```

## MCP Connection

The server exposes MCP Streamable HTTP at `/mcp`:

```json
{
  "mcpServers": {
    "zobr-script": {
      "type": "streamableHttp",
      "url": "http://127.0.0.1:1978/mcp"
    }
  }
}
```

Production: `https://zs.docxi.org/mcp`

## Script Example

Scripts use the **file-based model** — each script is a `.cog.ts` file, optionally paired with a `.srv.ts`:

```
zs-lib/
  examples/
    hello.cog.ts           → script_ref = "examples/hello"
    insight.cog.ts         → script_ref = "examples/insight"
    insight.srv.ts         → paired server module
```

**Cognitive part** (`examples/hello.cog.ts`):
```typescript
/** A minimal demo script. */
export type Result = { summary: string; confidence: "low" | "medium" | "high" };

export function analyze(topic: string): Result {
  const overview = survey(topic, { count: 3 });
  const critique = doubt(overview);
  return conclude<Result>();
}
```

**Server module** (`examples/insight.srv.ts`):
```typescript
export default class InsightScript extends ZsScript {
  onCheckpoint(label: string, data: unknown): Directive {
    this.db.notes.put(`insight:${this.invocation.id}`, data, "architectural-insight");
    return "proceed";
  }
}
```

## Trust Model

| Realizer | Trust Class | Examples |
|----------|------------|---------|
| LLM (agent) | **asserted** | survey, doubt, synthesize |
| Server (deterministic) | **verified** | @sandbox methods, checkpoint, shape validation |
| External source | **verified** / asserted-relay | retrieve (KB / web) |
| User | **authority** | ask_user |

## Stack

**Backend:**
- Node.js 22 LTS, pnpm, ESM
- TypeScript 6, Vitest, supertest
- Zod 4 (MCP SDK requirement)
- `@modelcontextprotocol/server` 2.0.0-alpha.2 (Streamable HTTP)
- `better-sqlite3` (WAL mode), `jose` (JWT), `pino` (logging)

**Frontend:**
- React 19, Vite 8, Tailwind CSS 4
- `@monaco-editor/react` + `monaco-editor`
- Custom i18n (0 deps), custom UI components

## License

Private — not open source.
