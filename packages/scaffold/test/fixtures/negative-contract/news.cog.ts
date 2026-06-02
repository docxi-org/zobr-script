import type { Input as TIn, Result as TOut } from "./topics.cog";
export type Result = { summary: string };
export function analyze(news_text: string): Result {
  // WRONG: child Input is { text }, we pass { txt } — must be a tsc error.
  const t = run<TIn, TOut>("topics", { txt: news_text });
  return conclude<Result>({ summary: t as string });
}
