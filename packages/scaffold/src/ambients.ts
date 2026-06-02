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

export interface GuideTopic {
  readonly file: string;
  readonly topic: string;
  readonly audience: "both" | "executor" | "architect";
  readonly title: string;
  readonly content: string;
}

const GUIDE_META: { file: string; topic: string; audience: "both" | "executor" | "architect"; title: string }[] = [
  { file: "00-overview.md", topic: "overview", audience: "both", title: "What is ZS, the cycle, roles" },
  { file: "01-operations.md", topic: "operations", audience: "both", title: "Semantics of each cognitive operation" },
  { file: "02-trust.md", topic: "trust", audience: "both", title: "Trust model: asserted / verified / authority" },
  { file: "03-script-structure.md", topic: "script-structure", audience: "architect", title: "cog + srv, contract, entry point, conclude<T>" },
  { file: "04-server-module.md", topic: "server-module", audience: "architect", title: "ZsScript, Db, Collection, Notes, Directive" },
  { file: "05-store.md", topic: "store", audience: "architect", title: "Collections, notes, store.d.ts schema" },
  { file: "06-lifecycle.md", topic: "lifecycle", audience: "architect", title: "Hot/cold, TTL, eviction, resume, checkpoints" },
  { file: "07-composition.md", topic: "composition", audience: "architect", title: "define-inline < @sandbox < run" },
  { file: "08-patterns.md", topic: "patterns", audience: "architect", title: "Example scripts with annotations" },
  { file: "09-discipline.md", topic: "discipline", audience: "both", title: "Commit/check, honesty, fail-closed, HITL" },
  { file: "10-ambients.md", topic: "ambients", audience: "both", title: "Full .d.ts signatures — cognitive + server + store" },
];

const guideDir = join(here, "..", "guide");

export const guideTopics: readonly GuideTopic[] = GUIDE_META.map((m) => ({
  ...m,
  content: readFileSync(join(guideDir, m.file), "utf8"),
}));

export const scaffoldFiles: ReadonlyMap<string, string> = new Map([
  ["zs.cognitive.d.ts", cognitiveAmbient],
  ["zs.server.d.ts", serverAmbient],
  ["store.d.ts", storeTemplate],
  ["tsconfig.base.json", tpl("tsconfig.base.json")],
  ["tsconfig.cognitive.json", tpl("tsconfig.cognitive.json")],
  ["tsconfig.server.json", tpl("tsconfig.server.json")],
  ["tsconfig.json", tpl("tsconfig.json")],
]);
