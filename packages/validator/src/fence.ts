// Structural fence (doc 09 §6): allowlist AST walk for what types cannot express.
// Rules:
//   ERROR   eval / Function constructor
//   ERROR   non-relative (bare/absolute) import — no npm/node in ZS scripts
//   ERROR   duplicate checkpoint/report label — must be unique per operation type
//   ERROR   re-export (export { } / export * from) — forbidden in ZS scripts
//   ERROR   export default non-class — srv must export default class
//   WARNING unbounded loop: while(true) / for(;;)
//   WARNING catch-then-retry heuristic: a callee in catch that also ran in try
import ts from "typescript";
import type { Diagnostic } from "./types";

export function fence(name: string, content: string): Diagnostic[] {
  const sf = ts.createSourceFile(name, content, ts.ScriptTarget.ES2022, true);
  const out: Diagnostic[] = [];

  const at = (node: ts.Node): { line: number; col: number } => {
    const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    return { line: line + 1, col: character + 1 };
  };
  const push = (node: ts.Node, code: string, message: string, severity: "error" | "warning"): void => {
    const p = at(node);
    out.push({ source: "fence", severity, code, message, file: name, line: p.line, col: p.col });
  };

  const calleeName = (node: ts.CallExpression | ts.NewExpression): string | undefined =>
    node.expression !== undefined && ts.isIdentifier(node.expression) ? node.expression.text : undefined;

  const collectCallees = (block: ts.Node): Set<string> => {
    const s = new Set<string>();
    const w = (n: ts.Node): void => {
      if (ts.isCallExpression(n)) {
        const c = calleeName(n);
        if (c !== undefined) s.add(c);
      }
      ts.forEachChild(n, w);
    };
    w(block);
    return s;
  };

  const seenLabels = new Map<string, { fn: string; node: ts.Node }>();

  const walk = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const fn = node.expression.text;
      if ((fn === "checkpoint" || fn === "report") && node.arguments.length >= 1) {
        const labelArg = node.arguments[0]!;
        if (ts.isStringLiteral(labelArg)) {
          const key = `${fn}:${labelArg.text}`;
          const prev = seenLabels.get(key);
          if (prev !== undefined) {
            const prevPos = at(prev.node);
            push(node, "fence/duplicate-label", `${fn} label "${labelArg.text}" already used at line ${prevPos.line}; labels must be unique per operation type`, "error");
          } else {
            seenLabels.set(key, { fn, node });
          }
        }
      }
    }
    if (ts.isExportDeclaration(node)) {
      push(node, "fence/no-reexport", "re-export (export { } / export * from) is forbidden in ZS scripts; use named exports", "error");
    }
    if (ts.isExportAssignment(node) && !node.isExportEquals) {
      if (!ts.isClassExpression(node.expression) && !(ts.isIdentifier(node.expression) || ts.isCallExpression(node.expression))) {
        push(node, "fence/no-default-fn", "export default must be a class (extends ZsScript) in srv.ts", "error");
      }
    }
    if (ts.isCallExpression(node) && calleeName(node) === "eval") {
      push(node, "fence/no-eval", "eval is forbidden", "error");
    }
    if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && calleeName(node) === "Function") {
      push(node, "fence/no-function-ctor", "the Function constructor is forbidden", "error");
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text;
      if (!spec.startsWith("./") && !spec.startsWith("../")) {
        push(node, "fence/no-external-import", `non-relative import "${spec}" is forbidden in a ZS script`, "error");
      }
    }
    if (ts.isWhileStatement(node) && node.expression.kind === ts.SyntaxKind.TrueKeyword) {
      push(node, "fence/unbounded-loop", "while(true) has no explicit bound; a runtime cap applies but add a bound", "warning");
    }
    if (ts.isForStatement(node) && node.condition === undefined) {
      push(node, "fence/unbounded-loop", "for(;;) has no condition; add an explicit bound", "warning");
    }
    if (ts.isTryStatement(node) && node.catchClause !== undefined) {
      const tried = collectCallees(node.tryBlock);
      const caught = collectCallees(node.catchClause.block);
      for (const c of caught) {
        if (tried.has(c)) {
          push(node.catchClause, "fence/catch-then-retry", `operation "${c}" is retried inside catch; recovery must not re-run the same op (forbidden on refusal)`, "warning");
        }
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return out;
}
