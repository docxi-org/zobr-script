---
title: What is ZS
category: What is ZS
order: 1
summary: ZS is a cognitive scripting language where the script defines the structure of reasoning and the agent fills it with content. The trace — not the answer — is the product.
tags: [overview, introduction]
related: [how-scripts-work, how-execution-works]
---

# What is ZS

ZS (Zobr Script) is a cognitive scripting language delivered as an MCP service. A ZS script doesn't compute an answer — it describes a **structure of reasoning**: what to explore, what to doubt, where to commit, when to check. An LLM agent executes the script by filling that structure with real content.

The key insight: **the trace is the product, not the answer**. When a script finishes, it produces an ordered log of every step — what was surveyed, what was challenged, where the server verified a claim, and how confident the conclusion is. This trace is auditable, reproducible, and inspectable after the fact.

## Why this matters

Without structure, an LLM produces a plausible-sounding answer with no way to tell which parts are grounded and which are guesses. ZS fixes this by separating two concerns:

- **Structure** (the script) — written by an architect, defines the reasoning protocol
- **Content** (the execution) — produced by an agent at runtime, tagged with trust

This separation means you can run the same script on different topics and get comparable traces. You can audit a trace without re-running the script. You can tell at a glance whether a conclusion rests on checked facts or on assertion alone.

## Roles

ZS distinguishes between **agent roles** (for the LLM executing scripts) and **user roles** (for humans managing the system).

**Agent roles** — assigned to each registered [agent](agents):

| Role | What the agent can do |
|---|---|
| **Executor** | Runs scripts — fills the structure with content via MCP tools. Read-only library access. Default role on registration. |
| **Architect** | Everything an executor can do, plus: create, update, and delete scripts in the [library](library). |

**User roles** — assigned to humans who log in to the SPA:

| Role | What the user can do |
|---|---|
| **Admin** | Full access: manage users, change agent roles, server configuration, monitoring. |
| **Architect** | View and manage scripts, traces, store. Cannot manage users. |
| **Executor** | View traces, scripts, store. Cannot modify scripts or manage users. |

An agent's role can be changed by a user on the [Agents](agents) page.

## Core concepts at a glance

- A [script](how-scripts-work) has a cognitive part (what to think) and an optional server part (what to verify)
- An [execution](how-execution-works) produces a trace of events, each tagged with a [trust class](trust-classes)
- [Coverage](coverage) measures how much of the work was verified vs asserted
- [Checkpoints](checkpoints) are server-adjudicated gates that can proceed, halt, or ask for input
- The [store](store) persists data across runs — collections and notes in SQLite

## Next steps

- [How scripts work](how-scripts-work) — the anatomy of a ZS script
- [How execution works](how-execution-works) — what happens when a script runs
