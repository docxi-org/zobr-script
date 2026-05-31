import { describe, it, expect } from "vitest";
import { extractCogShapes, extractClassInfo, extractStoreSchema, generateMethodAmbient, shapeToTypeText, transpileSrvModule } from "../src/index";
import { serverAmbient, cognitiveAmbient } from "@zobr/scaffold";

describe("extractCogShapes", () => {
  it("extracts concludeShape from conclude<T>()", () => {
    const cog = `
export type Result = { summary: string; confidence: "low" | "medium" | "high" };
export function analyze(t: string): Result { return conclude<Result>(); }
`;
    const shapes = extractCogShapes([{ name: "/zs/test.cog.ts", content: cog }], cognitiveAmbient);
    expect(shapes.concludeShape).toEqual({
      kind: "object",
      fields: {
        summary: { kind: "string" },
        confidence: { kind: "literal", values: ["low", "medium", "high"] },
      },
    });
  });

  it("extracts checkpointShapes per label", () => {
    const cog = `
interface ThesisCheck { holds: boolean }
export function analyze(t: string) {
  checkpoint("thesis_tested", { holds: true } as ThesisCheck);
  checkpoint("count_check", { n: 5 });
  return conclude();
}
`;
    const shapes = extractCogShapes([{ name: "/zs/test.cog.ts", content: cog }], cognitiveAmbient);
    expect(shapes.checkpointShapes["thesis_tested"]).toEqual({
      kind: "object",
      fields: { holds: { kind: "boolean" } },
    });
    expect(shapes.checkpointShapes["count_check"]).toEqual({
      kind: "object",
      fields: { n: { kind: "number" } },
    });
  });

  it("extracts reportShapes per label", () => {
    const cog = `
export function analyze(t: string) {
  report("stats", { count: 42, quality: "ok" });
  return conclude();
}
`;
    const shapes = extractCogShapes([{ name: "/zs/test.cog.ts", content: cog }], cognitiveAmbient);
    expect(shapes.reportShapes["stats"]).toEqual({
      kind: "object",
      fields: { count: { kind: "number" }, quality: { kind: "string" } },
    });
  });

  it("returns no concludeShape when conclude has no type argument", () => {
    const cog = `export function f() { return conclude(); }`;
    const shapes = extractCogShapes([{ name: "/zs/test.cog.ts", content: cog }], cognitiveAmbient);
    expect(shapes.concludeShape).toBeUndefined();
    expect(shapes.checkpointShapes).toEqual({});
    expect(shapes.reportShapes).toEqual({});
  });
});

describe("extractClassInfo", () => {
  it("extracts public non-lifecycle methods from a ZsScript class", () => {
    const srv = `
export default class TestScript extends ZsScript {
  private rounds = 0;

  findItems(topic: string): string[] {
    return [];
  }

  rankByScore(items: number[]): number[] {
    return items.sort();
  }

  private helper(): void {}

  protected internal(): void {}

  onStart(): Record<string, unknown> { return {}; }
  onCheckpoint(label: string, data: unknown): Directive { return "proceed"; }
  onReport(label: string, data: unknown): void {}
}
`;
    const info = extractClassInfo(
      [{ name: "/zs/test.srv.ts", content: srv }],
      serverAmbient,
    );

    expect(info).not.toBeNull();
    expect(info!.className).toBe("TestScript");
    expect(info!.methods).toHaveLength(2);

    const names = info!.methods.map((m) => m.name);
    expect(names).toEqual(["findItems", "rankByScore"]);
    expect(names).not.toContain("onStart");
    expect(names).not.toContain("onCheckpoint");
    expect(names).not.toContain("onReport");
    expect(names).not.toContain("helper");
    expect(names).not.toContain("internal");
  });

  it("extracts parameter names and type text for ambient generation", () => {
    const srv = `
export default class TestScript extends ZsScript {
  search(topic: string, limit: number): string[] {
    return [];
  }
}
`;
    const info = extractClassInfo(
      [{ name: "/zs/test.srv.ts", content: srv }],
      serverAmbient,
    );

    expect(info).not.toBeNull();
    const method = info!.methods[0]!;
    expect(method.name).toBe("search");
    expect(method.params).toEqual([
      { name: "topic", typeText: "string", shape: { kind: "string" } },
      { name: "limit", typeText: "number", shape: { kind: "number" } },
    ]);
    expect(method.returnTypeText).toBe("string[]");
    expect(method.returnShape).toEqual({ kind: "array", of: { kind: "string" } });
  });

  it("returns null when no class extends ZsScript", () => {
    const srv = `export function helper(): void {}`;
    const info = extractClassInfo(
      [{ name: "/zs/test.srv.ts", content: srv }],
      serverAmbient,
    );
    expect(info).toBeNull();
  });

  it("returns empty methods for a class with only lifecycle overrides", () => {
    const srv = `
export default class EmptyScript extends ZsScript {
  onCheckpoint(label: string, data: unknown): Directive { return "proceed"; }
}
`;
    const info = extractClassInfo(
      [{ name: "/zs/test.srv.ts", content: srv }],
      serverAmbient,
    );

    expect(info).not.toBeNull();
    expect(info!.className).toBe("EmptyScript");
    expect(info!.methods).toEqual([]);
  });

  it("skips static methods", () => {
    const srv = `
export default class TestScript extends ZsScript {
  static version(): string { return "1.0"; }
  query(q: string): string { return q; }
}
`;
    const info = extractClassInfo(
      [{ name: "/zs/test.srv.ts", content: srv }],
      serverAmbient,
    );

    expect(info).not.toBeNull();
    expect(info!.methods).toHaveLength(1);
    expect(info!.methods[0]!.name).toBe("query");
  });
});

