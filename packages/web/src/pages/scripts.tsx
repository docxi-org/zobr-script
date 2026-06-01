import { useState, useMemo } from "react";
import { Icon } from "../ui/icon";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { DataTable, type Column } from "../ui/data-table";
import { Pagination } from "../ui/pagination";
import { Segmented } from "../ui/segmented";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { timeAgo } from "../ui/helpers";
import { navigate } from "../router";
import { useApi } from "../api/hooks";
import { useT } from "../i18n/context";
import type { ScriptEntry } from "../api/types";

const NOW = Date.now();

const baseName = (n: string) => n.split("/").pop()!;
const dirOf = (n: string) => { const i = n.lastIndexOf("/"); return i === -1 ? "" : n.slice(0, i); };

function PathLabel({ name, size }: { name: string; size?: string }) {
  const d = dirOf(name);
  return (
    <span className="mono inline-flex min-w-0 items-center" style={{ gap: 7 }}>
      <Icon name="filecode" size={13} style={{ color: "var(--text-3)", flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: size }}>
        {d && <span style={{ color: "var(--text-3)" }}>{d}/</span>}
        <span style={{ fontWeight: 700, color: "var(--text-0)" }}>{baseName(name)}</span>
      </span>
    </span>
  );
}

// ── Tree model ──

interface TreeNode {
  name: string;
  path: string;
  folders: Record<string, TreeNode>;
  scripts: ScriptEntry[];
}

function buildTree(scripts: ScriptEntry[]): TreeNode {
  const root: TreeNode = { name: "", path: "", folders: {}, scripts: [] };
  scripts.forEach((s) => {
    const parts = s.name.split("/");
    parts.pop();
    let node = root;
    let acc = "";
    parts.forEach((p) => {
      acc = acc ? acc + "/" + p : p;
      if (!node.folders[p]) node.folders[p] = { name: p, path: acc, folders: {}, scripts: [] };
      node = node.folders[p]!;
    });
    node.scripts.push(s);
  });
  return root;
}

function countScripts(node: TreeNode): number {
  let n = node.scripts.length;
  Object.values(node.folders).forEach((f) => (n += countScripts(f)));
  return n;
}

function allFolders(scripts: ScriptEntry[]): string[] {
  const set = new Set<string>();
  scripts.forEach((s) => {
    const p = s.name.split("/");
    p.pop();
    let acc = "";
    p.forEach((x) => { acc = acc ? acc + "/" + x : x; set.add(acc); });
  });
  return [...set].sort();
}

// ── TreeView ──

function TreeNodes({ node, depth, open, toggle }: { node: TreeNode; depth: number; open: Record<string, boolean>; toggle: (path: string) => void }) {
  const folders = Object.values(node.folders).sort((a, b) => a.name.localeCompare(b.name));
  const files = node.scripts.slice().sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      {folders.map((f) => {
        const isOpen = !!open[f.path];
        const count = countScripts(f);
        return (
          <div key={f.path}>
            <div onClick={() => toggle(f.path)} className="zs-tree-row flex cursor-pointer items-center"
              style={{ gap: 8, height: 32, paddingRight: 14, paddingLeft: 12 + depth * 18 }}>
              <Icon name="chevronRight" size={13} style={{ color: "var(--text-2)", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .12s var(--ease)", flexShrink: 0 }} />
              <Icon name="database" size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
              <span className="mono" style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--text-0)" }}>{f.name}</span>
              <span className="mono rounded-full" style={{ fontSize: "var(--fs-xs)", color: "var(--text-3)", background: "var(--bg-2)", padding: "1px 7px", fontWeight: 600 }}>{count}</span>
            </div>
            {isOpen && <TreeNodes node={f} depth={depth + 1} open={open} toggle={toggle} />}
          </div>
        );
      })}
      {files.map((s) => (
        <div key={s.name} onClick={() => navigate("/scripts/" + s.name)} className="zs-tree-row flex cursor-pointer items-center"
          style={{ gap: 8, minHeight: 32, paddingRight: 14, paddingLeft: 12 + depth * 18 + 21 }}>
          <Icon name="filecode" size={14} style={{ color: "var(--text-2)", flexShrink: 0 }} />
          <span className="mono" style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--text-0)" }}>{baseName(s.name)}</span>
          {s.hasSrv && <Badge color="var(--trust-authority)">srv</Badge>}
          <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.description}</span>
          <div style={{ flex: 1, minWidth: 8 }} />
          <span className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--text-3)", flexShrink: 0 }}>{s.runs} runs</span>
          <span className="mono zs-hide-narrow" style={{ fontSize: "var(--fs-xs)", color: "var(--text-3)", flexShrink: 0, width: 64, textAlign: "right" }}>{s.last_run ? timeAgo(s.last_run, NOW) + " ago" : "—"}</span>
        </div>
      ))}
    </>
  );
}

