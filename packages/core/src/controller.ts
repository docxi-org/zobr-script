// Controller — the server module as supervisor (doc 04 §2-§4). Like the sandbox,
// core defines a PORT; the real handlers (frozen *.srv.ts code) run in the server
// layer. The controller sees ONLY what the agent reports; it influences ONLY via
// the Directive it returns. Dumb deterministic code; no view of model reasoning.
export type Directive =
  | "proceed"
  | "warn"
  | "halt"
  | { readonly ask: string; readonly choices?: readonly string[] };

export interface ControllerHost {
  /** Whether this script even has a server module. No module => no controller. */
  readonly present: boolean;
  /** onStart composer: may seed initial handles into the store (doc 03 §4). */
  onStart?(invocation_id: string): Promise<void> | void;
  /** onCheckpoint gate: returns a Directive the agent cooperatively honors. */
  onCheckpoint?(invocation_id: string, label: string, data: unknown): Promise<Directive> | Directive;
  /** onReport: passive telemetry; no response. */
  onReport?(invocation_id: string, label: string, data: unknown): Promise<void> | void;
}

/** A no-op controller for purely cognitive scripts (no server module). */
export const NO_CONTROLLER: ControllerHost = { present: false };

export function isAsk(d: Directive): d is { ask: string; choices?: readonly string[] } {
  return typeof d === "object" && d !== null && "ask" in d;
}