describe("shapeToTypeText", () => {
  it("converts primitive shapes", () => {
    expect(shapeToTypeText({ kind: "string" })).toBe("string");
    expect(shapeToTypeText({ kind: "number" })).toBe("number");
    expect(shapeToTypeText({ kind: "boolean" })).toBe("boolean");
    expect(shapeToTypeText({ kind: "unknown" })).toBe("unknown");
  });

  it("converts literal union shapes", () => {
    expect(shapeToTypeText({ kind: "literal", values: ["low", "high"] })).toBe('"low" | "high"');
    expect(shapeToTypeText({ kind: "literal", values: [1, 2, 3] })).toBe("1 | 2 | 3");
  });

  it("converts array shapes with parens for complex inner types", () => {
    expect(shapeToTypeText({ kind: "array", of: { kind: "string" } })).toBe("string[]");
    expect(shapeToTypeText({ kind: "array", of: { kind: "object", fields: { x: { kind: "number" } } } }))
      .toBe("({ x: number })[]");
    expect(shapeToTypeText({ kind: "array", of: { kind: "literal", values: ["a", "b"] } }))
      .toBe('("a" | "b")[]');
  });

  it("converts object shapes with optional fields", () => {
    expect(shapeToTypeText({
      kind: "object",
      fields: { name: { kind: "string" }, age: { kind: "number" } },
      optional: ["age"],
    })).toBe("{ name: string; age?: number }");
  });
});

describe("generateMethodAmbient", () => {
  it("produces declare function lines from ClassInfo", () => {
    const srv = `
export default class TestScript extends ZsScript {
  search(topic: string, limit: number): string[] { return []; }
  count(): number { return 0; }
}
`;
    const info = extractClassInfo(
      [{ name: "/zs/test.srv.ts", content: srv }],
      serverAmbient,
    )!;
    const ambient = generateMethodAmbient(info);

    expect(ambient).toContain("declare function search(topic: string, limit: number): string[];");
    expect(ambient).toContain("declare function count(): number;");
  });

  it("expands complex types to structural form (no named type references)", () => {
    const srv = `
interface Entry { name: string; score: number }
export default class TestScript extends ZsScript {
  search(tag: string): Entry[] { return []; }
}
`;
    const info = extractClassInfo(
      [{ name: "/zs/test.srv.ts", content: srv }],
      serverAmbient,
    )!;
    const ambient = generateMethodAmbient(info);

    expect(ambient).toContain("declare function search(tag: string): ({ name: string; score: number })[];");
    expect(ambient).not.toContain("Entry");
  });
});

describe("extractStoreSchema", () => {
  it("extracts exported interfaces as Shape per collection name", () => {
    const store = `
export interface Analysis {
  topic: string;
  summary: string;
  confidence: "low" | "medium" | "high";
}

export interface Topic {
  name: string;
  priority: number;
  active: boolean;
}
`;
    const schema = extractStoreSchema(store);
    expect(Object.keys(schema).sort()).toEqual(["Analysis", "Topic"]);
    expect(schema["Analysis"]).toEqual({
      kind: "object",
      fields: {
        topic: { kind: "string" },
        summary: { kind: "string" },
        confidence: { kind: "literal", values: ["low", "medium", "high"] },
      },
    });
    expect(schema["Topic"]).toEqual({
      kind: "object",
      fields: {
        name: { kind: "string" },
        priority: { kind: "number" },
        active: { kind: "boolean" },
      },
    });
  });

  it("returns empty for store.d.ts with only comments", () => {
    const store = `// empty store`;
    expect(extractStoreSchema(store)).toEqual({});
  });

  it("ignores non-exported interfaces", () => {
    const store = `
interface Internal { x: number }
export interface Public { y: string }
`;
    const schema = extractStoreSchema(store);
    expect(Object.keys(schema)).toEqual(["Public"]);
  });
});

describe("transpileSrvModule", () => {
  it("strips types and produces valid JS", () => {
    const ts = `export function rank(items: string[]): string[] { return items.sort(); }`;
    const js = transpileSrvModule(ts);
    expect(js).toContain("function rank(items)");
    expect(js).not.toContain("string[]");
    expect(js).toContain("export");
  });
});
