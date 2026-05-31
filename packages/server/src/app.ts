// Composition root: wires the loader + registry + ZsService + discovery/CRUD.
// The MCP adapter and the future REST controllers call into this.
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { InvocationRegistry, ZsService } from "@zobr/protocol";
import type { ZsServiceOptions, LoadedScript } from "@zobr/protocol";
import { FsScriptLoader } from "./loader";
import type { ScriptSourceReader, ScriptLibrary } from "./loader";
import { MCP_TOOLS } from "./mcp-tools";
import { AgentRegistry } from "./agent-registry";
import { createDb } from "./db";
import type { Db } from "./db";
import { checkShape, Instance, isTerminal } from "@zobr/core";
import type { Shape, InstanceSnapshot } from "@zobr/core";
import { cognitiveAmbient } from "@zobr/scaffold";
import { validateScript, extractStoreSchema } from "@zobr/validator";
import type { OperationsRes, ListRes, ReadRes, ValidateReq, ValidateRes, CreateReq, CreateRes, DeleteRes, RegisterRes, StartReq, ConcludeReq, ResumeReq } from "@zobr/protocol";

const STATE_CHANGING_TOOLS = new Set(["zs_sandbox", "zs_checkpoint", "zs_report", "zs_ask_record", "zs_act_record"]);

interface FullSnapshot extends InstanceSnapshot {
  readonly workerState?: Record<string, unknown>;
}

export interface ZsAppOptions extends ZsServiceOptions {
  readonly library?: ScriptLibrary | undefined;
  readonly dbPath?: string | undefined;
  readonly storeShapes?: Readonly<Record<string, Shape>> | undefined;
  readonly invocationTtlMs?: number | undefined;
  readonly awaitingTtlMs?: number | undefined;
  readonly maxActiveInvocations?: number | undefined;
}

const DEFAULT_INVOCATION_TTL = 60 * 60 * 1000; // 1 hour
const DEFAULT_AWAITING_TTL = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_MAX_ACTIVE = 100;

export class ZsApp {
  readonly registry: InvocationRegistry;
  readonly service: ZsService;
  readonly agents: AgentRegistry;
  readonly #library: ScriptLibrary | undefined;
  readonly #loader: FsScriptLoader;
  readonly #db: Db | undefined;
  readonly #storeShapes: Readonly<Record<string, Shape>>;
  readonly #invocationTtlMs: number;
  readonly #awaitingTtlMs: number;
  readonly #maxActive: number;

