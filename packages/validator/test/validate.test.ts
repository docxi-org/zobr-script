import { describe, it, expect } from "vitest";
import { validateScript } from "../src/index";

const TOPICS = `
export type Input = { text: string };
export type Result = { topics: string[] };
export function topics(input: Input): Result { survey(input.text, { count: 3 }); return conclude<Result>(); }
`;
const NEWS = `
import type { Input as TIn, Result as TOut } from "./topics.cog";
export type Result = { summary: string };
export function analyze(t: string): Result {
  const r = run<TIn, TOut>("topics", { text: t });
  synthesize(r.topics, { method: "x" });
  return conclude<Result>();
}
`;
const SRV = `export default class extends ZsScript { onReport(label: string, data: unknown): void {} }`;

describe("validateScript (engine: tsc + fence)", () => {
  it("a valid two-part bundle is ok with no errors", () => {
    const r = validateScript({
      cog: [{ name: "/zs/topics.cog.ts", content: TOPICS }, { name: "/zs/news.cog.ts", content: NEWS }],
      srv: [{ name: "/zs/news.srv.ts", content: SRV }],
    });
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("fence errors make a bundle not ok", () => {
    const r = validateScript({
      cog: [{ name: "/zs/x.cog.ts", content: `export function f(){ eval("1"); return conclude<{a:number}>(); }` }],
      srv: [],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((d) => d.code === "fence/no-eval")).toBe(true);
  });

  it("warnings alone do not break ok", () => {
    const r = validateScript({
      cog: [{ name: "/zs/w.cog.ts", content: `export function f(){ while(true){} return conclude<{a:number}>(); }` }],
      srv: [],
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((d) => d.code === "fence/unbounded-loop")).toBe(true);
  });

  it("cog calling a srv public method passes validation (ambient auto-generation)", () => {
    const cog = `
export type Result = { items: string[] };
export function analyze(topic: string): Result {
  const items = findByTopic(topic);
  return conclude<Result>();
}
`;
    const srv = `
export default class TestScript extends ZsScript {
  findByTopic(topic: string): string[] { return []; }
}
`;
    const r = validateScript({
      cog: [{ name: "/zs/test.cog.ts", content: cog }],
      srv: [{ name: "/zs/test.srv.ts", content: srv }],
    });
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("cog calling an undefined srv method still fails validation", () => {
    const cog = `
export function analyze(topic: string) {
  const items = nonExistentMethod(topic);
  return conclude();
}
`;
    const srv = `
export default class TestScript extends ZsScript {
  findByTopic(topic: string): string[] { return []; }
}
`;
    const r = validateScript({
      cog: [{ name: "/zs/test.cog.ts", content: cog }],
      srv: [{ name: "/zs/test.srv.ts", content: srv }],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((d) => d.message.includes("nonExistentMethod"))).toBe(true);
  });
});
