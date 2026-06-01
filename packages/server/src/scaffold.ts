// Materialize the canonical ZS scaffold (zs.*.d.ts + tsconfig*) into a library
// folder so VS Code opens it with correct validation (doc 09 §8).
// store.d.ts is user-editable — only written if missing.
import { writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { scaffoldFiles } from "@zobr/scaffold";

const USER_EDITABLE = new Set(["store.d.ts"]);

export async function materializeScaffold(libraryRoot: string): Promise<void> {
  await mkdir(libraryRoot, { recursive: true });
  const writes = [...scaffoldFiles].map(async ([name, content]) => {
    const path = join(libraryRoot, name);
    if (USER_EDITABLE.has(name)) {
      try { await access(path); return; } catch { /* file missing, create it */ }
    }
    await writeFile(path, content, "utf8");
  });
  await Promise.all(writes);
}
