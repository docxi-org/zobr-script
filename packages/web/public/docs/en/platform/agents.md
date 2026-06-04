---
title: Agents
category: Platform
order: 1
summary: An agent is a persistent identity that registers by name, receives an agent_id, and owns its invocations.
tags: [agents, registration, identity]
related: [how-execution-works, hot-cold]
---

# Agents

An **agent** is any MCP client that runs ZS scripts — typically an LLM in a chat session. Before doing anything, an agent must register.

## Registration

```
zs_register({ name: "Smith" }) → { agent_id: "ag_68de4eb2-813", role: "executor", guide: "...", active_invocations: [] }
```

Registration is **idempotent by name**: the same name always returns the same `agent_id`. This means an agent can reconnect across sessions without losing its identity. The response also includes the full system **guide** for the agent's role — no separate `zs_guide()` call needed.

The `agent_id` is required on every subsequent MCP call (except `zs_register` itself). The server rejects calls with an unknown `agent_id`.

## Roles

Every agent has a role that determines which MCP tools it can use:

| Role | Tools | Assigned how |
|---|---|---|
| **Executor** | Run scripts, report, checkpoint, conclude, store reads | Default on registration |
| **Architect** | Everything executor can do, plus: `zs_create`, `zs_update`, `zs_delete`, `zs_validate` | User switches on the Agents page |

Role gating happens at the tool call level — the agent sees all tools in the MCP schema, but architect-only calls return an error if the agent's role is `executor`.

## What agents own

- **Active invocations** — currently running scripts started by this agent
- **History** — all past invocations (stored in the invocations table)
- **Store lockout** — during an active invocation, standalone store writes are blocked for that agent (writes must go through [checkpoints](checkpoints))

## Agents page

The **Agents** page shows all registered agents with:

- Name and agent_id
- Registration date
- Number of active invocations
- Total runs
- Click through to invocation history

## Persistence

Agents are persisted in SQLite (`zs_agents` table). They survive server restarts. Active invocations are ephemeral — they live in memory and are lost on restart (but can be restored via [hot/cold lifecycle](hot-cold) snapshots).

## See also

- [How execution works](how-execution-works) — the start-to-conclude cycle
- [Hot/cold lifecycle](hot-cold) — what happens to invocations on eviction
