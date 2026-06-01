import { useState } from "react";
import { Icon } from "../ui/icon";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { DataTable, type Column } from "../ui/data-table";
import { Segmented } from "../ui/segmented";
import { Button } from "../ui/button";
import { ScriptChip } from "../ui/script-chip";
import { navigate } from "../router";
import { useApi } from "../api/hooks";
import type { ScriptEntry } from "../api/types";

export function Scripts({ role }: { role: string }) {
  const [view, setView] = useState("cards");
  const { data } = useApi<{ scripts: ScriptEntry[] }>("/scripts");
  const scripts = data?.scripts ?? [];
  const canCreate = role === "architect" || role === "admin";

  const columns: Column<ScriptEntry>[] = [
    { key: "name", label: "Name", mono: true, render: (r) => <ScriptChip name={r.name} /> },
    { key: "srv", label: "Server", render: (r) => r.hasSrv ? <Badge color="var(--trust-authority)">srv</Badge> : <span style={{ color: "var(--text-3)" }}>—</span> },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between" style={{ gap: 16, marginBottom: "var(--gap)" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "var(--fs-h1)", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-0)" }}>Scripts</h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>{scripts.length} scripts in library</p>
        </div>
        <div className="flex items-center" style={{ gap: 8 }}>
          <Segmented value={view} onChange={setView} options={[{ value: "cards", label: "Cards" }, { value: "table", label: "Table" }]} />
          {canCreate && <Button variant="primary" icon="plus" onClick={() => navigate("/scripts/new")}>New script</Button>}
        </div>
      </div>

      {view === "cards" ? (
        <div className="grid gap-[var(--gap)]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {scripts.map((s) => (
            <Card key={s.name} hover onClick={() => navigate("/scripts/" + s.name)} style={{ padding: 18 }}>
              <div className="flex items-center" style={{ gap: 10 }}>
                <div className="grid place-items-center rounded-[9px] border border-[var(--border)]" style={{ width: 34, height: 34, background: "var(--bg-2)", color: "var(--text-1)" }}>
                  <Icon name="filecode" size={17} />
                </div>
                <div className="mono min-w-0" style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</div>
                <div className="flex-1" />
                {s.hasSrv && <Badge color="var(--trust-authority)">srv</Badge>}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <DataTable rowKey={(r) => r.name} onRowClick={(r) => navigate("/scripts/" + r.name)} columns={columns} rows={scripts} />
      )}
    </div>
  );
}
