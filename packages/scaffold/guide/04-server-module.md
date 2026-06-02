# Server Module

The server module (`.srv.ts`) is an optional per-script controller that runs on
the server in a sandboxed worker. It provides deterministic computation,
persistence, and gating. The cognitive part (`.cog.ts`) calls into it via
`@sandbox` methods and lifecycle hooks.

## ZsScript Base Class

Every server module exports a default class extending `ZsScript`:

```ts
export default class MyScript extends ZsScript {
  // ...
}
```

### Available Properties

| Property | Type | Description |
|----------|------|-------------|
| `this.db` | `Db` | Persistent SQLite storage (own connection in worker) |
| `this.config` | `Record<string, unknown>` | Script-level configuration |
| `this.invocation` | `{ id, scriptRef, depth, parentId? }` | Current invocation metadata |

### Lifecycle Overrides

Override these methods to react to script events:

| Method | Called when | Returns |
|--------|-----------|---------|
| `onStart()` | Invocation begins | `Record<string, unknown>` (initial data for the agent) |
| `onCheckpoint(label, data)` | Agent calls `checkpoint()` | `Directive` |
| `onReport(label, data)` | Agent calls `report()` | `void` |

```ts
export default class MyScript extends ZsScript {
  onStart() {
    return { greeting: "ready", run_count: this.db.notes.keys().length };
  }

  onCheckpoint(label: string, data: unknown): Directive {
    if (label === "final_review") {
      this.db.collection("reviews").insertOne(data);
      return "proceed";
    }
    return "proceed";
  }

  onReport(label: string, data: unknown): void {
    this.db.notes.put(`report:${label}:${this.invocation.id}`, data, label);
  }
}
```

## @sandbox Methods

Public methods on the class become callable from the cognitive part as
deterministic `@sandbox` functions. They execute on the server (verified trust),
not in the agent's context.

```ts
export default class StatsScript extends ZsScript {
  // Callable from cog as: const result = stats.calculate(data)
  calculate(data: { values: number[] }): { mean: number; median: number } {
    const sorted = [...data.values].sort((a, b) => a - b);
    const mean = data.values.reduce((s, v) => s + v, 0) / data.values.length;
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
    return { mean, median };
  }
}
```

**Constraints:**
- No `fetch`, `fs`, `process`, or network access — enforced by the sandbox
- Deterministic: same input → same output
- Input and output are validated against their TypeScript types at the seam
  (verified trust)

## Directive

The return type of `onCheckpoint`:

```ts
type Directive =
  | "proceed"              // continue execution
  | "warn"                 // continue, but flag a concern
  | "halt"                 // stop execution
  | { ask: string; choices?: string[] }  // request human input
```

The agent cooperatively honors the directive. `halt` transitions the invocation
to a terminal state. `{ ask }` triggers a human-in-the-loop interaction.

## Db — Persistent Storage

### Collections

```ts
const coll = this.db.collection<MyType>("analyses");
coll.insertOne({ topic: "X", score: 42 });          // → document id
coll.insertMany([{ topic: "A" }, { topic: "B" }]);   // → array of ids
coll.findOne({ topic: "X" });                         // → doc | null
coll.find({ topic: "X" });                            // → doc[]
coll.updateOne({ topic: "X" }, { score: 99 });        // → count
coll.updateMany({}, { reviewed: true });               // → count
coll.deleteOne({ topic: "X" });                        // → count
coll.deleteMany({ reviewed: false });                  // → count
coll.count({ score: 42 });                             // → number
```

Collections are created implicitly on first use. Type parameter `<MyType>` is
for TypeScript checking only — runtime stores JSON.

### Notes (key-value)

```ts
this.db.notes.put("summary:run1", { text: "..." }, "summary");  // key, data, type?
this.db.notes.get("summary:run1");    // → data | null
this.db.notes.delete("summary:run1"); // → boolean
this.db.notes.list("summary");        // → StoreEntry[] (filtered by type)
this.db.notes.keys("summary");        // → string[]
```

Notes are simpler than collections — single key-value pairs with an optional
type tag for filtering.

### store.d.ts

The optional `store.d.ts` file in the library root defines typed collection
schemas. Each exported interface becomes a collection name:

```ts
export interface Analysis {
  topic: string;
  summary: string;
  findings: { fact: string; source: string }[];
  meta: { confidence: "low" | "medium" | "high" };
}
```

This enables `this.db.collection<Analysis>("Analysis")` with full type checking.

## See Also

- Topic `script-structure` — how cog and srv pair together
- Topic `store` — standalone store tools (outside scripts)
- Topic `trust` — why @sandbox is verified
- Topic `ambients` — full `zs.server.d.ts`
