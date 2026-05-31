// Canonical server surface — visible ONLY to server parts (*.srv.ts).
// ZsScript base class provides this.db, this.config, this.invocation.
// No fetch / fs / process / network — enforced by types:[] + vm sandbox.

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
