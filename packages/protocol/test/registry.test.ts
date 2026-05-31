import { describe, it, expect } from "vitest";
import { InvocationRegistry, UnknownInvocation } from "../src/index";
import { Instance } from "@zobr/core";

const mk = () => new Instance({ script_ref: "s", code_snapshot: "x", budgets: { steps: 5, iterations: 5 } });

describe("InvocationRegistry", () => {
  it("registers and requires instances", () => {
    const r = new InvocationRegistry();
    const i = mk();
    r.register(i);
    expect(r.require(i.invocation_id)).toBe(i);
    expect(r.has(i.invocation_id)).toBe(true);
  });
  it("throws UnknownInvocation for missing ids", () => {
    expect(() => new InvocationRegistry().require("nope")).toThrow(UnknownInvocation);
  });
  it("remembers idempotent outcomes by key, ignores undefined key", () => {
    const r = new InvocationRegistry();
    expect(r.remembered(undefined).hit).toBe(false);
    r.remember("k1", { v: 1 });
    expect(r.remembered("k1")).toEqual({ hit: true, value: { v: 1 } });
    r.remember(undefined, { v: 2 }); // no-op
    expect(r.remembered("k2").hit).toBe(false);
  });
});
