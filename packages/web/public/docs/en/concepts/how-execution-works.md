---
title: How execution works
category: What is ZS
order: 3
summary: An agent registers, starts a script, executes operations through MCP tools, and finalizes with conclude. The lifecycle goes from start to a terminal status.
tags: [execution, lifecycle, invocation, status]
related: [what-is-zs, how-scripts-work, trace, agents, hot-cold]
---

# How execution works

An **invocation** is one run of a script by an agent. Here's what happens:

## The execution cycle

1. **Register** — the agent calls `zs_register` with its name. Gets back an `agent_id` used for all subsequent calls.
2. **Start** — `zs_start` with a `script_ref`. Server loads the script, creates an invocation, returns the cognitive code + an `invocation_id`.
3. **Execute** — the agent reads the code and fulfills each operation (survey, doubt, etc.) by reasoning, then reports results via `zs_report`, `zs_checkpoint`, or other MCP tools.
4. **Conclude** — `zs_conclude` with the final result. Server validates it against the declared type, marks the invocation as `done`.

Every step is recorded in the [trace](trace). The agent carries the `invocation_id` on every call so the server knows which run it belongs to.

## Statuses

| Status | Terminal? | How it happens |
|---|---|---|
| `running` | no | Created by `zs_start` — actively executing |
| `awaiting_user` | no | Waiting for human input (`ask` directive) |
| `suspended` | no | Evicted to cold storage (LRU/TTL pressure) |
| `done` | yes | `zs_conclude` succeeded |
| `halted` | yes | A [checkpoint](checkpoints) returned `halt` |
| `halted_budget` | yes | Budget (steps or iterations) exhausted |
| `aborted` | yes | `zs_abort` called |
| `errored` | yes | Unrecoverable failure |
| `expired` | yes | Awaiting input too long (awaiting TTL) |

The typical flow is `running → done`. A checkpoint returning `halt` leads to `halted`. Running out of budget leads to `halted_budget`.

## Budgets and TTLs

Every invocation runs under limits:

- **Step budget** — max operations before forced abort (default: 1000)
- **Iteration budget** — max iterations for loops (default: 100)
- **Invocation TTL** — wall-clock time before eviction (default: 1 hour)
- **Awaiting TTL** — how long a suspended invocation waits for input (default: 24 hours)

Exceeding any limit terminates the run. See [Hot/cold lifecycle](hot-cold) for what happens to evicted invocations.

## Parent and child runs

A script can spawn sub-invocations. Children carry a `parent_invocation_id` and the parent lists its children. The Trace Detail view shows this tree so you can walk the full execution graph.

## Trace events during execution

A typical invocation produces these events in its [trace](trace):

1. `start` — invocation created (verified)
2. `report` — intermediate observations from the agent (asserted)
3. `checkpoint` — server decision gate (verified), with a [directive](checkpoints)
4. `conclude` — result validated (verified)
5. `status_transition` — final status change to `done` (verified)

## See also

- [Trace](trace) — the event stream produced by execution
- [Agents](agents) — registration, identity, active invocations
- [Hot/cold lifecycle](hot-cold) — what happens when invocations are evicted
