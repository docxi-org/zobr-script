import { describe, it, expect } from "vitest";
import { ZsService, InvocationRegistry } from "../src/index";
import { FakeLoader } from "./_fakeloader";
import { FakeController } from "../../core/test/_fakecontroller";

const svc = (loaderOpts = {}) => {
  const reg = new InvocationRegistry();
  return { reg, s: new ZsService(new FakeLoader("news", loaderOpts), reg) };
};

describe("ZsService.start", () => {
  it("creates an instance and returns id + code", async () => {
    const { reg, s } = svc();
    const r = await s.start({ script_ref: "news" });
    expect(typeof r.invocation_id).toBe("string");
    expect(reg.has(r.invocation_id)).toBe(true);
  });
  it("is idempotent on idempotency_key", async () => {
    const { s } = svc();
    const a = await s.start({ script_ref: "news", idempotency_key: "k" });
    const b = await s.start({ script_ref: "news", idempotency_key: "k" });
    expect(a.invocation_id).toBe(b.invocation_id); // same remembered result, no second instance
  });
  it("rejects an unknown script_ref (validate-at-start throws)", async () => {
    const { s } = svc();
    await expect(s.start({ script_ref: "ghost" })).rejects.toThrow(/not found/);
  });
  it("returns serverFunctions in start response when srv module has public methods", async () => {
    const { s } = svc({ serverFunctions: ["findAll", "rankByScore"] });
    const r = await s.start({ script_ref: "news" });
    expect(r.serverFunctions).toEqual(["findAll", "rankByScore"]);
  });

  it("omits serverFunctions from start response when none defined", async () => {
    const { s } = svc();
    const r = await s.start({ script_ref: "news" });
    expect(r.serverFunctions).toBeUndefined();
  });

  it("runs onStart composer when controller present", async () => {
    const reg = new InvocationRegistry();
    let started = "";
    const ctrl = new FakeController("proceed", (id) => { started = id; });
    const s = new ZsService(new FakeLoader("news", { controller: ctrl }), reg);
    const r = await s.start({ script_ref: "news" });
    expect(started).toBe(r.invocation_id);
  });
});

describe("ZsService.sandbox", () => {
  it("dispatches a sandbox fn and returns a handle + preview", async () => {
    const { s } = svc();
    const { invocation_id } = await s.start({ script_ref: "news" });
    const r = await s.sandbox({ invocation_id, fn: "rank", args: [{ __literal: [3, 1, 2] }] });
    expect(r.ok).toBe(true);
    expect(r.handle?.__handle).toBe(true);
    expect(typeof r.preview).toBe("string");
  });
  it("returns a typed error for unknown invocation", async () => {
    const { s } = svc();
    await expect(s.sandbox({ invocation_id: "nope", fn: "rank", args: [] })).rejects.toThrow(/unknown invocation/);
  });
  it("is idempotent on idempotency_key", async () => {
    const { s } = svc();
    const { invocation_id } = await s.start({ script_ref: "news" });
    const a = await s.sandbox({ invocation_id, fn: "rank", args: [{ __literal: [1] }], idempotency_key: "x" });
    const b = await s.sandbox({ invocation_id, fn: "rank", args: [{ __literal: [9, 9] }], idempotency_key: "x" });
    expect(a).toEqual(b); // remembered; second args ignored
  });
});

describe("ZsService.checkpoint / report", () => {
  it("returns the controller directive and applies halt", async () => {
    const reg = new InvocationRegistry();
    const ctrl = new FakeController("halt");
    const s = new ZsService(new FakeLoader("news", { controller: ctrl }), reg);
    const { invocation_id } = await s.start({ script_ref: "news" });
    const r = await s.checkpoint({ invocation_id, label: "g", data: {} });
    expect(r).toMatchObject({ ok: true, directive: "halt" });
    expect(reg.require(invocation_id).status).toBe("halted");
  });
  it("report is fire-and-forget ok", async () => {
    const { s } = svc();
    const { invocation_id } = await s.start({ script_ref: "news" });
    expect((await s.report({ invocation_id, label: "p", data: { n: 1 } })).ok).toBe(true);
  });
});

