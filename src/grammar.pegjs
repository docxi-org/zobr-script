// ZS (Zobr Script) PEG Grammar v0.1
// Generates AST for validation

{{
  const BUILTIN_OPS = new Set([
    'survey', 'ground', 'assert', 'doubt', 'contrast', 'analogy',
    'synthesize', 'reframe', 'assess', 'pivot', 'scope'
  ]);
}}

Script
  = _ task:TaskDecl _ inputs:InputDecl? _ body:StatementList _ {
      return { type: 'Script', task, inputs: inputs || [], body, location: location() };
    }

TaskDecl
  = "task:" _ value:StringLiteral { return value.value; }

InputDecl
  = "input:" _ first:InputParam rest:(_ "," _ p:InputParam { return p; })* _ {
      return [first, ...rest];
    }

InputParam
  = name:Ident _ "=" _ val:Expression {
      return { type: 'InputDecl', name, defaultValue: val, location: location() };
    }
  / name:Ident {
      return { type: 'InputDecl', name, location: location() };
    }

// --- Statements ---

StatementList
  = stmts:(Statement _)* { return stmts.map(s => s[0]); }

Statement
  = DefineStatement
  / ImportStatement
  / ForAssignment
  / ConcludeAssignment
  / Assignment
  / ForStatement
  / IfStatement
  / LoopTimesStatement
  / LoopUntilStatement
  / YieldStatement
  / ExpressionStatement

Assignment
  = name:Ident _ "=" _ value:Expression {
      return { type: 'Assignment', name, value, location: location() };
    }

ForAssignment
  = name:Ident _ "=" _ stmt:ForBlock {
      return { type: 'Assignment', name, value: stmt, location: location() };
    }

ConcludeAssignment
  = name:Ident _ "=" _ expr:ConcludeExpression {
      return { type: 'Assignment', name, value: expr, location: location() };
    }

ForStatement
  = stmt:ForBlock { return stmt; }

ForBlock
  = "for" __ variable:Ident __ "in" __ iterable:Expression _ "{" _ body:StatementList _ "}" {
      return { type: 'ForStatement', variable, iterable, body, location: location() };
    }

IfStatement
  = "if" __ condition:Condition _ "{" _ consequent:StatementList _ "}"
    alt:(_ "else" _ "{" _ body:StatementList _ "}" { return body; })? {
      return { type: 'IfStatement', condition, consequent, alternate: alt || [], location: location() };
    }

LoopTimesStatement
  = "loop" __ count:Integer __ "times" _ "{" _ body:StatementList _ "}" {
      return { type: 'LoopTimesStatement', count, body, location: location() };
    }

LoopUntilStatement
  = "loop" __ "until" __ condition:Condition _ "{" _ body:StatementList _ "}" {
      return { type: 'LoopUntilStatement', condition, body, location: location() };
    }

ImportStatement
  = "import" __ path:ImportPath {
      return { type: 'ImportStatement', path, location: location() };
    }

ImportPath
  = chars:$([a-zA-Z0-9_/.:-]+) { return chars; }

DefineStatement
  = "define" __ name:Ident _ "(" _ params:ParamList? _ ")" _ "{" _ members:DefineMember* _ body:StatementList _ "}" {
      const prompt = members.find(m => m.key === 'prompt')?.value || '';
      const inputField = members.find(m => m.key === 'input')?.value;
      const outputField = members.find(m => m.key === 'output')?.value;
      return {
        type: 'DefineStatement', name, params: params || [],
        prompt, inputField, outputField, body,
        location: location()
      };
    }

DefineMember
  = key:("prompt" / "input" / "output") _ ":" _ value:DefineValue _ {
      return { key, value };
    }

DefineValue
  = StringLiteral
  / ObjectLiteral
  / Ident

ParamList
  = first:Param rest:(_ "," _ p:Param { return p; })* {
      return [first, ...rest];
    }

Param
  = name:Ident _ ":" _ def:Expression { return { name, defaultValue: def }; }
  / name:Ident { return { name }; }

YieldStatement
  = "yield" __ value:Expression {
      return { type: 'YieldStatement', value, location: location() };
    }

ExpressionStatement
  = !("}" / "else") expr:Expression {
      return { type: 'ExpressionStatement', expression: expr, location: location() };
    }

// --- Expressions ---

Expression
  = EnumExpression
  / CallExpression

EnumExpression
  = head:CallExpression _ "|" _ rest:CallExpression
    tail:(_ "|" _ v:CallExpression { return v; })* {
      function getName(e) {
        if (e.type === 'Identifier') return e.name;
        if (e.type === 'BareWord') return e.name;
        return String(e.value ?? e.name ?? '?');
      }
      return { type: 'EnumLiteral', values: [getName(head), getName(rest), ...tail.map(getName)], location: location() };
    }

