import { useState, useMemo } from "react";
import { StatusBadge } from "../ui/badge";
import { CoverageBar } from "../ui/coverage-bar";
import { DataTable, type Column } from "../ui/data-table";
import { Pagination } from "../ui/pagination";
import { ScriptChip } from "../ui/script-chip";
import { Button } from "../ui/button";
import { Select } from "../ui/select";
import { Input } from "../ui/input";
import { fmtDuration, fmtDate } from "../ui/helpers";
import { navigate, useQueryParam } from "../router";
import { useApi } from "../api/hooks";
import { useT } from "../i18n/context";
import type { TraceRow, ScriptEntry, Invocation } from "../api/types";

// columns moved inside component for i18n access

export function Traces() {
  const [scriptF, setScriptF] = useQueryParam("script", "");
  const [statusF, setStatusF] = useQueryParam("status", "");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", "200");
    if (scriptF) p.set("script_ref", scriptF);
    if (statusF) p.set("status", statusF);
    return p.toString();
  }, [scriptF, statusF]);

  const { data: traceData, refetch: refetchTraces } = useApi<{ traces: TraceRow[]; total: number }>(`/traces?${queryParams}`, [queryParams]);
  const { data: invData, refetch: refetchInv } = useApi<{ invocations: Invocation[] }>("/invocations");
  const { data: scriptData } = useApi<{ scripts: ScriptEntry[] }>("/scripts");
  const refetch = () => { refetchTraces(); refetchInv(); };

  const liveRows: TraceRow[] = useMemo(() =>
    (invData?.invocations ?? []).map((inv) => ({
      invocation_id: inv.invocation_id,
      script_ref: inv.script_ref,
      status: inv.status,
      events_count: inv.events_count,
      coverage: { verified: 0, asserted: 0, authority_gates: 0, grounded_claims: 0, asserted_claims: 0, final_result_trust: null },
      created_at: inv.started_at,
    })),
  [invData]);

  const savedTraces = traceData?.traces ?? [];
  const savedIds = useMemo(() => new Set(savedTraces.map((t) => t.invocation_id)), [savedTraces]);
  const allTraces = useMemo(() => [
    ...liveRows.filter((r) => !savedIds.has(r.invocation_id)),
    ...savedTraces,
  ], [liveRows, savedTraces, savedIds]);
  const filtered = q ? allTraces.filter((t) => t.invocation_id.includes(q.toLowerCase())) : allTraces;
  const page = filtered.slice(offset, offset + limit);
  const scriptNames = scriptData?.scripts.map((s) => s.name) ?? [];

  const active = scriptF || statusF || q;
  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setOffset(0); };
  const t = useT();

  const columns = useMemo((): Column<TraceRow>[] => [
    { key: "id", label: t("col.invocation"), mono: true, sortable: true, maxWidth: 240, render: (r) => <span style={{ color: "var(--accent)" }}>{r.invocation_id}</span> },
    { key: "script", label: t("col.script"), sortable: true, render: (r) => <ScriptChip name={r.script_ref} /> },
    { key: "status", label: t("col.status"), sortable: true, render: (r) => <StatusBadge status={r.status} /> },
    { key: "coverage", label: t("col.coverage"), width: 170, render: (r) => r.coverage ? <CoverageBar coverage={r.coverage} /> : <span style={{ color: "var(--text-3)" }}>—</span> },
    { key: "events", label: t("col.events"), align: "right", sortable: true, mono: true, muted: true, render: (r) => r.events_count },
    { key: "when", label: t("col.started"), align: "right", sortable: true, mono: true, muted: true, render: (r) => fmtDate(r.created_at) },
  ], [t]);

  const statusOptions = useMemo(() => [
    { value: "running", label: t("status.running") },
    { value: "done", label: t("status.done") },
    { value: "halted", label: t("status.halted") },
    { value: "aborted", label: t("status.aborted") },
    { value: "errored", label: t("status.errored") },
    { value: "expired", label: t("status.expired") },
  ], [t]);

  return (
    <div>
      <div style={{ marginBottom: "var(--gap)" }}>
        <h1 style={{ margin: 0, fontSize: "var(--fs-h1)", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-0)" }}>{t("traces.title")}</h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>{t("traces.matching", { count: filtered.length })}</p>
      </div>

      <div className="flex flex-wrap items-center" style={{ gap: 8, marginBottom: "var(--gap)" }}>
        <Input value={q} onChange={reset(setQ)} placeholder={t("traces.search")} icon="search" style={{ width: 260 }} mono />
        <Select value={scriptF} onChange={reset(setScriptF)} placeholder={t("traces.all_scripts")} options={scriptNames} width={150} />
        <Select value={statusF} onChange={reset(setStatusF)} placeholder={t("traces.all_statuses")} options={statusOptions} width={150} />
        {active && <Button variant="ghost" size="sm" icon="x" onClick={() => { setScriptF(""); setStatusF(""); setQ(""); setOffset(0); }}>{t("traces.clear")}</Button>}
        <div className="flex-1" />
        <Button variant="default" size="md" icon="refresh" onClick={refetch}>{t("traces.refresh")}</Button>
      </div>

      <DataTable rowKey={(r) => r.invocation_id} onRowClick={(r) => navigate("/traces/" + r.invocation_id)} columns={columns} rows={page} />
      <div style={{ marginTop: 12 }}>
        <Pagination total={filtered.length} limit={limit} offset={offset} onChange={setOffset} />
      </div>
    </div>
  );
}
