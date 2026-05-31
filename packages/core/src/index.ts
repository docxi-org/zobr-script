// @zobr/core — framework-free ZS domain. Public surface.
// Slice 2: deterministic state model (handles, store, trace, status, budgets, instance).
export const CORE_VERSION = "0.2.0";

export type { Handle, Preview, PreviewKind } from "./handle";
export { makePreview } from "./handle";

export { HandleStore } from "./store";
export type { StoreEntry } from "./store";

export type { Realizer, TrustClass } from "./trust";

export { Trace } from "./trace";
export type { TraceEvent, Coverage, NewEvent } from "./trace";

export type { Status } from "./status";
export { isActive, isTerminal, isIntentionalStop, isInfraTerminal, canTransition } from "./status";

export { BudgetTracker } from "./budget";
export type { Budgets, BudgetKind } from "./budget";

export { Instance } from "./instance";
export type { InstanceParams, InstanceSnapshot } from "./instance";

export { newInvocationId, nextHandleId } from "./ids";

// Slice 4: sandbox port + dispatcher + capability scoping.
export type { Capability } from "./capability";
export { CapabilitySet } from "./capability";
export type { SandboxHost, SandboxCall, SandboxOutcome, SandboxFnSpec } from "./sandbox";
export { SandboxDispatcher } from "./dispatch";
export type { DispatchResult, SandboxFailureKind, SandboxArg } from "./dispatch";

// Slice 5: controller port, control driver, schema-at-seam.
export type { Shape, ShapeError } from "./shape";
export { checkShape, conforms } from "./shape";
export type { ControllerHost, Directive } from "./controller";
export { NO_CONTROLLER, isAsk } from "./controller";
export { ControlDriver } from "./control";
export type { CheckpointResult, ReportResult, ControlFailure } from "./control";
