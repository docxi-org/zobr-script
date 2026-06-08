/** Widget test: exercises all interactive MCP tools. */
export type Result = { answer: string; score: number };

export function run_test(topic: string): Result {
  const data = survey(topic, { count: 3 });
  report("survey_done", { topic, count: 3 });

  const c = commit({
    what: "Evaluate the topic",
    basis: "survey results",
    verify: "score > 0",
    boundaries: "no external data",
  });

  const critique = doubt(data, { lens: "weak points" });
  report("doubt_done", { lens: "weak points" });

  const score = computeScore(3, 1);
  check(c, { critique, score });

  checkpoint("final", { score });

  return conclude<Result>({
    answer: synthesize([data, critique], { method: "summary" }) as string,
    score,
  });
}
