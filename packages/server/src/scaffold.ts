// Materialize the canonical ZS scaffold (zs.*.d.ts + tsconfig*) into a library
// folder so VS Code opens it with correct validation (doc 09 §8).
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { scaffoldFiles } from "@zobr/scaffold";

export async function materializeScaffold(libraryRoot: string): Promise<void> {
  await mkdir(libraryRoot, { recursive: true });
  const writes = [...scaffoldFiles].map(([name, content]) =>
    writeFile(join(libraryRoot, name), content, "utf8"),
  );
  await Promise.all(writes);
}
