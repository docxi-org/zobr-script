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
```

## Packages (monorepo, pnpm workspaces)

| Package | Purpose |
|---------|---------|
| `packages/core` | Framework-free domain kernel: Instance, HandleStore, Trace, Shape, Status, Budgets |
| `packages/scaffold` | Canonical ambient declarations (`zs.*.d.ts`) + tsconfig templates |
| `packages/validator` | TypeScript compiler as a library + structural fence + shape extraction |
| `packages/protocol` | ZsService, InvocationRegistry, zod contracts, transport-agnostic |
| `packages/server` | Express + MCP SDK, SrvRuntime, SQLite storage, agent registry, MCP tools |

## Features

- **28 MCP tools** — full lifecycle (start/sandbox/checkpoint/report/conclude/resume/abort), agent registration, standalone store operations, discovery/CRUD
- **Class-based srv modules** — `export default class extends ZsScript` with `this.db`, `this.config`, lifecycle overrides
- **SQLite persistent storage** — typed collections, notes, traces, agent registration, instance snapshots
- **Shape validation** — conclude, checkpoint, and report data validated against types extracted from `.cog.ts`
- **Hot/cold invocation lifecycle** — TTL-based eviction, LRU under pressure, full restore from snapshot (including worker class instance state)
- **Agent registration** — persistent (SQLite), idempotent by name, active invocation tracking, store write lockout during script execution
- **Ambient auto-generation** — srv class public methods → `declare function` for cognitive environment
- **Structural fence** — allowlist AST validation: no eval, no unbounded loops, no unauthorized imports, duplicate label detection, srv export form enforcement
- **Trace as product** — every step tagged with realizer + trust class, coverage metrics (verified/asserted ratio)

## Quick Start

```bash
# Install
pnpm install

# Run tests (193 tests)
pnpm test

# Type check all packages
pnpm run typecheck

# Start dev server (auto-restart)
pnpm dev

# Start server
pnpm start
```

## Configuration (.env)

```env
ZS_HOST=127.0.0.1
ZS_PORT=1978
ZS_LIBRARY=./zs-lib
ZS_STORE_PATH=./data/store.sqlite
ZS_BUDGET_STEPS=1000
ZS_BUDGET_ITERATIONS=100
ZS_INVOCATION_TTL=3600        # seconds
ZS_AWAITING_TTL=86400         # seconds
ZS_MAX_ACTIVE_INVOCATIONS=100
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

## Script Example

**Cognitive part** (`hello/hello.cog.ts`):
```typescript
export type Result = { summary: string; confidence: "low" | "medium" | "high" };

export function analyze(topic: string): Result {
  const overview = survey(topic, { count: 3 });
  const critique = doubt(overview);
  return conclude<Result>();
}
```

**Server module** (`insight/insight.srv.ts`):
```typescript
export default class InsightScript extends ZsScript {
  private rounds = 0;

  onCheckpoint(label: string, data: unknown): Directive {
    this.rounds++;
    return this.rounds >= 3 ? "halt" : "proceed";
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

- Node.js 22 LTS, pnpm, ESM
- TypeScript 6, Vitest
- Zod 4 (MCP SDK requirement)
- `@modelcontextprotocol/server` 2.0.0-alpha.2 (Streamable HTTP)
- `better-sqlite3` (WAL mode)
- `pino` + `pino-pretty` (structured logging)
- `tsx` (dev runner, no build step)

## License

Private — not open source.
