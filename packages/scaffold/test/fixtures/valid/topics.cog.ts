export type Input = { text: string };
export type Result = { topics: string[] };
export function topics(input: Input): Result {
  const angles = survey(input.text, { count: 3 });
  doubt(angles, { lens: "bias" });
  return conclude<Result>({ topics: angles as string[] });
}
