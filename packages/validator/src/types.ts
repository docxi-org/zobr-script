// Validation result types. Errors block publish/start; warnings inform (doc 09).
export type DiagSource = "tsc" | "fence";
export type Severity = "error" | "warning";

export interface Diagnostic {
  readonly source: DiagSource;
  readonly severity: Severity;
  readonly code: string;
  readonly message: string;
  readonly file?: string;
  readonly line?: number;
  readonly col?: number;
}

export interface VirtualFile {
  readonly name: string; // e.g. "/zs/news.cog.ts"
  readonly content: string;
}

export interface ScriptBundle {
  readonly cog: readonly VirtualFile[]; // *.cog.ts sources
  readonly srv: readonly VirtualFile[]; // *.srv.ts sources
}

export interface Ambients {
  readonly cognitive: string;
  readonly server: string;
}

export interface ValidationResult {
  readonly ok: boolean; // no errors (warnings are allowed)
  readonly errors: readonly Diagnostic[];
  readonly warnings: readonly Diagnostic[];
}
