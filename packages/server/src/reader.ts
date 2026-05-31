// FsScriptSourceReader — reads a script's source files from the library folder
// on disk. A script = a subfolder with *.cog.ts (required) and *.srv.ts (optional).
// Virtual file names follow the /zs/{filename} convention expected by @zobr/validator.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ScriptLibrary, RawScript } from "./loader";
import type { VirtualFile } from "@zobr/validator";

export class FsScriptSourceReader implements ScriptLibrary {
  readonly libraryRoot: string;
  constructor(libraryRoot: string) { this.libraryRoot = libraryRoot; }

  async read(script_ref: string): Promise<RawScript> {
    const dir = join(this.libraryRoot, script_ref);

    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      throw new Error(`script not found: "${script_ref}" (${dir})`);
    }

    const cog: VirtualFile[] = [];
    const srv: VirtualFile[] = [];

    for (const entry of entries.sort()) {
      if (entry.endsWith(".cog.ts")) {
        const content = await readFile(join(dir, entry), "utf8");
        cog.push({ name: `/zs/${entry}`, content });
      } else if (entry.endsWith(".srv.ts")) {
        const content = await readFile(join(dir, entry), "utf8");
        srv.push({ name: `/zs/${entry}`, content });
      }
    }

    if (cog.length === 0) {
      throw new Error(`no *.cog.ts files in "${script_ref}" (${dir})`);
    }

    return { script_ref, cog, srv };
  }
}
