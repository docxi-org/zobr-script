import { describe, it, expect } from "vitest";
import { zStartReq, zSandboxReq, zCheckpointRes, zDirective } from "../src/index";

describe("message schemas (zod)", () => {
  it("parses a valid start request and applies arg default", () => {
    expect(zStartReq.parse({ script_ref: "news" }).script_ref).toBe("news");
    expect(zSandboxReq.parse({ invocation_id: "i", fn: "rank" }).args).toEqual([]);
  });
  it("rejects a start request missing script_ref", () => {
    expect(zStartReq.safeParse({}).success).toBe(false);
  });
  it("accepts all directive shapes", () => {
    for (const d of ["proceed", "warn", "halt", { ask: "q", choices: ["a"] }]) {
      expect(zDirective.safeParse(d).success).toBe(true);
    }
    expect(zCheckpointRes.safeParse({ ok: true, directive: "proceed" }).success).toBe(true);
  });
});
