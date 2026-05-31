import { describe, it, expect } from "vitest";
import { Instance, CapabilitySet, SandboxDispatcher } from "../src/index";
import type { SandboxFnSpec, SandboxArg } from "../src/index";
import { FakeHost } from "./_fakehost";

const params = () => ({ script_ref: "s", code_snapshot: "x", budgets: { steps: 5, iterations: 5 } });
const specs: SandboxFnSpec[] = [
  { name: "rank", needs: ["store.read"] },
  { name: "fromKb", needs: ["kb.read"] },
  { name: "boom", needs: [] },
];
const host = () =>
  new FakeHost({
    rank: (xs: unknown) => (xs as number[]).slice().sort((a, b) => b - a),
    fromKb: () => ["a", "b"],
    boom: () => { throw new Error("kaboom"); },
  });

describe("SandboxDispatcher", () => {
  it("runs a function, stores result by handle, records a verified trace event", async () => {
    const inst = new Instance(params());
    const d = new SandboxDispatcher(host(), specs, new CapabilitySet(["store.read"]));
    const h = inst.store.put([3, 1, 2]);
    const r = await d.dispatch(inst, "rank", [h]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(inst.store.get(r.handle)).toEqual([3, 2, 1]);
      const ev = inst.trace.events.at(-1);
      expect(ev?.op).toBe("rank");
      expect(ev?.realizer).toBe("sandbox");
      expect(ev?.trust).toBe("verified");
      expect(ev?.inputs).toEqual([h.id]);
      expect(ev?.output).toBe(r.handle.id);
    }
  });

  it("resolves handle args to values and passes literals through", async () => {
    const inst = new Instance(params());
    const fh = host();
    const d = new SandboxDispatcher(fh, specs, new CapabilitySet(["store.read"]));
    const h = inst.store.put([5, 9, 1]);
    await d.dispatch(inst, "rank", [h, { __literal: 42 } as SandboxArg]);
    expect(fh.calls[0]?.args).toEqual([[5, 9, 1], 42]); // handle de-referenced, literal kept
  });

  it("denies a call whose needs exceed the grant", async () => {
    const inst = new Instance(params());
    const d = new SandboxDispatcher(host(), specs, new CapabilitySet(["store.read"]));
    const r = await d.dispatch(inst, "fromKb", []);
    expect(r).toMatchObject({ ok: false, kind: "capability_denied" });
    expect(inst.trace.events.at(-1)?.meta).toMatchObject({ failed: "capability_denied" });
  });

  it("rejects an unknown function", async () => {
    const inst = new Instance(params());
    const d = new SandboxDispatcher(host(), specs, new CapabilitySet([]));
    const r = await d.dispatch(inst, "nope", []);
    expect(r).toMatchObject({ ok: false, kind: "unknown_fn" });
  });

  it("surfaces a sandbox_error without throwing", async () => {
    const inst = new Instance(params());
    const d = new SandboxDispatcher(host(), specs, new CapabilitySet([]));
    const r = await d.dispatch(inst, "boom", []);
    expect(r).toMatchObject({ ok: false, kind: "sandbox_error", message: "kaboom" });
  });

  it("charges the step budget and halts when exhausted", async () => {
    const inst = new Instance({ script_ref: "s", code_snapshot: "x", budgets: { steps: 1, iterations: 5 } });
    const d = new SandboxDispatcher(host(), specs, new CapabilitySet(["store.read"]));
    const h = inst.store.put([1]);
    expect((await d.dispatch(inst, "rank", [h])).ok).toBe(true); // steps 1 -> 0
    const r = await d.dispatch(inst, "rank", [h]); // overdraw
    expect(r).toMatchObject({ ok: false, kind: "budget_exhausted" });
    expect(inst.status).toBe("halted_budget");
  });
});

describe("SandboxDispatcher — schema at seam", () => {
  it("rejects output that violates the declared shape", async () => {
    const inst = new Instance(params());
    const fh = new FakeHost({ rank: () => "not-an-array" });
    const d = new SandboxDispatcher(fh, [{ name: "rank", needs: [] }], new CapabilitySet([]));
    const r = await d.dispatch(inst, "rank", [], { kind: "array", of: { kind: "number" } });
    expect(r).toMatchObject({ ok: false, kind: "schema_mismatch" });
  });
});
