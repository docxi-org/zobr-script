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
