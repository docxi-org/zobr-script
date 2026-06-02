import { describe, it, expect } from "vitest";
import { fence } from "../src/index";

const codes = (name: string, src: string) => fence(name, src).map((d) => d.code);

describe("structural fence", () => {
  it("passes a clean script", () => {
    expect(fence("/zs/ok.cog.ts", `export function f(){ const x = survey("t", { count: 2 }); return conclude<{a:number}>({a:0}); }`)).toHaveLength(0);
  });
  it("flags eval and Function as errors", () => {
    expect(codes("/zs/e.cog.ts", `function f(){ eval("1"); }`)).toContain("fence/no-eval");
    expect(codes("/zs/e.cog.ts", `function f(){ const g = new Function("return 1"); }`)).toContain("fence/no-function-ctor");
  });
  it("flags non-relative imports as errors", () => {
    expect(codes("/zs/i.cog.ts", `import x from "lodash"; export const y = x;`)).toContain("fence/no-external-import");
    expect(codes("/zs/i.cog.ts", `import type { T } from "./sibling.cog"; export type U = T;`)).not.toContain("fence/no-external-import");
  });
  it("warns on unbounded loops", () => {
    expect(fence("/zs/l.cog.ts", `function f(){ while(true){} }`)[0]?.severity).toBe("warning");
    expect(codes("/zs/l.cog.ts", `function f(){ for(;;){} }`)).toContain("fence/unbounded-loop");
  });
  it("warns on catch-then-retry of the same op", () => {
    const src = `function f(){ try { retrieve("q"); } catch (e) { retrieve("q"); } }`;
    expect(codes("/zs/r.cog.ts", src)).toContain("fence/catch-then-retry");
  });
  it("errors on duplicate checkpoint/report labels", () => {
    const dup = `function f(){
      checkpoint("progress", { step: 1 });
      checkpoint("progress", { step: 2 });
    }`;
    const diags = fence("/zs/d.cog.ts", dup);
    expect(diags.some((d) => d.code === "fence/duplicate-label" && d.severity === "error")).toBe(true);
    expect(diags[0]?.message).toContain('"progress"');
  });
  it("allows same label for checkpoint and report (different operation types)", () => {
    const src = `function f(){
      checkpoint("status", { x: 1 });
      report("status", { y: 2 });
    }`;
    expect(codes("/zs/ok.cog.ts", src)).not.toContain("fence/duplicate-label");
  });
  it("allows a single checkpoint label used once", () => {
    const src = `function f(){ checkpoint("done", { ok: true }); }`;
    expect(codes("/zs/ok.cog.ts", src)).not.toContain("fence/duplicate-label");
  });
  it("errors on re-export (export { } and export * from)", () => {
    expect(codes("/zs/r.srv.ts", `export { foo } from "./other";`)).toContain("fence/no-reexport");
    expect(codes("/zs/r.srv.ts", `export * from "./other";`)).toContain("fence/no-reexport");
  });
  it("allows export default class", () => {
    const src = `export default class extends ZsScript { foo(): number { return 1; } }`;
    expect(codes("/zs/ok.srv.ts", src)).not.toContain("fence/no-reexport");
    expect(codes("/zs/ok.srv.ts", src)).not.toContain("fence/no-default-fn");
  });
});
