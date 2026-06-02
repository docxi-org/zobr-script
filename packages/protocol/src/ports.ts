// Ports the protocol layer needs from the server layer.
import type { SandboxFnSpec, Shape, Capability, SandboxHost, ControllerHost } from "@zobr/core";

/** Abstract runtime for srv modules (class-based, doc 12 §3). */
export interface ScriptRuntime {
  createInstance(invocationId: string, config: Record<string, unknown>, invocation: { id: string; scriptRef: string; depth: number; parentId?: string }): Promise<{ ok: boolean; initialData?: Record<string, unknown> | undefined; serverFunctions?: string[] | undefined }>;
  call(invocationId: string, fn: string, args: unknown[]): Promise<{ ok: boolean; result?: unknown | undefined; error?: { kind: string; message: string } | undefined }>;
  lifecycle(invocationId: string, method: string, args: unknown[]): Promise<{ ok: boolean; result?: unknown | undefined; error?: { kind: string; message: string } | undefined }>;
  destroy(invocationId: string): void;
  terminate(): void;
  snapshotState?(invocationId: string): Promise<Record<string, unknown> | null>;
  restoreState?(invocationId: string, state: Record<string, unknown>): Promise<boolean>;
}

/** Everything the server resolves for a script_ref at start time. */
export interface LoadedScript {
  readonly script_ref: string;
  readonly code: string;
  readonly sandboxSpecs: readonly SandboxFnSpec[];
  readonly capabilities: readonly Capability[];
  readonly sandboxHost: SandboxHost;
  readonly controller: ControllerHost;
  /** Class-based runtime for srv module (doc 12). If present, ZsService
   *  calls createInstance on start. */
  readonly runtime?: ScriptRuntime | undefined;
  /** Public method names from srv class (doc 12 §5). */
  readonly serverFunctions?: readonly string[] | undefined;
  readonly sandboxOutShapes?: Readonly<Record<string, Shape>>;
  readonly concludeShape?: Shape;
  readonly checkpointShapes?: Readonly<Record<string, Shape>>;
  readonly reportShapes?: Readonly<Record<string, Shape>>;
  readonly budgets?: { steps?: number; iterations?: number } | undefined;
}

export interface ScriptLoader {
  load(script_ref: string): Promise<LoadedScript>;
}
