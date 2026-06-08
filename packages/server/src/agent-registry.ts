// AgentRegistry — persistent agent registration (doc 12 §6).
// Idempotent by name: same name → same agent_id (reconnect mechanism).
// Persisted to SQLite (zs_agents) via InfraStore when Db is provided.
// activeInvocations is ephemeral (in-memory only).
import { randomUUID } from "node:crypto";
import type { Db, AgentRole } from "./db";

export interface AgentEntry {
  readonly name: string;
  readonly agentId: string;
  readonly registeredAt: number;
  role: AgentRole;
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
          role: row.role ?? "executor",
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
      role: "executor",
      activeInvocations: new Set(),
    });
    this.#byName.set(name, agentId);
    this.#db?.infra.saveAgent({ agent_id: agentId, name, registered_at: registeredAt, role: "executor" });
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

  setRole(agentId: string, role: AgentRole): boolean {
    const entry = this.#agents.get(agentId);
    if (!entry) return false;
    entry.role = role;
    this.#db?.infra.setAgentRole(agentId, role);
    return true;
  }

  delete(agentId: string): boolean {
    const entry = this.#agents.get(agentId);
    if (!entry) return false;
    if (entry.activeInvocations.size > 0) return false;
    this.#agents.delete(agentId);
    this.#byName.delete(entry.name);
    this.#db?.infra.deleteAgent(agentId);
    return true;
  }

  all(): { agent_id: string; name: string; registered_at: number; role: AgentRole }[] {
    return [...this.#agents.values()].map((a) => ({
      agent_id: a.agentId,
      name: a.name,
      registered_at: a.registeredAt,
      role: a.role,
    }));
  }

  agentForInvocation(invocationId: string): string | undefined {
    return this.#invToAgent.get(invocationId);
  }
}
