import { useMemo, useState, useCallback } from "react";
import { Icon } from "../ui/icon";
import { ConfirmModal } from "../ui/modal";
import { Badge, StatusBadge } from "../ui/badge";
import { Card } from "../ui/card";
import { DataTable, type Column } from "../ui/data-table";
import { SectionTitle } from "../ui/section-title";
import { ScriptChip } from "../ui/script-chip";
import { timeAgo, fmtDate } from "../ui/helpers";
import { navigate } from "../router";
import { useApi } from "../api/hooks";
import { api } from "../api/client";
import { useT, usePlural } from "../i18n/context";
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

const ROLE_COLOR: Record<string, string> = {
  executor: "var(--st-done)",
  architect: "var(--trust-asserted)",
};

const ROLE_KEY: Record<string, string> = { executor: "agents.role_executor", architect: "agents.role_architect" };

function RoleToggle({ agentId, role, onChanged }: { agentId: string; role: string; onChanged: () => void }) {
  const t = useT();
  const c = ROLE_COLOR[role] ?? ROLE_COLOR["executor"]!;
  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await api.put(`/agents/${agentId}/role`, { role: role === "architect" ? "executor" : "architect" });
    onChanged();
  };
  return (
    <button onClick={toggle} className="inline-flex cursor-pointer items-center rounded-full border-none"
      style={{ gap: 6, padding: "3px 10px 3px 6px", background: `color-mix(in oklch, ${c} calc(var(--tint) * 100%), transparent)`, fontSize: "var(--fs-xs)", fontWeight: 600, color: c, transition: "all .15s var(--ease)" }}>
      <span style={{ width: 8, height: 8, borderRadius: 99, background: c }} />
      {t((ROLE_KEY[role] ?? ROLE_KEY["executor"]!) as Parameters<typeof t>[0])}
    </button>
  );
}

