import { describe, it, expect } from "vitest";
import { CORE_VERSION, isTerminal } from "../src/index";

describe("@zobr/core smoke", () => {
  it("exposes a version", () => {
    expect(CORE_VERSION).toBe("0.2.0");
  });
  it("classifies terminal vs active status", () => {
    expect(isTerminal("running")).toBe(false);
    expect(isTerminal("done")).toBe(true);
    expect(isTerminal("aborted")).toBe(true);
  });
});
