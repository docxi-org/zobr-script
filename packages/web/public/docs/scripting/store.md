---
title: Store
category: Scripting
order: 2
summary: The store provides persistent collections and notes in SQLite, accessible from server modules and MCP tools.
tags: [store, collections, notes, persistence, SQLite]
related: [server-module, how-scripts-work]
---

# Store

The store is a persistent data layer backed by SQLite. It survives across invocations and server restarts. There are two kinds of storage:

## Collections

Typed document collections, similar to MongoDB. Each document gets a unique `_id` on insert.

```ts
// In a server module
const analyses = this.db.collection<Analysis>("analyses");
analyses.insertOne({ topic: "climate", confidence: "high", summary: "..." });
const results = analyses.find({ topic: "climate" });
```

Operations: `insertOne`, `insertMany`, `find`, `findOne`, `updateOne`, `updateMany`, `deleteOne`, `deleteMany`, `count`.

Filtering uses equality matching with dot-notation for nested fields — implemented via SQLite's `json_extract`.

## Notes

A simpler key-value store for configuration, cursors, and small state:

```ts
this.db.notes.put("cursor:feed", { last: "2026-06-01" }, "cursor");
const cursor = this.db.notes.get("cursor:feed");
this.db.notes.list("cursor"); // all notes of type "cursor"
```

## Where you see it

The **Store** page in the console shows:
- **Collections** tab — list of collections with document count, browse documents, JSON detail view
- **Notes** tab — key/type/data, filterable by type

Both are read-only in the UI. Writes go through [server modules](server-module) or MCP tools (`zs_store_insert`, `zs_store_put`, etc.).

## Schema validation (optional)

If a `store.d.ts` file exists in the library root with exported interfaces, the server validates documents against those interfaces on insert. This is optional — without it, collections accept any shape.

```ts
// store.d.ts
export interface Analysis {
  topic: string;
  confidence: "low" | "medium" | "high";
  summary: string;
}
```

## Write lockout

During an active invocation, the agent that owns the run cannot write to the store through standalone MCP tools (`zs_store_insert`, etc.) — writes must go through [checkpoints](checkpoints) and the server module. This prevents the model from silently modifying persistent state outside the script's control flow.

## See also

- [Server module](server-module) — accessing `this.db`
- [How scripts work](how-scripts-work) — the cog + srv split
