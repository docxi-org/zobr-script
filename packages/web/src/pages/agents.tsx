import { Icon } from "../ui/icon";
import { Badge, StatusBadge } from "../ui/badge";
import { Card } from "../ui/card";
import { DataTable, type Column } from "../ui/data-table";
import { SectionTitle } from "../ui/section-title";
import { ScriptChip } from "../ui/script-chip";
import { timeAgo, fmtDate } from "../ui/helpers";
import { navigate } from "../router";
import { useApi } from "../api/hooks";
import type { Agent, AgentDetail } from "../api/types";

const NOW = Date.now();

function MiniStat({ label, value, c }: { label: string; value: string | number; c?: string }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 8, color: c ?? "var(--text-0)", lineHeight: 1 }}>{value}</div>
    </Card>
  );
}

export function AgentsList() {
  const { data } = useApi<{ agents: Agent[] }>("/agents");
  const agents = data?.agents ?? [];

  const columns: Column<Agent>[] = [
    { key: "name", label: "Name", render: (r) => (
      <span className="inline-flex items-center" style={{ gap: 9, fontWeight: 600 }}>
        <span className="grid place-items-center rounded-full border border-[var(--border)]" style={{ width: 26, height: 26, background: "var(--bg-3)", fontSize: 11, fontWeight: 700 }}>{r.name[0]}</span>
        {r.name}
      </span>
    ) },
    { key: "agent_id", label: "Agent ID", mono: true, muted: true },
    { key: "registered", label: "Registered", mono: true, muted: true, render: (r) => timeAgo(r.registered_at, NOW) + " ago" },
    { key: "active", label: "Active", align: "right", render: (r) => r.active_invocations > 0 ? <Badge color="var(--st-running)">{r.active_invocations}</Badge> : <span className="mono" style={{ color: "var(--text-3)" }}>0</span> },
    { key: "total", label: "Total runs", align: "right", mono: true, render: (r) => r.total_runs },
  ];

  return (
    <div>
      <div style={{ marginBottom: "var(--gap)" }}>
        <h1 style={{ margin: 0, fontSize: "var(--fs-h1)", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-0)" }}>Agents</h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>{agents.length} registered agents</p>
      </div>
      <DataTable rowKey={(r) => r.agent_id} onRowClick={(r) => navigate("/agents/" + r.agent_id)} columns={columns} rows={agents} />
    </div>
  );
}

export function AgentDetailPage({ id }: { id: string }) {
  const { data: agent, loading } = useApi<AgentDetail>(`/agents/${id}`, [id]);

  if (loading) return <div style={{ padding: "56px 24px", textAlign: "center", color: "var(--text-2)" }}>Loading agent…</div>;
  if (!agent) return (
    <div className="flex flex-col items-center justify-center" style={{ padding: "56px 24px", color: "var(--text-2)" }}>
      <Icon name="alert" size={28} style={{ color: "var(--text-3)" }} />
      <div style={{ fontWeight: 600, color: "var(--text-1)", marginTop: 10 }}>Agent not found</div>
      <div className="mono" style={{ fontSize: "var(--fs-sm)", marginTop: 4 }}>{id}</div>
    </div>
  );

  const history = agent.history ?? [];
  const done = history.filter((h) => h.status === "done").length;
  const failed = history.filter((h) => ["aborted", "errored", "expired", "halted"].includes(h.status)).length;

  return (
    <div>
      <a href="#/agents" className="mb-3 inline-flex items-center" style={{ gap: 6, fontSize: "var(--fs-sm)", color: "var(--text-2)", fontWeight: 600 }}>
        <Icon name="arrowLeft" size={14} /> Agents
      </a>
      <div className="mb-5 flex items-center" style={{ gap: 14 }}>
        <span className="grid place-items-center rounded-full border border-[var(--border)]" style={{ width: 44, height: 44, background: "var(--bg-3)", fontSize: 18, fontWeight: 700 }}>{agent.name[0]}</span>
        <div>
          <h1 style={{ margin: 0, fontSize: "var(--fs-h1)", fontWeight: 700 }}>{agent.name}</h1>
          <span className="mono" style={{ fontSize: "var(--fs-sm)", color: "var(--text-2)" }}>{agent.agent_id}</span>
        </div>
      </div>

      <div className="zs-stats mb-6 grid gap-[var(--gap)]" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <MiniStat label="Registered" value={timeAgo(agent.registered_at, NOW) + " ago"} />
        <MiniStat label="Total runs" value={history.length} />
        <MiniStat label="Done" value={done} c="var(--st-done)" />
        <MiniStat label="Failed" value={failed} c="var(--st-halted)" />
      </div>

      <SectionTitle title="Invocation history" hint={`${history.length} runs`} />
      <DataTable
        rowKey={(r) => r.invocation_id}
        onRowClick={(r) => navigate("/traces/" + r.invocation_id)}
        columns={[
          { key: "id", label: "Invocation", mono: true, maxWidth: 240, render: (r) => <span style={{ color: "var(--accent)" }}>{r.invocation_id}</span> },
          { key: "script", label: "Script", render: (r) => <ScriptChip name={r.script_ref} /> },
          { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "started", label: "Started", align: "right", mono: true, muted: true, render: (r) => fmtDate(r.started_at) },
        ]}
        rows={history}
      />
    </div>
  );
}