  constructor(reader: ScriptSourceReader, opts?: ZsAppOptions) {
    this.registry = new InvocationRegistry();
    const dbPath = opts?.dbPath;
    this.#loader = new FsScriptLoader(reader, dbPath);
    this.service = new ZsService(this.#loader, this.registry, opts ?? {});
    this.#library = opts?.library ?? ("libraryRoot" in reader ? reader as ScriptLibrary : undefined);
    this.#storeShapes = opts?.storeShapes ?? this.#loadStoreShapes();
    this.#invocationTtlMs = opts?.invocationTtlMs ?? DEFAULT_INVOCATION_TTL;
    this.#awaitingTtlMs = opts?.awaitingTtlMs ?? DEFAULT_AWAITING_TTL;
    this.#maxActive = opts?.maxActiveInvocations ?? DEFAULT_MAX_ACTIVE;
    if (dbPath !== undefined) {
      try { mkdirSync(dirname(dbPath), { recursive: true }); } catch {}
      this.#db = createDb(dbPath);
    }
    this.agents = new AgentRegistry(this.#db);
  }

  toolNames(): string[] {
    return MCP_TOOLS.map((t) => t.name);
  }

  async callTool(name: string, rawArgs: unknown): Promise<unknown> {
    const raw = rawArgs as Record<string, unknown>;
    const agentId = raw["agent_id"] as string | undefined;

    if (name !== "zs_register") {
      if (typeof agentId !== "string") {
        return { ok: false, error: { kind: "auth_error", message: "agent_id required; call zs_register first" } };
      }
      if (!this.agents.has(agentId)) {
        return { ok: false, error: { kind: "auth_error", message: "unknown agent_id; call zs_register first" } };
      }
    }

    const tool = MCP_TOOLS.find((t) => t.name === name);
    if (tool === undefined) throw new Error(`unknown MCP tool: ${name}`);
    const parsed = tool.input.parse(rawArgs) as Record<string, unknown>;

    const invId = raw["invocation_id"] as string | undefined;
    if (invId !== undefined) {
      const inst = this.registry.get(invId);
      if (inst !== undefined) {
        inst.lastActivityAt = Date.now();
      } else if (name !== "zs_resume") {
        const hasSnapshot = this.#db?.infra.loadSnapshot(invId) !== null;
        if (hasSnapshot) {
          return { ok: false, error: { kind: "evicted", message: `invocation ${invId} was evicted to cold storage; call zs_resume to restore` } };
        }
      }
    }

    switch (name) {
      case "zs_operations": return this.operations();
      case "zs_list": return this.list();
      case "zs_read": return this.read(parsed["script_ref"] as string);
      case "zs_validate": return this.validate(parsed as unknown as ValidateReq);
      case "zs_create": return this.createScript(parsed as unknown as CreateReq);
      case "zs_update": return this.createScript(parsed as unknown as CreateReq);
      case "zs_delete": return this.deleteScript(parsed["script_ref"] as string);
      case "zs_authoring_guide": return this.authoringGuide();
      case "zs_abort": return this.abort(agentId!, parsed["invocation_id"] as string | undefined);
      case "zs_register": {
        await this.sweepExpired();
        return this.register(parsed["name"] as string);
      }
      case "zs_store_insert": return this.storeInsert(agentId!, parsed["collection"] as string, parsed["doc"] as Record<string, unknown>);
      case "zs_store_find": return this.storeFind(parsed["collection"] as string, parsed["filter"] as Record<string, unknown> | undefined);
      case "zs_store_update": return this.storeUpdate(agentId!, parsed["collection"] as string, parsed["filter"] as Record<string, unknown>, parsed["patch"] as Record<string, unknown>);
      case "zs_store_delete": return this.storeDelete(agentId!, parsed["collection"] as string, parsed["filter"] as Record<string, unknown>);
      case "zs_store_collections": return this.storeCollections();
      case "zs_store_put": return this.storePut(agentId!, parsed["key"] as string, parsed["data"], parsed["type"] as string | undefined);
      case "zs_store_get": return this.storeGet(parsed["key"] as string);
      case "zs_store_list": return this.storeList(parsed["type"] as string | undefined);
      case "zs_start": {
        await this.sweepExpired();
        await this.evictOldestIfNeeded();
        const res = await this.service.start(parsed as StartReq);
        if ("invocation_id" in res) {
          this.agents.addActiveInvocation(agentId!, res.invocation_id);
          this.#db?.infra.recordInvocation({
            invocation_id: res.invocation_id,
            script_ref: (parsed as StartReq).script_ref,
            status: "running",
            ...(agentId !== undefined ? { agent_id: agentId } : {}),
          });
        }
        return res;
      }
      case "zs_conclude": {
        const invId = parsed["invocation_id"] as string;
        const inst = this.registry.get(invId);
        const res = await this.service.conclude(parsed as ConcludeReq);
        this.agents.removeActiveInvocation(agentId!, invId);
        this.#db?.infra.finishInvocation(invId, inst?.status ?? "done");
        this.#deleteSnapshot(invId);
        if (this.#db !== undefined && inst !== undefined) {
          this.#db.infra.saveTrace({
            invocation_id: invId,
            script_ref: inst.script_ref,
            code_snapshot: inst.code_snapshot,
            status: inst.status,
            events: inst.trace.events,
            coverage: inst.trace.coverage(),
            result: (res as { ok: boolean }).ok ? (parsed as Record<string, unknown>)["result"] : undefined,
          });
        }
        return res;
      }
      case "zs_resume": {
        const resumeInvId = parsed["invocation_id"] as string;
        if (!this.registry.has(resumeInvId)) {
          const restored = await this.#restoreFromCold(resumeInvId, agentId!);
          if (!restored) {
            return { ok: false, error: { kind: "not_found", message: `invocation ${resumeInvId} not found` } };
          }
        }
        return this.service.resume(parsed as ResumeReq);
      }
      default: {
        const res = await tool.handle(this.service, parsed);
        if (STATE_CHANGING_TOOLS.has(name)) {
          const stateInvId = parsed["invocation_id"] as string | undefined;
          if (stateInvId !== undefined) await this.#saveSnapshot(stateInvId);
        }
        return res;
      }
    }
  }

  async #saveSnapshot(invocationId: string): Promise<void> {
    if (this.#db === undefined) return;
    const inst = this.registry.get(invocationId);
    if (inst === undefined) return;
    const snap = inst.snapshot();
    const runtime = this.service.getRuntimeForInvocation(invocationId);
    const workerState = await runtime?.snapshotState?.(invocationId) ?? null;
    const fullSnap = workerState !== null ? { ...snap, workerState } : snap;
    this.#db.infra.saveSnapshot(invocationId, snap.script_ref, JSON.stringify(fullSnap));
  }

  async #restoreFromCold(invocationId: string, agentId: string): Promise<boolean> {
    const snap = this.#loadFullSnapshot(invocationId);
    if (snap === null) return false;

    const inst = Instance.restore(snap);
    const loaded = await this.#loader.load(snap.script_ref);
    await this.#restoreWorker(loaded, invocationId, snap);

    this.service.registerRestoredInstance(inst, loaded);
    this.agents.addActiveInvocation(agentId, invocationId);
    return true;
  }

  #loadFullSnapshot(invocationId: string): FullSnapshot | null {
    const row = this.#db?.infra.loadSnapshot(invocationId) ?? null;
    if (row === null) return null;
    return JSON.parse(row.state) as FullSnapshot;
  }

  async #restoreWorker(loaded: LoadedScript, invocationId: string, snap: FullSnapshot): Promise<void> {
    if (loaded.runtime === undefined) return;
    const invocation = {
      id: invocationId,
      scriptRef: snap.script_ref,
      depth: snap.depth,
      ...(snap.parent_invocation_id !== undefined ? { parentId: snap.parent_invocation_id } : {}),
    };
    await loaded.runtime.createInstance(invocationId, {}, invocation);
    if (snap.workerState !== undefined) {
      await loaded.runtime.restoreState?.(invocationId, snap.workerState);
    }
  }

  #deleteSnapshot(invocationId: string): void {
    this.#db?.infra.deleteSnapshot(invocationId);
  }

  async sweepExpired(): Promise<string[]> {
    const now = Date.now();
    const toEvict: string[] = [];
    for (const inst of this.registry.values()) {
      const idle = now - inst.lastActivityAt;
      const ttl = inst.status === "awaiting_user" ? this.#awaitingTtlMs : this.#invocationTtlMs;
      if (idle > ttl) toEvict.push(inst.invocation_id);
    }
    for (const id of toEvict) await this.evictInvocation(id);
    return toEvict;
  }

  async evictOldestIfNeeded(): Promise<string | null> {
    if (this.registry.size < this.#maxActive) return null;
    let oldest: { id: string; lastActivity: number } | undefined;
    for (const inst of this.registry.values()) {
      if (oldest === undefined || inst.lastActivityAt < oldest.lastActivity) {
        oldest = { id: inst.invocation_id, lastActivity: inst.lastActivityAt };
      }
    }
    if (oldest === undefined) return null;
    await this.evictInvocation(oldest.id);
    return oldest.id;
  }

  async evictInvocation(invocationId: string): Promise<boolean> {
    const inst = this.registry.get(invocationId);
    if (inst === undefined) return false;
    if (inst.status === "running" || inst.status === "awaiting_user") {
      inst.transition("suspended", "evicted");
    }
    await this.#saveSnapshot(invocationId);
    const runtime = this.service.getRuntimeForInvocation(invocationId);
    runtime?.destroy(invocationId);
    const agentId = this.agents.findAgentByInvocation(invocationId);
    if (agentId !== undefined) this.agents.removeActiveInvocation(agentId, invocationId);
    this.registry.remove(invocationId);
    this.service.cleanup(invocationId);
    return true;
  }

  #loadStoreShapes(): Readonly<Record<string, Shape>> {
    if (this.#library === undefined) return {};
    try {
      const content = readFileSync(join(this.#library.libraryRoot, "store.d.ts"), "utf8");
      return extractStoreSchema(content);
    } catch {
      return {};
    }
  }

  #requireDb(): Db {
    if (this.#db === undefined) throw new Error("no store configured (set dbPath)");
    return this.#db;
  }

  #validateStoreShape(collection: string, doc: Record<string, unknown>): { ok: false; error: { kind: string; message: string } } | null {
    const shape = this.#storeShapes[collection];
    if (shape === undefined) return null;
    const errs = checkShape(doc, shape);
    if (errs.length === 0) return null;
    const e = errs[0]!;
    return { ok: false, error: { kind: "schema_mismatch", message: `${e.expected} expected at ${e.path}, got ${e.got}` } };
  }

  #writeLockout(agentId: string): { ok: false; error: { kind: string; message: string } } | null {
    if (this.agents.hasActiveInvocation(agentId)) {
      return { ok: false, error: { kind: "lockout", message: "store writes blocked during active invocation; use checkpoint instead" } };
    }
    return null;
  }

  storeInsert(agentId: string, collection: string, doc: Record<string, unknown>): unknown {
    const lockout = this.#writeLockout(agentId);
    if (lockout !== null) return lockout;
    const shapeErr = this.#validateStoreShape(collection, doc);
    if (shapeErr !== null) return shapeErr;
    const _id = this.#requireDb().collection(collection).insertOne(doc);
    return { ok: true, _id };
  }

  storeFind(collection: string, filter?: Record<string, unknown>): unknown {
    const docs = this.#requireDb().collection(collection).find(filter);
    return { ok: true, docs };
  }

  storeUpdate(agentId: string, collection: string, filter: Record<string, unknown>, patch: Record<string, unknown>): unknown {
    const lockout = this.#writeLockout(agentId);
    if (lockout !== null) return lockout;
    const shape = this.#storeShapes[collection];
    if (shape !== undefined && shape.kind === "object") {
      for (const [key, value] of Object.entries(patch)) {
        const fieldShape = shape.fields[key];
        if (fieldShape === undefined) continue;
        const errs = checkShape(value, fieldShape);
        if (errs.length > 0) {
          const e = errs[0]!;
          return { ok: false, error: { kind: "schema_mismatch", message: `patch.${key}: ${e.expected} expected at ${e.path}, got ${e.got}` } };
        }
      }
    }
    const matched = this.#requireDb().collection(collection).updateMany(filter, patch);
    return { ok: true, matched };
  }

  storeDelete(agentId: string, collection: string, filter: Record<string, unknown>): unknown {
    const lockout = this.#writeLockout(agentId);
    if (lockout !== null) return lockout;
    const deleted = this.#requireDb().collection(collection).deleteMany(filter);
    return { ok: true, deleted };
  }

  storeCollections(): unknown {
    const list = this.#requireDb().collections();
    const names = list.map((c) => c.name);
    const counts: Record<string, number> = {};
    for (const c of list) counts[c.name] = c.count;
    return { ok: true, names, counts };
  }

  storePut(agentId: string, key: string, data: unknown, type?: string): unknown {
    const lockout = this.#writeLockout(agentId);
    if (lockout !== null) return lockout;
    this.#requireDb().notes.put(key, data, type);
    return { ok: true };
  }

  storeGet(key: string): unknown {
    const data = this.#requireDb().notes.get(key);
    return { ok: true, data };
  }

  storeList(type?: string): unknown {
    const entries = this.#requireDb().notes.list(type);
    return { ok: true, entries };
  }

  async abort(agentId: string, invocationId?: string): Promise<{ ok: boolean; aborted: string[] }> {
    const targets = invocationId !== undefined
      ? [invocationId]
      : [...this.agents.get(agentId)?.activeInvocations ?? []];

    const aborted: string[] = [];
    for (const id of targets) {
      const inst = this.registry.get(id);
      if (inst === undefined) continue;
      if (!isTerminal(inst.status)) {
        inst.transition("aborted", "zs_abort");
      }
      if (this.#db !== undefined) {
        this.#db.infra.saveTrace({
          invocation_id: id,
          script_ref: inst.script_ref,
          code_snapshot: inst.code_snapshot,
          status: inst.status,
          events: inst.trace.events,
          coverage: inst.trace.coverage(),
        });
        this.#db.infra.finishInvocation(id, inst.status);
      }
      this.#deleteSnapshot(id);
      const runtime = this.service.getRuntimeForInvocation(id);
      runtime?.destroy(id);
      this.agents.removeActiveInvocation(agentId, id);
      this.registry.remove(id);
      this.service.cleanup(id);
      aborted.push(id);
    }
    return { ok: true, aborted };
  }

  register(name: string): { agent_id: string; active_invocations: string[] } {
    const agent_id = this.agents.register(name);
    const active_invocations = [...this.agents.get(agent_id)?.activeInvocations ?? []];
    return { agent_id, active_invocations };
  }

  operations(): OperationsRes {
    return { reference: cognitiveAmbient };
  }

  async list(): Promise<ListRes> {
    if (this.#library === undefined) return { entries: [] };
    const { readdir } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const root = this.#library.libraryRoot;
    const dirs = await readdir(root, { withFileTypes: true });
    const entries: ListRes["entries"] = [];
    for (const d of dirs) {
      if (!d.isDirectory()) continue;
      const files = await readdir(join(root, d.name));
      if (!files.some((f) => f.endsWith(".cog.ts"))) continue;
      entries.push({ name: d.name, hasSrv: files.some((f) => f.endsWith(".srv.ts")) });
    }
    return { entries };
  }

  async read(script_ref: string): Promise<ReadRes> {
    if (this.#library === undefined) throw new Error("no library configured");
    const raw = await this.#library.read(script_ref);
    const cog = raw.cog.map((f) => f.content).join("\n\n");
    const srvContent = raw.srv.map((f) => f.content).join("\n\n");
    return { script_ref, cog, ...(srvContent.length > 0 ? { srv: srvContent } : {}) };
  }

  authoringGuide(): { instruction: string } {
    return { instruction: AUTHORING_GUIDE };
  }

  validate(req: ValidateReq): ValidateRes {
    const result = validateScript({ cog: req.cog, srv: req.srv });
    return {
      ok: result.ok,
      errors: result.errors.map((e) => ({ code: e.code, message: e.message, file: e.file, line: e.line })),
      warnings: result.warnings.map((e) => ({ code: e.code, message: e.message, file: e.file, line: e.line })),
    };
  }

  async createScript(req: CreateReq): Promise<CreateRes> {
    const v = this.validate({ cog: req.cog, srv: req.srv });
    if (!v.ok) return { ok: false, errors: v.errors.map((e) => `${e.code}: ${e.message}`) };
    if (this.#library === undefined) throw new Error("no library configured");
    const { mkdir, writeFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const dir = join(this.#library.libraryRoot, req.script_ref);
    await mkdir(dir, { recursive: true });
    for (const f of [...req.cog, ...req.srv]) {
      const name = f.name.startsWith("/zs/") ? f.name.slice(4) : f.name;
      await writeFile(join(dir, name), f.content, "utf8");
    }
    return { ok: true };
  }

  async deleteScript(script_ref: string): Promise<DeleteRes> {
    if (this.#library === undefined) throw new Error("no library configured");
    const { rm } = await import("node:fs/promises");
    const { join } = await import("node:path");
    await rm(join(this.#library.libraryRoot, script_ref), { recursive: true, force: true });
    return { ok: true };
  }
}

const AUTHORING_GUIDE = `You are a ZS script architect. Design scripts together with the user.

Role: co-design with user in the loop. Write to library only with human confirmation.

Workflow:
1. Understand the need: what cognitive work, inputs, desired result.
2. Fix the contract early: input + conclude<T>() schema.
3. Draft cognitive part; server module only if needed (verified-compute, gating, persistence).
4. Validate iteratively with zs_validate; fix before showing. Library holds only valid scripts.
5. Show the user, discuss trade-offs, revise.
6. Publish with confirmed human save (publication gate).

Privileged asymmetry: cognitive part — write freely. Server module is privileged (adjudicator, KB, sandbox). Keep minimal, justify each capability, mark for explicit human confirmation.

Design for the trace: commit/check and checkpoint on real milestones, not for show. Route important claims through verified seams (@sandbox, retrieve).

Composition ladder: define-inline (reuse) < @sandbox (deterministic compute) < run (full sub-script, isolation). Use the minimal sufficient tier.

Honesty: surface trade-offs and design assumptions to the user. Do not fabricate requirements or smuggle capabilities silently.`;

