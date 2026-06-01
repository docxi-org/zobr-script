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
import { navigate } from "../router";
import { useApi } from "../api/hooks";
import type { TraceRow, ScriptEntry } from "../api/types";

const columns: Column<TraceRow>[] = [
  { key: "id", label: "Invocation", mono: true, sortable: true, maxWidth: 240, render: (r) => <span style={{ color: "var(--accent)" }}>{r.invocation_id}</span> },
  { key: "script", label: "Script", sortable: true, render: (r) => <ScriptChip name={r.script_ref} /> },
  { key: "status", label: "Status", sortable: true, render: (r) => <StatusBadge status={r.status} /> },
  { key: "coverage", label: "Coverage", width: 170, render: (r) => r.coverage ? <CoverageBar coverage={r.coverage} /> : <span style={{ color: "var(--text-3)" }}>—</span> },
  { key: "events", label: "Events", align: "right", sortable: true, mono: true, muted: true, render: (r) => r.events_count },
  { key: "when", label: "Started", align: "right", sortable: true, mono: true, muted: true, render: (r) => fmtDate(r.created_at) },
];

export function Traces() {
  const [scriptF, setScriptF] = useState("");
  const [statusF, setStatusF] = useState("");
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

  const { data: traceData, refetch } = useApi<{ traces: TraceRow[]; total: number }>(`/traces?${queryParams}`, [queryParams]);
  const { data: scriptData } = useApi<{ scripts: ScriptEntry[] }>("/scripts");

  const allTraces = traceData?.traces ?? [];
  const filtered = q ? allTraces.filter((t) => t.invocation_id.includes(q.toLowerCase())) : allTraces;
  const page = filtered.slice(offset, offset + limit);
  const scriptNames = scriptData?.scripts.map((s) => s.name) ?? [];

  const active = scriptF || statusF || q;
  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setOffset(0); };

  return (
    <div>
      <div style={{ marginBottom: "var(--gap)" }}>
        <h1 style={{ margin: 0, fontSize: "var(--fs-h1)", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-0)" }}>Traces</h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>{filtered.length} matching invocations</p>
      </div>

      <div className="flex flex-wrap items-center" style={{ gap: 8, marginBottom: "var(--gap)" }}>
        <Input value={q} onChange={reset(setQ)} placeholder="Search invocation id…" icon="search" style={{ width: 260 }} mono />
        <Select value={scriptF} onChange={reset(setScriptF)} placeholder="All scripts" options={scriptNames} width={150} />
        <Select value={statusF} onChange={reset(setStatusF)} placeholder="All statuses" options={["running", "done", "halted", "aborted", "errored", "expired"]} width={150} />
        {active && <Button variant="ghost" size="sm" icon="x" onClick={() => { setScriptF(""); setStatusF(""); setQ(""); setOffset(0); }}>Clear</Button>}
        <div className="flex-1" />
        <Button variant="default" size="md" icon="refresh" onClick={refetch}>Refresh</Button>
      </div>

      <DataTable rowKey={(r) => r.invocation_id} onRowClick={(r) => navigate("/traces/" + r.invocation_id)} columns={columns} rows={page} />
      <div style={{ marginTop: 12 }}>
        <Pagination total={filtered.length} limit={limit} offset={offset} onChange={setOffset} />
      </div>
    </div>
  );
}
