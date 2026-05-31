import { describe, it, expect } from "vitest";
import { HandleStore } from "../src/index";

describe("HandleStore — pass-by-handle", () => {
  it("put returns a handle with a preview; get round-trips the value", () => {
    const s = new HandleStore();
    const data = { a: 1, b: [1, 2, 3] };
    const h = s.put(data);
    expect(h.__handle).toBe(true);
    expect(typeof h.id).toBe("string");
    expect(h.preview.kind).toBe("object");
    expect(s.get(h)).toBe(data);
    expect(s.get(h.id)).toBe(data);
  });

  it("builds shape-only previews without the bulk value", () => {
    const s = new HandleStore();
    expect(s.put([1, 2, 3, 4]).preview).toMatchObject({ kind: "array", size: 4 });
    expect(s.put("x".repeat(200)).preview).toMatchObject({ kind: "string", size: 200 });
    expect(s.put(null).preview.kind).toBe("null");
    expect(s.put(42).preview.summary).toBe("42");
  });

  it("throws on unknown handles", () => {
    const s = new HandleStore();
    expect(() => s.get("nope")).toThrow(/unknown handle/);
    expect(s.has("nope")).toBe(false);
  });

  it("isolates stores between instances", () => {
    const a = new HandleStore();
    const b = new HandleStore();
    const h = a.put("secret");
    expect(a.has(h)).toBe(true);
    expect(b.has(h.id)).toBe(false);
  });
});
