import { useState, useMemo } from "react";
import { Icon } from "../ui/icon";
import { Badge, StatusBadge } from "../ui/badge";
import { CoverageBar } from "../ui/coverage-bar";
import { Button } from "../ui/button";
import { Tabs } from "../ui/tabs";
import { DataTable, type Column } from "../ui/data-table";
import { DiffEditor } from "@monaco-editor/react";
import { ZsMonacoEditor, type EditorMarker } from "../ui/monaco-editor";
import { fmtDate } from "../ui/helpers";
import { navigate, useQueryParam } from "../router";
import { useApi } from "../api/hooks";
import { api } from "../api/client";
import { useT } from "../i18n/context";
import type { ScriptSource, TraceRow, Shape } from "../api/types";

function ScriptCrumb({ scriptRef }: { scriptRef: string }) {
  const segs = scriptRef.split("/");
  const dirs = segs.slice(0, -1);
  const base = segs[segs.length - 1]!;
  return (
    <div className="mb-3 flex flex-wrap items-center" style={{ gap: 7, fontSize: "var(--fs-sm)" }}>
      <a href="#/scripts" className="inline-flex items-center" style={{ gap: 6, color: "var(--text-2)", fontWeight: 600 }}>
        <Icon name="arrowLeft" size={14} /> Scripts
      </a>
      {dirs.map((d, i) => (
        <span key={i} className="flex items-center" style={{ gap: 7 }}>
          <Icon name="chevronRight" size={13} style={{ color: "var(--text-3)" }} />
          <span className="mono" style={{ color: "var(--text-2)", fontWeight: 600 }}>{d}</span>
        </span>
      ))}
      <Icon name="chevronRight" size={13} style={{ color: "var(--text-3)" }} />
      <span className="mono" style={{ color: "var(--text-0)", fontWeight: 700 }}>{base}</span>
    </div>
  );
}

function shapeToString(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "kind" in v) {
    const s = v as Shape;
    if (s.kind === "object" && s.fields) {
      return `{ ${Object.entries(s.fields).map(([k, fv]) => `${k}: ${shapeToString(fv)}`).join("; ")} }`;
    }
    return s.kind;
  }
  return String(v);
}

