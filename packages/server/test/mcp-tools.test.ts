import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MCP_TOOLS, ZsApp, createDb } from "../src/index";
import { FakeReader, VALID_COG } from "./_fakereader";

const reader = new FakeReader({
  news: { script_ref: "news", cog: [{ name: "/zs/news.cog.ts", content: VALID_COG }], srv: [] },
});
const app = () => new ZsApp(reader);

const tmpDir = mkdtempSync(join(tmpdir(), "zs-store-test-"));
const storeApp = () => new ZsApp(reader, { dbPath: join(tmpDir, `test-${Date.now()}.sqlite`) });
afterAll(() => { try { rmSync(tmpDir, { recursive: true, force: true }); } catch {} });

async function registered(a: ZsApp): Promise<string> {
  const res = (await a.callTool("zs_register", { name: "test" })) as { agent_id: string };
  return res.agent_id;
}

describe("MCP tool registry", () => {
  it("declares the expected zs_* tools", () => {
    const names = MCP_TOOLS.map((t) => t.name);
    expect(names).toEqual(["zs_start", "zs_sandbox", "zs_report", "zs_checkpoint", "zs_commit", "zs_check", "zs_conclude", "zs_status", "zs_ask_record", "zs_act_record", "zs_list", "zs_read", "zs_validate", "zs_create", "zs_update", "zs_delete", "zs_retrieve", "zs_resume", "zs_register", "zs_store_insert", "zs_store_find", "zs_store_update", "zs_store_delete", "zs_store_collections", "zs_abort", "zs_store_put", "zs_store_get", "zs_store_list", "zs_guide", "zs_dashboard"]);
    for (const t of MCP_TOOLS) expect(t.description.length).toBeGreaterThan(0);
  });

  it("dispatches zs_start through the app and parses args via zod", async () => {
    const a = app();
    const agent_id = await registered(a);
    const res = (await a.callTool("zs_start", { agent_id, script_ref: "news" })) as { invocation_id: string };
    expect(typeof res.invocation_id).toBe("string");
    expect(a.registry.has(res.invocation_id)).toBe(true);
  });

  it("rejects malformed tool args at the zod boundary", async () => {
    const a = app();
    const agent_id = await registered(a);
    await expect(a.callTool("zs_start", { agent_id, wrong: true })).rejects.toThrow();
  });

  it("rejects an unknown tool name", async () => {
    const a = app();
    const agent_id = await registered(a);
    await expect(a.callTool("zs_nope", { agent_id })).rejects.toThrow(/unknown MCP tool/);
  });

  it("zs_guide returns full guide for executor", async () => {
    const a = app();
    const agent_id = await registered(a);
    const res = (await a.callTool("zs_guide", { agent_id })) as { guide: string };
    expect(res.guide).toContain("Executor Guide");
    expect(res.guide).toContain("survey");
    expect(res.guide).toContain("Trust Model");
  });

  it("zs_register includes guide in response", async () => {
    const a = app();
    const res = (await a.callTool("zs_register", { name: "tester" })) as { agent_id: string; role: string; guide: string };
    expect(res.guide).toContain("Executor Guide");
    expect(typeof res.guide).toBe("string");
    expect(res.guide.length).toBeGreaterThan(100);
  });

  it("zs_read returns script source (requires library)", async () => {
    const lib = Object.assign(reader, { libraryRoot: "/fake" });
    const a = new ZsApp(reader, { library: lib });
    const agent_id = await registered(a);
    const res = (await a.callTool("zs_read", { agent_id, script_ref: "news" })) as { script_ref: string; cog: string };
    expect(res.script_ref).toBe("news");
    expect(res.cog).toContain("function analyze");
  });

  it("zs_validate returns ok for valid script and errors for invalid", async () => {
    const a = app();
    const agent_id = await registered(a);
    const valid = await a.callTool("zs_validate", {
      agent_id,
      cog: [{ name: "/zs/ok.cog.ts", content: VALID_COG }],
    }) as { ok: boolean; errors: unknown[] };
    expect(valid.ok).toBe(true);
    expect(valid.errors).toHaveLength(0);

    const invalid = await a.callTool("zs_validate", {
      agent_id,
      cog: [{ name: "/zs/bad.cog.ts", content: `export function f() { eval("x"); return conclude(); }` }],
    }) as { ok: boolean; errors: unknown[] };
    expect(invalid.ok).toBe(false);
    expect(invalid.errors.length).toBeGreaterThan(0);
  });

  it("zs_register returns an agent_id", async () => {
    const a = app();
    const res = (await a.callTool("zs_register", { name: "TestAgent" })) as { agent_id: string };
    expect(typeof res.agent_id).toBe("string");
    expect(res.agent_id).toMatch(/^ag_/);
    expect(a.agents.has(res.agent_id)).toBe(true);
    expect(a.agents.get(res.agent_id)!.name).toBe("TestAgent");
  });

  it("zs_register returns active_invocations for the agent", async () => {
    const a = app();
    const aid = await registered(a);
    const r1 = (await a.callTool("zs_register", { name: "test" })) as { agent_id: string; active_invocations: string[] };
    expect(r1.active_invocations).toEqual([]);

    const { invocation_id } = (await a.callTool("zs_start", { agent_id: aid, script_ref: "news" })) as { invocation_id: string };
    const r2 = (await a.callTool("zs_register", { name: "test" })) as { agent_id: string; active_invocations: string[] };
    expect(r2.active_invocations).toEqual([invocation_id]);
  });

  it("zs_register is idempotent by name (same name → same agent_id)", async () => {
    const a = app();
    const r1 = (await a.callTool("zs_register", { name: "Гаврила" })) as { agent_id: string };
    const r2 = (await a.callTool("zs_register", { name: "Гаврила" })) as { agent_id: string };
    expect(r1.agent_id).toBe(r2.agent_id);
  });

  it("zs_register returns different agent_ids for different names", async () => {
    const a = app();
    const r1 = (await a.callTool("zs_register", { name: "A" })) as { agent_id: string };
    const r2 = (await a.callTool("zs_register", { name: "B" })) as { agent_id: string };
    expect(r1.agent_id).not.toBe(r2.agent_id);
  });

  it("rejects calls without agent_id", async () => {
    const res = (await app().callTool("zs_start", { script_ref: "news" })) as { ok: boolean; error: { kind: string } };
    expect(res.ok).toBe(false);
    expect(res.error.kind).toBe("auth_error");
  });

  it("rejects calls with unknown agent_id", async () => {
    const res = (await app().callTool("zs_start", { agent_id: "ag_nonexistent", script_ref: "news" })) as { ok: boolean; error: { kind: string } };
    expect(res.ok).toBe(false);
    expect(res.error.kind).toBe("auth_error");
  });

  it("tracks active invocations per agent (start adds, conclude removes)", async () => {
    const a = app();
    const agent_id = await registered(a);
    expect(a.agents.hasActiveInvocation(agent_id)).toBe(false);

    const { invocation_id } = (await a.callTool("zs_start", { agent_id, script_ref: "news" })) as { invocation_id: string };
    expect(a.agents.hasActiveInvocation(agent_id)).toBe(true);

    await a.callTool("zs_conclude", { agent_id, invocation_id, result: { summary: "ok" } });
    expect(a.agents.hasActiveInvocation(agent_id)).toBe(false);
  });

  it("runs a start -> conclude round trip over the tool surface", async () => {
    const a = app();
    const agent_id = await registered(a);
    const { invocation_id } = (await a.callTool("zs_start", { agent_id, script_ref: "news" })) as { invocation_id: string };
    const c = (await a.callTool("zs_conclude", { agent_id, invocation_id, result: { summary: "ok" } })) as { ok: boolean; status: string };
    expect(c.ok).toBe(true);
    expect(c.status).toBe("done");
  });
});

