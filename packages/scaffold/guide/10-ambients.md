# Ambient Declarations

Full TypeScript signatures available to scripts. These are the canonical API
reference — when in doubt, the `.d.ts` is authoritative.

In production, this topic dynamically includes the current ambient files from
the server. The signatures below are the reference copy.

## Cognitive Ambient (`zs.cognitive.d.ts`)

Available in `.cog.ts` files. No Node/DOM globals — the type environment is
closed.

```ts
type Sem = unknown;
type Source = "kb" | "web" | (string & {});
type Directive = "proceed" | "warn" | "halt" | { ask: string; choices?: string[] };
type Criteria = { what: string; basis: string; verify: string; boundaries: string };
type State = { status: "open" | "converging" | "stuck"; tension: string; missing: string };

// Discovery
declare function survey(topic: string, o?: { count?: number }): Sem[];
declare function ground(claim: Sem, o?: { extract?: string[] }): Sem;
declare function retrieve(query: string, o?: { from?: Source }): Sem;

// Argument
declare function assert(thesis: Sem, o?: { based_on?: Sem }): Sem;
declare function doubt(target: Sem, o?: { lens?: string }): Sem;
declare function contrast(target: Sem, o?: { with?: Sem }): Sem;
declare function analogy(target: Sem, o?: { from?: string }): Sem;

// Synthesis
declare function synthesize(sources: Sem, o?: { method?: string }): Sem;
declare function reframe(target: Sem, o?: { lens?: string }): Sem;

// Meta
declare function assess(o?: { scale?: number }): State;
declare function pivot(reason: string): void;
declare function scope(direction: "narrow" | "wide", o?: { focus?: string }): void;

// Control
declare function commit(c: Criteria): Criteria;
declare function check(c: Criteria, results: Sem): void;
declare function report(label: string, data: Sem): void;
declare function checkpoint(label: string, data: Sem): Directive;

// Composition
declare function run<I, O>(ref: string, inputs: I): O;

// Human-in-the-loop
declare function ask_user(prompt: string): string;
declare function ask_user<T extends string>(prompt: string, choices: readonly T[]): T;

// Action
declare function act(intent: string, o?: { reversible?: boolean }): Sem;

// Output
declare function conclude<T>(result: T): T;
```

## Server Ambient (`zs.server.d.ts`)

Available in `.srv.ts` files. No fetch/fs/process/network.

```ts
type Sem = unknown;
type Directive = "proceed" | "warn" | "halt" | { ask: string; choices?: string[] };

interface Collection<T = unknown> {
  insertOne(doc: T): string;
  insertMany(docs: T[]): string[];
  findOne(filter?: Partial<T>): (T & { _id: string }) | null;
  find(filter?: Partial<T>): (T & { _id: string })[];
  updateOne(filter: Partial<T>, patch: Partial<T>): number;
  updateMany(filter: Partial<T>, patch: Partial<T>): number;
  deleteOne(filter: Partial<T>): number;
  deleteMany(filter: Partial<T>): number;
  count(filter?: Partial<T>): number;
}

interface StoreEntry {
  key: string;
  type?: string;
  data: unknown;
}

interface Notes {
  put(key: string, data: unknown, type?: string): void;
  get(key: string): unknown | null;
  delete(key: string): boolean;
  list(type?: string): StoreEntry[];
  keys(type?: string): string[];
}

interface Db {
  collection<T = unknown>(name: string): Collection<T>;
  collections(): { name: string; count: number }[];
  notes: Notes;
}

declare class ZsScript {
  protected constructor();
  readonly db: Db;
  readonly config: Record<string, unknown>;
  readonly invocation: {
    id: string;
    scriptRef: string;
    depth: number;
    parentId?: string;
  };

  onStart?(): Record<string, unknown>;
  onCheckpoint?(label: string, data: unknown): Directive;
  onReport?(label: string, data: unknown): void;
}
```

## Store Schema (`store.d.ts`)

The current `store.d.ts` from the library root is included here when available.
Each exported interface defines a typed collection.

```ts
// (loaded dynamically from the library — see zs_guide implementation)
```

## See Also

- Topic `operations` — semantics behind each cognitive function
- Topic `server-module` — how to use the server ambient in practice
- Topic `store` — collections and notes usage
