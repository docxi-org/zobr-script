import { useState } from "react";
import { Icon } from "../ui/icon";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Tabs } from "../ui/tabs";
import { Select } from "../ui/select";
import { DataTable, type Column } from "../ui/data-table";
import { JsonView } from "../ui/code-block";
import { useApi } from "../api/hooks";
import type { StoreCollection, StoreNote } from "../api/types";

function Collections() {
  const [sel, setSel] = useState<string | null>(null);
  const [openDoc, setOpenDoc] = useState<Record<string, unknown> | null>(null);
  const { data } = useApi<{ collections: StoreCollection[] }>("/store/collections");
  const { data: docsData } = useApi<{ collection: string; docs: Record<string, unknown>[]; total: number }>(
    sel ? `/store/collections/${sel}` : "", [sel],
  );

  const collections = data?.collections ?? [];

  if (sel) {
    const docs = docsData?.docs ?? [];
    const cols = docs.length ? Object.keys(docs[0]!).filter((k) => k !== "findings") : [];
    return (
      <div>
        <div className="mb-3.5 flex items-center" style={{ gap: 8 }}>
          <Button variant="ghost" size="sm" icon="arrowLeft" onClick={() => { setSel(null); setOpenDoc(null); }}>Collections</Button>
          <Icon name="chevronRight" size={13} style={{ color: "var(--text-3)" }} />
          <span className="mono" style={{ fontWeight: 700 }}>{sel}</span>
          <Badge color="var(--text-2)">{docs.length} docs</Badge>
        </div>
        <div className="flex items-start" style={{ gap: 16 }}>
          <div className="min-w-0 flex-1">
            <DataTable
              rowKey={(r) => String(r["_id"])}
              onRowClick={(r) => setOpenDoc(r)}
              columns={cols.map((c): Column<Record<string, unknown>> => ({
                key: c, label: c, mono: c === "_id", muted: c === "_id", maxWidth: c === "summary" ? 280 : undefined,
                render: (r) => { const val = r[c]; return typeof val === "object" ? JSON.stringify(val) : String(val ?? ""); },
              }))}
              rows={docs}
            />
          </div>
          {openDoc && (
            <Card className="shrink-0" style={{ width: 360, padding: 0 }}>
              <div className="flex items-center border-b border-[var(--border)]" style={{ gap: 8, padding: "11px 14px" }}>
                <Icon name="doc" size={14} style={{ color: "var(--text-2)" }} />
                <span style={{ fontWeight: 700, fontSize: 14 }}>Document</span>
                <div className="flex-1" />
                <button onClick={() => setOpenDoc(null)} className="cursor-pointer border-none" style={{ background: "transparent", color: "var(--text-2)" }}><Icon name="x" size={15} /></button>
              </div>
              <div style={{ padding: 14, maxHeight: 460, overflow: "auto" }}><JsonView data={openDoc} /></div>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <DataTable
      rowKey={(r) => r.name}
      columns={[
        { key: "name", label: "Name", mono: true, render: (r: StoreCollection) => <span className="inline-flex items-center" style={{ gap: 7, fontWeight: 600 }}><Icon name="database" size={13} style={{ color: "var(--text-3)" }} />{r.name}</span> },
        { key: "count", label: "Documents", align: "right", mono: true, render: (r: StoreCollection) => r.count },
        { key: "actions", label: "", align: "right", render: (r: StoreCollection) => <Button size="sm" variant="outline" onClick={() => setSel(r.name)}>Browse</Button> },
      ] satisfies Column<StoreCollection>[]}
      rows={collections}
    />
  );
}

function Notes() {
  const [typeF, setTypeF] = useState("");
  const { data } = useApi<{ notes: StoreNote[] }>(`/store/notes${typeF ? `?type=${typeF}` : ""}`, [typeF]);
  const notesList = data?.notes ?? [];
  const types = [...new Set(notesList.map((n) => n.type).filter((t): t is string => !!t))];

  return (
    <div>
      <div className="mb-3.5">
        <Select value={typeF} onChange={setTypeF} placeholder="All types" options={types} width={160} />
      </div>
      <DataTable
        rowKey={(r) => r.key}
        columns={[
          { key: "key", label: "Key", mono: true, render: (r: StoreNote) => r.key },
          { key: "type", label: "Type", render: (r: StoreNote) => r.type ? <Badge color="var(--accent)">{r.type}</Badge> : <span style={{ color: "var(--text-3)" }}>—</span> },
          { key: "data", label: "Data", mono: true, muted: true, maxWidth: 420, render: (r: StoreNote) => JSON.stringify(r.data) },
        ] satisfies Column<StoreNote>[]}
        rows={notesList}
      />
    </div>
  );
}

export function Store() {
  const [tab, setTab] = useState("collections");
  return (
    <div>
      <div style={{ marginBottom: "var(--gap)" }}>
        <h1 style={{ margin: 0, fontSize: "var(--fs-h1)", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-0)" }}>Store</h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>Read-only view of typed collections and notes · writes go through MCP tools</p>
      </div>
      <Tabs tabs={[{ id: "collections", label: "Collections" }, { id: "notes", label: "Notes" }]} active={tab} onChange={setTab} />
      <div className="mt-4">{tab === "collections" ? <Collections /> : <Notes />}</div>
    </div>
  );
}
