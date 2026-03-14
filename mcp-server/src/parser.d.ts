import { Script } from './ast';

export interface PeggySyntaxError extends Error {
  location: {
    start: { line: number; column: number; offset: number };
    end: { line: number; column: number; offset: number };
  };
  expected: Array<{ type: string; description: string }>;
  found: string | null;
}

export function parse(input: string): Script;
