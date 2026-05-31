import type { ScriptSourceReader, ScriptLibrary, RawScript } from "../src/index";

export class FakeReader implements ScriptSourceReader {
  constructor(private readonly scripts: Record<string, RawScript>) {}
  read(script_ref: string): Promise<RawScript> {
    const s = this.scripts[script_ref];
    if (s === undefined) return Promise.reject(new Error(`not found: ${script_ref}`));
    return Promise.resolve(s);
  }
}

export const VALID_COG = `
export type Result = { summary: string };
export function analyze(t: string): Result { survey(t, { count: 2 }); return conclude<Result>(); }
`;
export const INVALID_COG = `
export function analyze(t: string){ eval("nope"); return conclude<{a:number}>(); }
`;

export const TYPED_COG = `
export interface ProgressData {
  step: number;
  findings: Sem;
  status: "open" | "converging" | "stuck";
}
export function analyze(topic: string) {
  const findings = survey(topic, { count: 3 });
  const state = assess();
  checkpoint("progress", { step: 1, findings, status: state.status } as ProgressData);
  report("metrics", { total: 3, quality: state.status });
  return conclude<{ summary: string }>();
}
`;
