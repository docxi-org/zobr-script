// Adapters: SrvRuntime → core ports (SandboxHost, ControllerHost).
// These bridge the class-based unified runtime to the existing
// SandboxDispatcher and ControlDriver in @zobr/core.
import type { SandboxHost, SandboxCall, SandboxOutcome, ControllerHost, Directive } from "@zobr/core";
import type { SrvRuntime } from "./srv-runtime";

export class SrvSandboxAdapter implements SandboxHost {
  readonly #runtime: SrvRuntime;
  readonly #functions: ReadonlySet<string>;

  constructor(runtime: SrvRuntime, functions: readonly string[]) {
    this.#runtime = runtime;
    this.#functions = new Set(functions);
  }

  has(fn: string): boolean {
    return this.#functions.has(fn);
  }

  async invoke(call: SandboxCall): Promise<SandboxOutcome> {
    const r = await this.#runtime.call(call.invocation_id, call.fn, [...call.args]);
    if (r.ok) {
      return { ok: true, value: r.result };
    }
    return { ok: false, error: { kind: "sandbox_error", message: r.error?.message ?? "unknown error" } };
  }
}

export class SrvControllerAdapter implements ControllerHost {
  readonly present = true;
  readonly #runtime: SrvRuntime;

  constructor(runtime: SrvRuntime) {
    this.#runtime = runtime;
  }

  async onStart(invocationId: string): Promise<void> {
    // onStart is handled separately in ZsService.start() via runtime.createInstance()
    // This method is a no-op — createInstance already called onStart.
  }

  async onCheckpoint(invocationId: string, label: string, data: unknown): Promise<Directive> {
    const r = await this.#runtime.lifecycle(invocationId, "onCheckpoint", [label, data]);
    if (r.ok) return (r.result as Directive) ?? "proceed";
    return "proceed";
  }

  async onReport(invocationId: string, label: string, data: unknown): Promise<void> {
    await this.#runtime.lifecycle(invocationId, "onReport", [label, data]);
  }
}
