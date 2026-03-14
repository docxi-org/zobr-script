export { parse } from './parser';
export { validate, Diagnostic } from './validator';
export * from './ast';

import { parse, PeggySyntaxError } from './parser';
import { validate, Diagnostic } from './validator';

export interface CheckResult {
  ok: boolean;
  ast?: any;
  diagnostics: Diagnostic[];
}

export function check(source: string): CheckResult {
  try {
    const ast = parse(source);
    const diagnostics = validate(ast);
    const hasErrors = diagnostics.some(d => d.severity === 'error');
    return { ok: !hasErrors, ast, diagnostics };
  } catch (err: any) {
    if (err.location) {
      const syntaxErr = err as PeggySyntaxError;
      return {
        ok: false,
        diagnostics: [{
          severity: 'error',
          message: `Syntax error: ${syntaxErr.message}`,
          location: syntaxErr.location,
        }],
      };
    }
    return {
      ok: false,
      diagnostics: [{
        severity: 'error',
        message: `Parse error: ${err.message}`,
      }],
    };
  }
}
