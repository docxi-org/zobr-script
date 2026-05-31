// MCP tool registry (doc 10): the single place that declares each zs_* tool, its
// zod input schema, and how it dispatches into ZsService. The Nest MCP adapter
// (6b) iterates this to register tools with @modelcontextprotocol/sdk — so the
// wire layer carries no business logic, only transport.
import {
  zStartReq, zSandboxReq, zReportReq, zCheckpointReq, zConcludeReq, zStatusReq,
  zAskRecordReq, zActRecordReq, zOperationsReq, zListReq, zReadReq,
  zValidateReq, zCreateReq, zUpdateReq, zDeleteReq, zAuthoringGuideReq,
  zRetrieveReq, zResumeReq, zRegisterReq,
  zStoreInsertReq, zStoreFindReq, zStoreUpdateReq, zStoreDeleteReq, zStoreCollectionsReq,
  zStorePutReq, zStoreGetReq, zStoreListReq, zAbortReq,
} from "@zobr/protocol";
import type { ZsService } from "@zobr/protocol";
import type { z } from "zod";

export type ToolRole = "executor" | "architect";

export interface McpTool<S extends z.ZodTypeAny = z.ZodTypeAny> {
  readonly name: string;
  readonly description: string;
  readonly input: S;
  readonly role: ToolRole;
  readonly handle: (svc: ZsService, args: z.infer<S>) => Promise<unknown> | unknown;
}

// Build a tool with a precise input schema, then erase to McpTool (ZodTypeAny) so
// a heterogeneous list is well-typed. The erasure is sound: dispatchTool parses
// rawArgs with the tool's own schema before calling handle.
function tool<S extends z.ZodTypeAny>(t: McpTool<S>): McpTool {
  return t as unknown as McpTool;
}

export const MCP_TOOLS: readonly McpTool[] = [
  tool({ name: "zs_start", description: "Start a ZS script run; returns invocation_id + cognitive code.", input: zStartReq, role: "executor", handle: (s, a) => s.start(a) }),
  tool({ name: "zs_sandbox", description: "Run a @sandbox function server-side; result stored by handle.", input: zSandboxReq, role: "executor", handle: (s, a) => s.sandbox(a) }),
  tool({ name: "zs_report", description: "Fire-and-forget telemetry into the trace.", input: zReportReq, role: "executor", handle: (s, a) => s.report(a) }),
  tool({ name: "zs_checkpoint", description: "Synchronous gate; returns a controller Directive.", input: zCheckpointReq, role: "executor", handle: (s, a) => s.checkpoint(a) }),
  tool({ name: "zs_conclude", description: "Finalize the run; validates result, returns status + coverage.", input: zConcludeReq, role: "executor", handle: (s, a) => s.conclude(a) }),
  tool({ name: "zs_status", description: "Get instance status + cursor.", input: zStatusReq, role: "executor", handle: (s, a) => s.status(a) }),
  tool({ name: "zs_ask_record", description: "Record a human-in-the-loop answer into the trace (authority).", input: zAskRecordReq, role: "executor", handle: (s, a) => s.askRecord(a) }),
  tool({ name: "zs_act_record", description: "Record an action outcome into the trace (asserted, with provenance).", input: zActRecordReq, role: "executor", handle: (s, a) => s.actRecord(a) }),
  tool({ name: "zs_operations", description: "Get the reference of all built-in ZS operations (the cognitive ambient).", input: zOperationsReq, role: "executor", handle: () => "dispatched_by_app" }),
  tool({ name: "zs_list", description: "List available scripts in the library.", input: zListReq, role: "executor", handle: () => "dispatched_by_app" }),
  tool({ name: "zs_read", description: "Read a script's source from the library.", input: zReadReq, role: "executor", handle: () => "dispatched_by_app" }),
  tool({ name: "zs_validate", description: "Validate a script source (tsc + fence). Returns errors/warnings.", input: zValidateReq, role: "executor", handle: () => "dispatched_by_app" }),
  tool({ name: "zs_create", description: "Create a new script in the library (validate-then-save). Architect only.", input: zCreateReq, role: "architect", handle: () => "dispatched_by_app" }),
  tool({ name: "zs_update", description: "Update an existing script (validate-then-save). Architect only.", input: zUpdateReq, role: "architect", handle: () => "dispatched_by_app" }),
  tool({ name: "zs_delete", description: "Delete a script from the library. Architect only.", input: zDeleteReq, role: "architect", handle: () => "dispatched_by_app" }),
  tool({ name: "zs_authoring_guide", description: "Get the authoring instruction for script architects (doc 11b). Architect only.", input: zAuthoringGuideReq, role: "architect", handle: () => "dispatched_by_app" }),
  tool({ name: "zs_retrieve", description: "Retrieve data from an external source (KB/web). Stub: KB not yet available.", input: zRetrieveReq, role: "executor", handle: (s, a) => s.retrieve(a) }),
  tool({ name: "zs_resume", description: "Resume a suspended or awaiting_user instance.", input: zResumeReq, role: "executor", handle: (s, a) => s.resume(a) }),
  tool({ name: "zs_register", description: "Register as an agent. Returns agent_id required for all subsequent calls.", input: zRegisterReq, role: "executor", handle: () => "dispatched_by_app" }),
  tool({ name: "zs_store_insert", description: "Insert a document into a typed collection. Blocked during active invocation.", input: zStoreInsertReq, role: "executor", handle: () => "dispatched_by_app" }),
  tool({ name: "zs_store_find", description: "Find documents in a typed collection by equality filter.", input: zStoreFindReq, role: "executor", handle: () => "dispatched_by_app" }),
  tool({ name: "zs_store_update", description: "Update documents in a typed collection. Blocked during active invocation.", input: zStoreUpdateReq, role: "executor", handle: () => "dispatched_by_app" }),
  tool({ name: "zs_store_delete", description: "Delete documents from a typed collection. Blocked during active invocation.", input: zStoreDeleteReq, role: "executor", handle: () => "dispatched_by_app" }),
  tool({ name: "zs_store_collections", description: "List all typed collections with document counts.", input: zStoreCollectionsReq, role: "executor", handle: () => "dispatched_by_app" }),
  tool({ name: "zs_abort", description: "Abort an invocation (or all active for this agent). Saves partial trace, frees resources.", input: zAbortReq, role: "executor", handle: () => "dispatched_by_app" }),
  tool({ name: "zs_store_put", description: "Put a note (key-value). Blocked during active invocation.", input: zStorePutReq, role: "executor", handle: () => "dispatched_by_app" }),
  tool({ name: "zs_store_get", description: "Get a note by key.", input: zStoreGetReq, role: "executor", handle: () => "dispatched_by_app" }),
  tool({ name: "zs_store_list", description: "List notes, optionally filtered by type.", input: zStoreListReq, role: "executor", handle: () => "dispatched_by_app" }),
] as const;

/** Parse + dispatch one tool call by name (used by the Nest adapter and tests). */
export async function dispatchTool(svc: ZsService, name: string, rawArgs: unknown): Promise<unknown> {
  const t = MCP_TOOLS.find((x) => x.name === name);
  if (t === undefined) throw new Error(`unknown MCP tool: ${name}`);
  const parsed = t.input.parse(rawArgs); // zod throws on bad input
  return t.handle(svc, parsed);
}
