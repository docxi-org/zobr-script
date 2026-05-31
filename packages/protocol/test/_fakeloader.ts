import type { ScriptLoader, LoadedScript } from "../src/index";
import { NO_CONTROLLER } from "@zobr/core";
import type { SandboxHost, SandboxCall, SandboxOutcome, ControllerHost, Shape } from "@zobr/core";

class MapHost implements SandboxHost {
  readonly #fns: Map<string, (...a: unknown[]) => unknown>;
  constructor(fns: Record<string, (...a: unknown[]) => unknown>) { this.#fns = new Map(Object.entries(fns)); }
  has(fn: string): boolean { return this.#fns.has(fn); }
  invoke(call: SandboxCall): Promise<SandboxOutcome> {
    const f = this.#fns.get(call.fn);
    if (f === undefined) return Promise.resolve({ ok: false, error: { kind: "sandbox_error", message: "no fn" } });
    try { return Promise.resolve({ ok: true, value: f(...call.args) }); }
    catch (e) { return Promise.resolve({ ok: false, error: { kind: "sandbox_error", message: (e as Error).message } }); }
  }
}

export interface FakeScriptOpts {
  code?: string;
  controller?: ControllerHost;
  concludeShape?: Shape;
  sandboxOutShapes?: Record<string, Shape>;
  serverFunctions?: readonly string[];
}

/** A loader returning one configurable script; throws on any other ref. */
export class FakeLoader implements ScriptLoader {
  constructor(private readonly ref: string, private readonly opts: FakeScriptOpts = {}) {}
  load(script_ref: string): Promise<LoadedScript> {
    if (script_ref !== this.ref) return Promise.reject(new Error(`not found: ${script_ref}`));
    const loaded: LoadedScript = {
      script_ref,
      code: this.opts.code ?? "export function f(){ return conclude<{a:number}>(); }",
      sandboxSpecs: [{ name: "rank", needs: [] }],
      capabilities: [],
      sandboxHost: new MapHost({ rank: (xs: unknown) => (xs as number[]).slice().sort((a, b) => b - a) }),
      controller: this.opts.controller ?? NO_CONTROLLER,
      ...(this.opts.sandboxOutShapes !== undefined ? { sandboxOutShapes: this.opts.sandboxOutShapes } : {}),
      ...(this.opts.concludeShape !== undefined ? { concludeShape: this.opts.concludeShape } : {}),
      ...(this.opts.serverFunctions !== undefined ? { serverFunctions: this.opts.serverFunctions } : {}),
    };
    return Promise.resolve(loaded);
  }
}
