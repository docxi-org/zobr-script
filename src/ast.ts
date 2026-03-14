export interface Location {
  start: { line: number; column: number; offset: number };
  end: { line: number; column: number; offset: number };
}

export interface Script {
  type: 'Script';
  task: string;
  inputs: InputDecl[];
  body: Statement[];
  location: Location;
}

export interface InputDecl {
  type: 'InputDecl';
  name: string;
  defaultValue?: Expression;
  location: Location;
}

// --- Statements ---

export type Statement =
  | Assignment
  | ForStatement
  | IfStatement
  | LoopTimesStatement
  | LoopUntilStatement
  | ImportStatement
  | DefineStatement
  | YieldStatement
  | ExpressionStatement;

export interface Assignment {
  type: 'Assignment';
  name: string;
  value: Expression;
  location: Location;
}

export interface ForStatement {
  type: 'ForStatement';
  variable: string;
  iterable: Expression;
  body: Statement[];
  location: Location;
}

export interface IfStatement {
  type: 'IfStatement';
  condition: Expression;
  consequent: Statement[];
  alternate: Statement[];
  location: Location;
}

export interface LoopTimesStatement {
  type: 'LoopTimesStatement';
  count: number;
  body: Statement[];
  location: Location;
}

export interface LoopUntilStatement {
  type: 'LoopUntilStatement';
  condition: Expression;
  body: Statement[];
  location: Location;
}

export interface ImportStatement {
  type: 'ImportStatement';
  path: string;
  location: Location;
}

export interface DefineStatement {
  type: 'DefineStatement';
  name: string;
  params: ParamDecl[];
  prompt: string;
  inputField?: string;
  outputField?: Expression;
  body: Statement[];
  location: Location;
}

export interface ParamDecl {
  name: string;
  defaultValue?: Expression;
}

export interface YieldStatement {
  type: 'YieldStatement';
  value: Expression;
  location: Location;
}

export interface ExpressionStatement {
  type: 'ExpressionStatement';
  expression: Expression;
  location: Location;
}

// --- Expressions ---

export type Expression =
  | OperationCall
  | FunctionCall
  | ConcludeExpression
  | ForStatement
  | Identifier
  | AtReference
  | StringLiteral
  | NumberLiteral
  | BooleanLiteral
  | ArrayLiteral
  | ObjectLiteral
  | DotAccess
  | EnumLiteral
  | BinaryExpression
  | BareWord;

export interface OperationCall {
  type: 'OperationCall';
  operation: string;
  args: Argument[];
  location: Location;
}

export interface FunctionCall {
  type: 'FunctionCall';
  name: string;
  args: Argument[];
  location: Location;
}

export interface Argument {
  type: 'Argument';
  name?: string; // named param: "extract:", "count:", etc.
  value: Expression;
}

export interface ConcludeExpression {
  type: 'ConcludeExpression';
  fields: ConcludeField[];
  location: Location;
}

export interface ConcludeField {
  name: string;
  value: Expression;
  location: Location;
}

export interface Identifier {
  type: 'Identifier';
  name: string;
  location: Location;
}

export interface AtReference {
  type: 'AtReference';
  ref: string; // 'last' or number
  location: Location;
}

export interface StringLiteral {
  type: 'StringLiteral';
  value: string;
  location: Location;
}

export interface NumberLiteral {
  type: 'NumberLiteral';
  value: number;
  location: Location;
}

export interface BooleanLiteral {
  type: 'BooleanLiteral';
  value: boolean;
  location: Location;
}

export interface ArrayLiteral {
  type: 'ArrayLiteral';
  elements: Expression[];
  location: Location;
}

export interface ObjectLiteral {
  type: 'ObjectLiteral';
  properties: ObjectProperty[];
  location: Location;
}

export interface ObjectProperty {
  key: string;
  value?: Expression; // if omitted, shorthand: { motive } => { motive: motive }
}

export interface DotAccess {
  type: 'DotAccess';
  object: Expression;
  property: string;
  location: Location;
}

export interface EnumLiteral {
  type: 'EnumLiteral';
  values: string[];
  location: Location;
}

export interface BinaryExpression {
  type: 'BinaryExpression';
  operator: '==';
  left: Expression;
  right: Expression;
  location: Location;
}

export interface BareWord {
  type: 'BareWord';
  name: string;
  location: Location;
}

export const BUILTIN_OPERATIONS = [
  'survey', 'ground', 'assert', 'doubt', 'contrast', 'analogy',
  'synthesize', 'reframe', 'assess', 'pivot', 'scope', 'conclude',
] as const;

export type BuiltinOperation = typeof BUILTIN_OPERATIONS[number];

export const SYMBOL_PARAMS = new Set(['extract', 'scale']);

export const OPERATION_PARAMS: Record<string, { positional: number; named: string[] }> = {
  survey:     { positional: 1, named: ['count', 'from'] },
  ground:     { positional: 1, named: ['extract'] },
  assert:     { positional: 1, named: ['based_on'] },
  doubt:      { positional: 1, named: [] },
  contrast:   { positional: 1, named: ['with'] },
  analogy:    { positional: 1, named: ['from'] },
  synthesize: { positional: 1, named: ['method'] },
  reframe:    { positional: 1, named: ['lens', 'considering', 'without'] },
  assess:     { positional: 0, named: ['scale'] },
  pivot:      { positional: 1, named: [] },
  scope:      { positional: 2, named: [] },
};

export const RESERVED_WORDS = new Set([
  'task', 'input', 'result', 'conclude', 'define', 'import',
  'for', 'in', 'if', 'else', 'loop', 'until', 'times', 'yield',
  ...BUILTIN_OPERATIONS,
  'string', 'list', 'bool', 'low', 'medium', 'high', 'structured',
  'true', 'false', 'null',
  'narrow', 'wide',
]);
