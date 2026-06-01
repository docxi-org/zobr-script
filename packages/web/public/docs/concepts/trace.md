---
title: Trace
category: Key concepts
order: 1
summary: The trace is an ordered stream of events — the primary product of every invocation. It records what happened, who produced it, and how trustworthy each step is.
tags: [trace, events, timeline, audit]
related: [trust-classes, coverage, how-execution-works]
---

# Trace

The trace is the **primary product** of a ZS invocation — not the final answer, but the complete record of how that answer was reached. Every step the agent took, every decision the server made, every status change is recorded as an event.

## Anatomy of an event

```ts
{
  seq: 3,                          // monotonic order
  t: "2026-06-01T19:29:05Z",      // ISO timestamp
  op: "report",                    // operation type
  realizer: "server",             // who produced it
  trust: "verified",              // trust class
  inputs: [],                     // input handle IDs
  output: "h_abc123",            // output handle ID
  preview: "{ pattern, description, replaces }",
  meta: { label: "survey" }      // additional context
}
```

Each event has a one-line **preview**. Clicking it in the Trace Detail view expands the full payload as syntax-highlighted JSON.

## Event types

| op | When | Trust | Description |
|---|---|---|---|
| `start` | Invocation created | verified | First event in every trace. Records script_ref and parent link. |
| `report` | Agent sends telemetry | verified | Intermediate observation — survey result, doubt output, etc. |
| `checkpoint` | Server decision gate | verified | Returns a [directive](checkpoints): proceed, halt, or ask. |
| `conclude` | Result finalized | verified | Result validated against the declared shape. |
| `status_transition` | Status changes | verified | Records `from → to` with reason. |
| `ask_user` | Human input requested | authority | Script needs external answer. |
| `act` | External action taken | authority | Script performed a side effect. |
| *(function name)* | Server function called | verified | A [server module](server-module) method was invoked. |

## Reading a trace

The Trace Detail view shows two panels side by side:

- **Code** (left) — the cognitive source with line highlighting. Hover over an event to highlight the corresponding line.
- **Events** (right) — the timeline. Each event shows its operation, [trust badge](trust-classes), preview, and timestamp. Expand for full detail.

Below the split view, the **Coverage Summary** shows the [coverage](coverage) donut chart, event counts, and the final result as JSON.

## What makes a good trace

A well-designed script produces a trace that tells a story: what was explored, what was challenged, where the server verified claims, and how the conclusion follows from the evidence. A trace with only `report` events is a monologue; one with checkpoints and shape validation is a dialogue between agent and server.

## See also

- [Trust classes](trust-classes) — the trust label on each event
- [Coverage](coverage) — the aggregate metric
- [How execution works](how-execution-works) — the lifecycle that produces traces
