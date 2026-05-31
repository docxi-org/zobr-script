import { describe, it, expect } from "vitest";
import { FsScriptLoader, StartRejected } from "../src/index";
import { FakeReader, VALID_COG, INVALID_COG } from "./_fakereader";

describe("FsScriptLoader — validate-at-start", () => {
  it("loads a valid cognitive-only script and returns a code snapshot", async () => {
    const loader = new FsScriptLoader(new FakeReader({
      news: { script_ref: "news", cog: [{ name: "/zs/news.cog.ts", content: VALID_COG }], srv: [] },
    }));
    const loaded = await loader.load("news");
    expect(loaded.script_ref).toBe("news");
    expect(loaded.code).toContain("function analyze");
    expect(loaded.sandboxHost.has("anything")).toBe(false);
  });

  it("rejects a script that fails validation (fence: eval)", async () => {
    const loader = new FsScriptLoader(new FakeReader({
      bad: { script_ref: "bad", cog: [{ name: "/zs/bad.cog.ts", content: INVALID_COG }], srv: [] },
    }));
    await expect(loader.load("bad")).rejects.toBeInstanceOf(StartRejected);
  });

  it("loads a script with a class-based server module", async () => {
    const loader = new FsScriptLoader(new FakeReader({
      withSrv: {
        script_ref: "withSrv",
        cog: [{ name: "/zs/x.cog.ts", content: VALID_COG }],
        srv: [{ name: "/zs/x.srv.ts", content: `export default class extends ZsScript {\n  onReport(l: string, d: unknown): void {}\n}` }],
      },
    }));
    const loaded = await loader.load("withSrv");
    expect(loaded.script_ref).toBe("withSrv");
    expect(loaded.runtime).toBeDefined();
    loaded.runtime!.terminate();
  });
});
