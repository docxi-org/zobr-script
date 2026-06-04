// Canonical ambient declaration texts and scaffold template files, read from
// lib-template (the single source of truth). Consumers: the validator typechecks
// ZS scripts against the ambients; the server materializes the full scaffold
// into a library folder for VS Code (doc 09 §8).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const tpl = (f: string): string => readFileSync(join(here, "..", "lib-template", f), "utf8");

export const cognitiveAmbient: string = tpl("zs.cognitive.d.ts");
export const serverAmbient: string = tpl("zs.server.d.ts");
export const storeTemplate: string = tpl("store.d.ts");

const guideDir = join(here, "..", "guide");
const guide = (f: string): string => readFileSync(join(guideDir, f), "utf8");

export const guideExecutor: string = guide("guide-executor.md");
export const guideArchitectExtra: string = guide("guide-architect.md");

export const scaffoldFiles: ReadonlyMap<string, string> = new Map([
  ["zs.cognitive.d.ts", cognitiveAmbient],
  ["zs.server.d.ts", serverAmbient],
  ["store.d.ts", storeTemplate],
  ["tsconfig.base.json", tpl("tsconfig.base.json")],
  ["tsconfig.cognitive.json", tpl("tsconfig.cognitive.json")],
  ["tsconfig.server.json", tpl("tsconfig.server.json")],
  ["tsconfig.json", tpl("tsconfig.json")],
]);