function ShapeView({ shape }: { shape: Shape }) {
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--border)]" style={{ background: "var(--bg-inset)", padding: 14 }}>
      <span className="mono" style={{ fontSize: "var(--fs-sm)", color: "var(--cc-k)" }}>{shape.kind}</span>
      {shape.fields && (
        <div className="mt-2 flex flex-col" style={{ gap: 4 }}>
          {Object.entries(shape.fields).map(([k, v]) => (
            <div key={k} className="mono flex" style={{ fontSize: "var(--fs-code)", gap: 6 }}>
              <span style={{ color: "var(--cc-key)" }}>{k}</span>
              <span style={{ color: "var(--text-3)" }}>:</span>
              <span style={{ color: "var(--cc-t)" }}>{shapeToString(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function DiffView({ oldText, newText, file, theme }: { oldText: string; newText: string; file: string; theme: "dark" | "light" }) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)]" style={{ background: "var(--bg-inset)", minHeight: 200 }}>
      <div className="flex shrink-0 items-center border-b border-[var(--border)]" style={{ gap: 8, padding: "8px 14px", background: "var(--bg-2)" }}>
        <Icon name="copy" size={13} style={{ color: "var(--text-2)" }} />
        <span className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--text-1)" }}>{file}</span>
        <span className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--text-3)" }}>saved ↔ working</span>
      </div>
      <DiffEditor
        original={oldText}
        modified={newText}
        language="typescript"
        theme={theme === "dark" ? "vs-dark" : "vs"}
        options={{ readOnly: true, minimap: { enabled: false }, renderSideBySide: true, scrollBeyondLastLine: false, fontSize: 13, lineNumbers: "on" }}
        height="100%"
      />
    </div>
  );
}

function ValidationBar({ v }: { v: { ok: boolean; errors: { code: string; message: string; line: number }[]; warnings: { code: string; message: string; line: number }[]; savedMsg?: boolean } }) {
  const hasErr = v.errors.length > 0;
  const hasWarn = v.warnings.length > 0;
  return (
    <div className="mt-3 overflow-hidden rounded-[var(--r-md)] border border-[var(--border)]" style={{ background: "var(--bg-1)" }}>
      <div className="flex items-center" style={{ gap: 8, padding: "9px 14px", fontSize: "var(--fs-sm)", fontWeight: 600, color: hasErr ? "var(--trust-error)" : hasWarn ? "var(--st-halted)" : "var(--st-done)" }}>
        <Icon name={hasErr ? "x" : hasWarn ? "alert" : "check"} size={15} />
        {v.savedMsg ? "Saved · validated, no errors" : hasErr ? `${v.errors.length} error(s)` : hasWarn ? `No errors · ${v.warnings.length} warning(s)` : "No errors"}
      </div>
      {(hasErr || hasWarn) && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {[...v.errors.map((e) => ({ ...e, t: "error" as const })), ...v.warnings.map((w) => ({ ...w, t: "warn" as const }))].map((it, i) => (
            <div key={i} className="flex items-center border-b border-[var(--border)]" style={{ gap: 10, padding: "8px 14px", fontSize: "var(--fs-sm)" }}>
              <span className="mono" style={{ color: it.t === "error" ? "var(--trust-error)" : "var(--st-halted)", fontWeight: 600 }}>{it.code}</span>
              <span style={{ color: "var(--text-1)" }}>{it.message}</span>
              <div className="flex-1" />
              <span className="mono" style={{ color: "var(--text-3)", fontSize: "var(--fs-xs)" }}>line {it.line}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// runsColumns moved inside component for i18n

export function ScriptDetailPage({ scriptRef, role, theme }: { scriptRef: string; role: string; theme: "dark" | "light" }) {
  const { data: script, loading } = useApi<ScriptSource>(`/scripts/${scriptRef}`, [scriptRef]);
  const { data: runsData } = useApi<{ traces: TraceRow[] }>(`/traces?script_ref=${scriptRef}&limit=40`, [scriptRef]);
  const [tab, setTab] = useQueryParam("tab", "cognitive");
  const [cog, setCog] = useState("");
  const [srv, setSrv] = useState("");
  const [inited, setInited] = useState(false);
  const [validation, setValidation] = useState<null | { ok: boolean; errors: { code: string; message: string; line: number }[]; warnings: { code: string; message: string; line: number }[]; savedMsg?: boolean }>(null);
  const [markers, setMarkers] = useState<EditorMarker[]>([]);
  const [diff, setDiff] = useState(false);

  if (script && !inited) {
    setCog(script.cog);
    setSrv(script.srv ?? "");
    setInited(true);
  }

  const t = useT();
  const runsColsMemo = useMemo((): Column<TraceRow>[] => [
    { key: "id", label: t("col.invocation"), mono: true, maxWidth: 240, sortable: true, sortVal: (r) => r.invocation_id, render: (r) => <span style={{ color: "var(--accent)" }}>{r.invocation_id}</span> },
    { key: "status", label: t("col.status"), sortable: true, sortVal: (r) => r.status, render: (r) => <StatusBadge status={r.status} /> },
    { key: "coverage", label: t("col.coverage"), width: 170, sortable: true, sortVal: (r) => r.coverage?.verified ?? 0, render: (r) => r.coverage ? <CoverageBar coverage={r.coverage} /> : <span style={{ color: "var(--text-3)" }}>—</span> },
    { key: "when", label: t("col.started"), align: "right", mono: true, muted: true, sortable: true, sortVal: (r) => r.created_at, render: (r) => fmtDate(r.created_at) },
  ], [t]);

  if (loading) return <div style={{ padding: "56px 24px", textAlign: "center", color: "var(--text-2)" }}>{t("scripts.loading")}</div>;
  if (!script) return (
    <div className="flex flex-col items-center justify-center" style={{ padding: "56px 24px", color: "var(--text-2)" }}>
      <Icon name="alert" size={28} style={{ color: "var(--text-3)" }} />
      <div style={{ fontWeight: 600, color: "var(--text-1)", marginTop: 10 }}>{t("scripts.not_found")}</div>
      <div className="mono" style={{ fontSize: "var(--fs-sm)", marginTop: 4 }}>{scriptRef}</div>
    </div>
  );

  const hasSrv = !!script.srv;
  const dirtyCog = cog !== script.cog;
  const dirtySrv = hasSrv && srv !== script.srv;
  const canEdit = role === "architect" || role === "admin";

  const doValidate = async () => {
    try {
      const result = await api.post<{ ok: boolean; errors: { code: string; message: string; file: string; line: number }[]; warnings: { code: string; message: string; file: string; line: number }[] }>(`/scripts/${scriptRef}/validate`, { cog: [{ name: `${scriptRef}.cog.ts`, content: cog }], srv: hasSrv ? [{ name: `${scriptRef}.srv.ts`, content: srv }] : [] });
      const errors = result.errors.map((e) => ({ code: e.code, message: e.message, line: e.line }));
      const warnings = result.warnings.map((w) => ({ code: w.code, message: w.message, line: w.line }));
      setValidation({ ok: result.ok, errors, warnings });
      setMarkers([
        ...errors.map((e) => ({ line: e.line, message: `${e.code}: ${e.message}`, severity: "error" as const })),
        ...warnings.map((w) => ({ line: w.line, message: `${w.code}: ${w.message}`, severity: "warning" as const })),
      ]);
    } catch (e) {
      setValidation({ ok: false, errors: [{ code: "NETWORK", message: (e as Error).message, line: 1 }], warnings: [] });
    }
  };

  const doSave = async () => {
    try {
      await api.put(`/scripts/${scriptRef}`, { script_ref: scriptRef, cog: [{ name: `${scriptRef}.cog.ts`, content: cog }], srv: hasSrv ? [{ name: `${scriptRef}.srv.ts`, content: srv }] : [] });
      setValidation({ ok: true, errors: [], warnings: [], savedMsg: true });
      setMarkers([]);
    } catch (e) {
      setValidation({ ok: false, errors: [{ code: "SAVE_FAILED", message: (e as Error).message, line: 1 }], warnings: [] });
    }
  };

  const tabs = [
    { id: "cognitive", label: t("new_script.cognitive"), dot: dirtyCog },
    ...(hasSrv ? [{ id: "server", label: t("new_script.server"), dot: dirtySrv }] : []),
    { id: "contract", label: "Contract" },
    { id: "runs", label: t("scripts.runs") },
  ];
  const isEditor = tab === "cognitive" || tab === "server";

  const scriptBase = scriptRef.split("/").pop()!;

  return (
    <div className="flex flex-1 flex-col" style={{ minHeight: 0 }}>
      <ScriptCrumb scriptRef={scriptRef} />
      <div className="mb-4 flex items-center" style={{ gap: 12 }}>
        <Icon name="filecode" size={20} style={{ color: "var(--text-1)" }} />
        <h1 className="mono" style={{ margin: 0, fontSize: "var(--fs-h1)", fontWeight: 700 }}>{scriptBase}</h1>
        {hasSrv && <Badge color="var(--trust-authority)">has srv</Badge>}
        <div className="flex-1" />
        <Badge color="var(--accent)">role: {role}</Badge>
      </div>

      <div className="flex flex-wrap items-end justify-between" style={{ gap: 12 }}>
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
        {isEditor && (canEdit ? (
          <div className="flex items-center" style={{ gap: 8, paddingBottom: 6 }}>
            {(dirtyCog || dirtySrv) && <span style={{ fontSize: "var(--fs-xs)", color: "var(--st-halted)", fontWeight: 600 }}>● {t("common.unsaved")}</span>}
            {(dirtyCog || dirtySrv) && <Button variant="ghost" size="sm" icon="copy" active={diff} onClick={() => setDiff((d) => !d)}>Diff</Button>}
            <Button variant="outline" size="sm" icon="check" onClick={doValidate}>{t("common.validate")}</Button>
            <Button variant="primary" size="sm" icon="save" disabled={!(dirtyCog || dirtySrv)} onClick={doSave}>{t("common.save")}</Button>
          </div>
        ) : (
          <div className="inline-flex items-center" style={{ gap: 6, paddingBottom: 8, fontSize: "var(--fs-xs)", color: "var(--text-2)", fontWeight: 600 }}>
            <Icon name="alert" size={13} /> {t("common.read_only")} · {role}
          </div>
        ))}
      </div>

      <div className="mt-3.5 flex flex-1 flex-col" style={{ minHeight: 320 }}>
        {tab === "cognitive" && (diff && canEdit
          ? <DiffView oldText={script.cog} newText={cog} file={`${scriptRef}.cog.ts`} theme={theme} />
          : <ZsMonacoEditor value={cog} readOnly={!canEdit} onChange={(v) => { setCog(v); setValidation(null); setMarkers([]); }} file={`${scriptRef}.cog.ts`} theme={theme} markers={tab === "cognitive" ? markers : []} />)}
        {tab === "server" && (diff && canEdit
          ? <DiffView oldText={script.srv ?? ""} newText={srv} file={`${scriptRef}.srv.ts`} theme={theme} />
          : <ZsMonacoEditor value={srv} readOnly={!canEdit} onChange={(v) => { setSrv(v); setValidation(null); setMarkers([]); }} file={`${scriptRef}.srv.ts`} theme={theme} markers={tab === "server" ? markers : []} />)}
        {tab === "contract" && (
          <div className="flex flex-col rounded-[var(--r-lg)] border border-[var(--border)]" style={{ background: "var(--bg-1)", padding: "var(--pad)", gap: 20 }}>
            <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              <div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Server functions</div>
                <span className="mono" style={{ fontSize: "var(--fs-sm)", color: "var(--text-0)" }}>
                  {script.serverFunctions?.length ? script.serverFunctions.join(", ") : "(none — lifecycle only)"}
                </span>
              </div>
            </div>
            {script.concludeShape && (
              <div>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>concludeShape</div>
                <ShapeView shape={script.concludeShape} />
              </div>
            )}
            {script.checkpointShapes && Object.entries(script.checkpointShapes).map(([name, shape]) => (
              <div key={name}>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>checkpointShape · <span className="mono">{name}</span></div>
                <ShapeView shape={shape} />
              </div>
            ))}
            {!script.concludeShape && !script.checkpointShapes && (
              <div className="mono" style={{ fontSize: "var(--fs-sm)", color: "var(--text-3)" }}>No shapes extracted. Run Validate to analyze.</div>
            )}
          </div>
        )}
        {tab === "runs" && (
          <DataTable rowKey={(r) => r.invocation_id} onRowClick={(r) => navigate("/traces/" + r.invocation_id)}
            columns={runsColsMemo} rows={runsData?.traces ?? []} />
        )}
      </div>

      {isEditor && canEdit && validation && <ValidationBar v={validation} />}
    </div>
  );
}
