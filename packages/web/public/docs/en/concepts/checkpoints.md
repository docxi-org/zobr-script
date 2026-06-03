---
title: Checkpoints & directives
category: Key concepts
order: 4
summary: A checkpoint is a server-adjudicated decision point. The server inspects the payload and returns a directive — proceed, halt, or ask.
tags: [checkpoint, directive, control-flow, shapes]
related: [how-scripts-work, trace, trust-classes, server-module]
---

# Checkpoints & directives

A **checkpoint** is a point in a script where the agent pauses and hands a payload to the server. The server inspects it and returns a **directive** that determines what happens next. Because the server adjudicates, every checkpoint event is [verified](trust-classes).

```ts
const gate = checkpoint("analysis_done", {
  pattern,
  residual_risk: friction.unresolved,
});

if (gate.directive === "halt") {
  return conclude<Result>({ /* partial */ });
}
```

## The four directives

| Directive | Effect |
|---|---|
| `proceed` | Continue execution past the checkpoint. |
| `warn` | Continue, but flag the checkpoint as a warning in the trace. |
| `halt` | Stop now. The run ends with status `halted`. |
| `ask` | Suspend and request input. The run parks as `awaiting_user`. |

## How the server decides

The directive comes from the [server module's](server-module) `onCheckpoint` hook:

```ts
export default class extends ZsScript {
  onCheckpoint(label: string, data: unknown): Directive {
    if (label === "analysis_done") {
      this.db.collection("analyses").insertOne(data);
      return this.shouldContinue(data) ? "proceed" : "halt";
    }
    return "proceed";
  }
}
```

If no server module exists, all checkpoints return `proceed` by default.

## Shape validation

Each named checkpoint can declare a **shape** — the expected structure of its payload. The server validates the payload against the shape before calling `onCheckpoint`. A malformed payload fails immediately rather than reaching the decision logic.

Shapes are extracted from the cognitive code's TypeScript types at load time. You can see them on the **Contract** tab in Script Detail.

## The `ask` directive

`ask` is how a script requests human or agent input mid-run. The invocation parks under the *awaiting* TTL (default: 24 hours). If no answer arrives in time, it transitions to `expired`. See [How execution works](how-execution-works) for status details.

## In the trace

Checkpoint events appear in the [event timeline](trace) with the directive shown as a colored badge:
- `proceed` — green
- `warn` — yellow
- `halt` — orange
- `ask` — blue

## See also

- [Server module](server-module) — where `onCheckpoint` is implemented
- [Trust classes](trust-classes) — why checkpoints are verified
- [How execution works](how-execution-works) — the lifecycle including halt and suspend
