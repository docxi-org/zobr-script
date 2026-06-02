// Sandbox worker — runs srv class instances in an isolated thread (doc 12 §3).
// This file is transpiled to CJS at module load time and executed via
// new Worker(code, { eval: true }). Do NOT import this file directly.
import { parentPort, workerData } from "node:worker_threads";
import * as vm from "node:vm";
import { randomUUID } from "node:crypto";
import BetterSqlite3 from "better-sqlite3";

// ── Types (stripped at transpile) ──

interface WorkerData {
  moduleSource: string;
  dbPath: string;
  safeGlobals: string[];
}

interface Msg {
  type: string;
  invocationId?: string;
  callId?: number;
  fn?: string;
  args?: unknown[];
  method?: string;
  config?: Record<string, unknown>;
  invocation?: { id: string; scriptRef: string; depth: number; parentId?: string };
  state?: Record<string, unknown>;
}

// ── Db implementation ──

function createWorkerDb(path: string) {
  const db = new BetterSqlite3(path);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.exec(
    "CREATE TABLE IF NOT EXISTS zs_documents (collection TEXT NOT NULL, _id TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (collection, _id))",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS zs_notes (key TEXT PRIMARY KEY, type TEXT, data TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
  );

  function buildWhere(col: string, filter?: Record<string, unknown>) {
    const conds = ["collection = ?"];
    const params: unknown[] = [col];
    if (filter) {
      for (const [k, v] of Object.entries(filter)) {
        conds.push("json_extract(data, ?) = ?");
        params.push("$." + k, typeof v === "object" && v !== null ? JSON.stringify(v) : v);
      }
    }
    return { clause: conds.join(" AND "), params };
  }

  function collection(name: string) {
    return {
      insertOne(doc: unknown) {
        const id = randomUUID();
        const now = Date.now();
        db.prepare("INSERT INTO zs_documents VALUES (?,?,?,?,?)").run(name, id, JSON.stringify(doc), now, now);
        return id;
      },
      insertMany(docs: unknown[]) {
        const ins = db.prepare("INSERT INTO zs_documents VALUES (?,?,?,?,?)");
        const ids: string[] = [];
        const tx = db.transaction(() => {
          const now = Date.now();
          for (const d of docs) {
            const id = randomUUID();
            ins.run(name, id, JSON.stringify(d), now, now);
            ids.push(id);
          }
        });
        tx();
        return ids;
      },
      findOne(filter?: Record<string, unknown>) {
        const { clause, params } = buildWhere(name, filter);
        const r = db.prepare("SELECT _id, data FROM zs_documents WHERE " + clause + " LIMIT 1").get(...params) as { _id: string; data: string } | undefined;
        return r ? { ...JSON.parse(r.data), _id: r._id } : null;
      },
      find(filter?: Record<string, unknown>) {
        const { clause, params } = buildWhere(name, filter);
        return (db.prepare("SELECT _id, data FROM zs_documents WHERE " + clause).all(...params) as { _id: string; data: string }[])
          .map((r) => ({ ...JSON.parse(r.data), _id: r._id }));
      },
      updateOne(filter: Record<string, unknown>, patch: Record<string, unknown>) {
        const { clause, params } = buildWhere(name, filter);
        const r = db.prepare("SELECT _id, data FROM zs_documents WHERE " + clause + " LIMIT 1").get(...params) as { _id: string; data: string } | undefined;
        if (!r) return 0;
        db.prepare("UPDATE zs_documents SET data=?, updated_at=? WHERE collection=? AND _id=?")
          .run(JSON.stringify({ ...JSON.parse(r.data), ...patch }), Date.now(), name, r._id);
        return 1;
      },
      updateMany(filter: Record<string, unknown>, patch: Record<string, unknown>) {
        const { clause, params } = buildWhere(name, filter);
        const rows = db.prepare("SELECT _id, data FROM zs_documents WHERE " + clause).all(...params) as { _id: string; data: string }[];
        if (!rows.length) return 0;
        const u = db.prepare("UPDATE zs_documents SET data=?, updated_at=? WHERE collection=? AND _id=?");
        const tx = db.transaction(() => {
          const now = Date.now();
          for (const r of rows) u.run(JSON.stringify({ ...JSON.parse(r.data), ...patch }), now, name, r._id);
        });
        tx();
        return rows.length;
      },
      deleteOne(filter: Record<string, unknown>) {
        const { clause, params } = buildWhere(name, filter);
        const r = db.prepare("SELECT _id FROM zs_documents WHERE " + clause + " LIMIT 1").get(...params) as { _id: string } | undefined;
        if (!r) return 0;
        db.prepare("DELETE FROM zs_documents WHERE collection=? AND _id=?").run(name, r._id);
        return 1;
      },
      deleteMany(filter: Record<string, unknown>) {
        const { clause, params } = buildWhere(name, filter);
        return db.prepare("DELETE FROM zs_documents WHERE " + clause).run(...params).changes;
      },
      count(filter?: Record<string, unknown>) {
        const { clause, params } = buildWhere(name, filter);
        return (db.prepare("SELECT COUNT(*) as c FROM zs_documents WHERE " + clause).get(...params) as { c: number }).c;
      },
    };
  }

  const notes = {
    put(key: string, data: unknown, type?: string) {
      const now = Date.now();
      db.prepare("INSERT INTO zs_notes VALUES (?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET type=excluded.type, data=excluded.data, updated_at=excluded.updated_at")
        .run(key, type || null, JSON.stringify(data), now, now);
    },
    get(key: string) {
      const r = db.prepare("SELECT data FROM zs_notes WHERE key=?").get(key) as { data: string } | undefined;
      return r ? JSON.parse(r.data) : null;
    },
    delete(key: string) {
      return db.prepare("DELETE FROM zs_notes WHERE key=?").run(key).changes > 0;
    },
    list(type?: string) {
      const rows = (type != null
        ? db.prepare("SELECT key,type,data FROM zs_notes WHERE type=?").all(type)
        : db.prepare("SELECT key,type,data FROM zs_notes").all()) as { key: string; type: string | null; data: string }[];
      return rows.map((r) => ({ key: r.key, ...(r.type ? { type: r.type } : {}), data: JSON.parse(r.data) }));
    },
    keys(type?: string) {
      const rows = (type != null
        ? db.prepare("SELECT key FROM zs_notes WHERE type=?").all(type)
        : db.prepare("SELECT key FROM zs_notes").all()) as { key: string }[];
      return rows.map((r) => r.key);
    },
  };

  return {
    collection,
    notes,
    collections() {
      return db.prepare("SELECT collection as name, COUNT(*) as count FROM zs_documents GROUP BY collection").all();
    },
    close() { db.close(); },
  };
}

// ── Setup ──

const { moduleSource, dbPath, safeGlobals } = workerData as WorkerData;
const workerDb = createWorkerDb(dbPath);
const instances = new Map<string, Record<string, unknown>>();

// ── ZsScript base class ──

class ZsScript {
  db: unknown;
  config: Record<string, unknown>;
  invocation: unknown;
  constructor(db: unknown, config: Record<string, unknown>, invocation: unknown) {
    this.db = db;
    this.config = config || {};
    this.invocation = invocation;
  }
}

// ── Load srv module ──

const sandbox = Object.create(null) as Record<string, unknown>;
safeGlobals.forEach((k) => { sandbox[k] = (globalThis as Record<string, unknown>)[k]; });
sandbox.undefined = undefined;
sandbox.NaN = NaN;
sandbox.Infinity = Infinity;
sandbox.ZsScript = ZsScript;
sandbox.exports = {};
sandbox.module = { exports: sandbox.exports };
const ctx = vm.createContext(sandbox);

type ScriptClassType = new (db: unknown, config: Record<string, unknown>, invocation: unknown) => Record<string, unknown>;
let ScriptClass: ScriptClassType | null = null;
let serverFunctions: string[] = [];
try {
  vm.runInContext(moduleSource, ctx);
  ScriptClass = ((sandbox.module as Record<string, unknown>).exports as Record<string, unknown>).default as ScriptClassType
    || (sandbox.exports as Record<string, unknown>).default as ScriptClassType;
  if (ScriptClass && typeof ScriptClass === "function") {
    const lifecycleMethods = new Set(["onStart", "onCheckpoint", "onReport", "constructor"]);
    const proto = ScriptClass.prototype as Record<string, unknown>;
    serverFunctions = Object.getOwnPropertyNames(proto)
      .filter((n) => typeof proto[n] === "function" && !lifecycleMethods.has(n) && !n.startsWith("_"));
  }
} catch (loadErr) {
  parentPort!.postMessage({ type: "error", error: "srv module load failed: " + (loadErr instanceof Error ? loadErr.message : String(loadErr)) });
}
parentPort!.postMessage({ type: "init", serverFunctions });

// ── Serialization helpers for Set/Map ──

const replacer = (_k: string, v: unknown): unknown => {
  if (v instanceof Set) return { __type: "Set", values: [...v] };
  if (v instanceof Map) return { __type: "Map", entries: [...v] };
  return v;
};

const reviver = (_k: string, v: unknown): unknown => {
  if (v && typeof v === "object" && (v as Record<string, unknown>).__type === "Set") return new Set((v as { values: unknown[] }).values);
  if (v && typeof v === "object" && (v as Record<string, unknown>).__type === "Map") return new Map((v as { entries: [unknown, unknown][] }).entries);
  return v;
};

// ── Message handler ──

parentPort!.on("message", (msg: Msg) => {
  try {
    if (msg.type === "create") {
      const inst = new ScriptClass!(workerDb, msg.config!, msg.invocation);
      instances.set(msg.invocationId!, inst);
      let initialData: Record<string, unknown> = {};
      const onStart = (inst as Record<string, unknown>).onStart;
      if (typeof onStart === "function") {
        initialData = (onStart.call(inst) as Record<string, unknown>) || {};
      }
      parentPort!.postMessage({ type: "created", ok: true, initialData, serverFunctions });

    } else if (msg.type === "call") {
      const inst = instances.get(msg.invocationId!);
      if (!inst) { parentPort!.postMessage({ type: "result", ok: false, callId: msg.callId, error: { kind: "runtime_error", message: "no instance for " + msg.invocationId } }); return; }
      const result = (inst[msg.fn!] as (...a: unknown[]) => unknown)(...(msg.args || []));
      parentPort!.postMessage({ type: "result", ok: true, callId: msg.callId, result });

    } else if (msg.type === "lifecycle") {
      const inst = instances.get(msg.invocationId!);
      if (!inst) { parentPort!.postMessage({ type: "result", ok: false, callId: msg.callId, error: { kind: "runtime_error", message: "no instance for " + msg.invocationId } }); return; }
      const method = inst[msg.method!];
      if (typeof method !== "function") { parentPort!.postMessage({ type: "result", ok: true, callId: msg.callId, result: msg.method === "onCheckpoint" ? "proceed" : undefined }); return; }
      const result = (method as (...a: unknown[]) => unknown).call(inst, ...msg.args!);
      parentPort!.postMessage({ type: "result", ok: true, callId: msg.callId, result });

    } else if (msg.type === "snapshot_state") {
      const inst = instances.get(msg.invocationId!);
      if (!inst) { parentPort!.postMessage({ type: "result", ok: false, callId: msg.callId, error: { kind: "runtime_error", message: "no instance for " + msg.invocationId } }); return; }
      const skip = new Set(["db", "config", "invocation"]);
      const state: Record<string, unknown> = {};
      for (const key of Object.keys(inst)) {
        if (skip.has(key)) continue;
        try { state[key] = JSON.parse(JSON.stringify(inst[key], replacer)); } catch { /* non-serializable field, skip */ }
      }
      parentPort!.postMessage({ type: "result", ok: true, callId: msg.callId, result: state });

    } else if (msg.type === "restore_state") {
      const inst = instances.get(msg.invocationId!);
      if (!inst) { parentPort!.postMessage({ type: "result", ok: false, callId: msg.callId, error: { kind: "runtime_error", message: "no instance for " + msg.invocationId } }); return; }
      const restored = JSON.parse(JSON.stringify(msg.state), reviver) as Record<string, unknown>;
      Object.assign(inst, restored);
      parentPort!.postMessage({ type: "result", ok: true, callId: msg.callId, result: null });

    } else if (msg.type === "destroy") {
      instances.delete(msg.invocationId!);
      parentPort!.postMessage({ type: "destroyed", ok: true });

    } else if (msg.type === "shutdown") {
      workerDb.close();
      parentPort!.postMessage({ type: "shutdown_done" });
    }
  } catch (err) {
    const callId = msg.callId || 0;
    parentPort!.postMessage({ type: "result", ok: false, callId, error: { kind: "controller_error", message: err instanceof Error ? err.message : String(err) } });
  }
});
