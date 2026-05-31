import type { ControllerHost, Directive } from "../src/index";

export class FakeController implements ControllerHost {
  readonly present = true;
  readonly reports: Array<{ label: string; data: unknown }> = [];
  readonly checkpoints: Array<{ label: string; data: unknown }> = [];
  #directive: Directive;
  #onStartSeed?: (id: string) => void;
  constructor(directive: Directive = "proceed", onStartSeed?: (id: string) => void) {
    this.#directive = directive;
    if (onStartSeed !== undefined) this.#onStartSeed = onStartSeed;
  }
  setDirective(d: Directive): void {
    this.#directive = d;
  }
  onStart(id: string): void {
    this.#onStartSeed?.(id);
  }
  onCheckpoint(_id: string, label: string, data: unknown): Directive {
    this.checkpoints.push({ label, data });
    return this.#directive;
  }
  onReport(_id: string, label: string, data: unknown): void {
    this.reports.push({ label, data });
  }
}
