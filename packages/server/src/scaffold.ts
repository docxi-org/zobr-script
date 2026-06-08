// Materialize the canonical ZS scaffold (zs.*.d.ts + tsconfig*) into a library
// folder so VS Code opens it with correct validation (doc 09 §8).
// store.d.ts is user-editable — only written if missing.
import { writeFile, mkdir, access, readFile, readdir } from "node:fs/promises";
import { join, relative, basename, dirname } from "node:path";
import { scaffoldFiles, serverAmbient } from "@zobr/scaffold";
import { extractClassInfo, generateMethodAmbient } from "@zobr/validator";

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
  await generateSandboxDeclarations(libraryRoot);
}

async function generateSandboxDeclarations(libraryRoot: string): Promise<void> {
  const walk = async (dir: string): Promise<string[]> => {
    const entries = await readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) files.push(...await walk(p));
      else if (e.name.endsWith(".srv.ts")) files.push(p);
    }
    return files;
  };

  for (const srvPath of await walk(libraryRoot)) {
    const ref = relative(libraryRoot, srvPath).replace(/\.srv\.ts$/, "");
    const dtsPath = join(libraryRoot, ref + ".sandbox.d.ts");
    try {
      const content = await readFile(srvPath, "utf8");
      const srvFiles = [{ name: `/zs/${basename(srvPath)}`, content }];
      const classInfo = extractClassInfo(srvFiles, serverAmbient);
      if (classInfo && classInfo.methods.length > 0) {
        await writeFile(dtsPath, generateMethodAmbient(classInfo) + "\n", "utf8");
      }
    } catch { /* skip unreadable files */ }
  }
}
