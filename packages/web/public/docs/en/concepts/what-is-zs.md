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

## The three roles

| Role | What they do |
|---|---|
| **Architect** | Designs scripts — defines operations, shapes, checkpoints. Has write access to the [library](library). |
| **Executor** | Runs scripts — fills the structure with content via MCP tools. Read-only library access. |
| **Admin** | Manages users, server configuration, monitoring. |

## Core concepts at a glance

- A [script](how-scripts-work) has a cognitive part (what to think) and an optional server part (what to verify)
- An [execution](how-execution-works) produces a trace of events, each tagged with a [trust class](trust-classes)
- [Coverage](coverage) measures how much of the work was verified vs asserted
- [Checkpoints](checkpoints) are server-adjudicated gates that can proceed, halt, or ask for input
- The [store](store) persists data across runs — collections and notes in SQLite

## Next steps

- [How scripts work](how-scripts-work) — the anatomy of a ZS script
- [How execution works](how-execution-works) — what happens when a script runs
