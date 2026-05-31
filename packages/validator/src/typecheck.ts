// tsc-as-a-library (doc 09 §1-§2). Compiles a set of virtual files in memory
// against the canonical ambient, mirroring the lib-template compilerOptions
// exactly, and returns TS diagnostics. No temp files; lib.*.d.ts come from the
// installed typescript via the default host.
import ts from "typescript";
import type { Diagnostic, VirtualFile } from "./types";
import { createVirtualProgram } from "./program";

export function typecheck(files: readonly VirtualFile[]): Diagnostic[] {
  const program = createVirtualProgram(files);
  return ts.getPreEmitDiagnostics(program).map(toDiagnostic);
}

function toDiagnostic(d: ts.Diagnostic): Diagnostic {
  const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
  const code = `TS${d.code}`;
  const severity = d.category === ts.DiagnosticCategory.Warning ? "warning" : "error";
  if (d.file !== undefined && d.start !== undefined) {
    const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
    return { source: "tsc", severity, code, message, file: d.file.fileName, line: line + 1, col: character + 1 };
  }
  return { source: "tsc", severity, code, message };
}
