// MCP operation contracts (doc 10 §2-§3): request/response shapes for every zs_*
// lifecycle op, with zod schemas. zod is the one validation library across MCP
// tools, REST DTOs (Nest), and these contracts. Parsed requests feed ZsService.
import { z } from "zod";

// --- shared ---
export const zHandleRef = z.object({ __handle: z.literal(true), id: z.string(), preview: z.unknown() });
export const zSandboxArg = z.union([zHandleRef, z.object({ __literal: z.unknown() })]);
export const zDirective = z.union([
  z.literal("proceed"),
  z.literal("warn"),
  z.literal("halt"),
  z.object({ ask: z.string(), choices: z.array(z.string()).readonly().optional() }),
]);

// --- zs_start ---
export const zStartReq = z.object({
  script_ref: z.string(),
  inputs: z.unknown().optional(),
  parent_invocation_id: z.string().optional(),
  idempotency_key: z.string().optional(),
});
export const zStartRes = z.object({ invocation_id: z.string(), code: z.string(), preamble: z.string().optional(), serverFunctions: z.array(z.string()).optional() });

// --- zs_sandbox ---
export const zSandboxReq = z.object({
  invocation_id: z.string(),
  fn: z.string(),
  args: z.array(zSandboxArg).default([]),
  idempotency_key: z.string().optional(),
});
export const zSandboxRes = z.object({
  ok: z.boolean(),
  handle: zHandleRef.optional(),
  preview: z.string().optional(),
  error: z.object({ kind: z.string(), message: z.string() }).optional(),
});

// --- zs_retrieve (agent-side retrieval: agent fetches, server records) ---
export const zRetrieveReq = z.object({
  invocation_id: z.string(),
  query: z.string(),
  source: z.string().optional(),
  data: z.unknown(),
  provenance: z.string(),
});
export const zRetrieveRes = z.object({
  ok: z.boolean(),
  error: z.object({ kind: z.string(), message: z.string() }).optional(),
});

// --- zs_report ---
export const zReportReq = z.object({ invocation_id: z.string(), label: z.string(), data: z.unknown() });
export const zReportRes = z.object({ ok: z.boolean(), error: z.object({ kind: z.string(), message: z.string() }).optional() });

// --- zs_checkpoint ---
export const zCheckpointReq = z.object({ invocation_id: z.string(), label: z.string(), data: z.unknown() });
export const zCheckpointRes = z.object({
  ok: z.boolean(),
  directive: zDirective.optional(),
  error: z.object({ kind: z.string(), message: z.string() }).optional(),
});

// --- zs_conclude ---
export const zConcludeReq = z.object({ invocation_id: z.string(), result: z.unknown() });
export const zConcludeRes = z.object({
  ok: z.boolean(),
  status: z.string(),
  coverage: z.object({
    verified: z.number(),
    asserted: z.number(),
    authority_gates: z.number(),
    grounded_claims: z.number(),
    asserted_claims: z.number(),
  }).optional(),
  trace_ref: z.string().optional(),
  error: z.object({ kind: z.string(), message: z.string() }).optional(),
});

// --- zs_operations ---
export const zOperationsReq = z.object({});
export const zOperationsRes = z.object({ reference: z.string() });

// --- zs_guide ---
export const zGuideReq = z.object({ topic: z.string().optional() });
export const zGuideRes = z.object({
  type: z.enum(["toc", "article"]),
  content: z.string(),
});

// --- zs_list ---
export const zListReq = z.object({ path: z.string().optional() });
export const zListRes = z.object({ entries: z.array(z.object({ name: z.string(), hasSrv: z.boolean() })) });

// --- zs_read ---
export const zReadReq = z.object({ script_ref: z.string() });
export const zReadRes = z.object({ script_ref: z.string(), cog: z.string(), srv: z.string().optional() });

// --- zs_validate ---
export const zValidateReq = z.object({
  cog: z.array(z.object({ name: z.string(), content: z.string() })),
  srv: z.array(z.object({ name: z.string(), content: z.string() })).default([]),
});
export const zValidateRes = z.object({
  ok: z.boolean(),
  errors: z.array(z.object({ code: z.string(), message: z.string(), file: z.string().optional(), line: z.number().optional() })),
  warnings: z.array(z.object({ code: z.string(), message: z.string(), file: z.string().optional(), line: z.number().optional() })),
});

// --- zs_create / zs_update / zs_delete ---
export const zCreateReq = z.object({
  script_ref: z.string(),
  cog: z.array(z.object({ name: z.string(), content: z.string() })),
  srv: z.array(z.object({ name: z.string(), content: z.string() })).default([]),
});
export const zCreateRes = z.object({ ok: z.boolean(), errors: z.array(z.string()).optional() });
export const zUpdateReq = zCreateReq;
export const zUpdateRes = zCreateRes;
export const zDeleteReq = z.object({ script_ref: z.string() });
export const zDeleteRes = z.object({ ok: z.boolean() });

