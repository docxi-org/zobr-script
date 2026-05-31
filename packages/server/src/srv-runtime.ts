// SrvRuntime — unified class-based worker runtime for srv modules (doc 12 §3).
// Replaces WorkerSandboxHost + SrvModuleController with a single worker that:
// - Loads the srv class via vm.createContext (CJS emit)
// - Instantiates one class instance per invocation
// - Provides this.db (own SQLite connection), this.config, this.invocation
// - Calls public methods (sandbox) and lifecycle handlers (onStart/onCheckpoint/onReport)
import { Worker } from "node:worker_threads";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import ts from "typescript";
import { log } from "./logger";

export const SANDBOX_GLOBALS: readonly string[] = [
  "Array", "Object", "Math", "JSON", "String", "Number", "Boolean",
  "Map", "Set", "WeakMap", "WeakSet", "Symbol", "Promise",
  "Date", "RegExp",
  "Error", "TypeError", "RangeError", "ReferenceError", "SyntaxError",
  "parseInt", "parseFloat", "isNaN", "isFinite",
  "encodeURIComponent", "decodeURIComponent", "encodeURI", "decodeURI",
];

export interface SrvRuntimeConfig {
  readonly moduleSource: string;
  readonly dbPath: string;
  readonly timeoutMs?: number;
}

export interface CallResult {
  readonly ok: boolean;
  readonly result?: unknown | undefined;
  readonly error?: { kind: string; message: string } | undefined;
}

export interface CreateResult {
  readonly ok: boolean;
  readonly initialData?: Record<string, unknown> | undefined;
  readonly serverFunctions?: string[] | undefined;
  readonly error?: { kind: string; message: string } | undefined;
}

// Worker script: transpiled from sandbox-worker.ts at module load time.
const workerSourcePath = join(dirname(fileURLToPath(import.meta.url)), "sandbox-worker.ts");
const SRV_WORKER_SCRIPT = ts.transpileModule(readFileSync(workerSourcePath, "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

const LIFECYCLE_METHODS = new Set(["onStart", "onCheckpoint", "onReport"]);

export class SrvRuntime {
  readonly #worker: Worker;
  readonly #log = log.child({ module: "srv-runtime" });
  readonly #pending = new Map<number, { resolve: (v: CallResult) => void; timer?: ReturnType<typeof setTimeout> | undefined }>();
  readonly #timeoutMs: number | undefined;
  #callCounter = 0;
  #createResolve: ((v: CreateResult) => void) | undefined;
  #shutdownResolve: (() => void) | undefined;
  #serverFunctions: readonly string[] = [];
  readonly #ready: Promise<void>;

  constructor(config: SrvRuntimeConfig) {
    this.#timeoutMs = config.timeoutMs;
    this.#worker = new Worker(SRV_WORKER_SCRIPT, {
      eval: true,
      workerData: {
        moduleSource: config.moduleSource,
        dbPath: config.dbPath,
        safeGlobals: [...SANDBOX_GLOBALS],
      },
    });

    let initResolve: (() => void) | undefined;
    let initReject: ((err: Error) => void) | undefined;
    this.#ready = new Promise<void>((resolve, reject) => { initResolve = resolve; initReject = reject; });

    this.#worker.on("message", (msg: { type: string; ok: boolean; callId?: number; result?: unknown; initialData?: Record<string, unknown>; serverFunctions?: string[]; error?: { kind: string; message: string } }) => {
      if (msg.type === "init") {
        this.#serverFunctions = msg.serverFunctions ?? [];
        initResolve?.();
        initResolve = undefined;
        initReject = undefined;
      } else if (msg.type === "created") {
        this.#createResolve?.({ ok: msg.ok, initialData: msg.initialData, serverFunctions: msg.serverFunctions, error: msg.error });
        this.#createResolve = undefined;
      } else if (msg.type === "result") {
        const p = this.#pending.get(msg.callId ?? 0);
        if (p) {
          this.#pending.delete(msg.callId ?? 0);
          if (p.timer) clearTimeout(p.timer);
          p.resolve({ ok: msg.ok, result: msg.result, error: msg.error });
        }
      } else if (msg.type === "destroyed") {
        // no-op
      } else if (msg.type === "shutdown_done") {
        this.#shutdownResolve?.();
        this.#shutdownResolve = undefined;
      } else if (msg.type === "error") {
        this.#log.error({ error: msg.error }, "srv worker init error");
      }
    });

    this.#worker.on("error", (err: Error) => {
      this.#log.error({ err }, "srv worker error");
      initReject?.(err);
      initReject = undefined;
    });

    this.#worker.on("exit", (code: number) => {
      if (code !== 0) {
        const err = new Error(`srv worker exited with code ${code}`);
        initReject?.(err);
        initReject = undefined;
      }
    });
  }

  async getServerFunctions(): Promise<readonly string[]> {
    await this.#ready;
    return this.#serverFunctions;
  }

  createInstance(invocationId: string, config: Record<string, unknown>, invocation: { id: string; scriptRef: string; depth: number; parentId?: string }): Promise<CreateResult> {
    return new Promise((resolve) => {
      this.#createResolve = resolve;
      this.#worker.postMessage({ type: "create", invocationId, config, invocation });
    });
  }

  call(invocationId: string, fn: string, args: unknown[]): Promise<CallResult> {
    return this.#send({ type: "call", invocationId, fn, args });
  }

  lifecycle(invocationId: string, method: string, args: unknown[]): Promise<CallResult> {
    return this.#send({ type: "lifecycle", invocationId, method, args });
  }

  async snapshotState(invocationId: string): Promise<Record<string, unknown> | null> {
    const r = await this.#send({ type: "snapshot_state", invocationId });
    return r.ok ? (r.result as Record<string, unknown>) : null;
  }

  async restoreState(invocationId: string, state: Record<string, unknown>): Promise<boolean> {
    const r = await this.#send({ type: "restore_state", invocationId, state });
    return r.ok;
  }

  destroy(invocationId: string): void {
    this.#worker.postMessage({ type: "destroy", invocationId });
  }

  async shutdown(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.#shutdownResolve = resolve;
      this.#worker.postMessage({ type: "shutdown" });
    });
    this.#worker.terminate();
  }

  terminate(): void {
    this.#worker.terminate();
  }

  #send(msg: Record<string, unknown>): Promise<CallResult> {
    return new Promise((resolve) => {
      const callId = ++this.#callCounter;
      let timer: ReturnType<typeof setTimeout> | undefined;
      if (this.#timeoutMs !== undefined) {
        timer = setTimeout(() => {
          const p = this.#pending.get(callId);
          if (p) {
            this.#pending.delete(callId);
            resolve({ ok: false, error: { kind: "sandbox_error", message: "timeout" } });
          }
        }, this.#timeoutMs);
      }
      this.#pending.set(callId, { resolve, timer });
      this.#worker.postMessage({ ...msg, callId });
    });
  }
}
