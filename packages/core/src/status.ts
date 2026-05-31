// Status and lifecycle (doc 03 §10). Terminals are of two sorts: intentional
// stops (clean partial conclude) and infra terminals (error). Fail-closed.
export type Status =
  | "running" | "awaiting_user" | "suspended" // active
  | "done" | "halted" | "aborted" | "halted_budget" // intentional stops
  | "errored" | "expired"; // infra terminals

const ACTIVE: ReadonlySet<Status> = new Set<Status>(["running", "awaiting_user", "suspended"]);
const INTENTIONAL_STOP: ReadonlySet<Status> = new Set<Status>(["done", "halted", "aborted", "halted_budget"]);
const INFRA_TERMINAL: ReadonlySet<Status> = new Set<Status>(["errored", "expired"]);

export function isActive(s: Status): boolean { return ACTIVE.has(s); }
export function isTerminal(s: Status): boolean { return !ACTIVE.has(s); }
export function isIntentionalStop(s: Status): boolean { return INTENTIONAL_STOP.has(s); }
export function isInfraTerminal(s: Status): boolean { return INFRA_TERMINAL.has(s); }

const LEGAL: Readonly<Record<Status, readonly Status[]>> = {
  running: ["running", "awaiting_user", "suspended", "done", "halted", "aborted", "halted_budget", "errored", "expired"],
  awaiting_user: ["running", "suspended", "aborted", "expired", "errored"],
  suspended: ["running", "aborted", "expired", "errored"],
  done: [],
  halted: [],
  aborted: [],
  halted_budget: [],
  errored: [],
  expired: [],
};

export function canTransition(from: Status, to: Status): boolean {
  return LEGAL[from].includes(to);
}
