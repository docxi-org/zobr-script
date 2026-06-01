import { describe, it, expect } from "vitest";
import { Instance } from "../src/index";

const params = { script_ref: "news", code_snapshot: "export function analyze(){}", budgets: { steps: 10, iterations: 3 } };

describe("Instance", () => {
  it("initializes with running status, own store/trace, depth 0", () => {
    const i = new Instance(params);
    expect(i.status).toBe("running");
    expect(i.depth).toBe(0);
    expect(i.parent_invocation_id).toBeUndefined();
    expect(typeof i.invocation_id).toBe("string");
    expect(i.store.size).toBe(0);
    expect(i.trace.length).toBe(1);
    expect(i.trace.events[0]?.op).toBe("status_transition");
    expect(i.trace.events[0]?.meta).toEqual({ from: "created", to: "running", reason: "start" });
  });

  it("records child linkage and depth", () => {
    const child = new Instance({ ...params, parent_invocation_id: "inv_parent", depth: 1 });
    expect(child.parent_invocation_id).toBe("inv_parent");
    expect(child.depth).toBe(1);
  });

  it("transitions legally and writes the transition to the trace", () => {
    const i = new Instance(params);
    i.transition("done", "conclude reached");
    expect(i.status).toBe("done");
    expect(i.trace.length).toBe(2);
    expect(i.trace.events[1]?.op).toBe("status_transition");
    expect(i.trace.events[1]?.trust).toBe("verified");
  });

  it("refuses an illegal transition (fail-closed)", () => {
    const i = new Instance(params);
    i.transition("done");
    expect(() => i.transition("running")).toThrow(/already terminal/);
  });

  it("refuses a non-adjacent transition", () => {
    const i = new Instance(params);
    i.transition("awaiting_user");
    expect(() => i.transition("done")).toThrow(/illegal transition/);
  });
});
