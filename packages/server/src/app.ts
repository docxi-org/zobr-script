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
import { cognitiveAmbient, serverAmbient, guideTopics } from "@zobr/scaffold";
import { validateScript, extractStoreSchema, extractCogShapes, extractClassInfo } from "@zobr/validator";
import type { ListRes, ReadRes, ValidateReq, ValidateRes, CreateReq, CreateRes, DeleteRes, RegisterRes, StartReq, ConcludeReq, ResumeReq } from "@zobr/protocol";
import { log as defaultLog } from "./logger";
import type { Logger } from "./logger";

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
  readonly logger?: Logger | undefined;
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
  readonly #log: Logger;

  constructor(reader: ScriptSourceReader, opts?: ZsAppOptions) {
    this.#log = (opts?.logger ?? defaultLog).child({ module: "app" });
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

  getDb(): Db | undefined { return this.#db; }

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

    if (tool.role === "architect" && agentId) {
      const entry = this.agents.get(agentId);
      if (entry && entry.role !== "architect") {
        return { ok: false, error: { kind: "role_insufficient", message: "This tool requires the architect role. Ask the user to upgrade your role on the Agents page." } };
      }
    }

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
      case "zs_guide": return this.guide(parsed["topic"] as string | undefined);
      case "zs_list": return this.list();
      case "zs_read": return this.read(parsed["script_ref"] as string);
      case "zs_validate": return this.validate(parsed as unknown as ValidateReq);
      case "zs_create": return this.createScript(parsed as unknown as CreateReq);
      case "zs_update": return this.createScript(parsed as unknown as CreateReq);
      case "zs_delete": return this.deleteScript(parsed["script_ref"] as string);
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

  register(name: string): { agent_id: string; role: string; active_invocations: string[]; hint: string } {
    const agent_id = this.agents.register(name);
    const entry = this.agents.get(agent_id)!;
    const active_invocations = [...entry.activeInvocations];
    const hint = entry.role === "architect"
      ? "Call zs_guide() for the full system reference. Your role is architect — you can create, update, and delete scripts in addition to running them."
      : "Call zs_guide() for the full system reference. Your role is executor — you can run scripts but cannot create or modify them. To get architect privileges, ask the user to switch your role on the Agents page in the admin panel.";
    return { agent_id, role: entry.role, active_invocations, hint };
  }

  guide(topic?: string): { type: "toc" | "article"; content: string } {
    if (topic === undefined) {
      const lines = guideTopics.map((t) => `- **${t.topic}** [${t.audience}] — ${t.title}`);
      return { type: "toc", content: "# ZS Guide — Table of Contents\n\n" + lines.join("\n") };
    }
    const entry = guideTopics.find((t) => t.topic === topic);
    if (!entry) {
      const available = guideTopics.map((t) => t.topic).join(", ");
      return { type: "article", content: `Unknown topic: "${topic}". Available: ${available}` };
    }
    if (topic === "ambients") {
      let storeSchema = "// No store.d.ts found in library";
      if (this.#library) {
        try {
          storeSchema = readFileSync(join(this.#library.libraryRoot, "store.d.ts"), "utf8");
        } catch {}
      }
      const content = [
        "# Ambient Declarations",
        "",
        "Full TypeScript signatures available to scripts. These are loaded dynamically from the running server.",
        "",
        "## Cognitive Ambient (`zs.cognitive.d.ts`)",
        "",
        "Available in `.cog.ts` files.",
        "",
        "```ts",
        cognitiveAmbient,
        "```",
        "",
        "## Server Ambient (`zs.server.d.ts`)",
        "",
        "Available in `.srv.ts` files.",
        "",
        "```ts",
        serverAmbient,
        "```",
        "",
        "## Store Schema (`store.d.ts`)",
        "",
        "```ts",
        storeSchema,
        "```",
      ].join("\n");
      return { type: "article", content };
    }
    return { type: "article", content: entry.content };
  }

  async list(): Promise<ListRes> {
    if (this.#library === undefined) return { entries: [] };
    const { readdir, readFile, access } = await import("node:fs/promises");
    const { join, relative } = await import("node:path");
    const root = this.#library.libraryRoot;
    const entries: ListRes["entries"] = [];

    const walk = async (dir: string) => {
      const items = await readdir(dir, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory()) {
          if (item.name.startsWith(".") || item.name === "node_modules") continue;
          await walk(join(dir, item.name));
        } else if (item.name.endsWith(".cog.ts")) {
          const filePath = join(dir, item.name);
          const baseName = item.name.slice(0, -".cog.ts".length);
          const scriptRef = relative(root, join(dir, baseName)).replace(/\\/g, "/");
          const srvPath = join(dir, baseName + ".srv.ts");
          let hasSrv = false;
          try { await access(srvPath); hasSrv = true; } catch {}
          let description = "";
          try {
            const src = await readFile(filePath, "utf8");
            const m = src.match(/^\/\*\*\s*([\s\S]*?)\s*\*\//);
            if (m) description = m[1]!.replace(/\n\s*\*\s*/g, " ").trim();
          } catch {}
          entries.push({ name: scriptRef, hasSrv, ...(description ? { description } : {}) });
        }
      }
    };

    await walk(root);
    return { entries };
  }

  async read(script_ref: string): Promise<ReadRes> {
    if (this.#library === undefined) throw new Error("no library configured");
    const raw = await this.#library.read(script_ref);
    const cog = raw.cog.map((f) => f.content).join("\n\n");
    const srvContent = raw.srv.map((f) => f.content).join("\n\n");
    return { script_ref, cog, ...(srvContent.length > 0 ? { srv: srvContent } : {}) };
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
    const { join, dirname } = await import("node:path");
    const cogPath = join(this.#library.libraryRoot, req.script_ref + ".cog.ts");
    await mkdir(dirname(cogPath), { recursive: true });
    const cogContent = req.cog[0]?.content ?? req.cog.map((f) => f.content).join("\n\n");
    await writeFile(cogPath, cogContent, "utf8");
    if (req.srv.length > 0) {
      const srvContent = req.srv[0]?.content ?? req.srv.map((f) => f.content).join("\n\n");
      await writeFile(join(this.#library.libraryRoot, req.script_ref + ".srv.ts"), srvContent, "utf8");
    }
    return { ok: true };
  }

  async deleteScript(script_ref: string): Promise<DeleteRes> {
    if (this.#library === undefined) throw new Error("no library configured");
    const { rm } = await import("node:fs/promises");
    const { join } = await import("node:path");
    await rm(join(this.#library.libraryRoot, script_ref + ".cog.ts"), { force: true });
    await rm(join(this.#library.libraryRoot, script_ref + ".srv.ts"), { force: true });
    return { ok: true };
  }

  // ── REST API methods ──

  get apiConfig() {
    return {
      invocationTtlMs: this.#invocationTtlMs,
      awaitingTtlMs: this.#awaitingTtlMs,
      maxActiveInvocations: this.#maxActive,
      budgets: this.service.defaultBudgets,
    };
  }

  apiListTraces(opts?: { scriptRef?: string; status?: string; limit?: number; offset?: number }) {
    if (!this.#db) return [];
    return this.#db.infra.listTraces(opts);
  }

  apiCountTraces(opts?: { scriptRef?: string; status?: string }): number {
    if (!this.#db) return 0;
    return this.#db.infra.countTraces(opts);
  }

  apiGetTrace(id: string) {
    if (!this.#db) return null;
    return this.#db.infra.getTrace(id);
  }

  apiScriptStats() {
    if (!this.#db) return [];
    return this.#db.infra.scriptStats();
  }

  async apiGetScriptDetail(ref: string) {
    try {
      const raw = await this.read(ref);
      const cogFiles = [{ name: `/zs/${ref}.cog.ts`, content: raw.cog }];
      const shapes = extractCogShapes(cogFiles, cognitiveAmbient);
      const srvContent = raw.srv;
      let serverFunctions: string[] = [];
      if (srvContent) {
        const srvFiles = [{ name: `/zs/${ref}.srv.ts`, content: srvContent }];
        const classInfo = extractClassInfo(srvFiles, serverAmbient);
        if (classInfo) {
          serverFunctions = classInfo.methods.map((m) => m.name);
        }
      }
      return {
        script_ref: ref,
        cog: raw.cog,
        ...(srvContent ? { srv: srvContent } : {}),
        serverFunctions,
        ...shapes,
      };
    } catch (err) {
      this.#log.warn({ ref, err: (err as Error).message }, "apiGetScriptDetail failed");
      return null;
    }
  }

  apiStoreCollectionDocs(name: string, filter: Record<string, unknown> | undefined, limit: number, offset: number) {
    const db = this.#requireDb();
    const docs = db.collection(name).find(filter);
    return { collection: name, docs: docs.slice(offset, offset + limit), total: docs.length, limit, offset };
  }

  apiStoreNotes(type?: string) {
    return this.#requireDb().notes.list(type);
  }

  apiListAgents() {
    if (!this.#db) return [];
    return this.agents.all().map((a) => ({
      ...a,
      active_invocations: this.agents.get(a.agent_id)?.activeInvocations.size ?? 0,
      total_runs: this.#db!.infra.countAgentInvocations(a.agent_id),
    }));
  }

  apiGetAgentDetail(id: string) {
    const agent = this.agents.get(id);
    if (!agent) return null;
    const history = this.#db?.infra.listInvocationsByAgent(id, 30) ?? [];
    return {
      agent_id: agent.agentId,
      name: agent.name,
      role: agent.role,
      registered_at: agent.registeredAt,
      active_invocations: [...agent.activeInvocations],
      total_runs: this.#db?.infra.countAgentInvocations(id) ?? 0,
      history,
    };
  }

  apiActiveInvocations() {
    const result: unknown[] = [];
    for (const inst of this.registry.values()) {
      if (isTerminal(inst.status)) continue;
      const agentId = this.agents.agentForInvocation(inst.invocation_id);
      const agent = agentId ? this.agents.get(agentId) : undefined;
      result.push({
        invocation_id: inst.invocation_id,
        script_ref: inst.script_ref,
        agent_id: agentId ?? null,
        agent_name: agent?.name ?? null,
        status: inst.status,
        started_at: inst.createdAt,
        last_activity_at: inst.lastActivityAt,
        events_count: inst.trace.events.length,
      });
    }
    return result;
  }
}

