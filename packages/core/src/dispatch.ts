// SandboxDispatcher — the deterministic logic around the SandboxHost port:
// resolves handle args -> values, enforces capability scoping, charges a budget
// step, invokes the host, stores the result by handle, and records a trace event
// tagged verified. This is the verified seam where asserted args cross into the
// verified layer (doc 05 §3) with optional output shape validation (slice 5).
import type { Handle } from "./handle";
import type { Instance } from "./instance";
import { CapabilitySet } from "./capability";
import type { SandboxFnSpec, SandboxHost } from "./sandbox";
import { makePreview } from "./handle";
import type { Shape } from "./shape";
import { checkShape } from "./shape";

export type DispatchResult =
  | { readonly ok: true; readonly handle: Handle }
  | { readonly ok: false; readonly kind: SandboxFailureKind; readonly message: string };

export type SandboxFailureKind =
  | "unknown_fn" // host has no such frozen function
  | "capability_denied" // function needs caps the script wasn't granted
  | "budget_exhausted" // step budget ran out
  | "sandbox_error" // the function body threw (doc 06 B6)
  | "schema_mismatch"; // output failed the seam shape check (doc 05 §3)

/** An arg is either a literal value or a handle reference into the instance store. */
export type SandboxArg = Handle | { readonly __literal: unknown };

function isHandle(a: SandboxArg): a is Handle {
  return typeof a === "object" && a !== null && "__handle" in a;
}

export class SandboxDispatcher {
  readonly #host: SandboxHost;
  readonly #specs: ReadonlyMap<string, SandboxFnSpec>;
  readonly #caps: CapabilitySet;

  constructor(host: SandboxHost, specs: readonly SandboxFnSpec[], caps: CapabilitySet) {
    this.#host = host;
    this.#specs = new Map(specs.map((s) => [s.name, s]));
    this.#caps = caps;
  }

  async dispatch(inst: Instance, fn: string, args: readonly SandboxArg[], outShape?: Shape): Promise<DispatchResult> {
    const spec = this.#specs.get(fn);
    if (spec === undefined || !this.#host.has(fn)) {
      return this.#fail(inst, fn, "unknown_fn", `no sandbox function "${fn}"`, []);
    }

    const missing = this.#caps.missing(spec.needs);
    if (missing.length > 0) {
      return this.#fail(inst, fn, "capability_denied", `missing capabilities: ${missing.join(", ")}`, []);
    }

    if (!inst.budgets.consume("steps")) {
      inst.transition("halted_budget", "step budget exhausted in sandbox dispatch");
      return { ok: false, kind: "budget_exhausted", message: "step budget exhausted" };
    }

    // Resolve handle args to values (pass-by-handle; data stays server-side).
    const inputHandles: string[] = [];
    const values = args.map((a) => {
      if (isHandle(a)) {
        inputHandles.push(a.id);
        return inst.store.get(a);
      }
      return a.__literal;
    });

    const outcome = await this.#host.invoke({ invocation_id: inst.invocation_id, fn, args: values });

    if (!outcome.ok) {
      return this.#fail(inst, fn, "sandbox_error", outcome.error?.message ?? "sandbox error", inputHandles);
    }

    if (outShape !== undefined) {
      const errs = checkShape(outcome.value, outShape);
      if (errs.length > 0) {
        const e = errs[0];
        const message = `output: ${e?.expected} expected at ${e?.path}, got ${e?.got}`;
        return this.#fail(inst, fn, "schema_mismatch", message, inputHandles);
      }
    }

    const handle = inst.store.put(outcome.value);
    inst.trace.append({
      op: fn,
      realizer: "sandbox",
      trust: "verified",
      inputs: inputHandles,
      output: handle.id,
      preview: makePreview(outcome.value).summary,
      ...(outcome.provenance !== undefined ? { meta: { provenance: outcome.provenance } } : {}),
    });
    return { ok: true, handle };
  }

  #fail(inst: Instance, fn: string, kind: SandboxFailureKind, message: string, inputs: string[]): DispatchResult {
    inst.trace.append({
      op: fn,
      realizer: "sandbox",
      trust: "verified",
      inputs,
      meta: { failed: kind, message },
    });
    return { ok: false, kind, message };
  }
}