describe("ZsService.askRecord / actRecord", () => {
  it("askRecord writes an authority event to the trace", async () => {
    const { reg, s } = svc();
    const { invocation_id } = await s.start({ script_ref: "news" });
    const r = s.askRecord({ invocation_id, question: "Pick a topic", answer: "climate" });
    expect(r.ok).toBe(true);
    const events = reg.require(invocation_id).trace.events;
    const ask = events.find((e) => e.op === "ask_user");
    expect(ask).toBeDefined();
    expect(ask?.trust).toBe("authority");
    expect(ask?.realizer).toBe("user");
    expect(ask?.meta).toMatchObject({ question: "Pick a topic" });
  });

  it("actRecord writes an asserted event with handle to the trace", async () => {
    const { reg, s } = svc();
    const { invocation_id } = await s.start({ script_ref: "news" });
    const r = s.actRecord({ invocation_id, intent: "create task", result: { id: 42 }, provenance: { tool: "jira" } });
    expect(r.ok).toBe(true);
    const events = reg.require(invocation_id).trace.events;
    const act = events.find((e) => e.op === "act");
    expect(act).toBeDefined();
    expect(act?.trust).toBe("asserted");
    expect(act?.realizer).toBe("host");
    expect(act?.output).toBeTruthy();
    expect(act?.meta).toMatchObject({ intent: "create task", provenance: { tool: "jira" } });
  });
});

describe("ZsService.retrieve", () => {
  it("records a verified event when provenance is provided", async () => {
    const { reg, s } = svc();
    const { invocation_id } = await s.start({ script_ref: "news" });
    const r = s.retrieve({ invocation_id, query: "revenue Q3", data: { total: 42 }, provenance: "postgres_query" });
    expect(r.ok).toBe(true);
    const ev = reg.require(invocation_id).trace.events.find((e) => e.op === "retrieve");
    expect(ev).toBeDefined();
    expect(ev?.trust).toBe("verified");
    expect(ev?.realizer).toBe("external");
    expect(ev?.meta).toMatchObject({ query: "revenue Q3", provenance: "postgres_query" });
  });

  it("records an asserted event when provenance is empty", async () => {
    const { reg, s } = svc();
    const { invocation_id } = await s.start({ script_ref: "news" });
    const r = s.retrieve({ invocation_id, query: "some fact", data: "answer", provenance: "" });
    expect(r.ok).toBe(true);
    const ev = reg.require(invocation_id).trace.events.find((e) => e.op === "retrieve");
    expect(ev?.trust).toBe("asserted");
  });

  it("includes source in meta when provided", async () => {
    const { reg, s } = svc();
    const { invocation_id } = await s.start({ script_ref: "news" });
    s.retrieve({ invocation_id, query: "docs", source: "company_db", data: {}, provenance: "pg_tool" });
    const ev = reg.require(invocation_id).trace.events.find((e) => e.op === "retrieve");
    expect(ev?.meta).toMatchObject({ source: "company_db" });
  });
});

describe("ZsService.conclude", () => {
  it("validates result against concludeShape and finalizes", async () => {
    const shape = { kind: "object", fields: { a: { kind: "number" } } } as const;
    const { reg, s } = svc({ concludeShape: shape });
    const { invocation_id } = await s.start({ script_ref: "news" });
    const r = await s.conclude({ invocation_id, result: { a: 1 } });
    expect(r.ok).toBe(true);
    expect(r.status).toBe("done");
    expect(r.coverage).toBeDefined();
    expect(reg.require(invocation_id).status).toBe("done");
  });
  it("rejects a result that violates concludeShape", async () => {
    const shape = { kind: "object", fields: { a: { kind: "number" } } } as const;
    const { s } = svc({ concludeShape: shape });
    const { invocation_id } = await s.start({ script_ref: "news" });
    const r = await s.conclude({ invocation_id, result: { a: "x" } });
    expect(r).toMatchObject({ ok: false });
    expect(r.error?.kind).toBe("schema_mismatch");
  });
});
