export type Input = { text: string };
export type Result = { topics: string[] };
export function topics(input: Input): Result { return conclude<Result>({ topics: [] }); }
