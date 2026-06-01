export interface Coverage {
  verified: number;
  asserted: number;
  authority_gates: number;
  grounded_claims: number;
  asserted_claims: number;
}

export interface TraceRow {
  invocation_id: string;
  script_ref: string;
  status: string;
  events_count: number;
  coverage: Coverage;
  created_at: number;
}

export interface TraceDetail {
  invocation_id: string;
  script_ref: string;
  code_snapshot: string;
  status: string;
  events: TraceEvent[];
  coverage: Coverage;
  result: unknown;
  created_at?: number;
}

export interface TraceEvent {
  seq: number;
  t: string;
  op: string;
  realizer: string;
  trust: string;
  inputs: string[];
  output: string | null;
  preview?: string;
  directive?: string;
  kind?: string;
  message?: string;
  meta?: Record<string, unknown>;
  detail?: Record<string, unknown>;
  line?: number;
}

export interface Invocation {
  invocation_id: string;
  script_ref: string;
  agent_id: string | null;
  agent_name: string | null;
  status: string;
  started_at: number;
  last_activity_at: number;
  events_count: number;
}

export interface Agent {
  agent_id: string;
  name: string;
  registered_at: number;
  active_invocations: number;
  total_runs: number;
}

export interface AgentDetail {
  agent_id: string;
  name: string;
  registered_at: number;
  active_invocations: string[];
  history: { invocation_id: string; script_ref: string; status: string; started_at: number; finished_at: number | null }[];
}

export interface ScriptEntry {
  name: string;
  hasSrv: boolean;
  description?: string;
  runs: number;
  last_run: number | null;
}

export interface Shape {
  kind: string;
  fields: Record<string, string>;
}

export interface ScriptSource {
  script_ref: string;
  cog: string;
  srv?: string;
  serverFunctions?: string[];
  concludeShape?: Shape;
  checkpointShapes?: Record<string, Shape>;
  reportShapes?: Record<string, Shape>;
}

export interface StatusResponse {
  version: string;
  uptime: number;
  agents: number;
  invocations: { active: number; total: number };
  config: {
    invocationTtlMs: number;
    awaitingTtlMs: number;
    maxActiveInvocations: number;
    budgets: { steps: number; iterations: number };
  };
}

export interface StoreCollection {
  name: string;
  count: number;
}

export interface StoreNote {
  key: string;
  type?: string;
  data: unknown;
}
