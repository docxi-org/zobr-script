// SandboxHost — the PORT (doc 04 §5). Core defines the boundary; the actual
// execution engine (worker_threads default; isolated-vm as a swap-in option for
// untrusted code / mediated external bridges) lives in the server layer.
//
// The host runs the script's *frozen* copy of a @sandbox function by name. It is
// deterministic and effect-free in the default (worker) impl; an effectful impl
// (external bridge) would carry provenance — see SandboxOutcome.provenance.
import type { Capability } from "./capability";

export interface SandboxCall {
  readonly invocation_id: string;
  readonly fn: string; // @sandbox function name
  readonly args: readonly unknown[]; // already de-referenced from handles by the dispatcher
}

export interface SandboxOutcome {
  readonly ok: boolean;
  readonly value?: unknown; // present iff ok
  readonly error?: { kind: "sandbox_error"; message: string }; // present iff !ok (doc 06 B6)
  readonly provenance?: Readonly<Record<string, unknown>>; // effectful impls only (future)
}

/** A sandbox function's static descriptor: its name and the capabilities its
 *  body requires. Produced from the server module at publish/load time. */
export interface SandboxFnSpec {
  readonly name: string;
  readonly needs: readonly Capability[];
}

export interface SandboxHost {
  /** True if the host has a frozen implementation for this function name. */
  has(fn: string): boolean;
  /** Execute the frozen implementation. MUST NOT throw for in-sandbox errors —
   *  it returns SandboxOutcome{ok:false,...}; may reject only on host failure. */
  invoke(call: SandboxCall): Promise<SandboxOutcome>;
}
