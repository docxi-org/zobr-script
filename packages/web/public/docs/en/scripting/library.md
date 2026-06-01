---
title: Library
category: Scripting
order: 3
summary: The library is a folder tree of scripts. Each script is a file (not a folder), identified by its path without extension.
tags: [library, scripts, files, scaffold]
related: [how-scripts-work, server-module]
---

# Library

The library is a directory on the server that holds all scripts. It's the source of truth for what scripts are available.

## File-based model

A script is a **file**, not a folder:

```
zs-lib/
  examples/
    hello.cog.ts                 ← script_ref = "examples/hello"
    insight.cog.ts               ← script_ref = "examples/insight"
    insight.srv.ts               ← paired server module
  analysis/
    market/
      trends.cog.ts              ← script_ref = "analysis/market/trends"
      trends.srv.ts
  zs.cognitive.d.ts              ← scaffold (auto-generated)
  zs.server.d.ts
  tsconfig*.json
```

- **`script_ref`** = path from library root to the base name, without extension
- A script is a `.cog.ts` file, optionally paired with a `.srv.ts` of the same name
- Folders are pure grouping — any number of scripts at any nesting depth
- The server resolves `script_ref` to `${libraryRoot}/${ref}.cog.ts`

## Scaffold files

On startup, the server materializes canonical files into the library root:

- `zs.cognitive.d.ts` — type declarations for cognitive operations
- `zs.server.d.ts` — type declarations for ZsScript base class
- `tsconfig*.json` — TypeScript configurations for VS Code

These are overwritten on every restart to stay in sync. The exception is `store.d.ts` — if it exists, the server leaves it alone (it's user-edited).

## Scripts page

The **Scripts** page shows the library in three views:

- **Tree** — collapsible folder hierarchy with script counts
- **Cards** — visual cards with description, run count, last run
- **Table** — sortable list with path, server badge, stats

The description on each card comes from the first JSDoc comment (`/** ... */`) in the `.cog.ts` file.

## Creating scripts

New scripts are created through the **New Script** page or the MCP tool `zs_create`. The architect specifies a folder (optional) and a name. The server validates the script before writing it to disk.

## See also

- [How scripts work](how-scripts-work) — anatomy of a script
- [Server module](server-module) — the optional srv part
