// ZsService — the transport-agnostic application service (6a). Takes a parsed
// MCP request, drives the core (Instance + SandboxDispatcher + ControlDriver),
// and returns a response contract. No Nest, no HTTP, no real isolation here.
import {
  Instance, SandboxDispatcher, CapabilitySet, ControlDriver, checkShape,
} from "@zobr/core";
import type { Shape, SandboxArg } from "@zobr/core";
import { InvocationRegistry, UnknownInvocation } from "./registry";
import type { ScriptLoader, LoadedScript, ScriptRuntime } from "./ports";
import type {
  StartReq, StartRes, SandboxReq, SandboxRes, ReportReq, ReportRes,
  CheckpointReq, CheckpointRes, ConcludeReq, ConcludeRes, StatusReq, StatusRes,
  AskRecordReq, AskRecordRes, ActRecordReq, ActRecordRes,
  RetrieveReq, RetrieveRes, ResumeReq, ResumeRes,
} from "./messages";

function tryParseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return value; }
}

export interface ZsServiceOptions {
  readonly defaultBudgets?: { steps: number; iterations: number; tokens?: number };
  readonly startPreamble?: string;
  readonly maxRunDepth?: number;
}

interface RunCtx {
  readonly loaded: LoadedScript;
  readonly dispatcher: SandboxDispatcher;
  readonly control: ControlDriver;
}

export class ZsService {
  readonly #loader: ScriptLoader;
  readonly #registry: InvocationRegistry;
  readonly #ctx = new Map<string, RunCtx>(); // invocation_id -> per-run wiring
  readonly #budgets: { steps: number; iterations: number; tokens?: number };
  readonly #preamble: string | undefined;
  readonly #maxRunDepth: number;

  constructor(loader: ScriptLoader, registry: InvocationRegistry, opts: ZsServiceOptions = {}) {
    this.#loader = loader;
    this.#registry = registry;
    this.#budgets = opts.defaultBudgets ?? { steps: 1000, iterations: 100 };
    this.#preamble = opts.startPreamble;
    this.#maxRunDepth = opts.maxRunDepth ?? 10;
  }

