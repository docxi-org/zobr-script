/** Vasya's test script. */
export type Result = { ok: boolean };
export function check(): Result {
  return conclude<Result>({ ok: true });
}