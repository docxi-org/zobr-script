# Discipline

Standing rules for both executors and architects. These apply to every ZS
interaction regardless of role.

## Honesty

The server sees only what you call and report. The trace is the product.
**Report truthfully.**

- Distinguish **grounded** (from `retrieve` with provenance — you fetched data
  from an external tool) from **asserted** (your reasoning, your memory).
  Do not present memory as a source — use `ground`, not `retrieve`.
- If a call is unconfirmed (e.g. transport error), treat it as **unknown**, not
  success.
- When in doubt — **stop** (fail-closed), do not fabricate.

## Commit / Check

The `commit` / `check` pair is a structured pre-commitment:

1. **commit** — before a significant step, state:
   - `what`: what you are about to do
   - `basis`: on what grounds (source, evidence, prior step)
   - `verify`: how you will check the result
   - `boundaries`: what you will NOT do in this step

2. **check** — after the step, raw comparison against the committed criteria.
   If you cannot tie a step to a real source — stop and raise the question.
   Do not fabricate justification.

```ts
const c = commit({
  what: "Find the root cause of the performance regression",
  basis: "profiling data from retrieve('perf-logs')",
  verify: "the cause must explain >80% of the latency increase",
  boundaries: "do not propose fixes — only diagnosis",
});

// ... cognitive work ...

check(c, { cause, evidence, coverage_pct });
```

## Safety

- On refusal, follow the catch scenario: **redirect / escalate / stop**.
  Never retry until agreement.
- Never circumvent your own guardrails. ZS is not a bypass tool.
- Irreversible actions (`act` with `reversible: false`) require a verified
  precondition or human confirmation **before** execution.

## Human-in-the-Loop

When `ask_user` is called, relay the script's intent clearly to the human.
Do not expose internal machinery (handles, invocation_id, seq numbers).

For high-stakes decisions, use the structured form with `choices` — it
constrains the response shape (verified) while the content remains authority.

## Data Handling

Operate by **handles and previews**. Precise data lives on the server in the
instance store. When checkpointing, send summaries and structure, not raw prose.

## Conclude

Produce the result by explicitly mapping each field of `T` to variables from
prior steps: `conclude<Result>({ insight: pattern as string, ... })`. The
server validates the shape at the seam. Uncaught failure → produce a partial
failure-conclude, not a silent drop.

## Reporting Convention

The agent is recommended to call `zs_report` after key cognitive operations.
This makes the trace complete and coverage meaningful.

### What to report

Report operations that are **substantive** — operations whose output matters
for the conclusion. Skip trivial or exploratory steps.

Recommended to report: `survey`, `synthesize`, `doubt` (when its output feeds
into a decision), `assert` (when backed by `retrieve`).

Usually skip: `scope`, `pivot`, `assess` (meta-operations), intermediate
`reframe`.

### Report format

```ts
report("survey", { topic: "market analysis", count: 5 });
report("doubt", { target: "initial hypothesis", lens: "edge cases" });
report("synthesize", { sources: 3, method: "comparative" });
```

The `label` should match the operation name. The `data` should include the
operation's key parameters (topic, lens, method) for traceability. These events
carry trust `asserted` in the trace.

## Executor-Specific

- **Do not** invent or modify scripts. Execute what the server gives you.
- **Do not** take actions the script did not direct.
- **Do not** assume capabilities you do not have.

## Architect-Specific

- Co-design with the user. Write to the library only with human confirmation.
- Draft the cognitive part freely. The server module is privileged — keep it
  minimal, justify each capability.
- Validate iteratively with `zs_validate` before showing to the user. The
  library holds only valid scripts.
- Surface trade-offs and design assumptions. Do not fabricate requirements.

## See Also

- Topic `operations` — semantics of commit/check and other operations
- Topic `trust` — why reporting matters for coverage
- Topic `patterns` — commit/check in practice
