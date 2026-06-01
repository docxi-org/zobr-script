// The invocation instance (doc 03 §3): the working state of one run. Wires
// store + trace + budgets + status. transition() is fail-closed.
import { HandleStore } from "./store";
import { Trace } from "./trace";
import { BudgetTracker } from "./budget";
import type { Budgets } from "./budget";
import type { Status } from "./status";
import { canTransition, isTerminal } from "./status";
import { newInvocationId } from "./ids";
import type { TraceEvent } from "./trace";
import type { StoreEntry } from "./store";

export interface InstanceSnapshot {
  readonly invocation_id: string;
  readonly script_ref: string;
  readonly code_snapshot: string;
  readonly status: Status;
  readonly cursor: number;
  readonly store: Record<string, StoreEntry>;
  readonly events: readonly TraceEvent[];
  readonly budgets: { steps: number; iterations: number; tokens: number };
  readonly depth: number;
  readonly parent_invocation_id?: string;
}

export interface InstanceParams {
  readonly invocation_id?: string;
  readonly script_ref: string;
  readonly code_snapshot: string;
  readonly budgets: Budgets;
  readonly parent_invocation_id?: string;
  readonly depth?: number;
}

export class Instance {
  readonly invocation_id: string;
  readonly script_ref: string;
  readonly code_snapshot: string;
  readonly store: HandleStore;
  readonly trace: Trace;
  readonly budgets: BudgetTracker;
  readonly parent_invocation_id?: string;
  readonly depth: number;
  readonly createdAt: number;
  lastActivityAt: number;
  cursor = 0;
  #status: Status = "running";

  constructor(p: InstanceParams) {
    this.invocation_id = p.invocation_id ?? newInvocationId();
    const now = Date.now();
    this.createdAt = now;
    this.lastActivityAt = now;
    this.script_ref = p.script_ref;
    this.code_snapshot = p.code_snapshot;
    this.store = new HandleStore();
    this.trace = new Trace();
    this.budgets = new BudgetTracker(p.budgets);
    if (p.parent_invocation_id !== undefined) this.parent_invocation_id = p.parent_invocation_id;
    this.depth = p.depth ?? 0;
    this.trace.append({
      op: "status_transition",
      realizer: "server",
      trust: "verified",
      inputs: [],
      meta: { from: "created", to: "running", reason: "start" },
    });
  }

  get status(): Status {
    return this.#status;
  }

  /** Attempt a status transition. Illegal or post-terminal moves are refused
   *  (throws) and the legal ones are recorded to the trace. Fail-closed. */
  transition(to: Status, reason?: string): void {
    if (isTerminal(this.#status)) {
      throw new Error(`instance already terminal (${this.#status}); cannot move to ${to}`);
    }
    if (!canTransition(this.#status, to)) {
      throw new Error(`illegal transition ${this.#status} -> ${to}`);
    }
    const from = this.#status;
    this.#status = to;
    this.trace.append({
      op: "status_transition",
      realizer: "server",
      trust: "verified",
      inputs: [],
      meta: { from, to, ...(reason !== undefined ? { reason } : {}) },
    });
  }

  snapshot(): InstanceSnapshot {
    return {
      invocation_id: this.invocation_id,
      script_ref: this.script_ref,
      code_snapshot: this.code_snapshot,
      status: this.#status,
      cursor: this.cursor,
      store: this.store.snapshot(),
      events: [...this.trace.events],
      budgets: this.budgets.snapshot(),
      depth: this.depth,
      ...(this.parent_invocation_id !== undefined ? { parent_invocation_id: this.parent_invocation_id } : {}),
    };
  }

  static restore(snap: InstanceSnapshot): Instance {
    const inst = new Instance({
      invocation_id: snap.invocation_id,
      script_ref: snap.script_ref,
      code_snapshot: snap.code_snapshot,
      budgets: snap.budgets,
      ...(snap.parent_invocation_id !== undefined ? { parent_invocation_id: snap.parent_invocation_id } : {}),
      depth: snap.depth,
    });
    inst.#status = snap.status;
    inst.cursor = snap.cursor;
    inst.store.restore(snap.store);
    inst.trace.restore(snap.events);
    inst.budgets.restore(snap.budgets);
    return inst;
  }
}