CallExpression
  = DotExpression

DotExpression
  = head:PrimaryExpression tail:("." prop:Ident { return prop; })* {
      return tail.reduce((obj, prop) => ({
        type: 'DotAccess', object: obj, property: prop, location: location()
      }), head);
    }

PrimaryExpression
  = OperationCall
  / FunctionCallExpr
  / ConcludeExpression
  / ArrayLiteral
  / ObjectLiteral
  / StringLiteral
  / NumberLit
  / BooleanLiteral
  / AtReference
  / BareWordOrIdent

OperationCall
  = op:BuiltinOp _ "(" _ args:ArgumentList? _ ")" {
      return { type: 'OperationCall', operation: op, args: args || [], location: location() };
    }

FunctionCallExpr
  = name:Ident &{ return !BUILTIN_OPS.has(name); } _ "(" _ args:ArgumentList? _ ")" {
      return { type: 'FunctionCall', name, args: args || [], location: location() };
    }

BuiltinOp
  = name:$("survey" / "ground" / "assert" / "doubt" / "contrast" / "analogy"
         / "synthesize" / "reframe" / "assess" / "pivot" / "scope") {
      return name;
    }

ArgumentList
  = first:Argument rest:(_ "," _ a:Argument { return a; })* {
      return [first, ...rest];
    }

Argument
  = name:PropertyKey _ ":" _ value:Expression {
      return { type: 'Argument', name, value };
    }
  / value:Expression {
      return { type: 'Argument', value };
    }

ConcludeExpression
  = "conclude" _ "{" _ fields:ConcludeFieldList _ "}" {
      return { type: 'ConcludeExpression', fields, location: location() };
    }

ConcludeFieldList
  = fields:(ConcludeField _)* { return fields.map(f => f[0]); }

ConcludeField
  = name:PropertyKey _ ":" _ value:Expression {
      return { name, value, location: location() };
    }

// --- Conditions ---

Condition
  = left:DotExpression _ "==" _ right:PrimaryExpression {
      return { type: 'BinaryExpression', operator: '==', left, right, location: location() };
    }
  / DotExpression

// --- Literals ---

StringLiteral
  = '"' chars:$([^"]*) '"' {
      return { type: 'StringLiteral', value: chars, location: location() };
    }

NumberLit
  = value:Integer {
      return { type: 'NumberLiteral', value, location: location() };
    }

Integer
  = digits:$([0-9]+) { return parseInt(digits, 10); }

BooleanLiteral
  = "true" { return { type: 'BooleanLiteral', value: true, location: location() }; }
  / "false" { return { type: 'BooleanLiteral', value: false, location: location() }; }

AtReference
  = "@last" { return { type: 'AtReference', ref: 'last', location: location() }; }
  / "@" n:Integer { return { type: 'AtReference', ref: String(n), location: location() }; }

ArrayLiteral
  = "[" _ elements:ArrayElements? _ "]" {
      return { type: 'ArrayLiteral', elements: elements || [], location: location() };
    }

ArrayElements
  = first:Expression rest:(_ "," _ e:Expression { return e; })* {
      return [first, ...rest];
    }

ObjectLiteral
  = "{" _ props:ObjectProperties? _ "}" {
      return { type: 'ObjectLiteral', properties: props || [], location: location() };
    }

ObjectProperties
  = first:ObjectProperty rest:(_ "," _ p:ObjectProperty { return p; })* (_ ",")? {
      return [first, ...rest];
    }

ObjectProperty
  = key:PropertyKey _ ":" _ value:Expression { return { key, value }; }
  / key:Ident { return { key }; } // shorthand (only non-reserved, to avoid ambiguity)

BareWordOrIdent
  = name:Ident {
      return { type: 'Identifier', name, location: location() };
    }

// --- Identifiers ---

// PropertyKey allows reserved words in key positions (object keys, conclude fields, named args)
PropertyKey
  = name:$([a-zA-Z_][a-zA-Z0-9_]*) { return name; }

Ident
  = !Reserved name:$([a-zA-Z_][a-zA-Z0-9_]*) { return name; }
  / name:$("narrow" / "wide") { return name; } // allowed as args to scope()

Reserved
  = ("task" / "input" / "conclude" / "define" / "import"
    / "for" / "in" / "if" / "else" / "loop" / "until" / "times" / "yield"
    / "true" / "false" / "null") ![a-zA-Z0-9_]

// --- Whitespace & comments ---

_  = (Whitespace / Comment)*
__ = (Whitespace / Comment)+

Whitespace = [ \t\n\r]+

Comment
  = "//" [^\n]* ("\n" / !.)
  / "/*" (!"*/" .)* "*/"
