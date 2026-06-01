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

- **verified** — events with trust `verified` (checkpoints, conclude, shape checks)
- **asserted** — events with trust `asserted` (cognitive operations like survey, doubt)
- **authority_gates** — events with trust `authority` (server function calls, I/O)

Coverage = `verified / (verified + asserted)`. Authority events are counted separately because they represent external dependencies, not model reasoning.

> **Tip:** coverage is not a quality score. A short fully-verified run can be trivial, and a rich asserted exploration can be exactly what you wanted. Read it alongside the [event timeline](trace), never alone.

## Where you see it

- **Dashboard** — coverage bar on each recent trace
- **Traces list** — sortable coverage column
- **Trace Detail** — donut chart in the Coverage Summary panel
- **Script Detail → Runs** — coverage per invocation

## See also

- [Trust classes](trust-classes) — what verified and asserted mean
- [Trace](trace) — the event stream coverage is computed from
