# Operations Reference

Every cognitive operation has fixed semantics — the name means the same thing in
every script. This topic describes what each operation does, its trust class, and
when to use it.

All operations return `Sem` (a semantic handle) unless noted otherwise. Trust
class is determined by the **origin of content**, not merely by who executes
the operation. Cognitive operations are asserted (agent-produced). Control
operations vary: `report` is asserted (server records agent's data), while
`checkpoint` and `sandbox` are verified (server evaluates and responds).

## Common Types

```ts
type Sem = unknown;           // semantic handle — opaque reference to a value
type Source = "kb" | "web" | (string & {});
type Directive = "proceed" | "warn" | "halt" | { ask: string; choices?: string[] };
type Criteria = { what: string; basis: string; verify: string; boundaries: string };
type State = { status: "open" | "converging" | "stuck"; tension: string; missing: string };
```

---

## Discovery

### `survey(topic, { count? }) → Sem[]`
**Trust:** asserted. Explore a topic and identify `count` distinct elements
(positions, factors, perspectives). Returns a list. Starting point for most
investigations.

### `ground(claim, { extract? }) → Sem`
**Trust:** asserted. Link a claim to concrete evidence from **already given text
or model memory**. `extract` structures output by named fields.

**Important:** `ground` does NOT fetch external data — it works from what the
agent already has. Model memory is hallucination-prone. For real external data,
use `retrieve`.

### `retrieve(query, { from? }) → Sem`
**Trust:** verified (with provenance) or asserted (without). Fetch data from an
external source using your own tools (MCP resources, APIs, databases).

**How it works:** you read `retrieve(query, { from: "source" })` in the script →
use your own host tools to get the data → call `zs_retrieve` with the data and
provenance (tool name, URL, method). The server records it in the trace.

**Provenance determines trust:** if you provide provenance (the tool or source
you used), the event is recorded as `verified`. If you omit provenance, it is
`asserted` — effectively no better than ground.

Key anti-hallucination mechanism: introduces an independent source of truth.
Back a factual `assert` with a `retrieve` handle, not `ground` from memory.

**`ground` vs `retrieve`:** ground = "what do I already know about this?"
(asserted, may hallucinate). retrieve = "fetch real data from an external system"
(verified when provenance is provided).

---

## Argument

### `assert(thesis, { based_on? }) → Sem`
**Trust:** asserted. State a position with justification. `based_on` points to
the source handle (e.g. from `retrieve` or `ground`).

### `doubt(target, { lens? }) → Sem`
**Trust:** asserted. Challenge the target — find weaknesses, hidden assumptions,
edge cases, failure conditions. `lens` sets a specific angle of critique.
Criticism must be substantive, not performative.

### `contrast(target, { with? }) → Sem`
**Trust:** asserted. Build or find the strongest opposing position or
counterexample. `with` sets the alternative perspective.

**`doubt` vs `contrast`:** doubt = "what's wrong with this?" (find weaknesses
within). contrast = "what's the opposite case?" (build the strongest alternative
from outside).

### `analogy(target, { from? }) → Sem`
**Trust:** asserted. Find a meaningful parallel in another domain (`from`).
Explicitly map the structure — what corresponds to what.

---

## Synthesis

### `synthesize(sources, { method? }) → Sem`
**Trust:** asserted. Merge multiple inputs into higher-level understanding — not
a summary, but a synthesis that reveals what no single part showed. `method` sets
the approach (e.g. "what real-world concept do these pieces imitate separately").

### `reframe(target, { lens? }) → Sem`
**Trust:** asserted. Reformulate the problem in fundamentally different terms.
Must change how you think about the problem, not just rephrase it.

---

## Meta

### `assess({ scale? }) → State`
**Trust:** asserted. Reflective pause: where am I in the reasoning, what is
decided, what is open, what tension remains, what is missing. `scale` sets
depth/detail.

**Warning:** `assess` is the model's self-evaluation — asserted and unreliable.
Do not use as the sole exit condition of a loop.

### `pivot(reason) → void`
**Trust:** asserted. Explicitly abandon the current approach and switch strategy.
No return value; the event is written to the trace.

### `scope(direction, { focus? }) → void`
**Trust:** asserted. Narrow (`"narrow"` — deeper into an aspect) or widen
(`"wide"` — broader context) the investigation focus.

---

## Control (verified — realized by the server)

These are infrastructure operations: they send data to the server and affect
flow, not cognitive content.

### `commit(criteria) → Criteria`
**Trust:** verified. Announce a pre-commitment for a step: what you are doing,
on what basis, how you will verify, and boundaries. Writes an event to the trace
and returns the criteria for subsequent `check`.

### `check(criteria, results) → void`
**Trust:** verified. Compare results against previously committed criteria.
Mechanizable criteria are checked by `@sandbox` (verified); semantic criteria by
cognitive self-check (asserted). Mismatch throws `criteria_unmet`.

### `report(label, data) → void`
**Trust:** asserted. Telemetry into the trace, fire-and-forget. The server
records what the agent sends but does not evaluate or respond. The content
originates from the agent, so the trust class is asserted.

### `checkpoint(label, data) → Directive`
**Trust:** verified. Synchronous gate: the agent sends state, the server module
compares against expected position and returns a `Directive` (`proceed` / `warn`
/ `halt` / `{ ask }`). The agent cooperatively honors the directive.

**`report` vs `checkpoint`:** report = "log this" (fire-and-forget, no response,
trust: asserted). checkpoint = "approve this" (synchronous, server evaluates and
responds with a directive, trust: verified).

---

## Composition

### `run<I, O>(ref, inputs) → O`
**Trust:** per child contract. Spawn a child invocation of script `ref` with
`inputs`; return its `conclude` result (type `O`). Heavy tier of composition —
full isolation (own trace, store, controller). Depth and budget are limited by
the runtime.

---

## Human-in-the-Loop (authority)

### `ask_user(prompt) → string`
**Trust:** authority. Stop and request free-text input from the human.

### `ask_user<T>(prompt, choices) → T`
**Trust:** authority. Request a choice from options. The schema constraint makes
the *form* of the response verified; the *content* remains authority.

---

## Action

### `act(intent, { reversible? }) → Sem`
**Trust:** asserted. Direct the agent to perform an external action using its
*own* connected tools. Expresses **intent** ("create a task in the tracker");
the host resolves to an available tool.

`reversible: false` (default for consequential actions) requires a verified
precondition or HITL confirmation before execution. No suitable tool → throws
`tool_error`.

---

## Output

### `conclude<T>(result: T) → T`
Terminal. The script explicitly maps each field of `T` to a variable from prior
steps. Sem handles are cast via `as` (e.g. `pattern as string`). The runtime
validates the actual result against the schema at the seam. Uncaught failure
produces a partial failure-conclude, not a silent drop.

```ts
return conclude<Result>({
  insight: pattern as string,
  replaces: mechanisms as string[],
  confidence: assess().status === "converging" ? "high" : "medium",
  tradeoffs: [antithesis, stress] as string[],
});
```
