---
title: Server module
category: Scripting
order: 1
summary: The server module (srv) adds verified computation, persistence, and gating to a script. It runs on the server, not in the model.
tags: [server, srv, ZsScript, hooks, functions]
related: [how-scripts-work, checkpoints, store]
---

# Server module

A script's server module (`name.srv.ts`) runs **on the server**, not in the model. It provides three things a model cannot: deterministic computation, persistent state, and authoritative gating.

## Structure

```ts
export default class InsightScript extends ZsScript {
  // Lifecycle hook — runs on each checkpoint
  onCheckpoint(label: string, data: unknown): Directive {
    this.db.collection("analyses").insertOne(data);
    return "proceed";
  }

  // Server function — callable from cognitive code
  async fetchFeed(topic: string) {
    return await this.http.get(`/feeds/${topic}`);
  }
}
```

The class extends `ZsScript` and has access to:

| Property | What it provides |
|---|---|
| `this.db` | SQLite [store](store) — collections and notes |
| `this.invocation` | Current invocation context — id, scriptRef, depth |
| `this.config` | Per-script configuration from config.json |

## Lifecycle hooks

| Hook | When it fires | Returns |
|---|---|---|
| `onStart(ctx)` | Invocation begins | void |
| `onCheckpoint(label, data)` | Agent hits a [checkpoint](checkpoints) | `Directive` — proceed, halt, or ask |
| `onReport(label, data)` | Agent sends a report | void |
| `onConclude(result)` | Agent finalizes the run | void |

Hooks are optional. Without a server module, checkpoints default to `proceed` and reports are logged without side effects.

## Server functions

Public methods on the class (not lifecycle hooks) become **server functions** — callable from the cognitive code via `invoke`. Their results carry [verified](trust-classes) trust because they are deterministic server-side computation.

Server functions appear on the **Contract** tab in Script Detail, and in the [trace](trace) as events with the function name as `op`.

## When to use a server module

- **Persistence** — save intermediate results across runs via [store](store)
- **Gating** — halt a run if quality criteria aren't met
- **Verified computation** — call external APIs, run deterministic logic
- **Audit** — log data to notes on each checkpoint

A purely cognitive script (no srv) works fine — it just has no server-side verification or persistence.

## See also

- [How scripts work](how-scripts-work) — the cog + srv split
- [Checkpoints & directives](checkpoints) — the gating mechanism
- [Store](store) — the persistence layer