  get defaultBudgets() { return this.#budgets; }

  async start(req: StartReq): Promise<StartRes> {
    const idem = this.#registry.remembered(req.idempotency_key);
    if (idem.hit) return idem.value as StartRes;

    const loaded = await this.#loader.load(req.script_ref); // validate-at-start (throws on bad)
    const depth = req.parent_invocation_id !== undefined
      ? (this.#registry.get(req.parent_invocation_id)?.depth ?? 0) + 1
      : 0;
    if (depth >= this.#maxRunDepth) {
      throw new Error(`Maximum run depth (${this.#maxRunDepth}) exceeded for script "${req.script_ref}"`);
    }
    const budgets = loaded.budgets
      ? { steps: loaded.budgets.steps ?? this.#budgets.steps, iterations: loaded.budgets.iterations ?? this.#budgets.iterations }
      : this.#budgets;
    const params = {
      script_ref: loaded.script_ref,
      code_snapshot: loaded.code,
      budgets,
      ...(req.parent_invocation_id !== undefined ? { parent_invocation_id: req.parent_invocation_id } : {}),
      ...(depth > 0 ? { depth } : {}),
    };
    const inst = new Instance(params);
    this.#registry.register(inst);
    this.#ctx.set(inst.invocation_id, {
      loaded,
      dispatcher: new SandboxDispatcher(loaded.sandboxHost, loaded.sandboxSpecs, new CapabilitySet(loaded.capabilities)),
      control: new ControlDriver(loaded.controller),
    });

    if (loaded.runtime !== undefined) {
      const cr = await loaded.runtime.createInstance(inst.invocation_id, {}, {
        id: inst.invocation_id, scriptRef: loaded.script_ref,
        depth: inst.depth, ...(inst.parent_invocation_id !== undefined ? { parentId: inst.parent_invocation_id } : {}),
      });
      if (cr.initialData !== undefined) {
        for (const [key, value] of Object.entries(cr.initialData)) {
          inst.store.put(value);
        }
      }
    } else if (loaded.controller.present) {
      if (loaded.controller.onStart !== undefined) {
        await loaded.controller.onStart(inst.invocation_id);
      }
    }

    const res: StartRes = {
      invocation_id: inst.invocation_id,
      code: loaded.code,
      ...(this.#preamble !== undefined ? { preamble: this.#preamble } : {}),
      ...(loaded.serverFunctions !== undefined && loaded.serverFunctions.length > 0 ? { serverFunctions: [...loaded.serverFunctions] } : {}),
    };
    this.#registry.remember(req.idempotency_key, res);
    return res;
  }

  async sandbox(req: SandboxReq): Promise<SandboxRes> {
    const idem = this.#registry.remembered(req.idempotency_key);
    if (idem.hit) return idem.value as SandboxRes;

    const inst = this.#registry.require(req.invocation_id);
    const ctx = this.#ctxOf(req.invocation_id);
    const outShape = ctx.loaded.sandboxOutShapes?.[req.fn];
    const r = await ctx.dispatcher.dispatch(inst, req.fn, req.args as unknown as SandboxArg[], outShape);

    const res: SandboxRes = r.ok
      ? { ok: true, handle: r.handle, preview: r.handle.preview.summary }
      : { ok: false, error: { kind: r.kind, message: r.message } };
    this.#registry.remember(req.idempotency_key, res);
    return res;
  }

  async report(req: ReportReq): Promise<ReportRes> {
    const inst = this.#registry.require(req.invocation_id);
    const ctx = this.#ctxOf(req.invocation_id);
    const shape = ctx.loaded.reportShapes?.[req.label];
    const data = tryParseJson(req.data);
    const r = await ctx.control.report(inst, req.label, data, shape);
    return r.ok ? { ok: true } : { ok: false, error: { kind: r.kind, message: r.message } };
  }

  async checkpoint(req: CheckpointReq): Promise<CheckpointRes> {
    const inst = this.#registry.require(req.invocation_id);
    const ctx = this.#ctxOf(req.invocation_id);
    const shape = ctx.loaded.checkpointShapes?.[req.label];
    const data = tryParseJson(req.data);
    const r = await ctx.control.checkpoint(inst, req.label, data, shape);
    return r.ok ? { ok: true, directive: r.directive } : { ok: false, error: { kind: r.kind, message: r.message } };
  }

  async conclude(req: ConcludeReq): Promise<ConcludeRes> {
    const inst = this.#registry.require(req.invocation_id);
    const result = typeof req.result === "string" ? tryParseJson(req.result) : req.result;
    const shape: Shape | undefined = this.#ctxOf(req.invocation_id).loaded.concludeShape;
    if (shape !== undefined) {
      const errs = checkShape(result, shape);
      if (errs.length > 0) {
        const e = errs[0];
        return { ok: false, status: inst.status, error: { kind: "schema_mismatch", message: `result: ${e?.expected} expected at ${e?.path}, got ${e?.got}` } };
      }
    }
    inst.trace.append({
      op: "conclude",
      realizer: "server",
      trust: "verified",
      inputs: [],
      preview: shape ? "result validated against concludeShape" : "result accepted",
      meta: { has_shape: shape !== undefined },
    });
    inst.transition("done", "conclude");
    return { ok: true, status: inst.status, coverage: inst.trace.coverage(), trace_ref: inst.invocation_id };
  }

  askRecord(req: AskRecordReq): AskRecordRes {
    const inst = this.#registry.require(req.invocation_id);
    inst.trace.append({
      op: "ask_user",
      realizer: "user",
      trust: "authority",
      inputs: [],
      preview: typeof req.answer === "string" ? req.answer.slice(0, 60) : JSON.stringify(req.answer).slice(0, 60),
      meta: { question: req.question, ...(req.provenance !== undefined ? { provenance: req.provenance } : {}) },
    });
    return { ok: true };
  }

  actRecord(req: ActRecordReq): ActRecordRes {
    const inst = this.#registry.require(req.invocation_id);
    const handle = inst.store.put(req.result);
    inst.trace.append({
      op: "act",
      realizer: "host",
      trust: "asserted",
      inputs: [],
      output: handle.id,
      preview: handle.preview.summary,
      meta: { intent: req.intent, ...(req.provenance !== undefined ? { provenance: req.provenance } : {}) },
    });
    return { ok: true };
  }

  retrieve(req: RetrieveReq): RetrieveRes {
    const inst = this.#registry.require(req.invocation_id);
    const trust = req.provenance ? "verified" : "asserted";
    inst.trace.append({
      op: "retrieve",
      realizer: "external",
      trust,
      inputs: [],
      preview: typeof req.data === "string" ? req.data.slice(0, 200) : JSON.stringify(req.data).slice(0, 200),
      meta: { query: req.query, ...(req.source ? { source: req.source } : {}), provenance: req.provenance },
    });
    return { ok: true };
  }

  resume(req: ResumeReq): ResumeRes {
    const inst = this.#registry.require(req.invocation_id);
    if (inst.status !== "suspended" && inst.status !== "awaiting_user") {
      throw new Error(`cannot resume: instance is ${inst.status}, expected suspended or awaiting_user`);
    }
    inst.transition("running", "resumed");
    return { code: inst.code_snapshot, cursor: inst.cursor, status: inst.status };
  }

  status(req: StatusReq): StatusRes {
    const inst = this.#registry.require(req.invocation_id);
    return { status: inst.status, cursor: inst.cursor };
  }

  registerRestoredInstance(inst: Instance, loaded: LoadedScript): void {
    this.#registry.register(inst);
    this.#ctx.set(inst.invocation_id, {
      loaded,
      dispatcher: new SandboxDispatcher(loaded.sandboxHost, loaded.sandboxSpecs, new CapabilitySet(loaded.capabilities)),
      control: new ControlDriver(loaded.controller),
    });
  }

  cleanup(invocation_id: string): void {
    this.#ctx.delete(invocation_id);
  }

  getRuntimeForInvocation(invocation_id: string): ScriptRuntime | undefined {
    return this.#ctx.get(invocation_id)?.loaded.runtime;
  }

  #ctxOf(invocation_id: string): RunCtx {
    const ctx = this.#ctx.get(invocation_id);
    if (ctx === undefined) throw new UnknownInvocation(invocation_id);
    return ctx;
  }
}