const treeBtnStyle = { background: "transparent", border: "none", color: "var(--text-2)", fontSize: "var(--fs-xs)", fontWeight: 600, cursor: "pointer", padding: "2px 4px" } as const;

function TreeView({ scripts, t }: { scripts: ScriptEntry[]; t: (k: string) => string }) {
  const root = useMemo(() => buildTree(scripts), [scripts]);
  const folders = useMemo(() => allFolders(scripts), [scripts]);
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    try { const s = JSON.parse(localStorage.getItem("zs_tree_open") ?? "null"); if (s) return s as Record<string, boolean>; } catch {}
    const init: Record<string, boolean> = {};
    folders.forEach((f) => (init[f] = true));
    return init;
  });

  const toggle = (path: string) => setOpen((o) => {
    const n = { ...o, [path]: !o[path] };
    localStorage.setItem("zs_tree_open", JSON.stringify(n));
    return n;
  });

  const expandAll = (v: boolean) => {
    const n: Record<string, boolean> = {};
    folders.forEach((f) => (n[f] = v));
    localStorage.setItem("zs_tree_open", JSON.stringify(n));
    setOpen(n);
  };

  return (
    <div className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)]" style={{ background: "var(--bg-1)" }}>
      <div className="flex items-center border-b border-[var(--border)]" style={{ gap: 8, padding: "8px 12px", background: "var(--bg-2)" }}>
        <Icon name="database" size={13} style={{ color: "var(--text-2)" }} />
        <span className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--text-1)" }}>library</span>
        <div className="flex-1" />
        <button onClick={() => expandAll(true)} style={treeBtnStyle}>{t("scripts.expand_all")}</button>
        <button onClick={() => expandAll(false)} style={treeBtnStyle}>{t("scripts.collapse_all")}</button>
      </div>
      <div style={{ padding: "6px 0" }}>
        <TreeNodes node={root} depth={0} open={open} toggle={toggle} />
      </div>
    </div>
  );
}

// ── Main Scripts page ──

