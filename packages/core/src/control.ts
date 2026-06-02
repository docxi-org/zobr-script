// Control operations driver (doc 05 §6): report (fire-and-forget telemetry) and
// checkpoint (synchronous gate -> Directive). Report is asserted (server merely
// records agent-produced data). Checkpoint is verified (server evaluates and
// responds). Both run the value through schema-at-seam validation (doc 05 §3).
import type { Instance } from "./instance";
import type { ControllerHost, Directive } from "./controller";
import { isAsk } from "./controller";
import type { Shape } from "./shape";
import { checkShape } from "./shape";
import { makePreview } from "./handle";

export type ControlFailure =
  | { readonly kind: "schema_mismatch"; readonly message: string };

export type CheckpointResult =
  | { readonly ok: true; readonly directive: Directive }
  | { readonly ok: false } & ControlFailure;

export type ReportResult = { readonly ok: true } | ({ readonly ok: false } & ControlFailure);

export class ControlDriver {
  readonly #ctrl: ControllerHost;
  constructor(ctrl: ControllerHost) {
    this.#ctrl = ctrl;
  }

  /** Fire-and-forget telemetry into the trace; controller.onReport is optional. */
  async report(inst: Instance, label: string, data: unknown, shape?: Shape): Promise<ReportResult> {
    if (shape !== undefined) {
      const errs = checkShape(data, shape);
      if (errs.length > 0) {
        const message = `report "${label}" payload: ${errs[0]?.expected} expected at ${errs[0]?.path}, got ${errs[0]?.got}`;
        this.#recordFail(inst, "report", label, message);
        return { ok: false, kind: "schema_mismatch", message };
      }
    }
    if (this.#ctrl.present && this.#ctrl.onReport !== undefined) {
      await this.#ctrl.onReport(inst.invocation_id, label, data);
    }
    inst.trace.append({
      op: "report",
      realizer: "server",
      trust: "asserted",
      inputs: [],
      preview: makePreview(data).summary,
      meta: { label },
    });
    return { ok: true };
  }

  /** Synchronous gate. Returns the controller's Directive (default proceed when
   *  no module / no handler), applies halt to the instance, records the event. */
  async checkpoint(inst: Instance, label: string, data: unknown, shape?: Shape): Promise<CheckpointResult> {
    if (shape !== undefined) {
      const errs = checkShape(data, shape);
      if (errs.length > 0) {
        const message = `checkpoint "${label}" payload: ${errs[0]?.expected} expected at ${errs[0]?.path}, got ${errs[0]?.got}`;
        this.#recordFail(inst, "checkpoint", label, message);
        return { ok: false, kind: "schema_mismatch", message };
      }
    }

    let directive: Directive = "proceed";
    if (this.#ctrl.present && this.#ctrl.onCheckpoint !== undefined) {
      directive = await this.#ctrl.onCheckpoint(inst.invocation_id, label, data);
    }

    inst.trace.append({
      op: "checkpoint",
      realizer: "server",
      trust: "verified",
      inputs: [],
      preview: makePreview(data).summary,
      meta: { label, directive: isAsk(directive) ? { ask: directive.ask } : directive },
    });

    if (directive === "halt") {
      inst.transition("halted", `controller halt at checkpoint "${label}"`);
    }
    return { ok: true, directive };
  }

  #recordFail(inst: Instance, op: string, label: string, message: string): void {
    inst.trace.append({
      op,
      realizer: "server",
      trust: "verified",
      inputs: [],
      meta: { label, failed: "schema_mismatch", message },
    });
  }
}
