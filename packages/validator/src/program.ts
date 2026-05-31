// Shared TypeScript program creation for virtual files. Used by both
// typecheck.ts (diagnostics) and extract.ts (type analysis).
import ts from "typescript";
import type { VirtualFile } from "./types";

export const TS_OPTIONS: ts.CompilerOptions = {
  strict: true,
  noEmit: true,
  target: ts.ScriptTarget.ES2022,
  lib: ["lib.es2022.d.ts"],
  types: [],
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  exactOptionalPropertyTypes: true,
  skipLibCheck: false,
};

export function createVirtualProgram(
  files: readonly VirtualFile[],
  opts: ts.CompilerOptions = TS_OPTIONS,
): ts.Program {
  const map = new Map(files.map((f) => [f.name, f.content]));
  const dirs = new Set<string>();
  for (const f of files) {
    let d = f.name.slice(0, f.name.lastIndexOf("/"));
    while (d.length > 0) {
      dirs.add(d);
      d = d.slice(0, d.lastIndexOf("/"));
    }
    dirs.add("/");
  }

  const host = ts.createCompilerHost(opts, true);
  const baseGetSourceFile = host.getSourceFile.bind(host);
  const baseFileExists = host.fileExists.bind(host);
  const baseReadFile = host.readFile.bind(host);
  const baseDirExists = host.directoryExists?.bind(host);
  const baseRealpath = host.realpath?.bind(host);

  host.directoryExists = (dir) => dirs.has(dir) || (baseDirExists !== undefined ? baseDirExists(dir) : false);
  host.realpath = (p) => (map.has(p) ? p : baseRealpath !== undefined ? baseRealpath(p) : p);
  host.getSourceFile = (fileName, languageVersionOrOptions, onError, shouldCreate) => {
    const v = map.get(fileName);
    if (v !== undefined) return ts.createSourceFile(fileName, v, languageVersionOrOptions, true);
    return baseGetSourceFile(fileName, languageVersionOrOptions, onError, shouldCreate);
  };
  host.fileExists = (fileName) => map.has(fileName) || baseFileExists(fileName);
  host.readFile = (fileName) => map.get(fileName) ?? baseReadFile(fileName);

  return ts.createProgram(files.map((f) => f.name), opts, host);
}
