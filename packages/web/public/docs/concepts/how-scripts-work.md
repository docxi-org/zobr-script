---
title: How scripts work
category: What is ZS
order: 2
summary: A script has a cognitive part (what to think) and an optional server part (what to verify). Together they define a reasoning protocol.
tags: [scripts, cognitive, server, operations]
related: [what-is-zs, how-execution-works, server-module, checkpoints]
---

# How scripts work

A ZS script lives as one or two files in the [library](library):

- **`name.cog.ts`** — the cognitive part (required). Written in a TypeScript subset, it defines the sequence of reasoning operations.
- **`name.srv.ts`** — the server module (optional). A class that provides verified computation, persistence, and gating.

## The cognitive part

The cognitive part reads like a reasoning protocol:

```ts
export type Result = {
  insight: string;
  confidence: "low" | "medium" | "high";
  tradeoffs: string[];
};

export function reflect(context: string): Result {
  const mechanisms = survey(context, { count: 10 });
  const friction = doubt(mechanisms, { lens: "second-order effects" });

  commit({
    criteria: ["reversibility", "blast-radius"],
    weights: [0.5, 0.5],
  });

  const pattern = synthesize(mechanisms, friction);
  checkpoint("analysis_done", { pattern, friction });

  return conclude<Result>();
}
```

The script doesn't execute these operations itself — the **agent** does. Each operation is a directive: `survey` means "explore this space", `doubt` means "stress-test this", `commit` means "declare your evaluation criteria".

## Operations

| Operation | Purpose | Trust |
|---|---|---|
| `survey` | Explore a space, gather candidates | asserted |
| `doubt` | Challenge, find friction, stress-test | asserted |
| `commit` | Declare criteria and basis for a decision | verified |
| `synthesize` | Combine findings into a pattern | asserted |
| `contrast` | Compare alternatives | asserted |
| `checkpoint` | Server-adjudicated gate → [directive](checkpoints) | verified |
| `conclude` | Final result, validated against type `T` | verified |
| `report` | Log an intermediate observation to the [trace](trace) | verified |

> **Note:** these operations are not function calls that return computed values. They are prompts that the agent fulfills with its reasoning, and the results are recorded in the trace with the appropriate [trust class](trust-classes).

## The server module

When a script needs verified computation, persistent state, or decision-making that shouldn't be left to the model, it adds a [server module](server-module):

```ts
export default class extends ZsScript {
  onCheckpoint(label: string, data: unknown): Directive {
    this.db.collection("analyses").insertOne(data);
    return "proceed";
  }
}
```

The server module runs on the server (not in the model), so its results carry [authority](trust-classes) or [verified](trust-classes) trust.

## Types and shapes

The `conclude<Result>()` call at the end declares the expected output type. The server validates the actual result against this shape — if it doesn't match, the run fails rather than producing a silently wrong answer.

[Checkpoints](checkpoints) can also declare shapes for their payloads, giving the server a contract to validate at each decision point.

## See also

- [How execution works](how-execution-works) — what happens when this script runs
- [Server module](server-module) — the srv part in detail
- [Checkpoints & directives](checkpoints) — the gating mechanism
- [Library](library) — where scripts live on disk
