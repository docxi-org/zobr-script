# Trust Model

## The Core Axis

Every trace event carries a **trust class** determined by the origin of its
content — not merely by who executed the operation. This is the central design
axis of ZS: making the epistemic status of every step visible and auditable.

## Trust Classes

### `asserted`

Produced by the agent (LLM reasoning, agent-reported data). May be false or
hallucinated. Mechanically trusting it is not justified.

Examples: cognitive operations (`survey`, `doubt`, `synthesize`), `report`
(server records agent's data), `act` (action result relayed by the agent).

### `verified`

Produced or checked by deterministic code or an independent source. Tamper-
resistant when server-sourced (stored by handle, agent cannot overwrite).

Examples: `@sandbox` functions, `checkpoint` (server evaluates and responds
with a Directive), `conclude` shape validation, `retrieve` with provenance
(agent fetched data from an external tool and reported the source).

### `authority`

A decision intentionally given to the human principal via `ask_user`. For its
step, this is ground truth by definition — not an assertion to be verified.

### `n/a`

Infrastructure events that do not contribute to the result: `start`, status
transitions. Excluded from coverage calculations.

## Verified Seams

A **seam** is a point where asserted data crosses into the verified layer. This
happens when cognitive (asserted) output is fed into:

- `@sandbox` functions
- `run` (child script inputs)
- `checkpoint` (sent to server for evaluation)
- `conclude` (final result)

**At every seam the server validates the value against its declared TypeScript
type at runtime.** Effect:

- Gross failures (empty, malformed cognitive output) are detected → throws
  `schema_mismatch`
- Coherent but *factually wrong* output passes — the seam checks **form, not
  truth**

This turns the weakest joint — cognitive→data — from a soft assertion into a
form-verified boundary exactly where data starts to matter.

## Report vs Checkpoint: Trust Difference

Both send data to the server, but their trust classes differ:

| Operation | Server does | Trust | Why |
|-----------|-------------|-------|-----|
| `report` | Records data, no response | **asserted** | Server merely stores what the agent claims |
| `checkpoint` | Evaluates data, returns Directive | **verified** | Server actively judges and responds |

This distinction matters for coverage: report events count toward asserted,
checkpoint events toward verified.

## Coverage Metric

From trust tags across all events, the server computes an aggregate:

```
Coverage = verified / (verified + asserted)
```

- `verified` — count of events with trust `verified`
- `asserted` — count of events with trust `asserted`
- `authority_gates` — count of `authority` events (counted separately)
- `n/a` events — excluded from the ratio

Example: *"40% verified, 60% asserted, 2 authority gates"*

This is a **signal, not a guarantee**. It shows how much of the result relied on
verifiable ground. A high verified ratio does not mean the conclusion is correct;
a high asserted ratio does not mean it is wrong.

## Cooperative Observability

In agent-driven mode, the server sees only what passes through MCP calls:
mandatory seams (`@sandbox`, `run`) and voluntary reports (`report`,
`checkpoint`). Therefore:

- The server **cannot force** the agent — it observes and advises
- "Control" here = **cooperative observability + soft gates**
- The ceiling of control = the fraction of significant work flowing through
  verified seams and checkpoint gates

Honest limit: a cooperative agent may skip `report` or distort its content.
Real enforcement comes only from (a) mandatory seams (sandbox — no other way
to compute; gate-checkpoint; `retrieve` with provenance) and (b) server-driven
execution (deferred).

## Agent Reporting Convention

The agent is **recommended** (not required) to call `zs_report` after key
cognitive operations to make the trace complete. These reports carry trust
`asserted` — the agent is reporting about its own work.

This is an honor system. The server cannot verify that the agent actually
performed the operations it claims. But the trace becomes fuller, coverage
becomes more meaningful, and audit becomes possible.

See topic `discipline` for the recommended reporting format.

## See Also

- Topic `operations` — trust class of each operation
- Topic `discipline` — commit/check, reporting convention
- Topic `ambients` — full `.d.ts` signatures
