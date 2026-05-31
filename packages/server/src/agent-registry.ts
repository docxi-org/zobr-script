// AgentRegistry — persistent agent registration (doc 12 §6).
// Idempotent by name: same name → same agent_id.
// Persisted to SQLite (zs_agents) via InfraStore when Db is provided.
// activeInvocations is ephemeral (in-memory only).
import { randomUUID } from "node:crypto";
import type { Db } from "./db";

export interface AgentEntry {
  readonly name: string;
  readonly agentId: string;
  readonly registeredAt: number;
  readonly activeInvocations: Set<string>;
}

export class AgentRegistry {
  readonly #agents = new Map<string, AgentEntry>();
  readonly #byName = new Map<string, string>();
  readonly #invToAgent = new Map<string, string>();
  readonly #db: Db | undefined;

  constructor(db?: Db) {
    this.#db = db;
    if (db !== undefined) {
      for (const row of db.infra.loadAgents()) {
        this.#agents.set(row.agent_id, {
          name: row.name,
          agentId: row.agent_id,
          registeredAt: row.registered_at,
          activeInvocations: new Set(),
        });
        this.#byName.set(row.name, row.agent_id);
      }
    }
  }

  register(name: string): string {
    const existing = this.#byName.get(name);
    if (existing !== undefined) return existing;

    const agentId = `ag_${randomUUID().slice(0, 12)}`;
    const registeredAt = Date.now();
    this.#agents.set(agentId, {
      name,
      agentId,
      registeredAt,
      activeInvocations: new Set(),
    });
    this.#byName.set(name, agentId);
    this.#db?.infra.saveAgent({ agent_id: agentId, name, registered_at: registeredAt });
    return agentId;
  }

  get(agentId: string): AgentEntry | undefined {
    return this.#agents.get(agentId);
  }

  has(agentId: string): boolean {
    return this.#agents.has(agentId);
  }

  addActiveInvocation(agentId: string, invocationId: string): void {
    this.#agents.get(agentId)?.activeInvocations.add(invocationId);
    this.#invToAgent.set(invocationId, agentId);
  }

  removeActiveInvocation(agentId: string, invocationId: string): void {
    this.#agents.get(agentId)?.activeInvocations.delete(invocationId);
    this.#invToAgent.delete(invocationId);
  }

  hasActiveInvocation(agentId: string): boolean {
    return (this.#agents.get(agentId)?.activeInvocations.size ?? 0) > 0;
  }

  findAgentByInvocation(invocationId: string): string | undefined {
    return this.#invToAgent.get(invocationId);
  }
}
