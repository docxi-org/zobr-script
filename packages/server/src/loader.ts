// FsScriptLoader — resolves a script_ref into a LoadedScript (doc 03 §9).
// Uses SrvRuntime (class-based worker) for scripts with srv modules.
import { validateScript, extractCogShapes, transpileSrvModule } from "@zobr/validator";
import type { ScriptBundle } from "@zobr/validator";
import { cognitiveAmbient } from "@zobr/scaffold";
import { NO_CONTROLLER } from "@zobr/core";
import type { SandboxFnSpec } from "@zobr/core";
import type { ScriptLoader, LoadedScript } from "@zobr/protocol";
import { SrvRuntime } from "./srv-runtime";
import { SrvSandboxAdapter, SrvControllerAdapter } from "./srv-adapters";
import { log } from "./logger";

export class NotImplemented extends Error {
  constructor(what: string) {
    super(`6b not implemented (Claude Code): ${what}`);
    this.name = "NotImplemented";
  }
}

export interface RawScript {
  readonly script_ref: string;
  readonly cog: ScriptBundle["cog"];
  readonly srv: ScriptBundle["srv"];
}

/** Reads a script's source files from the library folder. */
export interface ScriptSourceReader {
  read(script_ref: string): Promise<RawScript>;
}

/** A reader that also knows its library root (for list/create/delete). */
export interface ScriptLibrary extends ScriptSourceReader {
  readonly libraryRoot: string;
}

export class FsScriptLoader implements ScriptLoader {
  readonly #dbPath: string | undefined;
  constructor(private readonly reader: ScriptSourceReader, dbPath?: string) {
    this.#dbPath = dbPath;
  }

  readonly #log = log.child({ module: "loader" });

  async load(script_ref: string): Promise<LoadedScript> {
    const raw = await this.reader.read(script_ref);
    this.#log.debug({ script_ref, cog: raw.cog.length, srv: raw.srv.length }, "validating script");

    const result = validateScript({ cog: raw.cog, srv: raw.srv });
    if (!result.ok) {
      this.#log.warn({ script_ref, errors: result.errors.length }, "validation failed");
      throw new StartRejected(script_ref, result.errors.map((e) => `${e.code}: ${e.message}`));
    }

    const code = raw.cog.map((f) => f.content).join("\n\n");
    const cogShapes = extractCogShapes(raw.cog, cognitiveAmbient);
    const hasServerModule = raw.srv.length > 0;

    const budgets = parseBudgetTag(raw.cog[0]?.content ?? "");

    const optShapes = {
      ...(cogShapes.concludeShape !== undefined ? { concludeShape: cogShapes.concludeShape } : {}),
      ...(Object.keys(cogShapes.checkpointShapes).length > 0 ? { checkpointShapes: cogShapes.checkpointShapes } : {}),
      ...(Object.keys(cogShapes.reportShapes).length > 0 ? { reportShapes: cogShapes.reportShapes } : {}),
    };

    if (!hasServerModule) {
      this.#log.info({ script_ref }, "loaded cognitive-only script");
      return {
        script_ref,
        code,
        sandboxSpecs: [],
        capabilities: [],
        sandboxHost: { has: () => false, invoke: () => Promise.reject(new Error("no sandbox host")) },
        controller: NO_CONTROLLER,
        ...optShapes,
        ...(budgets ? { budgets } : {}),
      };
    }

    const srvJs = transpileSrvModule(raw.srv.map((f) => f.content).join("\n\n"));
    const dbPath = this.#dbPath ?? "./data/store.sqlite";
    const { mkdirSync } = await import("node:fs");
    const { dirname } = await import("node:path");
    try { mkdirSync(dirname(dbPath), { recursive: true }); } catch {}
    const runtime = new SrvRuntime({ moduleSource: srvJs, dbPath });
    const serverFunctions = await runtime.getServerFunctions();
    const sandboxSpecs: SandboxFnSpec[] = serverFunctions.map((name) => ({ name, needs: [] }));

    this.#log.info({ script_ref, serverFunctions, dbPath }, "loaded script with srv runtime");

    return {
      script_ref,
      code,
      sandboxSpecs,
      capabilities: [],
      sandboxHost: new SrvSandboxAdapter(runtime, serverFunctions),
      controller: new SrvControllerAdapter(runtime),
      runtime,
      serverFunctions,
      ...optShapes,
      ...(budgets ? { budgets } : {}),
    };
  }
}

function parseBudgetTag(source: string): { steps?: number; iterations?: number } | undefined {
  const m = source.match(/^\/\*\*[\s\S]*?\*\//);
  if (!m) return undefined;
  const bm = m[0].match(/@budget\s+(.+)/);
  if (!bm) return undefined;
  const result: { steps?: number; iterations?: number } = {};
  for (const pair of bm[1]!.split(/\s+/)) {
    const [k, v] = pair.split("=");
    const n = Number(v);
    if (k === "steps" && Number.isFinite(n) && n > 0) result.steps = n;
    if (k === "iterations" && Number.isFinite(n) && n > 0) result.iterations = n;
  }
  return result.steps !== undefined || result.iterations !== undefined ? result : undefined;
}

export class StartRejected extends Error {
  constructor(readonly script_ref: string, readonly errors: readonly string[]) {
    super(`start rejected for "${script_ref}": ${errors.join("; ")}`);
    this.name = "StartRejected";
  }
}
