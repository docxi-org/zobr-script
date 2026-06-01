// FsScriptSourceReader — reads a script's source files from the library.
// A script = a file pair: {ref}.cog.ts (required) + {ref}.srv.ts (optional).
// script_ref is a path from library root without extension: "hello", "analysis/insight".
// Virtual file names follow the /zs/{filename} convention expected by @zobr/validator.
import { readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import type { ScriptLibrary, RawScript } from "./loader";
import type { VirtualFile } from "@zobr/validator";

export class FsScriptSourceReader implements ScriptLibrary {
  readonly libraryRoot: string;
  constructor(libraryRoot: string) { this.libraryRoot = libraryRoot; }

  async read(script_ref: string): Promise<RawScript> {
    const base = basename(script_ref);
    const cogPath = join(this.libraryRoot, script_ref + ".cog.ts");

    let cogContent: string;
    try {
      cogContent = await readFile(cogPath, "utf8");
    } catch {
      throw new Error(`script not found: "${script_ref}" (${cogPath})`);
    }

    const cog: VirtualFile[] = [{ name: `/zs/${base}.cog.ts`, content: cogContent }];
    const srv: VirtualFile[] = [];

    try {
      const srvContent = await readFile(join(this.libraryRoot, script_ref + ".srv.ts"), "utf8");
      srv.push({ name: `/zs/${base}.srv.ts`, content: srvContent });
    } catch {
      // no srv module — cognitive-only script
    }

    return { script_ref, cog, srv };
  }
}
