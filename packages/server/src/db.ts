// SQLite-backed Db/Collection/Notes — the persistent storage layer (doc 12 §4).
// Equality-match filtering via json_extract. Dot-notation for nested fields.
import Database, { type Database as DatabaseType } from "better-sqlite3";
import { randomUUID } from "node:crypto";

// ── Types ──

export interface StoreEntry {
  key: string;
  type?: string;
  data: unknown;
}

export interface Collection<T = unknown> {
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

export interface Notes {
  put(key: string, data: unknown, type?: string): void;
  get(key: string): unknown | null;
  delete(key: string): boolean;
  list(type?: string): StoreEntry[];
  keys(type?: string): string[];
}

export type AgentRole = "executor" | "architect";

export interface AgentRecord {
  agent_id: string;
  name: string;
  registered_at: number;
  role: AgentRole;
}

export interface InfraStore {
  saveTrace(trace: { invocation_id: string; script_ref: string; code_snapshot: string; status: string; events: readonly unknown[]; coverage?: unknown; result?: unknown }): void;
  getTrace(invocation_id: string): { invocation_id: string; script_ref: string; status: string; events: unknown[]; coverage?: unknown; result?: unknown } | null;
  recordInvocation(inv: { invocation_id: string; script_ref: string; status: string; agent_id?: string }): void;
  finishInvocation(invocation_id: string, status: string): void;
  saveAgent(agent: AgentRecord): void;
  loadAgents(): AgentRecord[];
  setAgentRole(agentId: string, role: AgentRole): boolean;
  saveSnapshot(invocation_id: string, script_ref: string, state: string): void;
  deleteSnapshot(invocation_id: string): void;
  loadSnapshot(invocation_id: string): { script_ref: string; state: string } | null;
  listTraces(opts?: { scriptRef?: string; status?: string; limit?: number; offset?: number }): { invocation_id: string; script_ref: string; code_snapshot: string; status: string; events_count: number; coverage: unknown; result: unknown; created_at: number }[];
  countTraces(opts?: { scriptRef?: string; status?: string }): number;
  scriptStats(): { script_ref: string; runs: number; last_run: number | null }[];
  countAgentInvocations(agentId: string): number;
  listInvocationsByAgent(agentId: string, limit: number): { invocation_id: string; script_ref: string; status: string; started_at: number; finished_at: number | null }[];
}

export interface Db {
  collection<T = unknown>(name: string): Collection<T>;
  collections(): { name: string; count: number }[];
  notes: Notes;
  infra: InfraStore;
  transaction<T>(fn: () => T): T;
  readonly rawDb: DatabaseType;
  close(): void;
}

// ── Implementation ──

function buildWhere(collection: string, filter?: Record<string, unknown>): { clause: string; params: unknown[] } {
  const conditions = ["collection = ?"];
  const params: unknown[] = [collection];
  if (filter !== undefined) {
    for (const [key, value] of Object.entries(filter)) {
      conditions.push("json_extract(data, ?) = ?");
      params.push(`$.${key}`, typeof value === "object" && value !== null ? JSON.stringify(value) : value);
    }
  }
  return { clause: conditions.join(" AND "), params };
}

const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS zs_documents (
        collection TEXT NOT NULL,
        _id TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (collection, _id)
      );
      CREATE TABLE IF NOT EXISTS zs_notes (
        key TEXT PRIMARY KEY,
        type TEXT,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS zs_traces (
        invocation_id TEXT PRIMARY KEY,
        script_ref TEXT NOT NULL,
        code_snapshot TEXT NOT NULL,
        status TEXT NOT NULL,
        events TEXT NOT NULL,
        coverage TEXT,
        result TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS zs_instances (
        invocation_id TEXT PRIMARY KEY,
        script_ref TEXT NOT NULL,
        state TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS zs_invocations (
        invocation_id TEXT PRIMARY KEY,
        script_ref TEXT NOT NULL,
        status TEXT NOT NULL,
        agent_id TEXT,
        started_at INTEGER NOT NULL,
        finished_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS zs_agents (
        agent_id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        registered_at INTEGER NOT NULL,
        role TEXT NOT NULL DEFAULT 'executor'
      );
      CREATE TABLE IF NOT EXISTS zs_users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'executor',
        active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        last_login INTEGER
      );`,
  },
];

function migrate(db: DatabaseType): void {
  db.exec("CREATE TABLE IF NOT EXISTS _schema_version (version INTEGER NOT NULL)");
  const row = db.prepare("SELECT version FROM _schema_version").get() as { version: number } | undefined;
  let current = row?.version ?? 0;
  if (current === 0 && !row) {
    db.prepare("INSERT INTO _schema_version (version) VALUES (0)").run();
  }
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    db.transaction(() => {
      db.exec(m.sql);
      db.prepare("UPDATE _schema_version SET version = ?").run(m.version);
    })();
    current = m.version;
  }
}

export function createDb(path: string): Db {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  migrate(db);

  function collection<T = unknown>(name: string): Collection<T> {
    return {
      insertOne(doc: T): string {
        const _id = randomUUID();
        const now = Date.now();
        db.prepare("INSERT INTO zs_documents (collection, _id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
          .run(name, _id, JSON.stringify(doc), now, now);
        return _id;
      },

      insertMany(docs: T[]): string[] {
        const insert = db.prepare("INSERT INTO zs_documents (collection, _id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)");
        const ids: string[] = [];
        const tx = db.transaction(() => {
          const now = Date.now();
          for (const doc of docs) {
            const _id = randomUUID();
            insert.run(name, _id, JSON.stringify(doc), now, now);
            ids.push(_id);
          }
        });
        tx();
        return ids;
      },

      findOne(filter?: Partial<T>): (T & { _id: string }) | null {
        const { clause, params } = buildWhere(name, filter as Record<string, unknown> | undefined);
        const row = db.prepare(`SELECT _id, data FROM zs_documents WHERE ${clause} LIMIT 1`).get(...params) as { _id: string; data: string } | undefined;
        if (row === undefined) return null;
        return { ...(JSON.parse(row.data) as T), _id: row._id };
      },

      find(filter?: Partial<T>): (T & { _id: string })[] {
        const { clause, params } = buildWhere(name, filter as Record<string, unknown> | undefined);
        const rows = db.prepare(`SELECT _id, data FROM zs_documents WHERE ${clause}`).all(...params) as { _id: string; data: string }[];
        return rows.map((r) => ({ ...(JSON.parse(r.data) as T), _id: r._id }));
      },

      updateOne(filter: Partial<T>, patch: Partial<T>): number {
        const { clause, params } = buildWhere(name, filter as Record<string, unknown>);
        const row = db.prepare(`SELECT _id, data FROM zs_documents WHERE ${clause} LIMIT 1`).get(...params) as { _id: string; data: string } | undefined;
        if (row === undefined) return 0;
        const merged = { ...JSON.parse(row.data), ...patch };
        db.prepare("UPDATE zs_documents SET data = ?, updated_at = ? WHERE collection = ? AND _id = ?")
          .run(JSON.stringify(merged), Date.now(), name, row._id);
        return 1;
      },

      updateMany(filter: Partial<T>, patch: Partial<T>): number {
        const { clause, params } = buildWhere(name, filter as Record<string, unknown>);
        const rows = db.prepare(`SELECT _id, data FROM zs_documents WHERE ${clause}`).all(...params) as { _id: string; data: string }[];
        if (rows.length === 0) return 0;
        const update = db.prepare("UPDATE zs_documents SET data = ?, updated_at = ? WHERE collection = ? AND _id = ?");
        const tx = db.transaction(() => {
          const now = Date.now();
          for (const row of rows) {
            const merged = { ...JSON.parse(row.data), ...patch };
            update.run(JSON.stringify(merged), now, name, row._id);
          }
        });
        tx();
        return rows.length;
      },

      deleteOne(filter: Partial<T>): number {
        const { clause, params } = buildWhere(name, filter as Record<string, unknown>);
        const row = db.prepare(`SELECT _id FROM zs_documents WHERE ${clause} LIMIT 1`).get(...params) as { _id: string } | undefined;
        if (row === undefined) return 0;
        db.prepare("DELETE FROM zs_documents WHERE collection = ? AND _id = ?").run(name, row._id);
        return 1;
      },

      deleteMany(filter: Partial<T>): number {
        const { clause, params } = buildWhere(name, filter as Record<string, unknown>);
        return db.prepare(`DELETE FROM zs_documents WHERE ${clause}`).run(...params).changes;
      },

      count(filter?: Partial<T>): number {
        const { clause, params } = buildWhere(name, filter as Record<string, unknown> | undefined);
        return (db.prepare(`SELECT COUNT(*) as c FROM zs_documents WHERE ${clause}`).get(...params) as { c: number }).c;
      },
    };
  }

  const notes: Notes = {
    put(key: string, data: unknown, type?: string): void {
      const now = Date.now();
      db.prepare(`INSERT INTO zs_notes (key, type, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET type = excluded.type, data = excluded.data, updated_at = excluded.updated_at`)
        .run(key, type ?? null, JSON.stringify(data), now, now);
    },

    get(key: string): unknown | null {
      const row = db.prepare("SELECT data FROM zs_notes WHERE key = ?").get(key) as { data: string } | undefined;
      return row !== undefined ? JSON.parse(row.data) : null;
    },

    delete(key: string): boolean {
      return db.prepare("DELETE FROM zs_notes WHERE key = ?").run(key).changes > 0;
    },

    list(type?: string): StoreEntry[] {
      const rows = type !== undefined
        ? db.prepare("SELECT key, type, data FROM zs_notes WHERE type = ?").all(type) as { key: string; type: string | null; data: string }[]
        : db.prepare("SELECT key, type, data FROM zs_notes").all() as { key: string; type: string | null; data: string }[];
      return rows.map((r) => ({ key: r.key, ...(r.type !== null ? { type: r.type } : {}), data: JSON.parse(r.data) }));
    },

    keys(type?: string): string[] {
      const rows = type !== undefined
        ? db.prepare("SELECT key FROM zs_notes WHERE type = ?").all(type) as { key: string }[]
        : db.prepare("SELECT key FROM zs_notes").all() as { key: string }[];
      return rows.map((r) => r.key);
    },
  };

  // ── Infrastructure persistence ──

  const infra = {
    saveTrace(trace: { invocation_id: string; script_ref: string; code_snapshot: string; status: string; events: unknown[]; coverage?: unknown; result?: unknown }): void {
      db.prepare("INSERT OR REPLACE INTO zs_traces (invocation_id, script_ref, code_snapshot, status, events, coverage, result, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(trace.invocation_id, trace.script_ref, trace.code_snapshot, trace.status, JSON.stringify(trace.events), trace.coverage !== undefined ? JSON.stringify(trace.coverage) : null, trace.result !== undefined ? JSON.stringify(trace.result) : null, Date.now());
    },

    getTrace(invocation_id: string): { invocation_id: string; script_ref: string; code_snapshot: string; status: string; events: unknown[]; coverage?: unknown; result?: unknown; created_at?: number } | null {
      const row = db.prepare("SELECT * FROM zs_traces WHERE invocation_id = ?").get(invocation_id) as { invocation_id: string; script_ref: string; code_snapshot: string; status: string; events: string; coverage: string | null; result: string | null; created_at: number } | undefined;
      if (row === undefined) return null;
      return { invocation_id: row.invocation_id, script_ref: row.script_ref, code_snapshot: row.code_snapshot, status: row.status, events: JSON.parse(row.events), created_at: row.created_at, ...(row.coverage !== null ? { coverage: JSON.parse(row.coverage) } : {}), ...(row.result !== null ? { result: JSON.parse(row.result) } : {}) };
    },

    recordInvocation(inv: { invocation_id: string; script_ref: string; status: string; agent_id?: string }): void {
      db.prepare("INSERT OR REPLACE INTO zs_invocations (invocation_id, script_ref, status, agent_id, started_at) VALUES (?, ?, ?, ?, ?)")
        .run(inv.invocation_id, inv.script_ref, inv.status, inv.agent_id ?? null, Date.now());
    },

    finishInvocation(invocation_id: string, status: string): void {
      db.prepare("UPDATE zs_invocations SET status = ?, finished_at = ? WHERE invocation_id = ?")
        .run(status, Date.now(), invocation_id);
    },

    saveAgent(agent: AgentRecord): void {
      db.prepare("INSERT OR IGNORE INTO zs_agents (agent_id, name, registered_at, role) VALUES (?, ?, ?, ?)")
        .run(agent.agent_id, agent.name, agent.registered_at, agent.role);
    },

    loadAgents(): AgentRecord[] {
      return db.prepare("SELECT agent_id, name, registered_at, role FROM zs_agents").all() as AgentRecord[];
    },

    setAgentRole(agentId: string, role: AgentRole): boolean {
      return db.prepare("UPDATE zs_agents SET role = ? WHERE agent_id = ?").run(role, agentId).changes > 0;
    },

    saveSnapshot(invocation_id: string, script_ref: string, state: string): void {
      db.prepare("INSERT OR REPLACE INTO zs_instances (invocation_id, script_ref, state, updated_at) VALUES (?, ?, ?, ?)")
        .run(invocation_id, script_ref, state, Date.now());
    },

    deleteSnapshot(invocation_id: string): void {
      db.prepare("DELETE FROM zs_instances WHERE invocation_id = ?").run(invocation_id);
    },

    loadSnapshot(invocation_id: string): { script_ref: string; state: string } | null {
      const row = db.prepare("SELECT script_ref, state FROM zs_instances WHERE invocation_id = ?").get(invocation_id) as { script_ref: string; state: string } | undefined;
      return row ?? null;
    },

    listTraces(opts?: { scriptRef?: string; status?: string; limit?: number; offset?: number }) {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (opts?.scriptRef) { conditions.push("script_ref = ?"); params.push(opts.scriptRef); }
      if (opts?.status) { conditions.push("status = ?"); params.push(opts.status); }
      const where = conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : "";
      let sql = `SELECT invocation_id, script_ref, code_snapshot, status, events, coverage, result, created_at FROM zs_traces${where} ORDER BY created_at DESC`;
      if (opts?.limit !== undefined) { sql += " LIMIT ?"; params.push(opts.limit); }
      if (opts?.offset !== undefined) { sql += " OFFSET ?"; params.push(opts.offset); }
      const rows = db.prepare(sql).all(...params) as { invocation_id: string; script_ref: string; code_snapshot: string; status: string; events: string; coverage: string | null; result: string | null; created_at: number }[];
      return rows.map((r) => ({
        invocation_id: r.invocation_id,
        script_ref: r.script_ref,
        code_snapshot: r.code_snapshot,
        status: r.status,
        events_count: (JSON.parse(r.events) as unknown[]).length,
        coverage: r.coverage ? JSON.parse(r.coverage) as unknown : null,
        result: r.result ? JSON.parse(r.result) as unknown : null,
        created_at: r.created_at,
      }));
    },

    countTraces(opts?: { scriptRef?: string; status?: string }): number {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (opts?.scriptRef) { conditions.push("script_ref = ?"); params.push(opts.scriptRef); }
      if (opts?.status) { conditions.push("status = ?"); params.push(opts.status); }
      const where = conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : "";
      const row = db.prepare(`SELECT COUNT(*) as c FROM zs_traces${where}`).get(...params) as { c: number } | undefined;
      return row?.c ?? 0;
    },

    scriptStats() {
      return db.prepare("SELECT script_ref, COUNT(*) as runs, MAX(created_at) as last_run FROM zs_traces GROUP BY script_ref")
        .all() as { script_ref: string; runs: number; last_run: number | null }[];
    },

    countAgentInvocations(agentId: string): number {
      const row = db.prepare("SELECT COUNT(*) as c FROM zs_invocations WHERE agent_id = ?").get(agentId) as { c: number } | undefined;
      return row?.c ?? 0;
    },

    listInvocationsByAgent(agentId: string, limit: number) {
      return db.prepare("SELECT invocation_id, script_ref, status, started_at, finished_at FROM zs_invocations WHERE agent_id = ? ORDER BY started_at DESC LIMIT ?")
        .all(agentId, limit) as { invocation_id: string; script_ref: string; status: string; started_at: number; finished_at: number | null }[];
    },
  };

  return {
    rawDb: db,
    collection,
    collections(): { name: string; count: number }[] {
      const rows = db.prepare("SELECT collection as name, COUNT(*) as count FROM zs_documents GROUP BY collection").all() as { name: string; count: number }[];
      return rows;
    },
    notes,
    infra,
    transaction<T>(fn: () => T): T { return db.transaction(fn)(); },
    close() { db.close(); },
  };
}
