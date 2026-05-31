// Per-instance budgets (doc 03 §3). Exhaustion is the backstop for runaway
// loops (A5) and run-tree depth (doc 06 G21) -> halted_budget terminal.
export interface Budgets {
  readonly steps: number;
  readonly iterations: number;
  readonly tokens?: number;
}

export type BudgetKind = "steps" | "iterations" | "tokens";

export class BudgetTracker {
  readonly #remaining: { steps: number; iterations: number; tokens: number };

  constructor(b: Budgets) {
    this.#remaining = {
      steps: b.steps,
      iterations: b.iterations,
      tokens: b.tokens ?? Number.POSITIVE_INFINITY,
    };
  }

  remaining(kind: BudgetKind): number {
    return this.#remaining[kind];
  }

  /** Consume n units; returns true if still within budget, false if exhausted/overdrawn. */
  consume(kind: BudgetKind, n = 1): boolean {
    this.#remaining[kind] -= n;
    return this.#remaining[kind] >= 0;
  }

  exhausted(): boolean {
    return this.#remaining.steps < 0 || this.#remaining.iterations < 0 || this.#remaining.tokens < 0;
  }

  snapshot(): { steps: number; iterations: number; tokens: number } {
    return { ...this.#remaining };
  }

  restore(r: { steps: number; iterations: number; tokens: number }): void {
    this.#remaining.steps = r.steps;
    this.#remaining.iterations = r.iterations;
    this.#remaining.tokens = r.tokens;
  }
}
