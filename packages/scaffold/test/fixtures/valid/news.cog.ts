import type { Input as TIn, Result as TOut } from "./topics.cog";
export type Result = { summary: string; confidence: "low" | "medium" | "high" };
/** Analyze a news article for hidden interests. */
export function analyze(news_text: string): Result {
  const c = commit({ what: "find topics", basis: "task", verify: ">=1 topic", boundaries: "no motives yet" });
  const t = run<TIn, TOut>("topics", { text: news_text });   // contract matches: { text }
  check(c, { t });
  const ev = retrieve("supporting evidence", { from: "web" });
  assert("there is a hidden interest", { based_on: ev });
  synthesize(t.topics, { method: "thematic" });
  const d = checkpoint("topics_ready", t);
  if (d === "halt") pivot("server halted");
  return conclude<Result>({
    summary: synthesize([t, ev], { method: "verdict" }) as string,
    confidence: "medium",
  });
}
