---
title: Hot/cold lifecycle
category: Platform
order: 2
summary: Invocations start hot (in memory), get evicted to cold storage (SQLite snapshot) by TTL or LRU, and can be restored with zs_resume.
tags: [lifecycle, eviction, TTL, LRU, snapshot, resume]
related: [how-execution-works, agents]
---

# Hot/cold lifecycle

The server manages invocations in two states:

## Hot (in memory)

A hot invocation has its full state in memory: the Instance object, the worker process (for scripts with a [server module](server-module)), trace events, handle store. It's ready to accept the next MCP call immediately.

## Cold (snapshot in SQLite)

When an invocation is evicted, the server serializes its full state — including the worker's class instance properties, Set/Map data structures — into a JSON snapshot stored in SQLite. The worker is destroyed and memory is freed.

## What triggers eviction

| Trigger | When |
|---|---|
| **TTL** | Invocation hasn't been touched for `invocationTtlMs` (default: 1 hour) |
| **Awaiting TTL** | Suspended invocation waiting too long (default: 24 hours) → `expired` |
| **LRU** | `maxActiveInvocations` exceeded → oldest by `lastActivityAt` is evicted |
| **Sweep** | TTL sweep runs on `zs_start` and `zs_register` |

## Resume

An evicted invocation can be restored:

```
zs_resume({ invocation_id: "inv_..." }) → full state restored
```

The server loads the snapshot, recreates the worker, restores class instance state (including Set and Map with type tags), and the invocation is hot again — ready to continue where it left off.

If you try to call an evicted invocation without resuming, the server returns:

```json
{ "error": { "kind": "evicted", "message": "call zs_resume to restore" } }
```

## Configuration

Set these in `.env`:

| Variable | Default | Meaning |
|---|---|---|
| `ZS_INVOCATION_TTL` | 3600 (1h) | Seconds before idle eviction |
| `ZS_AWAITING_TTL` | 86400 (24h) | Seconds before suspended → expired |
| `ZS_MAX_ACTIVE_INVOCATIONS` | 100 | LRU cap |

## See also

- [How execution works](how-execution-works) — the full invocation lifecycle
- [Agents](agents) — who owns invocations
