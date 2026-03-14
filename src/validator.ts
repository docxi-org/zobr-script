import {
  Script, Statement, Expression, Location,
  BUILTIN_OPERATIONS, OPERATION_PARAMS, SYMBOL_PARAMS,
} from './ast';

export interface Diagnostic {
  severity: 'error' | 'warning';
  message: string;
  location?: Location;
}

interface Scope {
  variables: Set<string>;
  functions: Set<string>;
  inFor: boolean;
  inDefine: boolean;
}

export function validate(ast: Script): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const scope: Scope = {
    variables: new Set(),
    functions: new Set(),
    inFor: false,
    inDefine: false,
  };

  // Register inputs
  for (const input of ast.inputs) {
    scope.variables.add(input.name);
  }

  // First pass: collect top-level defines and assignments (hoisting)
  for (const stmt of ast.body) {
    if (stmt.type === 'DefineStatement') {
      scope.functions.add(stmt.name);
    }
  }

  // Check body
  validateStatements(ast.body, scope, diagnostics);

  // Check that a conclude block exists
  const hasConclude = ast.body.some(s =>
    s.type === 'Assignment' && s.value.type === 'ConcludeExpression'
  );
  if (!hasConclude) {
    diagnostics.push({
      severity: 'warning',
      message: 'Script has no conclude block — output format is undefined',
    });
  }

  return diagnostics;
}

function validateStatements(stmts: Statement[], scope: Scope, diag: Diagnostic[]) {
  for (const stmt of stmts) {
    validateStatement(stmt, scope, diag);
  }
}

function validateStatement(stmt: Statement, scope: Scope, diag: Diagnostic[]) {
  switch (stmt.type) {
    case 'Assignment': {
      validateExpression(stmt.value, scope, diag);
      // For-assignment: the result is a list
      scope.variables.add(stmt.name);
      break;
    }

    case 'ForStatement': {
      validateExpression(stmt.iterable, scope, diag);
      const innerScope = childScope(scope, { inFor: true });
      innerScope.variables.add(stmt.variable);
      validateStatements(stmt.body, innerScope, diag);
      // If top-level for (inside assignment), variable is already added there
      break;
    }

    case 'IfStatement': {
      validateExpression(stmt.condition, scope, diag);
      const thenScope = childScope(scope);
      validateStatements(stmt.consequent, thenScope, diag);
      // Variables defined in if branches are available after (optimistic)
      for (const v of thenScope.variables) scope.variables.add(v);
      if (stmt.alternate.length > 0) {
        const elseScope = childScope(scope);
        validateStatements(stmt.alternate, elseScope, diag);
        for (const v of elseScope.variables) scope.variables.add(v);
      }
      break;
    }

    case 'LoopTimesStatement': {
      if (stmt.count < 1) {
        diag.push({ severity: 'warning', message: `Loop count ${stmt.count} is less than 1`, location: stmt.location });
      }
      const loopScope = childScope(scope);
      validateStatements(stmt.body, loopScope, diag);
      for (const v of loopScope.variables) scope.variables.add(v);
      break;
    }

    case 'LoopUntilStatement': {
      validateExpression(stmt.condition, scope, diag);
      const loopScope = childScope(scope);
      validateStatements(stmt.body, loopScope, diag);
      for (const v of loopScope.variables) scope.variables.add(v);
      break;
    }

    case 'YieldStatement': {
      if (!scope.inFor) {
        diag.push({ severity: 'error', message: '`yield` can only be used inside a `for` block', location: stmt.location });
      }
      validateExpression(stmt.value, scope, diag);
      break;
    }

    case 'ImportStatement': {
      // No validation — path is opaque
      break;
    }

    case 'DefineStatement': {
      const fnScope = childScope(scope, { inDefine: true });
      for (const p of stmt.params) {
        fnScope.variables.add(p.name);
      }
      if (stmt.inputField && typeof stmt.inputField === 'string') {
        fnScope.variables.add(stmt.inputField);
      }
      validateStatements(stmt.body, fnScope, diag);
      scope.functions.add(stmt.name);
      break;
    }

    case 'ExpressionStatement': {
      validateExpression(stmt.expression, scope, diag);
      break;
    }
  }
}

