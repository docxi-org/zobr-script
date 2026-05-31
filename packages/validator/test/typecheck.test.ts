import { describe, it, expect } from "vitest";
import { typecheck } from "../src/index";
import { cognitiveAmbient, serverAmbient } from "@zobr/scaffold";

const cog = "/zs/zs.cognitive.d.ts";
const srv = "/zs/zs.server.d.ts";
const errs = <T extends { severity: string }>(ds: readonly T[]): T[] => ds.filter((d) => d.severity === "error");

const TOPICS = `
export type Input = { text: string };
export type Result = { topics: string[] };
export function topics(input: Input): Result { survey(input.text, { count: 3 }); return conclude<Result>(); }
`;
const NEWS_OK = `
import type { Input as TIn, Result as TOut } from "./topics.cog";
export type Result = { summary: string };
export function analyze(t: string): Result {
  const r = run<TIn, TOut>("topics", { text: t });
  synthesize(r.topics, { method: "x" });
  return conclude<Result>();
}
`;
const NEWS_BAD = NEWS_OK.replace("{ text: t }", "{ txt: t }");

describe("typecheck (tsc-as-a-library)", () => {
  it("accepts a valid cognitive script with a cross-script run() contract", () => {
    const ds = typecheck([
      { name: cog, content: cognitiveAmbient },
      { name: "/zs/topics.cog.ts", content: TOPICS },
      { name: "/zs/news.cog.ts", content: NEWS_OK },
    ]);
    expect(errs(ds)).toHaveLength(0);
  });

  it("rejects a cross-script run() contract mismatch", () => {
    const ds = typecheck([
      { name: cog, content: cognitiveAmbient },
      { name: "/zs/topics.cog.ts", content: TOPICS },
      { name: "/zs/news.cog.ts", content: NEWS_BAD },
    ]);
    expect(errs(ds).some((d) => d.message.includes("Input"))).toBe(true);
  });

  it("rejects a server module reaching for the network (no fetch in ambient)", () => {
    const ds = typecheck([
      { name: srv, content: serverAmbient },
      { name: "/zs/bad.srv.ts", content: `export const onReport: OnReport = () => { void fetch("x"); };` },
    ]);
    expect(errs(ds).some((d) => /Cannot find name 'fetch'/.test(d.message))).toBe(true);
  });
});
