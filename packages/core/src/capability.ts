// Capability scoping (doc 04 §6). A script is granted a set of capabilities;
// the dispatcher refuses any sandbox call whose declared needs exceed the grant.
// Capabilities are coarse, named, allowlist (closed world): nothing implied.
export type Capability =
  | "store.read"
  | "store.write"
  | "kb.read"
  | "kb.write"
  | (`retrieve:${string}`); // a named external source bridge (future; doc 05)

export class CapabilitySet {
  readonly #granted: ReadonlySet<Capability>;
  constructor(granted: Iterable<Capability>) {
    this.#granted = new Set(granted);
  }
  has(cap: Capability): boolean {
    return this.#granted.has(cap);
  }
  /** Returns the capabilities in `needs` that are NOT granted (empty => allowed). */
  missing(needs: Iterable<Capability>): Capability[] {
    const out: Capability[] = [];
    for (const c of needs) if (!this.#granted.has(c)) out.push(c);
    return out;
  }
  get size(): number {
    return this.#granted.size;
  }
}