function RoleSegmented({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useT();
  const opts = [
    { value: "executor", label: t("agents.role_executor"), c: ROLE_COLOR["executor"]! },
    { value: "architect", label: t("agents.role_architect"), c: ROLE_COLOR["architect"]! },
  ];
  return (
    <div className="inline-flex rounded-[var(--r-md)] border border-[var(--border)]" style={{ padding: 3, gap: 2, background: "var(--bg-2)" }}>
      {opts.map((o) => {
        const on = value === o.value;
        return (
          <button key={o.value} onClick={() => onChange(o.value)} className="cursor-pointer rounded-[6px]"
            style={{ padding: "4px 11px", fontSize: "var(--fs-sm)", fontWeight: 600, border: "1px solid transparent", transition: "all .14s var(--ease)",
              background: on ? `color-mix(in oklch, ${o.c} calc(var(--tint) * 100%), var(--bg-0))` : "transparent",
              color: on ? o.c : "var(--text-3)",
              borderColor: on ? `color-mix(in oklch, ${o.c} 30%, transparent)` : "transparent",
            }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function AgentsList() {
  const { data, refetch } = useApi<{ agents: Agent[] }>("/agents");
  const agents = data?.agents ?? [];
  const t = useT();
  const p = usePlural();
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await api.del(`/agents/${deleteTarget.agent_id}`);
    setDeleteTarget(null);
    refetch();
  }, [deleteTarget, refetch]);

  const columns = useMemo((): Column<Agent>[] => [
    { key: "name", label: t("col.name"), sortable: true, sortVal: (r) => r.name, render: (r) => (
      <span className="inline-flex items-center" style={{ gap: 9, fontWeight: 600 }}>
        <span className="grid place-items-center rounded-full border border-[var(--border)]" style={{ width: 26, height: 26, background: "var(--bg-3)", fontSize: 11, fontWeight: 700 }}>{r.name[0]}</span>
        {r.name}
      </span>
    ) },
    { key: "role", label: t("agents.role"), width: 120, sortable: true, sortVal: (r) => r.role, render: (r) => <RoleToggle agentId={r.agent_id} role={r.role} onChanged={refetch} /> },
    { key: "agent_id", label: t("col.agent_id"), mono: true, muted: true },
    { key: "registered", label: t("col.registered"), mono: true, muted: true, sortable: true, sortVal: (r) => r.registered_at, render: (r) => timeAgo(r.registered_at, NOW) + " " + t("common.ago") },
    { key: "active", label: t("col.active"), align: "right", sortable: true, sortVal: (r) => r.active_invocations, render: (r) => r.active_invocations > 0 ? <Badge color="var(--st-running)">{r.active_invocations}</Badge> : <span className="mono" style={{ color: "var(--text-3)" }}>0</span> },
    { key: "total", label: t("col.total_runs"), align: "right", mono: true, sortable: true, sortVal: (r) => r.total_runs, render: (r) => r.total_runs },
    { key: "actions", label: "", width: 40, render: (r) => r.active_invocations === 0 ? (
      <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}
        className="cursor-pointer rounded border-none" style={{ padding: "2px 6px", background: "transparent", color: "var(--text-3)" }}
        title="Delete agent">
        <Icon name="x" size={14} />
      </button>
    ) : null },
  ], [t]);

  return (
    <div>
      <div style={{ marginBottom: "var(--gap)" }}>
        <h1 style={{ margin: 0, fontSize: "var(--fs-h1)", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-0)" }}>{t("agents.title")}</h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>{`${agents.length} ${p(agents.length, t("p.agents").split("|"))}`}</p>
      </div>
      <DataTable rowKey={(r) => r.agent_id} onRowClick={(r) => navigate("/agents/" + r.agent_id)} columns={columns} rows={agents} />
      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete agent"
        message={`Delete agent "${deleteTarget?.name}"? Invocation history will be preserved.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}

export function AgentDetailPage({ id }: { id: string }) {
  const { data: agent, loading, refetch } = useApi<AgentDetail>(`/agents/${id}`, [id]);
  const [showDelete, setShowDelete] = useState(false);

  const t = useT();

  const changeRole = async (role: string) => {
    await api.put(`/agents/${id}/role`, { role });
    refetch();
  };
  if (loading) return <div style={{ padding: "56px 24px", textAlign: "center", color: "var(--text-2)" }}>{t("agents.loading")}</div>;
  if (!agent) return (
    <div className="flex flex-col items-center justify-center" style={{ padding: "56px 24px", color: "var(--text-2)" }}>
      <Icon name="alert" size={28} style={{ color: "var(--text-3)" }} />
      <div style={{ fontWeight: 600, color: "var(--text-1)", marginTop: 10 }}>{t("agents.not_found")}</div>
      <div className="mono" style={{ fontSize: "var(--fs-sm)", marginTop: 4 }}>{id}</div>
    </div>
  );

  const history = agent.history ?? [];
  const done = history.filter((h) => h.status === "done").length;
  const failed = history.filter((h) => ["aborted", "errored", "expired", "halted"].includes(h.status)).length;

  return (
    <div>
      <a href="#/agents" className="mb-3 inline-flex items-center" style={{ gap: 6, fontSize: "var(--fs-sm)", color: "var(--text-2)", fontWeight: 600 }}>
        <Icon name="arrowLeft" size={14} /> {t("agents.back")}
      </a>
      <div className="mb-5 flex items-center" style={{ gap: 14 }}>
        <span className="grid place-items-center rounded-full border border-[var(--border)]" style={{ width: 44, height: 44, background: "var(--bg-3)", fontSize: 18, fontWeight: 700 }}>{agent.name[0]}</span>
        <div>
          <h1 style={{ margin: 0, fontSize: "var(--fs-h1)", fontWeight: 700 }}>{agent.name}</h1>
          <span className="mono" style={{ fontSize: "var(--fs-sm)", color: "var(--text-2)" }}>{agent.agent_id}</span>
        </div>
      </div>

      <Card className="mb-5">
        <div className="flex items-center justify-between" style={{ gap: 12, fontSize: "var(--fs-sm)" }}>
          <div className="flex items-center" style={{ gap: 10 }}>
            <Icon name="users" size={16} style={{ color: "var(--text-2)" }} />
            <span style={{ fontWeight: 600 }}>{t("agents.role")}</span>
            <span style={{ color: "var(--text-3)", fontSize: "var(--fs-xs)" }}>{t("agents.role_hint")}</span>
          </div>
          <div className="flex items-center" style={{ gap: 8 }}>
            <RoleSegmented value={agent.role ?? "executor"} onChange={changeRole} />
            <button onClick={() => setShowDelete(true)}
              className="cursor-pointer rounded-[var(--r-md)] border border-[var(--border)]"
              style={{ padding: "5px 10px", background: "transparent", color: "var(--text-3)", fontSize: "var(--fs-xs)", fontWeight: 600 }}
              title="Delete agent">
              <Icon name="x" size={13} />
            </button>
          </div>
        </div>
      </Card>

      <div className="zs-stats mb-6 grid gap-[var(--gap)]" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <MiniStat label={t("agents.registered")} value={timeAgo(agent.registered_at, NOW) + " " + t("common.ago")} />
        <MiniStat label={t("agents.total_runs")} value={history.length} />
        <MiniStat label={t("agents.done")} value={done} c="var(--st-done)" />
        <MiniStat label={t("agents.failed")} value={failed} c="var(--st-halted)" />
      </div>

      <SectionTitle title={t("agents.invocation_history")} hint={`${history.length} ${t("scripts.runs")}`} />
      <DataTable
        rowKey={(r) => r.invocation_id}
        onRowClick={(r) => navigate("/traces/" + r.invocation_id)}
        columns={[
          { key: "id", label: t("col.invocation"), mono: true, maxWidth: 240, sortable: true, sortVal: (r) => r.invocation_id, render: (r) => <span style={{ color: "var(--accent)" }}>{r.invocation_id}</span> },
          { key: "script", label: t("col.script"), sortable: true, sortVal: (r) => r.script_ref, render: (r) => <ScriptChip name={r.script_ref} /> },
          { key: "status", label: t("col.status"), sortable: true, sortVal: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
          { key: "started", label: t("col.started"), align: "right", mono: true, muted: true, sortable: true, sortVal: (r) => r.started_at, render: (r) => fmtDate(r.started_at) },
        ]}
        rows={history}
      />
      <ConfirmModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={async () => { await api.del(`/agents/${id}`); navigate("/agents"); }}
        title="Delete agent"
        message={`Delete agent "${agent.name}"? Invocation history will be preserved.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
