# Composition

ZS scripts can reuse logic at three tiers. Use the minimal sufficient tier.

## The Composition Ladder

| Tier | Mechanism | Isolation | Trust | Cost |
|------|-----------|-----------|-------|------|
| 1. Define-inline | `const helper = (x) => ...` | None — same invocation | Same as caller | Zero |
| 2. @sandbox | Public method on `ZsScript` class | Sandbox worker | **verified** | MCP round-trip |
| 3. run | `run<I,O>(ref, inputs)` | Full — own trace, store, worker | Per child contract | Heavy |

### Tier 1: Define-inline

Simple reuse within the same script. A helper function or shared constant.
No isolation, no overhead, same trust class as the surrounding code.

```ts
const summarize = (items: Sem) => synthesize(items, { method: "key takeaways" });

const overview = survey("topic", { count: 5 });
const result = summarize(overview);
```

Use when: the logic is trivial and script-local.

### Tier 2: @sandbox

A public method on the server module class. Runs in the server's sandboxed
worker — deterministic, verified trust, no network/filesystem access.

```ts
// In .srv.ts
export default class MyScript extends ZsScript {
  score(data: { factors: string[]; weights: number[] }): number {
    return data.factors.reduce((sum, _, i) => sum + data.weights[i]!, 0);
  }
}

// In .cog.ts — called as a deterministic verified operation
const s = score({ factors: [...], weights: [...] });
```

Use when: you need deterministic computation with verified trust — math,
scoring, validation, data transformation. The key advantage: the result is
**verified**, not asserted.

### Tier 3: run

Spawn a child invocation of another script. Full isolation: own trace, store,
controller, budgets. The child's `conclude` result is returned.

```ts
const analysis = run<{ topic: string }, AnalysisResult>(
  "tools/deep-analysis",
  { topic: "market trends" }
);
```

Use when: you need a complete sub-task with its own trace and isolation.
The child script must exist in the library. Input/output types are checked
at compile time via the child's exported contract.

**Constraints:**
- Depth is limited by the runtime (prevents infinite recursion)
- Each child consumes its own budget
- The child's trace is linked to the parent via `parent_invocation_id`

## Choosing the Right Tier

```
Is the logic trivial and script-local?
  → Tier 1: define-inline

Does it need deterministic/verified computation?
  → Tier 2: @sandbox

Does it need its own trace, isolation, or is it a reusable script?
  → Tier 3: run
```

Do not use `run` for what a helper function or `@sandbox` can do. Do not use
`@sandbox` for what is purely cognitive (that would force a server module for
no benefit). Match the tier to the need.

## See Also

- Topic `server-module` — writing @sandbox methods
- Topic `trust` — why @sandbox is verified and run inherits child trust
- Topic `script-structure` — the contract that `run` depends on
