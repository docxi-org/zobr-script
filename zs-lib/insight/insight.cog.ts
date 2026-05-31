/** Systematic architectural reflection: find hidden unifying abstractions
 *  in a codebase that has accumulated incremental workarounds. */
export type Result = {
  insight: string;
  replaces: string[];
  confidence: "low" | "medium" | "high";
  tradeoffs: string[];
};

export function reflect(context: string): Result {
  // 1. Survey: what mechanisms exist and what problem each solves
  const mechanisms = survey("distinct mechanisms, workarounds, and conventions in the system", {
    count: 10,
  });

  // 2. Find friction: which of these feel forced or fragile
  const friction = doubt(mechanisms, {
    lens: "which mechanisms exist only to compensate for a missing abstraction",
  });

  // 3. Look for a common root
  const c = commit({
    what: "Find a single concept that several mechanisms approximate",
    basis: "the friction points identified above",
    verify: "the concept must replace at least 3 mechanisms, not just rename them",
    boundaries: "do not propose adding complexity — only consolidation",
  });

  const pattern = synthesize([mechanisms, friction], {
    method: "what real-world concept (object, protocol, lifecycle) do these pieces imitate separately",
  });

  // 4. Challenge: does the concept actually simplify?
  const antithesis = contrast(pattern, {
    with: "keeping the current mechanisms as they are",
  });

  const stress = doubt(pattern, {
    lens: "what edge cases break the proposed abstraction",
  });

  // 5. Verdict
  check(c, { pattern, antithesis, stress });

  checkpoint("reflection_done", { pattern, replaces: mechanisms, stress });

  return conclude<Result>();
}
