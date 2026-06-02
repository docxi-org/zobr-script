---
title: Trust classes
category: Key concepts
order: 2
summary: Every trace event carries a trust class — a label saying how the content was produced and how much you can rely on it.
tags: [trust, audit, coverage]
related: [coverage, trace]
---

# Trust classes

Every event in a [trace](trace) is tagged with a **trust class**. It answers one question: *where did the content of this result come from?*

| Class | Color | Meaning |
|---|---|---|
| `asserted` | amber | Produced by the agent (model reasoning or agent-reported data). Plausible, not independently checked. |
| `verified` | green | Produced or checked by deterministic code — sandbox, checkpoint evaluation, shape validation. |
| `authority` | blue | Came from the user via human-in-the-loop (`ask_user`). Ground truth by definition. |
| `n/a` | gray | Infrastructure event (start, status transition). Not a contribution to the result. |

## How trust is assigned

Trust is determined by the **origin of the content**, not merely by who executed the operation:

- A cognitive operation (`survey`, `doubt`, `synthesize`) — content from the model → `asserted`
- A `report` — the server records what the agent sends, but the content is agent-produced → `asserted`
- An `act` — action result relayed by the agent → `asserted`
- A [server function](server-module) / `@sandbox` call — deterministic computation → `verified`
- A [checkpoint](checkpoints) — the server evaluates data and returns a directive → `verified`
- A `retrieve` with provenance (agent fetched data from an external tool and reported the source) → `verified`; without provenance → `asserted`
- A `conclude` validated against its shape → `verified`
- An `ask_user` response from the human → `authority`
- A `start` or status transition → `n/a` (infrastructure, excluded from coverage)

> **Note:** an `asserted` result is not wrong — it is *unverified*. The trace makes the distinction visible so consumers can decide how much verification they need.

## Trust and the trace

The [coverage](coverage) metric rolls up trust across all events: what fraction of the work was verified vs asserted. Infrastructure events (`n/a`) are excluded from the calculation. A trace built entirely from `asserted` steps is a hypothesis; one backed by `verified` and `authority` steps is an audited claim.

Trust badges appear on every row of the event timeline in the [Trace Detail](trace) view. Decisions that gate execution — [checkpoints](checkpoints) — are always `verified` because the server evaluates and responds to them.

## See also

- [Coverage](coverage) — the aggregate trust metric
- [Trace](trace) — the event stream where trust is recorded
- [Checkpoints & directives](checkpoints) — verified decision gates
