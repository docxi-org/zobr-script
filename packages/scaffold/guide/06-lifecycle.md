# Invocation Lifecycle

## States

Every script invocation moves through a state machine:

```
         ┌──────────┐
         │  running  │ ← zs_start creates the invocation here
         └────┬──────┘
              │
    ┌─────────┼──────────┬────────────┐
    ▼         ▼          ▼            ▼
  done    halted     aborted      errored
           │                        │
           ▼                        ▼
        expired                  expired
```

| Status | Meaning | Terminal? |
|--------|---------|-----------|
| `running` | Active, accepting MCP calls | No |
| `suspended` | Awaiting human input (`{ ask }` directive) | No |
| `done` | Completed via `zs_conclude` | Yes |
| `halted` | Stopped by a `halt` directive | Yes |
| `aborted` | Stopped by `zs_abort` | Yes |
| `errored` | Unrecoverable error | Yes |
| `expired` | TTL exceeded while in non-terminal state | Yes |

## Hot and Cold

An invocation can be in one of two physical states:

**Hot** — Instance in memory, worker active, ready for calls. This is the normal
state during execution.

**Cold** — Snapshot saved to SQLite, memory and worker freed. This happens when:
- TTL expires without activity (configurable via `ZS_INVOCATION_TTL`)
- LRU pressure (too many active invocations, controlled by
  `ZS_MAX_ACTIVE_INVOCATIONS`)

### Resume

A cold invocation can be restored with `zs_resume`:
- Full restore from snapshot (Instance state + worker state)
- The invocation picks up where it left off
- The agent receives the script code and current state

### Design Implications for Architects

- **Use checkpoints for recoverability.** If an invocation might be evicted
  mid-run (long tasks, many concurrent invocations), place `checkpoint` calls at
  meaningful milestones. The server module can persist state in `this.db` during
  `onCheckpoint`, enabling recovery even if the snapshot is lost.

- **Respect TTL.** The default invocation TTL is 1 hour (`ZS_INVOCATION_TTL`).
  Scripts designed for long-running work should checkpoint early and often.

- **Awaiting TTL.** Invocations in `suspended` state (waiting for human input)
  have a separate, longer TTL (`ZS_AWAITING_TTL`, default 24 hours).

## Budgets

Each invocation has resource budgets:

| Budget | Default | Meaning |
|--------|---------|---------|
| `steps` | 1000 | Maximum number of MCP tool calls |
| `iterations` | 100 | Maximum loop iterations (prevent runaway) |

Exceeding a budget transitions the invocation to `errored`. The architect should
design scripts that complete well within budget, using `checkpoint` to persist
partial results in case of budget exhaustion.

## Abort

`zs_abort` immediately terminates an invocation:
- Writes a partial trace
- Cleans up the worker
- Transitions to `aborted` (terminal)

Use when an invocation is stuck or no longer needed.

## See Also

- Topic `script-structure` — how checkpoints fit into script design
- Topic `trust` — how checkpoint is a verified seam
- Topic `discipline` — commit/check pattern for structured milestones
