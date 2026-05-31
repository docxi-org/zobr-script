import { describe, it, expect } from "vitest";
import { checkShape, conforms } from "../src/index";
import type { Shape } from "../src/index";

const resultShape: Shape = {
  kind: "object",
  fields: {
    summary: { kind: "string" },
    confidence: { kind: "literal", values: ["low", "medium", "high"] },
    topics: { kind: "array", of: { kind: "string" } },
    note: { kind: "string" },
  },
  optional: ["note"],
};

describe("checkShape — schema at the seam (form, not truth)", () => {
  it("accepts a conforming value", () => {
    expect(conforms({ summary: "s", confidence: "high", topics: ["a", "b"] }, resultShape)).toBe(true);
  });
  it("flags wrong primitive types with a path", () => {
    const errs = checkShape({ summary: 1, confidence: "high", topics: [] }, resultShape);
    expect(errs).toContainEqual({ path: "$.summary", expected: "string", got: "number" });
  });
  it("flags a literal not in the union", () => {
    const errs = checkShape({ summary: "s", confidence: "certain", topics: [] }, resultShape);
    expect(errs[0]?.path).toBe("$.confidence");
  });
  it("flags missing required fields but allows missing optional", () => {
    const errs = checkShape({ confidence: "low", topics: [] }, resultShape);
    expect(errs).toContainEqual({ path: "$.summary", expected: "string", got: "missing" });
    expect(conforms({ summary: "s", confidence: "low", topics: [] }, resultShape)).toBe(true); // note omitted ok
  });
  it("checks array element types", () => {
    const errs = checkShape({ summary: "s", confidence: "low", topics: ["a", 2] }, resultShape);
    expect(errs[0]?.path).toBe("$.topics[1]");
  });
  it("unknown accepts anything (Sem)", () => {
    expect(conforms({ whatever: 1 }, { kind: "unknown" })).toBe(true);
  });
  it("a coherent-but-false value still passes (form, not truth)", () => {
    // confidence 'high' with empty topics is semantically dubious but well-formed.
    expect(conforms({ summary: "the earth is flat", confidence: "high", topics: [] }, resultShape)).toBe(true);
  });
});
