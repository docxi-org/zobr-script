# Patterns

Annotated example scripts showing common ZS patterns. Read the scripts in the
library with `zs_read` for the full source.

## Pattern 1: Minimal (hello)

The simplest possible script — survey + doubt + conclude.

```ts
/** A minimal demo script. */
export type Result = { summary: string; confidence: "low" | "medium" | "high" };

export function analyze(topic: string): Result {
  const overview = survey(topic, { count: 3 });
  const critique = doubt(overview);
  return conclude<Result>({
    summary: synthesize([overview, critique], { method: "concise verdict" }) as string,
    confidence: assess().status === "converging" ? "high" : "medium",
  });
}
```

**What it shows:**
- JSDoc description → library listing
- Exported type → conclude schema
- Explicit field mapping: summary from synthesize, confidence from assess
- Linear flow: discover → challenge → conclude
- No server module needed

**Library ref:** `examples/hello`

## Pattern 2: Reflective with commit/check (insight)

Structured reasoning with explicit pre-commitment and verification.

```ts
/** Systematic architectural reflection. */
export type Result = {
  insight: string;
  replaces: string[];
  confidence: "low" | "medium" | "high";
  tradeoffs: string[];
};

export function reflect(context: string): Result {
  const mechanisms = survey("distinct mechanisms in the system", { count: 10 });
  const friction = doubt(mechanisms, {
    lens: "which mechanisms exist only to compensate for a missing abstraction",
  });

  const c = commit({
    what: "Find a single concept that several mechanisms approximate",
    basis: "the friction points identified above",
    verify: "the concept must replace at least 3 mechanisms",
    boundaries: "do not propose adding complexity — only consolidation",
  });

  const pattern = synthesize([mechanisms, friction], {
    method: "what real-world concept do these pieces imitate separately",
  });

  const antithesis = contrast(pattern, {
    with: "keeping the current mechanisms as they are",
  });

  const stress = doubt(pattern, {
    lens: "what edge cases break the proposed abstraction",
  });

  check(c, { pattern, antithesis, stress });

  const state = assess();
  const confidence = state.status === "converging" ? "high" as const
    : state.status === "stuck" ? "low" as const
    : "medium" as const;

  checkpoint("reflection_done", { pattern, replaces: mechanisms, stress });
  return conclude<Result>({
    insight: pattern as string,
    replaces: mechanisms as string[],
    confidence,
    tradeoffs: [antithesis, stress] as string[],
  });
}
```

**What it shows:**
- `commit` / `check` — structured pre-commitment and verification
- `contrast` — building the strongest counterargument
- `checkpoint` — synchronous gate for server-side persistence
- Multiple cognitive operations building on each other

**Library ref:** `examples/insight`

### Its Server Module

```ts
export default class InsightScript extends ZsScript {
  onCheckpoint(label: string, data: unknown): Directive {
    if (label === "reflection_done") {
      this.db.notes.put(`insight:${this.invocation.id}`, data, "architectural-insight");
    }
    return "proceed";
  }
}
```

**What it shows:**
- `onCheckpoint` — react to the agent's checkpoint
- `this.db.notes.put` — persist data across invocations
- Return `"proceed"` — allow execution to continue

## Pattern 3: Gated with Human-in-the-Loop

A script that requires human approval before taking action.

```ts
/** Plan and execute a task with human approval gate. */
export type Result = { plan: string; approved: boolean; outcome?: string };

export function plan_and_execute(task: string): Result {
  const research = survey(task, { count: 5 });
  const plan = synthesize(research, { method: "actionable step-by-step plan" });
  const risks = doubt(plan, { lens: "what could go wrong" });

  report("plan_ready", { plan, risks });

  const approval = ask_user(
    "Here is the proposed plan. Approve execution?",
    ["approve", "revise", "cancel"] as const,
  );

  if (approval === "cancel") return conclude<Result>({ plan: plan as string, approved: false });
  if (approval === "revise") {
    const revised = reframe(plan, { lens: "address the identified risks" });
    report("plan_revised", { revised });
  }

  checkpoint("pre_execution", { plan, approval });
  const outcome = act("execute the approved plan", { reversible: false });
  return conclude<Result>({
    plan: plan as string,
    approved: true,
    outcome: outcome as string,
  });
}
```

**What it shows:**
- `ask_user` with typed choices — human-in-the-loop (authority trust)
- `report` for logging intermediate state (asserted trust)
- `checkpoint` before irreversible action — server gate (verified trust)
- `act` with `reversible: false` — consequential action requiring confirmation

## Pattern 4: Multi-stage with run

A script that delegates sub-tasks to other scripts.

```ts
/** Comparative analysis using sub-scripts. */
export type Result = { comparison: string; winner: string; confidence: string };

export function compare(topic_a: string, topic_b: string): Result {
  const analysis_a = run<{ topic: string }, AnalysisResult>(
    "tools/deep-analysis", { topic: topic_a }
  );
  const analysis_b = run<{ topic: string }, AnalysisResult>(
    "tools/deep-analysis", { topic: topic_b }
  );
  const comparison = contrast(analysis_a, { with: analysis_b });
  return conclude<Result>({
    comparison: comparison as string,
    winner: synthesize([analysis_a, analysis_b, comparison], { method: "pick winner" }) as string,
    confidence: assess().status as string,
  });
}
```

**What it shows:**
- `run` — full sub-script invocation with isolation
- Each child has its own trace and budget
- Results compose naturally with cognitive operations

## See Also

- Topic `script-structure` — anatomy of a script
- Topic `composition` — when to use define-inline vs @sandbox vs run
- Topic `discipline` — commit/check protocol
- Topic `trust` — why report and checkpoint have different trust
