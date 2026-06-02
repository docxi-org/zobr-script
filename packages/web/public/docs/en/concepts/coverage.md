---
title: Coverage
category: Key concepts
order: 3
summary: Coverage is the verified-to-asserted ratio across all events — a single number showing how grounded a run is.
tags: [coverage, trust, audit]
related: [trust-classes, trace]
---

# Coverage

**Coverage** summarises an entire invocation in one figure: of everything the script did, how much was [verified](trust-classes) versus merely [asserted](trust-classes)?

```
verified:  57%  ████████░░░
asserted:  43%  ██████░░░░░
```

## How it's calculated

The server counts events by [trust class](trust-classes) at the end of each run:

- **verified** — events with trust `verified` (sandbox calls, checkpoints, conclude shape validation)
- **asserted** — events with trust `asserted` (cognitive operations, `report` with agent-produced data, `act`)
- **authority_gates** — events with trust `authority` (human-in-the-loop responses)
- **n/a** — infrastructure events (`start`, status transitions) — **excluded** from the ratio

Coverage = `verified / (verified + asserted)`. Authority events are counted separately because they represent external decisions, not model reasoning. Infrastructure events (`n/a`) are excluded entirely.

The key distinction: `report` counts as **asserted** because the server merely records what the agent sends — the content originates from the agent. `checkpoint` counts as **verified** because the server evaluates the data and responds with a directive.

> **Tip:** coverage is not a quality score. A short fully-verified run can be trivial, and a rich asserted exploration can be exactly what you wanted. Read it alongside the [event timeline](trace), never alone.

## Where you see it

- **Dashboard** — coverage bar on each recent trace
- **Traces list** — sortable coverage column
- **Trace Detail** — donut chart in the Coverage Summary panel
- **Script Detail → Runs** — coverage per invocation

## See also

- [Trust classes](trust-classes) — what verified and asserted mean
- [Trace](trace) — the event stream coverage is computed from
