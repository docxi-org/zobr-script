import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const tscJs = require.resolve("typescript/lib/tsc.js");
const here = dirname(fileURLToPath(import.meta.url));
const fx = (p: string) => resolve(here, "fixtures", p);

/** Run tsc on a project; return true if it typechecks cleanly. */
function typechecks(configPath: string): { ok: boolean; out: string } {
  try {
    const out = execFileSync(process.execPath, [tscJs, "-p", configPath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, out };
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string };
    return { ok: false, out: (err.stdout ?? "") + (err.stderr ?? "") };
  }
}

describe("zs scaffold — canonical types enforce the spec", () => {
  it("a valid cognitive script typechecks", () => {
    expect(typechecks(fx("valid/tsconfig.cognitive.json")).ok).toBe(true);
  });

  it("a valid server module typechecks", () => {
    expect(typechecks(fx("valid/tsconfig.server.json")).ok).toBe(true);
  });

  it("rejects a cross-script run() contract mismatch", () => {
    const r = typechecks(fx("negative-contract/tsconfig.cognitive.json"));
    expect(r.ok).toBe(false);
    expect(r.out).toMatch(/does not exist in type 'Input'/);
  });

  it("rejects a server module that reaches for the network (no fetch)", () => {
    const r = typechecks(fx("negative-fence/tsconfig.server.json"));
    expect(r.ok).toBe(false);
    expect(r.out).toMatch(/Cannot find name 'fetch'/);
  });
});
