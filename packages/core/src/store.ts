// Per-instance handle-keyed store (doc 03 §3, §6). Data stays here; the agent
// shuffles references. Two instances have isolated stores.
import type { Handle } from "./handle";
import { makePreview } from "./handle";
import { nextHandleId } from "./ids";

export interface StoreEntry {
  readonly value: unknown;
  readonly meta?: Readonly<Record<string, unknown>>;
}

export class HandleStore {
  readonly #map = new Map<string, StoreEntry>();

  put(value: unknown, meta?: Record<string, unknown>): Handle {
    const id = nextHandleId();
    const entry: StoreEntry = meta !== undefined ? { value, meta } : { value };
    this.#map.set(id, entry);
    return { __handle: true, id, preview: makePreview(value) };
  }

  get(ref: Handle | string): unknown {
    const id = typeof ref === "string" ? ref : ref.id;
    const entry = this.#map.get(id);
    if (entry === undefined) throw new Error(`unknown handle: ${id}`);
    return entry.value;
  }

  has(ref: Handle | string): boolean {
    const id = typeof ref === "string" ? ref : ref.id;
    return this.#map.has(id);
  }

  get size(): number {
    return this.#map.size;
  }

  snapshot(): Record<string, StoreEntry> {
    const out: Record<string, StoreEntry> = {};
    for (const [k, v] of this.#map) out[k] = v;
    return out;
  }

  restore(entries: Record<string, StoreEntry>): void {
    this.#map.clear();
    for (const [k, v] of Object.entries(entries)) this.#map.set(k, v);
  }
}
