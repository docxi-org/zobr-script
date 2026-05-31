import { describe, it, expect } from "vitest";
import { BudgetTracker } from "../src/index";

describe("BudgetTracker", () => {
  it("decrements and reports staying within budget", () => {
    const b = new BudgetTracker({ steps: 2, iterations: 1 });
    expect(b.consume("steps")).toBe(true);
    expect(b.remaining("steps")).toBe(1);
    expect(b.consume("steps")).toBe(true);
    expect(b.exhausted()).toBe(false);
  });

  it("flags exhaustion when overdrawn", () => {
    const b = new BudgetTracker({ steps: 1, iterations: 1 });
    expect(b.consume("steps")).toBe(true);
    expect(b.consume("steps")).toBe(false); // overdraw
    expect(b.exhausted()).toBe(true);
  });

  it("treats unset tokens as unbounded", () => {
    const b = new BudgetTracker({ steps: 5, iterations: 5 });
    expect(b.consume("tokens", 1_000_000)).toBe(true);
    expect(b.exhausted()).toBe(false);
  });
});
