import { describe, it, expect } from "vitest";
import { CapabilitySet } from "../src/index";

describe("CapabilitySet — allowlist scoping", () => {
  it("reports membership and missing caps", () => {
    const caps = new CapabilitySet(["store.read", "kb.read"]);
    expect(caps.has("store.read")).toBe(true);
    expect(caps.has("kb.write")).toBe(false);
    expect(caps.missing(["store.read"])).toEqual([]);
    expect(caps.missing(["store.read", "kb.write", "store.write"])).toEqual(["kb.write", "store.write"]);
  });
  it("an empty grant denies everything", () => {
    expect(new CapabilitySet([]).missing(["kb.read"])).toEqual(["kb.read"]);
  });
});
