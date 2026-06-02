# Script Structure

## File Model

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
- **`script_ref`** — path from library root to the base name, without extension.
  Used in `zs_start`, `zs_read`, `run()`.
- Folders are pure grouping — any nesting depth, any number of scripts per folder.

## Cognitive Part (`.cog.ts`)

The cognitive part is a TypeScript file with:

1. **JSDoc description** — first `/** ... */` comment becomes the script's
   description in the library listing.
2. **Exported result type** — the schema for `conclude<T>()`.
3. **Exported entry function** — typed input parameters + body + `conclude`.

```ts
/** A minimal demo script. */
export type Result = { summary: string; confidence: "low" | "medium" | "high" };

export function analyze(topic: string): Result {
  const overview = survey(topic, { count: 3 });
  const critique = doubt(overview);
  return conclude<Result>();
}
```

### The Contract

A script's public contract = **input parameters** + **conclude type**. This is
what `run()` callers depend on. Both are checked by the TypeScript compiler.

### Variables

Variables hold semantic handles (`Sem`) — references to values in the instance
store, not copies in the agent's context. Use `const` (preferred) or `let`
(for reassignment in loops).

```ts
const positions = survey("views on free will", { count: 3 });
let thesis = assert("initial position");
```

### Operations

Operations are ambient functions declared in the cognitive `.d.ts`. The agent
performs cognitive operations; the server realizes control operations.
See topic `operations` for semantics and topic `ambients` for signatures.

Named arguments use an options object: `survey("...", { count: 3 })`,
`contrast(x, { with: y })`.

### Control Flow

Standard TypeScript control flow is allowed: `if/else`, `for`, `while`,
`try/catch`. The `try/catch` pattern handles operation failures
(e.g. `schema_mismatch` from a seam check).

## Server Module (`.srv.ts`)

The server module is a class extending `ZsScript`:

```ts
export default class InsightScript extends ZsScript {
  onCheckpoint(label: string, data: unknown): Directive {
    if (label === "reflection_done") {
      this.db.notes.put(`insight:${this.invocation.id}`, data, "architectural-insight");
    }
    return "proceed";
  }
}
```

### When to Add a Server Module

Most scripts are purely cognitive — no `.srv.ts` needed. Add one when you need:

- **Verified compute** — `@sandbox` methods (public methods on the class,
  callable from cog as deterministic functions)
- **Gating** — `onCheckpoint` returning `halt` or `{ ask }` based on data
- **Persistence** — writing to `this.db` (collections and notes)
- **Custom lifecycle** — `onStart`, `onReport` overrides

### Privileged Asymmetry

The cognitive part can be written freely — it runs in the agent's context.
The server module is privileged: it executes on the server with access to
the database and deterministic sandbox. Keep it minimal, justify each
capability, and mark for explicit human confirmation when creating scripts.

See topic `server-module` for full `ZsScript` API.

## See Also

- Topic `operations` — what each cognitive operation does
- Topic `server-module` — ZsScript, Db, Collection, Notes
- Topic `patterns` — complete example scripts with annotations
- Topic `ambients` — full `.d.ts` signatures
