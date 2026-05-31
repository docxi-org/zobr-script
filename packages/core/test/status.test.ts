import { describe, it, expect } from "vitest";
import { isActive, isTerminal, isIntentionalStop, isInfraTerminal, canTransition } from "../src/index";

describe("status lifecycle", () => {
  it("classifies active vs terminal", () => {
    expect(isActive("running")).toBe(true);
    expect(isActive("awaiting_user")).toBe(true);
    expect(isTerminal("done")).toBe(true);
    expect(isTerminal("running")).toBe(false);
  });

  it("separates intentional stops from infra terminals", () => {
    expect(isIntentionalStop("halted")).toBe(true);
    expect(isIntentionalStop("halted_budget")).toBe(true);
    expect(isInfraTerminal("errored")).toBe(true);
    expect(isInfraTerminal("done")).toBe(false);
  });

  it("permits legal transitions and refuses illegal ones", () => {
    expect(canTransition("running", "done")).toBe(true);
    expect(canTransition("running", "awaiting_user")).toBe(true);
    expect(canTransition("awaiting_user", "running")).toBe(true);
    expect(canTransition("done", "running")).toBe(false); // terminals are sinks
    expect(canTransition("awaiting_user", "done")).toBe(false); // must resume first
  });
});
