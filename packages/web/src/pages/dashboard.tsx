import { StatusBadge } from "../ui/badge";
import { CoverageBar } from "../ui/coverage-bar";
import { DataTable, type Column } from "../ui/data-table";
import { StatCard } from "../ui/stat-card";
import { SectionTitle } from "../ui/section-title";
import { ScriptChip } from "../ui/script-chip";
import { timeAgo, fmtDate } from "../ui/helpers";
import { navigate } from "../router";
import { useApi } from "../api/hooks";
import { useT } from "../i18n/context";
import type { StatusResponse, Invocation, TraceRow } from "../api/types";

const NOW = Date.now();

// columns moved inside Dashboard for i18n access

export function Dashboard() {
  const { data: status } = useApi<StatusResponse>("/status");
  const { data: invData } = useApi<{ invocations: Invocation[] }>("/invocations");
  const { data: traceData } = useApi<{ traces: TraceRow[]; total: number }>("/traces?limit=8");

  const invocations = invData?.invocations ?? [];
  const recent = traceData?.traces ?? [];

  const t = useT();

  const invColumns: Column<Invocation>[] = [
    { key: "id", label: t("col.invocation"), mono: true, sortable: true, sortVal: (r) => r.invocation_id, render: (r) => <span style={{ color: "var(--accent)" }}>{r.invocation_id}</span> },
    { key: "script", label: t("col.script"), sortable: true, sortVal: (r) => r.script_ref, render: (r) => <ScriptChip name={r.script_ref} /> },
    { key: "agent", label: t("col.agent"), sortable: true, sortVal: (r) => r.agent_name ?? "", render: (r) => r.agent_name ?? "—" },
    { key: "events", label: t("col.events"), align: "right", mono: true, muted: true, sortable: true, sortVal: (r) => r.events_count, render: (r) => r.events_count },
    { key: "age", label: t("col.age"), mono: true, muted: true, sortable: true, sortVal: (r) => r.started_at, render: (r) => timeAgo(r.started_at, NOW) },
    { key: "activity", label: t("col.last_activity"), mono: true, muted: true, sortable: true, sortVal: (r) => r.last_activity_at, render: (r) => timeAgo(r.last_activity_at, NOW) + " " + t("common.ago") },
    { key: "status", label: t("col.status"), sortable: true, sortVal: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
  ];

  const traceColumns: Column<TraceRow>[] = [
    { key: "id", label: t("col.invocation"), mono: true, maxWidth: 220, sortable: true, sortVal: (r) => r.invocation_id, render: (r) => <span style={{ color: "var(--accent)" }}>{r.invocation_id}</span> },
    { key: "script", label: t("col.script"), sortable: true, sortVal: (r) => r.script_ref, render: (r) => <ScriptChip name={r.script_ref} /> },
    { key: "status", label: t("col.status"), sortable: true, sortVal: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
    { key: "coverage", label: t("col.coverage"), width: 170, sortable: true, sortVal: (r) => r.coverage?.verified ?? 0, render: (r) => r.coverage ? <CoverageBar coverage={r.coverage} /> : <span style={{ color: "var(--text-3)" }}>—</span> },
    { key: "events", label: t("col.events"), align: "right", mono: true, muted: true, sortable: true, sortVal: (r) => r.events_count, render: (r) => r.events_count },
    { key: "when", label: t("col.when"), mono: true, muted: true, align: "right", sortable: true, sortVal: (r) => r.created_at, render: (r) => fmtDate(r.created_at) },
  ];

  return (
    <div>
      <div style={{ marginBottom: "var(--gap)" }}>
        <h1 style={{ margin: 0, fontSize: "var(--fs-h1)", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-0)" }}>
          {t("dashboard.title")}
        </h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>
          {t("dashboard.subtitle")}
        </p>
      </div>

      <div className="zs-stats grid gap-[var(--gap)]" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <StatCard label={t("dashboard.traces")} value={traceData?.total ?? 0} icon="activity" sub={t("dashboard.total")} onClick={() => navigate("/traces")} />
        <StatCard label={t("dashboard.agents")} value={status?.agents ?? 0} icon="users" sub={t("dashboard.registered")} onClick={() => navigate("/agents")} />
        <StatCard label={t("dashboard.active")} value={status?.invocations.active ?? 0} icon="zap" accent="var(--st-running)" sub={t("dashboard.running")} />
        <StatCard label={t("dashboard.uptime")} value={status ? Math.floor(status.uptime / 3600) : 0} icon="clock" sub={t("dashboard.hours")} />
      </div>

      <div style={{ marginTop: 28 }}>
        <SectionTitle
          title={t("dashboard.active_invocations")}
          hint={`${invocations.length} ${t("dashboard.running")}`}
          action={<a href="#/traces" style={{ fontSize: "var(--fs-sm)", color: "var(--accent)", fontWeight: 600 }}>{t("dashboard.all_traces")}</a>}
        />
        <DataTable
          rowKey={(r) => r.invocation_id}
          onRowClick={(r) => navigate("/traces/" + r.invocation_id)}
          columns={invColumns}
          rows={invocations}
        />
      </div>

      <div style={{ marginTop: 28 }}>
        <SectionTitle
          title={t("dashboard.recent_traces")}
          action={<a href="#/traces" style={{ fontSize: "var(--fs-sm)", color: "var(--accent)", fontWeight: 600 }}>{t("dashboard.view_all")}</a>}
        />
        <DataTable
          rowKey={(r) => r.invocation_id}
          onRowClick={(r) => navigate("/traces/" + r.invocation_id)}
          columns={traceColumns}
          rows={recent}
        />
      </div>
    </div>
  );
}
