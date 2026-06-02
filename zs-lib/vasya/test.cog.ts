/** Vasya's test script. */
export type Result = { ok: number };
export function check(): Result {
  const a = 1 * 2 * 3 * 4 * 5;
  return conclude<Result>();
}