export function Scripts({ role }: { role: string }) {
  const [view, setView] = useState("tree");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const { data } = useApi<{ scripts: ScriptEntry[] }>("/scripts");
  const scripts = data?.scripts ?? [];
  const filtered = q ? scripts.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())) : scripts;
  const limit = view === "cards" ? 9 : 10;
  const page = filtered.slice(offset, offset + limit);
  const canCreate = role === "architect" || role === "admin";
  const folders = useMemo(() => allFolders(scripts), [scripts]);
  const t = useT();

  const columns: Column<ScriptEntry>[] = [
    { key: "name", label: "Path", mono: true, sortable: true, sortVal: (r) => r.name, render: (r) => <PathLabel name={r.name} size="var(--fs-sm)" /> },
    { key: "srv", label: "Server", sortable: true, sortVal: (r) => r.hasSrv ? 1 : 0, render: (r) => r.hasSrv ? <Badge color="var(--trust-authority)">srv</Badge> : <span style={{ color: "var(--text-3)" }}>—</span> },
    { key: "description", label: "Description", muted: true, maxWidth: 300, render: (r) => r.description ?? "" },
    { key: "runs", label: "Runs", align: "right", mono: true, sortable: true, sortVal: (r) => r.runs, render: (r) => r.runs },
    { key: "last", label: "Last run", align: "right", mono: true, muted: true, sortable: true, sortVal: (r) => r.last_run ?? 0, render: (r) => r.last_run ? timeAgo(r.last_run, NOW) + " ago" : "—" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between" style={{ gap: 16, marginBottom: "var(--gap)" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "var(--fs-h1)", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-0)" }}>{t("scripts.title")}</h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>{t("scripts.subtitle", { count: scripts.length, folders: folders.length })}</p>
        </div>
        <div className="flex items-center" style={{ gap: 8 }}>
          <Segmented value={view} onChange={(v) => { setView(v); setOffset(0); }} options={[{ value: "tree", label: t("scripts.tree") }, { value: "cards", label: t("scripts.cards") }, { value: "table", label: t("scripts.table") }]} />
          {canCreate && <Button variant="primary" icon="plus" onClick={() => navigate("/scripts/new")}>{t("scripts.new")}</Button>}
        </div>
      </div>

      {(view === "cards" || view === "table") && (
        <div style={{ marginBottom: "var(--gap)", maxWidth: 320 }}>
          <Input value={q} onChange={(v) => { setQ(v); setOffset(0); }} placeholder={t("scripts.filter")} icon="search" mono />
        </div>
      )}

      {view === "tree" ? <TreeView scripts={scripts} t={t as (k: string) => string} />
        : view === "cards" ? (
          <>
            <div className="grid gap-[var(--gap)]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
              {page.map((s) => (
                <Card key={s.name} hover onClick={() => navigate("/scripts/" + s.name)} style={{ padding: 18 }}>
                  <div className="flex items-start" style={{ gap: 10 }}>
                    <div className="grid shrink-0 place-items-center rounded-[9px] border border-[var(--border)]" style={{ width: 34, height: 34, background: "var(--bg-2)", color: "var(--text-1)" }}>
                      <Icon name="filecode" size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mono" style={{ fontSize: 14, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {dirOf(s.name) && <span style={{ color: "var(--text-3)" }}>{dirOf(s.name)}/</span>}
                        <span style={{ fontWeight: 700 }}>{baseName(s.name)}</span>
                      </div>
                      {s.description && <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-2)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.description}</div>}
                    </div>
                    {s.hasSrv && <Badge color="var(--trust-authority)">srv</Badge>}
                  </div>
                  <div className="flex" style={{ gap: 18, marginTop: 16, fontSize: "var(--fs-sm)" }}>
                    <div><div className="mono" style={{ fontWeight: 700, fontSize: 16 }}>{s.runs}</div><div style={{ color: "var(--text-2)", fontSize: "var(--fs-xs)" }}>runs</div></div>
                    <div><div className="mono" style={{ fontWeight: 700, fontSize: 16 }}>{s.last_run ? timeAgo(s.last_run, NOW) : "—"}</div><div style={{ color: "var(--text-2)", fontSize: "var(--fs-xs)" }}>last run</div></div>
                  </div>
                </Card>
              ))}
            </div>
            {filtered.length > limit && <div style={{ marginTop: 14 }}><Pagination total={filtered.length} limit={limit} offset={offset} onChange={setOffset} /></div>}
          </>
        ) : (
          <>
            <DataTable rowKey={(r) => r.name} onRowClick={(r) => navigate("/scripts/" + r.name)} columns={columns} rows={page} />
            {filtered.length > limit && <div style={{ marginTop: 12 }}><Pagination total={filtered.length} limit={limit} offset={offset} onChange={setOffset} /></div>}
          </>
        )}
    </div>
  );
}

// Exported for use in New Script
export { allFolders };