function validateExpression(expr: Expression, scope: Scope, diag: Diagnostic[]) {
  switch (expr.type) {
    case 'Identifier': {
      if (!scope.variables.has(expr.name) && !isBuiltinValue(expr.name)) {
        diag.push({
          severity: 'error',
          message: `Variable '${expr.name}' is used but not defined`,
          location: expr.location,
        });
      }
      break;
    }

    case 'OperationCall': {
      // Validate operation params
      const opDef = OPERATION_PARAMS[expr.operation];
      if (opDef) {
        const positionalArgs = expr.args.filter(a => !a.name);
        const namedArgs = expr.args.filter(a => a.name);

        if (positionalArgs.length > opDef.positional) {
          diag.push({
            severity: 'warning',
            message: `Operation '${expr.operation}' expects at most ${opDef.positional} positional argument(s), got ${positionalArgs.length}`,
            location: expr.location,
          });
        }

        for (const arg of namedArgs) {
          if (arg.name && !opDef.named.includes(arg.name)) {
            diag.push({
              severity: 'warning',
              message: `Unknown parameter '${arg.name}' for operation '${expr.operation}'. Known: ${opDef.named.join(', ') || 'none'}`,
              location: expr.location,
            });
          }
        }
      }
      // Validate arg expressions (skip symbol-list params like extract:, scale:)
      for (const arg of expr.args) {
        if (arg.name && SYMBOL_PARAMS.has(arg.name)) continue;
        validateExpression(arg.value, scope, diag);
      }
      break;
    }

    case 'FunctionCall': {
      if (!scope.functions.has(expr.name)) {
        diag.push({
          severity: 'error',
          message: `Function '${expr.name}' is called but not defined`,
          location: expr.location,
        });
      }
      for (const arg of expr.args) {
        validateExpression(arg.value, scope, diag);
      }
      break;
    }

    case 'ConcludeExpression': {
      for (const field of expr.fields) {
        validateExpression(field.value, scope, diag);
      }
      break;
    }

    case 'DotAccess': {
      validateExpression(expr.object, scope, diag);
      break;
    }

    case 'BinaryExpression': {
      validateExpression(expr.left, scope, diag);
      validateExpression(expr.right, scope, diag);
      break;
    }

    case 'ArrayLiteral': {
      for (const el of expr.elements) {
        validateExpression(el, scope, diag);
      }
      break;
    }

    case 'ObjectLiteral': {
      for (const prop of expr.properties) {
        if (prop.value) {
          validateExpression(prop.value, scope, diag);
        } else {
          // Shorthand: { motive } -> check motive is defined
          if (!scope.variables.has(prop.key)) {
            diag.push({
              severity: 'error',
              message: `Variable '${prop.key}' is used in shorthand property but not defined`,
              location: expr.location,
            });
          }
        }
      }
      break;
    }

    case 'ForStatement': {
      validateExpression(expr.iterable, scope, diag);
      const innerScope = childScope(scope, { inFor: true });
      innerScope.variables.add(expr.variable);
      validateStatements(expr.body, innerScope, diag);
      break;
    }

    case 'EnumLiteral':
    case 'StringLiteral':
    case 'NumberLiteral':
    case 'BooleanLiteral':
    case 'AtReference':
    case 'BareWord':
      break;
  }
}

function childScope(parent: Scope, overrides?: Partial<Scope>): Scope {
  return {
    variables: new Set(parent.variables),
    functions: new Set(parent.functions),
    inFor: overrides?.inFor ?? parent.inFor,
    inDefine: overrides?.inDefine ?? parent.inDefine,
  };
}

function isBuiltinValue(name: string): boolean {
  // Words that can appear as bare identifiers in certain contexts:
  // - scope direction: narrow, wide
  // - conclude field types: string, list, bool, structured
  // - enum values used in comparisons: low, medium, high, stuck, open, converging
  return [
    'narrow', 'wide',
    'string', 'list', 'bool', 'structured',
    'low', 'medium', 'high',
    'stuck', 'open', 'converging',
  ].includes(name);
}
