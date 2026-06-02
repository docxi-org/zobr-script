# ZS — Overview

## What is ZS

ZS (Zobr Script) is a cognitive scripting language: a composable vocabulary of
reasoning operations (`survey`, `doubt`, `synthesize`, …) with variables, control
flow, typed results, and a runtime.

A ZS script describes *how* a task is worked through — making the process
explicit, typed, traceable, and partially verifiable.

- **Not a prompt template.** It has computation, control flow, failure handling,
  and a runtime that holds state between steps.
- **Not a black box.** Every step is a named operation with fixed semantics and a
  recorded outcome.
- **Not an agent platform.** In v0.2 it *directs* the host agent to use its own
  tools; it does not execute external actions itself.

The primary product of a ZS run is **the trace**, not the answer. The trace is an
auditable, typed, step-by-step record of *how* the conclusion was reached. Each
step carries a trust class and the realizer that produced it.

## Roles

There are two agent roles in ZS:

**Executor** — runs pre-saved scripts. Receives code from the server and performs
cognitive operations, dispatching MCP calls for control, sandbox, retrieval, and
human-in-the-loop steps. Default role on registration.

**Architect** — designs and writes scripts. Has access to create, update, and
delete operations. Assigned by the user through the Agents page.

Both roles use the same guide. Topics are annotated with `[both]`, `[executor]`,
or `[architect]` to indicate primary audience, but all topics are accessible to
all agents.

## The Cycle

```
zs_register  →  agent_id + role
zs_guide()   →  read relevant topics
zs_start     →  invocation_id + script code + server ambient
  ↓
  Agent reads the script and executes cognitive operations:
    survey / doubt / synthesize / assert / ...  (performed by the agent)
    report / checkpoint / commit / check         (dispatched to server via MCP)
    @sandbox methods                             (dispatched to server via MCP)
    retrieve                                     (dispatched to server via MCP)
    ask_user                                     (relayed to the human)
    act                                          (directed at host tools)
  ↓
zs_conclude  →  typed result + coverage + trace
```

## Trust Model (summary)

Every trace event carries a trust class determined by the **origin of its
content**, not merely by who executed the operation:

| Content origin | Trust class | Examples |
|----------------|-------------|---------|
| Agent reasoning | **asserted** | survey, doubt, synthesize, report (agent-produced data) |
| Deterministic code | **verified** | @sandbox, checkpoint (server evaluates + responds), shape validation |
| External source | **verified** or asserted-relay | retrieve |
| User | **authority** | ask_user |
| Infrastructure | **n/a** | start, status_transition (not a contribution to the result) |

The goal is not to make the model trusted. It is to route important claims
through verified seams and make asserted parts *visible as such* in the trace.

See topic `trust` for the full model.

## Script Structure (summary)

A script has two parts:

- **Cognitive part** (`.cog.ts`, required) — the reasoning script. Defines types,
  entry functions, and calls cognitive operations. The agent executes this.
- **Server module** (`.srv.ts`, optional) — deterministic per-script controller.
  Extends `ZsScript`, provides `@sandbox` methods, lifecycle overrides
  (`onCheckpoint`, `onReport`), and persistent storage via `this.db`.

Most scripts are purely cognitive. The server module is added only when verified
compute, gating, or persistence is needed.

See topic `script-structure` for details.

## Guide Topics

Call `zs_guide()` without arguments to get the table of contents.
Call `zs_guide({ topic: "operations" })` to read a specific topic.

| Topic | Audience | Description |
|-------|----------|-------------|
| `overview` | both | This document — what ZS is, the cycle, roles |
| `operations` | both | Semantics of each cognitive operation |
| `trust` | both | Trust model: asserted / verified / authority |
| `script-structure` | architect | cog + srv, contract, entry point, conclude<T> |
| `server-module` | architect | ZsScript, Db, Collection, Notes, Directive |
| `store` | architect | Collections, notes, store.d.ts schema |
| `lifecycle` | architect | Hot/cold, TTL, eviction, resume, checkpoints |
| `composition` | architect | define-inline < @sandbox < run |
| `patterns` | architect | Example scripts with annotations |
| `discipline` | both | Commit/check, honesty, fail-closed, HITL |
| `ambients` | both | Full .d.ts signatures — cognitive + server + store |