describe("Standalone store tools", () => {
  it("insert → find → update → delete cycle", async () => {
    const a = storeApp();
    const agent_id = (await a.callTool("zs_register", { name: "store-test" }) as { agent_id: string }).agent_id;

    const ins = (await a.callTool("zs_store_insert", { agent_id, collection: "items", doc: { name: "alpha", score: 10 } })) as { ok: boolean; _id: string };
    expect(ins.ok).toBe(true);
    expect(ins._id).toBeTruthy();

    const found = (await a.callTool("zs_store_find", { agent_id, collection: "items", filter: { name: "alpha" } })) as { ok: boolean; docs: { name: string; score: number; _id: string }[] };
    expect(found.ok).toBe(true);
    expect(found.docs).toHaveLength(1);
    expect(found.docs[0]!.name).toBe("alpha");
    expect(found.docs[0]!.score).toBe(10);

    const upd = (await a.callTool("zs_store_update", { agent_id, collection: "items", filter: { name: "alpha" }, patch: { score: 20 } })) as { ok: boolean; matched: number };
    expect(upd.ok).toBe(true);
    expect(upd.matched).toBe(1);

    const after = (await a.callTool("zs_store_find", { agent_id, collection: "items" })) as { ok: boolean; docs: { score: number }[] };
    expect(after.docs[0]!.score).toBe(20);

    const del = (await a.callTool("zs_store_delete", { agent_id, collection: "items", filter: { name: "alpha" } })) as { ok: boolean; deleted: number };
    expect(del.ok).toBe(true);
    expect(del.deleted).toBe(1);

    const empty = (await a.callTool("zs_store_find", { agent_id, collection: "items" })) as { ok: boolean; docs: unknown[] };
    expect(empty.docs).toHaveLength(0);
  });

  it("zs_store_collections lists collections with counts", async () => {
    const a = storeApp();
    const agent_id = (await a.callTool("zs_register", { name: "coll-test" }) as { agent_id: string }).agent_id;

    await a.callTool("zs_store_insert", { agent_id, collection: "things", doc: { x: 1 } });
    await a.callTool("zs_store_insert", { agent_id, collection: "things", doc: { x: 2 } });
    await a.callTool("zs_store_insert", { agent_id, collection: "other", doc: { y: 1 } });

    const res = (await a.callTool("zs_store_collections", { agent_id })) as { ok: boolean; names: string[]; counts: Record<string, number> };
    expect(res.ok).toBe(true);
    expect(res.names).toContain("things");
    expect(res.names).toContain("other");
    expect(res.counts["things"]).toBe(2);
    expect(res.counts["other"]).toBe(1);
  });

  it("notes: put → get → list cycle", async () => {
    const a = storeApp();
    const agent_id = (await a.callTool("zs_register", { name: "notes-test" }) as { agent_id: string }).agent_id;

    const put = (await a.callTool("zs_store_put", { agent_id, key: "memo:1", data: { text: "hello" }, type: "memo" })) as { ok: boolean };
    expect(put.ok).toBe(true);

    const get = (await a.callTool("zs_store_get", { agent_id, key: "memo:1" })) as { ok: boolean; data: { text: string } };
    expect(get.ok).toBe(true);
    expect(get.data).toEqual({ text: "hello" });

    await a.callTool("zs_store_put", { agent_id, key: "memo:2", data: { text: "world" }, type: "memo" });
    await a.callTool("zs_store_put", { agent_id, key: "config:x", data: 42, type: "config" });

    const all = (await a.callTool("zs_store_list", { agent_id })) as { ok: boolean; entries: { key: string; type?: string }[] };
    expect(all.entries).toHaveLength(3);

    const memos = (await a.callTool("zs_store_list", { agent_id, type: "memo" })) as { ok: boolean; entries: { key: string }[] };
    expect(memos.entries).toHaveLength(2);

    const missing = (await a.callTool("zs_store_get", { agent_id, key: "nonexistent" })) as { ok: boolean; data: unknown };
    expect(missing.ok).toBe(true);
    expect(missing.data).toBeNull();
  });

  it("validates insert against store shape when defined", async () => {
    const itemShape = { kind: "object" as const, fields: { name: { kind: "string" as const }, score: { kind: "number" as const } } };
    const a = new ZsApp(reader, {
      dbPath: join(tmpDir, `shape-${Date.now()}.sqlite`),
      storeShapes: { items: itemShape },
    });
    const agent_id = (await a.callTool("zs_register", { name: "shape-test" }) as { agent_id: string }).agent_id;

    const ok = (await a.callTool("zs_store_insert", { agent_id, collection: "items", doc: { name: "x", score: 5 } })) as { ok: boolean };
    expect(ok.ok).toBe(true);

    const bad = (await a.callTool("zs_store_insert", { agent_id, collection: "items", doc: { name: 123, score: "wrong" } })) as { ok: boolean; error?: { kind: string } };
    expect(bad.ok).toBe(false);
    expect(bad.error?.kind).toBe("schema_mismatch");

    const untyped = (await a.callTool("zs_store_insert", { agent_id, collection: "other", doc: { anything: true } })) as { ok: boolean };
    expect(untyped.ok).toBe(true);
  });

  it("validates update patch fields against store shape", async () => {
    const itemShape = { kind: "object" as const, fields: { name: { kind: "string" as const }, score: { kind: "number" as const } } };
    const a = new ZsApp(reader, {
      dbPath: join(tmpDir, `shape-upd-${Date.now()}.sqlite`),
      storeShapes: { items: itemShape },
    });
    const agent_id = (await a.callTool("zs_register", { name: "shape-upd" }) as { agent_id: string }).agent_id;

    await a.callTool("zs_store_insert", { agent_id, collection: "items", doc: { name: "x", score: 5 } });

    const ok = (await a.callTool("zs_store_update", { agent_id, collection: "items", filter: { name: "x" }, patch: { score: 10 } })) as { ok: boolean };
    expect(ok.ok).toBe(true);

    const bad = (await a.callTool("zs_store_update", { agent_id, collection: "items", filter: { name: "x" }, patch: { score: "wrong" } })) as { ok: boolean; error?: { kind: string } };
    expect(bad.ok).toBe(false);
    expect(bad.error?.kind).toBe("schema_mismatch");
  });

  it("full snapshot includes worker state (class instance properties)", async () => {
    const srvCog = `export type R = { x: number };\nexport function f(): R { checkpoint("c", {}); return conclude<R>({} as R); }`;
    const srvSrv = `export default class extends ZsScript {\n  private counter = 0;\n  onCheckpoint(label: string, data: unknown): Directive { this.counter++; return "proceed"; }\n}`;
    const srvReader = new FakeReader({
      counted: {
        script_ref: "counted",
        cog: [{ name: "/zs/counted.cog.ts", content: srvCog }],
        srv: [{ name: "/zs/counted.srv.ts", content: srvSrv }],
      },
    });
    const dbPath = join(tmpDir, `full-snap-${Date.now()}.sqlite`);
    const a = new ZsApp(srvReader, { dbPath });
    const aid = (await a.callTool("zs_register", { name: "full-snap" }) as { agent_id: string }).agent_id;
    const { invocation_id } = (await a.callTool("zs_start", { agent_id: aid, script_ref: "counted" })) as { invocation_id: string };

    await a.callTool("zs_checkpoint", { agent_id: aid, invocation_id, label: "c", data: {} });
    await a.callTool("zs_checkpoint", { agent_id: aid, invocation_id, label: "c", data: {} });

    const db = createDb(dbPath);
    const snap = db.infra.loadSnapshot(invocation_id);
    expect(snap).not.toBeNull();
    const state = JSON.parse(snap!.state);
    expect(state.workerState).toBeDefined();
    expect(state.workerState.counter).toBe(2);
    db.close();
  });

  it("snapshots instance after state-changing calls, deletes on conclude", async () => {
    const dbPath = join(tmpDir, `snap-${Date.now()}.sqlite`);
    const a = new ZsApp(reader, { dbPath });
    const aid = (await a.callTool("zs_register", { name: "snap-test" }) as { agent_id: string }).agent_id;
    const { invocation_id } = (await a.callTool("zs_start", { agent_id: aid, script_ref: "news" })) as { invocation_id: string };

    await a.callTool("zs_report", { agent_id: aid, invocation_id, label: "x", data: { n: 1 } });

    const db = createDb(dbPath);
    const snap = db.infra.loadSnapshot(invocation_id);
    expect(snap).not.toBeNull();
    expect(snap!.script_ref).toBe("news");
    const state = JSON.parse(snap!.state);
    expect(state.invocation_id).toBe(invocation_id);
    expect(state.events.length).toBeGreaterThan(0);

    await a.callTool("zs_conclude", { agent_id: aid, invocation_id, result: {} });
    const afterConclude = db.infra.loadSnapshot(invocation_id);
    expect(afterConclude).toBeNull();
    db.close();
  });

  it("conclude persists trace to SQLite", async () => {
    const dbPath = join(tmpDir, `trace-${Date.now()}.sqlite`);
    const a = storeApp();
    const agent_id = (await a.callTool("zs_register", { name: "trace-test" }) as { agent_id: string }).agent_id;

    const aWithDb = new ZsApp(reader, { dbPath });
    const aid = (await aWithDb.callTool("zs_register", { name: "trace-db" }) as { agent_id: string }).agent_id;
    const { invocation_id } = (await aWithDb.callTool("zs_start", { agent_id: aid, script_ref: "news" })) as { invocation_id: string };
    await aWithDb.callTool("zs_report", { agent_id: aid, invocation_id, label: "test", data: { n: 1 } });
    await aWithDb.callTool("zs_conclude", { agent_id: aid, invocation_id, result: { summary: "done" } });

    const db = createDb(dbPath);
    const trace = db.infra.getTrace(invocation_id);
    expect(trace).not.toBeNull();
    expect(trace!.script_ref).toBe("news");
    expect(trace!.status).toBe("done");
    expect(trace!.events.length).toBeGreaterThan(0);
    expect(trace!.coverage).toBeDefined();
    db.close();
  });

  it("agent registration persists across app restarts", async () => {
    const dbPath = join(tmpDir, `persist-${Date.now()}.sqlite`);
    const a1 = new ZsApp(reader, { dbPath });
    const agent_id = (await a1.callTool("zs_register", { name: "Persistent" }) as { agent_id: string }).agent_id;

    const a2 = new ZsApp(reader, { dbPath });
    expect(a2.agents.has(agent_id)).toBe(true);
    expect(a2.agents.get(agent_id)!.name).toBe("Persistent");

    const r2 = (await a2.callTool("zs_register", { name: "Persistent" }) as { agent_id: string }).agent_id;
    expect(r2).toBe(agent_id);
  });

  it("sweepExpired evicts invocations past TTL", async () => {
    const dbPath = join(tmpDir, `sweep-${Date.now()}.sqlite`);
    const a = new ZsApp(reader, { dbPath, invocationTtlMs: 50 });
    const aid = (await a.callTool("zs_register", { name: "sweep-test" }) as { agent_id: string }).agent_id;
    const { invocation_id } = (await a.callTool("zs_start", { agent_id: aid, script_ref: "news" })) as { invocation_id: string };

    expect(a.registry.has(invocation_id)).toBe(true);

    await new Promise((r) => setTimeout(r, 80));
    const evicted = await a.sweepExpired();

    expect(evicted).toContain(invocation_id);
    expect(a.registry.has(invocation_id)).toBe(false);
    expect(a.agents.hasActiveInvocation(aid)).toBe(false);
  });

  it("LRU eviction when maxActiveInvocations exceeded", async () => {
    const dbPath = join(tmpDir, `lru-${Date.now()}.sqlite`);
    const a = new ZsApp(reader, { dbPath, maxActiveInvocations: 2 });
    const aid = (await a.callTool("zs_register", { name: "lru-test" }) as { agent_id: string }).agent_id;

    const r1 = (await a.callTool("zs_start", { agent_id: aid, script_ref: "news" })) as { invocation_id: string };
    await new Promise((r) => setTimeout(r, 10));
    const r2 = (await a.callTool("zs_start", { agent_id: aid, script_ref: "news" })) as { invocation_id: string };
    expect(a.registry.size).toBe(2);

    await new Promise((r) => setTimeout(r, 10));
    const r3 = (await a.callTool("zs_start", { agent_id: aid, script_ref: "news" })) as { invocation_id: string };

    expect(a.registry.size).toBe(2);
    expect(a.registry.has(r1.invocation_id)).toBe(false);
    expect(a.registry.has(r2.invocation_id)).toBe(true);
    expect(a.registry.has(r3.invocation_id)).toBe(true);

    const db = createDb(dbPath);
    expect(db.infra.loadSnapshot(r1.invocation_id)).not.toBeNull();
    db.close();
  });

  it("returns evicted error with resume hint when calling evicted invocation", async () => {
    const dbPath = join(tmpDir, `evict-msg-${Date.now()}.sqlite`);
    const a = new ZsApp(reader, { dbPath });
    const aid = (await a.callTool("zs_register", { name: "evict-msg" }) as { agent_id: string }).agent_id;
    const { invocation_id } = (await a.callTool("zs_start", { agent_id: aid, script_ref: "news" })) as { invocation_id: string };

    await a.evictInvocation(invocation_id);

    const res = (await a.callTool("zs_report", { agent_id: aid, invocation_id, label: "x", data: {} })) as { ok: boolean; error: { kind: string; message: string } };
    expect(res.ok).toBe(false);
    expect(res.error.kind).toBe("evicted");
    expect(res.error.message).toContain("zs_resume");
  });

  it("evictInvocation moves invocation to cold storage", async () => {
    const dbPath = join(tmpDir, `evict-${Date.now()}.sqlite`);
    const a = new ZsApp(reader, { dbPath });
    const aid = (await a.callTool("zs_register", { name: "evict-test" }) as { agent_id: string }).agent_id;
    const { invocation_id } = (await a.callTool("zs_start", { agent_id: aid, script_ref: "news" })) as { invocation_id: string };

    expect(a.registry.has(invocation_id)).toBe(true);
    expect(a.agents.hasActiveInvocation(aid)).toBe(true);

    const evicted = await a.evictInvocation(invocation_id);
    expect(evicted).toBe(true);

    expect(a.registry.has(invocation_id)).toBe(false);
    expect(a.agents.hasActiveInvocation(aid)).toBe(false);

    const db = createDb(dbPath);
    const snap = db.infra.loadSnapshot(invocation_id);
    expect(snap).not.toBeNull();
    const state = JSON.parse(snap!.state);
    expect(state.status).toBe("suspended");
    db.close();
  });

  it("resume from cold restores full state (Instance + worker)", async () => {
    const srvCog = `export type R = { x: number };\nexport function f(): R { checkpoint("c", {}); return conclude<R>({} as R); }`;
    const srvSrv = `export default class extends ZsScript {\n  private counter = 0;\n  onCheckpoint(label: string, data: unknown): Directive { this.counter++; return this.counter >= 3 ? "halt" : "proceed"; }\n}`;
    const srvReader = new FakeReader({
      counter: {
        script_ref: "counter",
        cog: [{ name: "/zs/counter.cog.ts", content: srvCog }],
        srv: [{ name: "/zs/counter.srv.ts", content: srvSrv }],
      },
    });
    const dbPath = join(tmpDir, `resume-cold-${Date.now()}.sqlite`);
    const a = new ZsApp(srvReader, { dbPath });
    const aid = (await a.callTool("zs_register", { name: "resume-cold" }) as { agent_id: string }).agent_id;
    const { invocation_id } = (await a.callTool("zs_start", { agent_id: aid, script_ref: "counter" })) as { invocation_id: string };

    const r1 = (await a.callTool("zs_checkpoint", { agent_id: aid, invocation_id, label: "c", data: {} })) as { ok: boolean; directive: string };
    expect(r1.directive).toBe("proceed"); // counter=1

    const r2 = (await a.callTool("zs_checkpoint", { agent_id: aid, invocation_id, label: "c", data: {} })) as { ok: boolean; directive: string };
    expect(r2.directive).toBe("proceed"); // counter=2

    await a.evictInvocation(invocation_id);
    expect(a.registry.has(invocation_id)).toBe(false);

    const resumed = (await a.callTool("zs_resume", { agent_id: aid, invocation_id })) as { code: string; cursor: number; status: string };
    expect(resumed.status).toBe("running");
    expect(a.registry.has(invocation_id)).toBe(true);

    const r3 = (await a.callTool("zs_checkpoint", { agent_id: aid, invocation_id, label: "c", data: {} })) as { ok: boolean; directive: string };
    expect(r3.directive).toBe("halt"); // counter=3 → halt
  });

  it("zs_abort specific invocation saves trace and frees resources", async () => {
    const dbPath = join(tmpDir, `abort-${Date.now()}.sqlite`);
    const a = new ZsApp(reader, { dbPath });
    const aid = (await a.callTool("zs_register", { name: "abort-test" }) as { agent_id: string }).agent_id;
    const { invocation_id } = (await a.callTool("zs_start", { agent_id: aid, script_ref: "news" })) as { invocation_id: string };

    const res = (await a.callTool("zs_abort", { agent_id: aid, invocation_id })) as { ok: boolean; aborted: string[] };
    expect(res.ok).toBe(true);
    expect(res.aborted).toEqual([invocation_id]);
    expect(a.registry.has(invocation_id)).toBe(false);
    expect(a.agents.hasActiveInvocation(aid)).toBe(false);

    const db = createDb(dbPath);
    const trace = db.infra.getTrace(invocation_id);
    expect(trace).not.toBeNull();
    expect(trace!.status).toBe("aborted");
    db.close();
  });

  it("zs_abort without invocation_id aborts all active for agent", async () => {
    const a = new ZsApp(reader, { dbPath: join(tmpDir, `abort-all-${Date.now()}.sqlite`) });
    const aid = (await a.callTool("zs_register", { name: "abort-all" }) as { agent_id: string }).agent_id;
    const r1 = (await a.callTool("zs_start", { agent_id: aid, script_ref: "news" })) as { invocation_id: string };
    const r2 = (await a.callTool("zs_start", { agent_id: aid, script_ref: "news" })) as { invocation_id: string };
    expect(a.agents.hasActiveInvocation(aid)).toBe(true);

    const res = (await a.callTool("zs_abort", { agent_id: aid })) as { ok: boolean; aborted: string[] };
    expect(res.ok).toBe(true);
    expect(res.aborted.sort()).toEqual([r1.invocation_id, r2.invocation_id].sort());
    expect(a.agents.hasActiveInvocation(aid)).toBe(false);
  });

  it("zs_abort clears store write lockout", async () => {
    const a = new ZsApp(reader, { dbPath: join(tmpDir, `abort-lock-${Date.now()}.sqlite`) });
    const aid = (await a.callTool("zs_register", { name: "abort-lock" }) as { agent_id: string }).agent_id;
    await a.callTool("zs_start", { agent_id: aid, script_ref: "news" });

    const blocked = (await a.callTool("zs_store_insert", { agent_id: aid, collection: "x", doc: { v: 1 } })) as { ok: boolean; error?: { kind: string } };
    expect(blocked.ok).toBe(false);
    expect(blocked.error?.kind).toBe("lockout");

    await a.callTool("zs_abort", { agent_id: aid });

    const ok = (await a.callTool("zs_store_insert", { agent_id: aid, collection: "x", doc: { v: 1 } })) as { ok: boolean };
    expect(ok.ok).toBe(true);
  });

  it("blocks store writes during active invocation, allows reads", async () => {
    const a = storeApp();
    const agent_id = (await a.callTool("zs_register", { name: "lockout-test" }) as { agent_id: string }).agent_id;

    await a.callTool("zs_store_insert", { agent_id, collection: "data", doc: { v: 1 } });

    const { invocation_id } = (await a.callTool("zs_start", { agent_id, script_ref: "news" })) as { invocation_id: string };

    const writeRes = (await a.callTool("zs_store_insert", { agent_id, collection: "data", doc: { v: 2 } })) as { ok: boolean; error?: { kind: string } };
    expect(writeRes.ok).toBe(false);
    expect(writeRes.error?.kind).toBe("lockout");

    const readRes = (await a.callTool("zs_store_find", { agent_id, collection: "data" })) as { ok: boolean; docs: unknown[] };
    expect(readRes.ok).toBe(true);
    expect(readRes.docs).toHaveLength(1);

    await a.callTool("zs_conclude", { agent_id, invocation_id, result: {} });

    const afterRes = (await a.callTool("zs_store_insert", { agent_id, collection: "data", doc: { v: 3 } })) as { ok: boolean };
    expect(afterRes.ok).toBe(true);
  });
});
