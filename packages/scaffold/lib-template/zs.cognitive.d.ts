// Canonical cognitive surface — visible ONLY to cognitive parts (*.cog.ts).
// Single source of truth for ZS operation signatures (doc 02 / doc 09).
// No Node / DOM globals: types:[] in tsconfig keeps this closed.

type Sem = unknown;
type Source = "kb" | "web" | (string & {});
type Directive = "proceed" | "warn" | "halt" | { ask: string; choices?: string[] };
type Criteria = { what: string; basis: string; verify: string; boundaries: string };
type State = { status: "open" | "converging" | "stuck"; tension: string; missing: string };

// — Discovery —
declare function survey(topic: string, o?: { count?: number }): Sem[];
declare function ground(claim: Sem, o?: { extract?: string[] }): Sem;
declare function retrieve(query: string, o?: { from?: Source }): Sem;

// — Argument —
declare function assert(thesis: Sem, o?: { based_on?: Sem }): Sem;
declare function doubt(target: Sem, o?: { lens?: string }): Sem;
declare function contrast(target: Sem, o?: { with?: Sem }): Sem;
declare function analogy(target: Sem, o?: { from?: string }): Sem;

// — Synthesis —
declare function synthesize(sources: Sem, o?: { method?: string }): Sem;
declare function reframe(target: Sem, o?: { lens?: string }): Sem;

// — Meta —
declare function assess(o?: { scale?: number }): State;
declare function pivot(reason: string): void;
declare function scope(direction: "narrow" | "wide", o?: { focus?: string }): void;

// — Control (verified; realized by the server module) —
declare function commit(c: Criteria): Criteria;
declare function check(c: Criteria, results: Sem): void;
declare function report(label: string, data: Sem): void;
declare function checkpoint(label: string, data: Sem): Directive;

// — Composition —
declare function run<I, O>(ref: string, inputs: I): O;

// — Human-in-the-loop (authority) —
declare function ask_user(prompt: string): string;
declare function ask_user<T extends string>(prompt: string, choices: readonly T[]): T;

// — Action (asserted; host tools) —
declare function act(intent: string, o?: { reversible?: boolean }): Sem;

// — Output —
declare function conclude<T>(): T;
