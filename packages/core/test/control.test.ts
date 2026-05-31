import { describe, it, expect } from "vitest";
import { Instance, ControlDriver, NO_CONTROLLER } from "../src/index";
import type { Shape } from "../src/index";
import { FakeController } from "./_fakecontroller";

const params = () => ({ script_ref: "s", code_snapshot: "x", budgets: { steps: 5, iterations: 5 } });

describe("ControlDriver.report", () => {
  it("records telemetry and forwards to onReport", async () => {
    const inst = new Instance(params());
    const ctrl = new FakeController();
    const d = new ControlDriver(ctrl);
    const r = await d.report(inst, "progress", { done: 2 });
    expect(r.ok).toBe(true);
    expect(ctrl.reports).toEqual([{ label: "progress", data: { done: 2 } }]);
    expect(inst.trace.events.at(-1)).toMatchObject({ op: "report", trust: "verified", meta: { label: "progress" } });
  });

  it("works with no controller (purely cognitive script)", async () => {
    const inst = new Instance(params());
    const r = await new ControlDriver(NO_CONTROLLER).report(inst, "x", { a: 1 });
    expect(r.ok).toBe(true);
    expect(inst.trace.length).toBe(1);
  });

  it("rejects a malformed payload at the seam", async () => {
    const inst = new Instance(params());
    const shape: Shape = { kind: "object", fields: { done: { kind: "number" } } };
    const r = await new ControlDriver(new FakeController()).report(inst, "p", { done: "two" }, shape);
    expect(r).toMatchObject({ ok: false, kind: "schema_mismatch" });
    expect(inst.trace.events.at(-1)?.meta).toMatchObject({ failed: "schema_mismatch" });
  });
});

describe("ControlDriver.checkpoint", () => {
  it("returns the controller's directive and records it", async () => {
    const inst = new Instance(params());
    const ctrl = new FakeController("warn");
    const r = await new ControlDriver(ctrl).checkpoint(inst, "midpoint", { k: 1 });
    expect(r).toMatchObject({ ok: true, directive: "warn" });
    expect(ctrl.checkpoints[0]?.label).toBe("midpoint");
    expect(inst.trace.events.at(-1)?.meta).toMatchObject({ label: "midpoint", directive: "warn" });
  });

  it("defaults to proceed with no controller", async () => {
    const inst = new Instance(params());
    const r = await new ControlDriver(NO_CONTROLLER).checkpoint(inst, "x", {});
    expect(r).toMatchObject({ ok: true, directive: "proceed" });
  });

  it("applies halt to the instance", async () => {
    const inst = new Instance(params());
    const r = await new ControlDriver(new FakeController("halt")).checkpoint(inst, "stop", {});
    expect(r).toMatchObject({ ok: true, directive: "halt" });
    expect(inst.status).toBe("halted");
  });

  it("passes through an ask directive and records the prompt", async () => {
    const inst = new Instance(params());
    const ctrl = new FakeController({ ask: "confirm?", choices: ["yes", "no"] });
    const r = await new ControlDriver(ctrl).checkpoint(inst, "gate", {});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.directive).toMatchObject({ ask: "confirm?" });
    expect(inst.trace.events.at(-1)?.meta).toMatchObject({ directive: { ask: "confirm?" } });
  });

  it("rejects a malformed checkpoint payload before gating", async () => {
    const inst = new Instance(params());
    const ctrl = new FakeController("halt");
    const shape: Shape = { kind: "object", fields: { n: { kind: "number" } } };
    const r = await new ControlDriver(ctrl).checkpoint(inst, "g", { n: "x" }, shape);
    expect(r).toMatchObject({ ok: false, kind: "schema_mismatch" });
    expect(ctrl.checkpoints).toHaveLength(0); // gate not consulted on bad payload
    expect(inst.status).toBe("running"); // no halt applied
  });
});

describe("onStart composer", () => {
  it("can seed initial handles into the store", async () => {
    const inst = new Instance(params());
    const ctrl = new FakeController("proceed", (id) => {
      inst.store.put({ seeded: true, id });
    });
    await ctrl.onStart(inst.invocation_id);
    expect(inst.store.size).toBe(1);
  });
});