// --- zs_authoring_guide ---

// --- zs_abort ---
export const zAbortReq = z.object({ invocation_id: z.string().optional() });

// --- zs_register ---
export const zRegisterReq = z.object({ name: z.string() });
export const zRegisterRes = z.object({ agent_id: z.string() });

// --- standalone store tools (doc 12 §7) ---
export const zStoreInsertReq = z.object({ collection: z.string(), doc: z.record(z.string(), z.unknown()) });
export const zStoreFindReq = z.object({ collection: z.string(), filter: z.record(z.string(), z.unknown()).optional() });
export const zStoreUpdateReq = z.object({ collection: z.string(), filter: z.record(z.string(), z.unknown()), patch: z.record(z.string(), z.unknown()) });
export const zStoreDeleteReq = z.object({ collection: z.string(), filter: z.record(z.string(), z.unknown()) });
export const zStoreCollectionsReq = z.object({});
export const zStorePutReq = z.object({ key: z.string(), data: z.unknown(), type: z.string().optional() });
export const zStoreGetReq = z.object({ key: z.string() });
export const zStoreListReq = z.object({ type: z.string().optional() });

// --- zs_ask_record ---
export const zAskRecordReq = z.object({
  invocation_id: z.string(),
  question: z.string(),
  answer: z.unknown(),
  provenance: z.record(z.string(), z.unknown()).optional(),
});
export const zAskRecordRes = z.object({ ok: z.boolean() });

// --- zs_act_record ---
export const zActRecordReq = z.object({
  invocation_id: z.string(),
  intent: z.string(),
  result: z.unknown(),
  provenance: z.record(z.string(), z.unknown()).optional(),
});
export const zActRecordRes = z.object({ ok: z.boolean() });

// --- zs_status / zs_resume ---
export const zStatusReq = z.object({ invocation_id: z.string() });
export const zStatusRes = z.object({ status: z.string(), cursor: z.number() });
export const zResumeReq = z.object({ invocation_id: z.string() });
export const zResumeRes = z.object({ code: z.string(), cursor: z.number(), status: z.string() });

// --- inferred TS types ---
export type StartReq = z.infer<typeof zStartReq>;
export type StartRes = z.infer<typeof zStartRes>;
export type SandboxReq = z.infer<typeof zSandboxReq>;
export type SandboxRes = z.infer<typeof zSandboxRes>;
export type RetrieveReq = z.infer<typeof zRetrieveReq>;
export type RetrieveRes = z.infer<typeof zRetrieveRes>;
export type ReportReq = z.infer<typeof zReportReq>;
export type ReportRes = z.infer<typeof zReportRes>;
export type CheckpointReq = z.infer<typeof zCheckpointReq>;
export type CheckpointRes = z.infer<typeof zCheckpointRes>;
export type ConcludeReq = z.infer<typeof zConcludeReq>;
export type ConcludeRes = z.infer<typeof zConcludeRes>;
export type StatusReq = z.infer<typeof zStatusReq>;
export type StatusRes = z.infer<typeof zStatusRes>;
export type ResumeReq = z.infer<typeof zResumeReq>;
export type ResumeRes = z.infer<typeof zResumeRes>;
export type ValidateReq = z.infer<typeof zValidateReq>;
export type ValidateRes = z.infer<typeof zValidateRes>;
export type CreateReq = z.infer<typeof zCreateReq>;
export type CreateRes = z.infer<typeof zCreateRes>;
export type UpdateReq = z.infer<typeof zUpdateReq>;
export type UpdateRes = z.infer<typeof zUpdateRes>;
export type DeleteReq = z.infer<typeof zDeleteReq>;
export type DeleteRes = z.infer<typeof zDeleteRes>;
export type OperationsReq = z.infer<typeof zOperationsReq>;
export type OperationsRes = z.infer<typeof zOperationsRes>;
export type ListReq = z.infer<typeof zListReq>;
export type ListRes = z.infer<typeof zListRes>;
export type ReadReq = z.infer<typeof zReadReq>;
export type ReadRes = z.infer<typeof zReadRes>;
export type AskRecordReq = z.infer<typeof zAskRecordReq>;
export type AskRecordRes = z.infer<typeof zAskRecordRes>;
export type ActRecordReq = z.infer<typeof zActRecordReq>;
export type ActRecordRes = z.infer<typeof zActRecordRes>;
export type RegisterReq = z.infer<typeof zRegisterReq>;
export type RegisterRes = z.infer<typeof zRegisterRes>;
export type GuideReq = z.infer<typeof zGuideReq>;
export type GuideRes = z.infer<typeof zGuideRes>;
