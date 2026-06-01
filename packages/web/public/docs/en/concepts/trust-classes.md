---
title: Trust classes
category: Key concepts
order: 2
summary: Every trace event carries a trust class — a label saying how the result was produced and how much you can rely on it.
tags: [trust, audit, coverage]
related: [coverage, trace]
---

# Trust classes

Every event in a [trace](trace) is tagged with a **trust class**. It answers one question: *how was this result produced?*

| Class | Color | Meaning |
|---|---|---|
| `asserted` | amber | The model proposed this based on its reasoning. Plausible, not independently checked. |
| `verified` | green | Checked against a declared shape, rule, or deterministic computation. |
| `authority` | blue | Came from a trusted boundary — a [server function](server-module), external I/O, or the host. |
| `error` | red | The step failed. Carries a `kind` and `message`. |

## Who assigns trust

Trust is assigned by the **realizer** — the component that actually produced the result — not by the script author:

- A cognitive operation (`survey`, `doubt`, `synthesize`) is realized by the model → `asserted`
- A [server function](server-module) call is realized by the server → `authority`
- A [checkpoint](checkpoints) is adjudicated by the server → `verified`
- A `conclude` validated against its shape → `verified`
- A `start` event recorded by the server → `verified`

> **Note:** an `asserted` result is not wrong — it is *unverified*. The trace makes the distinction visible so consumers can decide how much verification they need.

## Trust and the trace

The [coverage](coverage) metric rolls up trust across all events: what fraction of the work was verified vs asserted. A trace built entirely from `asserted` steps is a hypothesis; one backed by `verified` and `authority` steps is an audited claim.

Trust badges appear on every row of the event timeline in the [Trace Detail](trace) view. Decisions that gate execution — [checkpoints](checkpoints) — are always `verified` because the server adjudicates them.

## See also

- [Coverage](coverage) — the aggregate trust metric
- [Trace](trace) — the event stream where trust is recorded
- [Checkpoints & directives](checkpoints) — verified decision gates
