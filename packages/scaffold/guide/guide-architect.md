# Architect Reference

The sections below extend the executor guide with script design, server modules,
storage, lifecycle, composition, and patterns.

**Architect rules.** Co-design with the user. Write to the library only with
human confirmation. Draft the cognitive part freely. The server module is
privileged — keep it minimal, justify each capability. Validate iteratively with
`zs_validate`. Surface trade-offs and design assumptions. Do not fabricate
requirements.

Additional tools: `zs_create`, `zs_update`, `zs_delete`, `zs_validate`.

## Script Structure

A ZS script is one or two files, paired by name:

```
zs-lib/
  examples/
    hello.cog.ts           → script_ref = "examples/hello"
    insight.cog.ts         → script_ref = "examples/insight"
    insight.srv.ts         → paired server module
```

- **`.cog.ts`** — cognitive part (required). The reasoning script.
- **`.srv.ts`** — server module (optional). Deterministic controller.
- **`script_ref`** — path from library root to base name, without extension.
- Folders are pure grouping — any nesting depth.

### Cognitive Part

```ts
/** A minimal demo script. */
export type Result = { summary: string; confidence: "low" | "medium" | "high" };

export function analyze(topic: string): Result {
  const overview = survey(topic, { count: 3 });
  const critique = doubt(overview);
  return conclude<Result>({
    summary: synthesize([overview, critique], { method: "concise verdict" }) as string,
    confidence: assess().status === "converging" ? "high" : "medium",
  });
}
```

- JSDoc `/** ... */` → script description in listing
- Exported `Result` type → conclude schema
- Exported entry function → typed input + body + explicit conclude
- Contract = input parameters + conclude type (what `run()` callers depend on)
- Variables hold Sem handles. Use `const` (preferred) or `let` (loops)
- Standard control flow: if/else, for, while, try/catch

### When to Add a Server Module

Most scripts are purely cognitive. Add `.srv.ts` when you need:
- **Verified compute** — @sandbox methods
- **Gating** — onCheckpoint returning halt or { ask }
- **Persistence** — writing to this.db
- **Custom lifecycle** — onStart, onReport overrides

The cognitive part runs in the agent's context. The server module is privileged:
server-side execution with database access. Keep it minimal.

## Server Module

```ts
export default class MyScript extends ZsScript {
  // @sandbox method — callable from cog, verified trust
  score(data: { values: number[] }): number {
    return data.values.reduce((s, v) => s + v, 0) / data.values.length;
  }

  onStart() {
    return { greeting: "ready", run_count: this.db.notes.keys().length };
  }

  onCheckpoint(label: string, data: unknown): Directive {
    if (label === "final_review") {
      this.db.collection("reviews").insertOne(data);
    }
    return "proceed";
  }

  onReport(label: string, data: unknown): void {
    this.db.notes.put(`report:${label}:${this.invocation.id}`, data, label);
  }
}
```

### Available Properties

| Property | Type | Description |
|----------|------|-------------|
| `this.db` | `Db` | Persistent SQLite storage (own connection in worker) |
| `this.config` | `Record<string, unknown>` | Script-level configuration |
| `this.invocation` | `{ id, scriptRef, depth, parentId? }` | Current invocation metadata |

### Lifecycle Overrides

| Method | Called when | Returns |
|--------|-----------|---------|
| `onStart()` | Invocation begins | `Record<string, unknown>` (initial data) |
| `onCheckpoint(label, data)` | Agent calls checkpoint | `Directive` |
| `onReport(label, data)` | Agent calls report | `void` |

### @sandbox Constraints

- No fetch, fs, process, or network access
- Deterministic: same input → same output
- Input/output validated against TypeScript types at the seam

### Directive

```ts
type Directive = "proceed" | "warn" | "halt" | { ask: string; choices?: string[] };
```

## Store

Persistent storage via collections (documents) and notes (key-value). Both
backed by SQLite, data persists across invocations.

### Two Access Paths

| Path | Context | How |
|------|---------|-----|
| Inside a script | `.srv.ts` | `this.db.collection(name)`, `this.db.notes` |
| Outside a script | Any agent | MCP tools: `zs_store_insert`, `zs_store_find`, etc. |

### Collections

```ts
const coll = this.db.collection<MyType>("analyses");
coll.insertOne({ topic: "X", score: 42 });          // → document id
coll.find({ topic: "X" });                           // → doc[]
coll.updateOne({ topic: "X" }, { score: 99 });        // → count
coll.deleteMany({ reviewed: false });                  // → count
coll.count({ score: 42 });                             // → number
```

### Notes (key-value)

```ts
this.db.notes.put("summary:run1", { text: "..." }, "summary");
this.db.notes.get("summary:run1");    // → data | null
this.db.notes.delete("summary:run1"); // → boolean
this.db.notes.list("summary");        // → StoreEntry[]
this.db.notes.keys("summary");        // → string[]
```

### store.d.ts

Optional file in library root. Each exported interface defines a typed collection:

```ts
export interface Analysis {
  topic: string;
  summary: string;
  findings: { fact: string; source: string }[];
}
```

Enables `this.db.collection<Analysis>("Analysis")` with full type checking.

## Invocation Lifecycle

### States

| Status | Meaning | Terminal? |
|--------|---------|-----------|
| `running` | Active, accepting MCP calls | No |
| `awaiting_user` | Waiting for human input | No |
| `suspended` | Evicted to cold storage (LRU/TTL) | No |
| `done` | Completed via zs_conclude | Yes |
| `halted` | Stopped by halt directive | Yes |
| `halted_budget` | Budget exhausted | Yes |
| `aborted` | Stopped by zs_abort | Yes |
| `errored` | Unrecoverable error | Yes |
| `expired` | TTL exceeded | Yes |

### Hot and Cold

**Hot** — in memory, worker active. **Cold** — snapshot in SQLite, resources freed.
Cold invocations restore with `zs_resume`.

**Design for eviction:** use checkpoints for recoverability. Persist state in
`this.db` during `onCheckpoint`. Default TTL: 1 hour. Awaiting TTL: 24 hours.

### Budgets

| Budget | Default | Meaning |
|--------|---------|---------|
| `steps` | 1000 | Max MCP tool calls |
| `iterations` | 100 | Max loop iterations |

Exceeding → `halted_budget`. Design scripts to complete within budget.

## Composition

Three tiers — use the minimal sufficient one:

| Tier | Mechanism | Trust | Cost |
|------|-----------|-------|------|
| 1. Define-inline | `const helper = (x) => ...` | Same as caller | Zero |
| 2. @sandbox | Public method on ZsScript | **verified** | MCP round-trip |
| 3. run | `run<I,O>(ref, inputs)` | Per child contract | Heavy |

**Tier 1** — trivial script-local reuse. No isolation.
**Tier 2** — deterministic verified compute. Math, scoring, validation.
**Tier 3** — full sub-task with own trace, store, budget. Child must exist in library.

Do not use `run` for what @sandbox can do. Do not use @sandbox for purely
cognitive logic.

## Patterns

### Minimal (hello)

Survey + doubt + conclude. No server module.
→ `zs_read("examples/hello")`

### Reflective with commit/check (insight)

Survey → doubt → commit → synthesize → contrast → doubt → check → @sandbox →
checkpoint → conclude. Server module with onCheckpoint persistence and @sandbox
scoring.
→ `zs_read("examples/insight")`

### Gated with Human-in-the-Loop

Survey → synthesize → doubt → report → ask_user (choices) → checkpoint → act.
Human approval gate before irreversible action.

### Multi-stage with run

Two child invocations via `run()`, then contrast + conclude. Each child has its
own trace and budget.
