// InvocationRegistry (doc 10 §4): holds live instances by id and enforces
// idempotency. A retried call carrying the same idempotency_key returns the
// remembered outcome instead of executing twice (doc 06 G20). Unconfirmed
// dispatch is treated as unknown, never success (fail-closed) — the caller only
// caches an outcome via remember() AFTER it is known.
import type { Instance } from "@zobr/core";

export class InvocationRegistry {
  readonly #instances = new Map<string, Instance>();
  readonly #idem = new Map<string, unknown>(); // idempotency_key -> remembered result

  register(inst: Instance): void {
    this.#instances.set(inst.invocation_id, inst);
  }

  get(invocation_id: string): Instance | undefined {
    return this.#instances.get(invocation_id);
  }

  /** Require a live instance or throw a typed not-found (caller maps to error). */
  require(invocation_id: string): Instance {
    const inst = this.#instances.get(invocation_id);
    if (inst === undefined) throw new UnknownInvocation(invocation_id);
    return inst;
  }

  has(invocation_id: string): boolean {
    return this.#instances.has(invocation_id);
  }

  remove(invocation_id: string): void {
    this.#instances.delete(invocation_id);
  }

  // --- idempotency ---
  remembered(key: string | undefined): { hit: boolean; value: unknown } {
    if (key === undefined) return { hit: false, value: undefined };
    if (this.#idem.has(key)) return { hit: true, value: this.#idem.get(key) };
    return { hit: false, value: undefined };
  }

  remember(key: string | undefined, value: unknown): void {
    if (key !== undefined) this.#idem.set(key, value);
  }

  get size(): number {
    return this.#instances.size;
  }

  values(): IterableIterator<Instance> {
    return this.#instances.values();
  }
}

export class UnknownInvocation extends Error {
  constructor(readonly invocation_id: string) {
    super(`unknown invocation_id: ${invocation_id}`);
    this.name = "UnknownInvocation";
  }
}
