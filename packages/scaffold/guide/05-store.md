# Store

ZS provides persistent storage through two mechanisms: **collections**
(document-oriented) and **notes** (key-value). Both are backed by SQLite.

## Two Access Paths

| Path | Context | How |
|------|---------|-----|
| Inside a script | Server module (`.srv.ts`) | `this.db.collection(name)`, `this.db.notes` |
| Outside a script | Any registered agent | Standalone MCP tools: `zs_store_insert`, `zs_store_find`, etc. |

Both paths write to the same SQLite database. Data persists across invocations.

## Collections

Collections are named groups of JSON documents, similar to MongoDB collections.
Each document gets an auto-generated `_id`.

### Standalone Tools

| Tool | Description |
|------|-------------|
| `zs_store_insert` | Insert a document into a collection |
| `zs_store_find` | Query documents with a filter |
| `zs_store_update` | Update matching documents |
| `zs_store_delete` | Delete matching documents |
| `zs_store_collections` | List all collections with counts |

### In a Server Module

```ts
const coll = this.db.collection<Analysis>("analyses");
coll.insertOne({ topic: "X", findings: [...] });
const docs = coll.find({ topic: "X" });
```

See topic `server-module` for the full `Collection<T>` API.

## Notes

Notes are simple key-value pairs with an optional type tag. Useful for metadata,
summaries, and cross-invocation state.

### Standalone Tools

| Tool | Description |
|------|-------------|
| `zs_store_put` | Set a note (key + data + optional type) |
| `zs_store_get` | Get a note by key |
| `zs_store_list` | List notes, optionally filtered by type |

### In a Server Module

```ts
this.db.notes.put("insight:run42", { pattern: "..." }, "architectural-insight");
const insight = this.db.notes.get("insight:run42");
const all = this.db.notes.list("architectural-insight");
```

## store.d.ts — Typed Collection Schemas

The optional `store.d.ts` in the library root defines TypeScript interfaces for
collections. Each exported interface name becomes a collection name:

```ts
export interface Analysis {
  topic: string;
  summary: string;
  findings: { fact: string; source: string }[];
  meta: { confidence: "low" | "medium" | "high"; runDate: string };
}
```

This enables type-safe `this.db.collection<Analysis>("Analysis")` in server
modules. The file is preserved across server restarts (not overwritten by
scaffold).

## See Also

- Topic `server-module` — using `this.db` in `.srv.ts`
- Topic `ambients` — `store.d.ts` content included in ambient reference
