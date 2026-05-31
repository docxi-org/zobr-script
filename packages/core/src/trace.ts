// The trace is the product (doc 07). Ordered ledger; each event tagged with
// realizer + trust class. coverage() aggregates the trust metric (doc 07 §4).
import type { Realizer, TrustClass } from "./trust";

export interface TraceEvent {
  readonly seq: number;
  readonly t: string; // ISO 8601
  readonly op: string;
  readonly realizer: Realizer;
  readonly trust: TrustClass;
  readonly inputs: readonly string[]; // input handle ids
  readonly output?: string; // output handle id
  readonly preview?: string;
  readonly meta?: Readonly<Record<string, unknown>>;
}

export interface Coverage {
  readonly verified: number; // fraction of (verified + asserted)
  readonly asserted: number;
  readonly authority_gates: number;
  readonly grounded_claims: number;
  readonly asserted_claims: number;
}

export type NewEvent = Omit<TraceEvent, "seq" | "t"> & { t?: string };

export class Trace {
  readonly #events: TraceEvent[] = [];
  #seq = 0;

  append(ev: NewEvent): TraceEvent {
    this.#seq += 1;
    const full: TraceEvent = {
      seq: this.#seq,
      t: ev.t ?? new Date().toISOString(),
      op: ev.op,
      realizer: ev.realizer,
      trust: ev.trust,
      inputs: ev.inputs,
      ...(ev.output !== undefined ? { output: ev.output } : {}),
      ...(ev.preview !== undefined ? { preview: ev.preview } : {}),
      ...(ev.meta !== undefined ? { meta: ev.meta } : {}),
    };
    this.#events.push(full);
    return full;
  }

  get events(): readonly TraceEvent[] {
    return this.#events;
  }

  get length(): number {
    return this.#events.length;
  }

  restore(events: readonly TraceEvent[]): void {
    this.#events.length = 0;
    this.#events.push(...events);
    this.#seq = events.length > 0 ? events[events.length - 1]!.seq : 0;
  }

  coverage(): Coverage {
    let verified = 0;
    let asserted = 0;
    let authority_gates = 0;
    let grounded_claims = 0;
    let asserted_claims = 0;
    for (const e of this.#events) {
      if (e.trust === "verified") verified += 1;
      else if (e.trust === "asserted") asserted += 1;
      else if (e.trust === "authority") authority_gates += 1;
      if (e.op === "retrieve" && e.trust === "verified") grounded_claims += 1;
      if (e.op === "assert" || e.op === "ground") asserted_claims += 1;
    }
    const denom = verified + asserted;
    return {
      verified: denom === 0 ? 0 : verified / denom,
      asserted: denom === 0 ? 0 : asserted / denom,
      authority_gates,
      grounded_claims,
      asserted_claims,
    };
  }
}
