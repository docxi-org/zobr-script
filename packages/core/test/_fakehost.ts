import type { SandboxHost, SandboxCall, SandboxOutcome } from "../src/index";

// A deterministic in-memory host for testing the dispatcher without any real
// isolation engine. Maps fn name -> a plain function over the (resolved) args.
export class FakeHost implements SandboxHost {
  readonly #fns: Map<string, (...args: unknown[]) => unknown>;
  readonly calls: SandboxCall[] = [];
  constructor(fns: Record<string, (...args: unknown[]) => unknown>) {
    this.#fns = new Map(Object.entries(fns));
  }
  has(fn: string): boolean {
    return this.#fns.has(fn);
  }
  invoke(call: SandboxCall): Promise<SandboxOutcome> {
    this.calls.push(call);
    const f = this.#fns.get(call.fn);
    if (f === undefined) return Promise.resolve({ ok: false, error: { kind: "sandbox_error", message: "no fn" } });
    try {
      return Promise.resolve({ ok: true, value: f(...call.args) });
    } catch (e) {
      return Promise.resolve({ ok: false, error: { kind: "sandbox_error", message: (e as Error).message } });
    }
  }
}
