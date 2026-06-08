import { StrictMode, useState, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { useApp, type App } from "@modelcontextprotocol/ext-apps/react";
import { useHostStyles } from "@modelcontextprotocol/ext-apps/react";
import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import "highlight.js/styles/github-dark.min.css";

hljs.registerLanguage("typescript", typescript);

interface TraceEvent {
  seq: number;
  t: string;
  op: string;
  realizer: string;
  trust: string;
  inputs: string[];
  output?: string;
  preview?: string;
  meta?: Record<string, unknown>;
}

interface Coverage {
  verified: number;
  asserted: number;
  authority_gates: number;
  grounded_claims?: number;
  asserted_claims?: number;
  final_result_trust?: string | null;
}

interface DashboardData {
  ok?: boolean;
  status?: string;
  coverage?: Coverage;
  trace_ref?: string;
  _trace?: { events: TraceEvent[]; script_ref: string; code_snapshot: string };
  _input?: { invocation_id?: string; result?: unknown };
}

const T = {
  text1: "var(--color-text-primary, #1e293b)",
  text2: "var(--color-text-secondary, #475569)",
  text3: "var(--color-text-tertiary, #64748b)",
  textGhost: "var(--color-text-ghost, #94a3b8)",
  bg1: "var(--color-background-primary, #fff)",
  bg2: "var(--color-background-secondary, #f8fafc)",
  bg3: "var(--color-background-tertiary, #f1f5f9)",
  border: "var(--color-border-primary, #e2e8f0)",
  sans: "var(--font-sans, system-ui, sans-serif)",
  mono: "var(--font-mono, monospace)",
};

const OP_ICONS: Record<string, string> = {
  start: "▶", conclude: "✓", status_transition: "↻",
  survey: "🔍", doubt: "⚡", commit: "📋", check: "✅",
  synthesize: "🔗", checkpoint: "🚦", report: "📝",
  act: "↗", ask_user: "👤", retrieve: "📡", sandbox: "⚙️",
};

const TRUST_COLORS: Record<string, string> = {
  verified: "#22c55e", asserted: "#f59e0b", authority: "#3b82f6", "n/a": "#94a3b8",
};

/* ── Shared components ── */

function Donut({ verified, asserted, size = 60 }: { verified: number; asserted: number; size?: number }) {
  const total = verified + asserted || 1;
  const pct = Math.round((verified / total) * 100);
  const r = size * 0.4, c = 2 * Math.PI * r, h = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={h} cy={h} r={r} fill="none" stroke="#f59e0b33" strokeWidth={size * 0.13} />
      <circle cx={h} cy={h} r={r} fill="none" stroke="#22c55e" strokeWidth={size * 0.13}
        strokeDasharray={`${c * pct / 100} ${c}`} transform={`rotate(-90 ${h} ${h})`}
        style={{ transition: "stroke-dasharray .4s" }} />
      <text x={h} y={h} textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: size * 0.2, fontWeight: 700, fill: T.text1, fontFamily: T.mono }}>{pct}%</text>
    </svg>
  );
}

function TrustBadge({ trust }: { trust: string }) {
  const c = TRUST_COLORS[trust] ?? TRUST_COLORS.asserted;
  return <span style={{ padding: "1px 5px", borderRadius: 3, fontSize: 9, fontWeight: 600, background: c + "22", color: c }}>{trust}</span>;
}

function StatusBadge({ ok, status }: { ok?: boolean; status?: string }) {
  const good = ok !== false;
  return (
    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: good ? "#22c55e22" : "#ef444422", color: good ? "#16a34a" : "#dc2626" }}>
      {status ?? (good ? "done" : "error")}
    </span>
  );
}

function CoverageSummary({ coverage, events, compact }: { coverage?: Coverage; events?: TraceEvent[]; compact?: boolean }) {
  if (!coverage && !events) return null;
  const vCount = events?.filter(e => e.trust === "verified").length ?? 0;
  const aCount = events?.filter(e => e.trust === "asserted").length ?? 0;
  const gap = compact ? 10 : 14, pad = compact ? 8 : 12, fs = compact ? 10 : 11, ds = compact ? 52 : 60;
  return (
    <div style={{ display: "flex", alignItems: "center", gap, padding: pad, background: T.bg2, borderRadius: 8, border: `1px solid ${T.border}` }}>
      <Donut verified={vCount} asserted={aCount} size={ds} />
      <div style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: fs }}>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#22c55e", marginRight: 4 }} />verified <strong>{vCount}</strong></span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#f59e0b", marginRight: 4 }} />asserted <strong>{aCount}</strong></span>
        {coverage?.authority_gates != null && coverage.authority_gates > 0 && (
          <span style={{ color: "#3b82f6" }}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#3b82f6", marginRight: 4 }} />authority <strong>{coverage.authority_gates}</strong></span>
        )}
        {events && <span style={{ color: T.textGhost }}>{events.length} events</span>}
      </div>
    </div>
  );
}

function ResultField({ k, v }: { k: string; v: unknown }) {
  const text = typeof v === "string" ? v : JSON.stringify(v);
  const long = text.length > 120;
  const [open, setOpen] = useState(!long);
  return (
    <div style={{ fontSize: 12, display: "flex", gap: 6 }}>
      <span style={{ fontWeight: 600, color: T.text2, minWidth: 80, flexShrink: 0 }}>{k}</span>
      <span style={{ fontFamily: T.mono, color: T.text1, wordBreak: "break-word", cursor: long ? "pointer" : "default" }}
        onClick={long ? () => setOpen(o => !o) : undefined}>
        {open ? text : text.slice(0, 117) + "…"}
      </span>
    </div>
  );
}

function ResultFields({ result }: { result: unknown }) {
  if (result == null) return null;
  if (typeof result !== "object") return <span style={{ fontFamily: T.mono, fontSize: 12 }}>{String(result)}</span>;
  const entries = Object.entries(result as Record<string, unknown>);
  if (entries.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {entries.map(([k, v]) => <ResultField key={k} k={k} v={v} />)}
    </div>
  );
}

/* ── Structured detail cards ── */

const FIELD_STYLE = { fontSize: 11, display: "flex" as const, gap: 6, marginBottom: 3 };
const LABEL_STYLE = { fontWeight: 600, color: T.text2, minWidth: 70, flexShrink: 0 };
const VALUE_STYLE = { color: T.text1, wordBreak: "break-word" as const };

function CommitCard({ meta }: { meta: Record<string, unknown> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {(["what", "basis", "verify", "boundaries"] as const).map(k => meta[k] != null && (
        <div key={k} style={FIELD_STYLE}><span style={LABEL_STYLE}>{k}</span><span style={VALUE_STYLE}>{String(meta[k])}</span></div>
      ))}
    </div>
  );
}

function CheckCard({ meta }: { meta: Record<string, unknown> }) {
  const results = meta.results;
  const items = Array.isArray(results) ? results : typeof results === "object" && results ? [results] : [];
  return (
    <div>
      <div style={FIELD_STYLE}><span style={LABEL_STYLE}>commit</span><span style={{ ...VALUE_STYLE, fontFamily: T.mono }}>seq #{String(meta.commit_seq)}</span></div>
      {items.map((r: unknown, i: number) => {
        const obj = r as Record<string, unknown>;
        const pass = obj.pass === true || obj.result === "pass" || obj.ok === true;
        return (
          <div key={i} style={{ ...FIELD_STYLE, alignItems: "center" }}>
            <span style={{ padding: "1px 5px", borderRadius: 3, fontSize: 9, fontWeight: 600, background: pass ? "#22c55e22" : "#ef444422", color: pass ? "#16a34a" : "#dc2626" }}>
              {pass ? "PASS" : "FAIL"}
            </span>
            <span style={VALUE_STYLE}>{obj.label ? String(obj.label) : JSON.stringify(r)}</span>
          </div>
        );
      })}
    </div>
  );
}

function CheckpointCard({ meta }: { meta: Record<string, unknown> }) {
  const dir = meta.directive;
  const dirStr = typeof dir === "string" ? dir : typeof dir === "object" && dir ? JSON.stringify(dir) : "";
  const colors: Record<string, { bg: string; fg: string }> = {
    proceed: { bg: "#22c55e22", fg: "#16a34a" },
    warn: { bg: "#f59e0b22", fg: "#d97706" },
    halt: { bg: "#ef444422", fg: "#dc2626" },
  };
  const c = colors[typeof dir === "string" ? dir : ""] ?? { bg: "#64748b22", fg: "#64748b" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {meta.label && <span style={VALUE_STYLE}>{String(meta.label)}</span>}
      <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: c.bg, color: c.fg }}>{dirStr}</span>
    </div>
  );
}

function ReportCard({ ev }: { ev: TraceEvent }) {
  const label = ev.meta?.label as string | undefined;
  return (
    <div>
      {label && <span style={{ padding: "1px 6px", borderRadius: 3, fontSize: 10, fontWeight: 600, background: "#8b5cf622", color: "#7c3aed" }}>{label}</span>}
      {ev.preview && <div style={{ marginTop: 3, ...VALUE_STYLE, fontSize: 11 }}>{ev.preview}</div>}
    </div>
  );
}

function SandboxCard({ ev }: { ev: TraceEvent }) {
  return (
    <div>
      <span style={{ fontFamily: T.mono, fontWeight: 600, color: "#8b5cf6", fontSize: 11 }}>{ev.op}()</span>
      {ev.preview && <div style={{ marginTop: 3, ...VALUE_STYLE, fontSize: 11 }}>{ev.preview}</div>}
      {ev.meta?.provenance && <div style={{ fontSize: 10, color: T.textGhost, marginTop: 2 }}>provenance: {String(ev.meta.provenance)}</div>}
    </div>
  );
}

function RetrieveCard({ meta }: { meta: Record<string, unknown> }) {
  return (
    <div>
      {meta.query && <div style={FIELD_STYLE}><span style={LABEL_STYLE}>query</span><span style={VALUE_STYLE}>{String(meta.query)}</span></div>}
      {meta.provenance && <div style={FIELD_STYLE}><span style={LABEL_STYLE}>provenance</span><span style={VALUE_STYLE}>{String(meta.provenance)}</span></div>}
      {meta.source && <div style={FIELD_STYLE}><span style={LABEL_STYLE}>source</span><span style={VALUE_STYLE}>{String(meta.source)}</span></div>}
    </div>
  );
}

function EventDetail({ ev }: { ev: TraceEvent }) {
  const m = ev.meta ?? {};
  if (ev.op === "commit") return <CommitCard meta={m} />;
  if (ev.op === "check") return <CheckCard meta={m} />;
  if (ev.op === "checkpoint") return <CheckpointCard meta={m} />;
  if (ev.op === "report") return <ReportCard ev={ev} />;
  if (ev.op === "retrieve") return <RetrieveCard meta={m} />;
  if (ev.realizer === "sandbox") return <SandboxCard ev={ev} />;
  if (!ev.preview && (!ev.meta || Object.keys(ev.meta).length === 0)) return null;
  return (
    <>
      {ev.preview && <div style={{ marginBottom: 4, fontSize: 11 }}>{ev.preview}</div>}
      {ev.meta && Object.keys(ev.meta).length > 0 && (
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 10, color: T.text3 }}>{JSON.stringify(ev.meta, null, 2)}</pre>
      )}
    </>
  );
}

/* ── Event row (fullscreen) ── */

function EventRow({ ev, open, onToggle }: { ev: TraceEvent; open: boolean; onToggle: () => void }) {
  const icon = ev.realizer === "sandbox" ? "⚙️" : (OP_ICONS[ev.op] ?? "•");
  return (
    <div style={{ marginBottom: 3 }}>
      <div onClick={onToggle} style={{
        display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", cursor: "pointer",
        borderRadius: 6, border: `1px solid ${T.border}`, background: T.bg1,
      }}>
        <span style={{ fontSize: 10, fontFamily: T.mono, color: T.textGhost, width: 22, textAlign: "right" }}>#{ev.seq}</span>
        <span style={{ fontSize: 13, width: 18, textAlign: "center" }}>{icon}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: T.text1, fontFamily: T.mono, flex: 1 }}>{ev.op}</span>
        {ev.preview && <span style={{ fontSize: 11, color: T.text3, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.preview}</span>}
        <TrustBadge trust={ev.trust} />
        <span style={{ fontSize: 10, color: T.textGhost, fontFamily: T.mono }}>{new Date(ev.t).toLocaleTimeString()}</span>
      </div>
      {open && (
        <div style={{ padding: "8px 10px 8px 52px", fontSize: 11, color: T.text2, background: T.bg2, borderRadius: "0 0 6px 6px", border: `1px solid ${T.border}`, borderTopWidth: 0 }}>
          <EventDetail ev={ev} />
          <div style={{ fontSize: 10, color: T.textGhost, marginTop: 4 }}>
            realizer: {ev.realizer} · inputs: [{ev.inputs.join(", ")}]{ev.output ? ` · output: ${ev.output}` : ""}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Code panel ── */

function CodePanel({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const html = useMemo(() => hljs.highlight(code, { language: "typescript" }).value, [code]);
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 6, overflow: "hidden" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", padding: "8px 12px", border: "none", cursor: "pointer",
        background: T.bg3, fontSize: 12, fontWeight: 600, color: T.text2,
        display: "flex", alignItems: "center", gap: 6, textAlign: "left",
      }}>
        <span>{open ? "▼" : "▶"}</span> Source Code
      </button>
      {open && (
        <pre className="hljs" style={{
          margin: 0, padding: 12,
          fontSize: 11, fontFamily: `'Fira Code', 'JetBrains Mono', ${T.mono}`,
          whiteSpace: "pre-wrap", maxHeight: 400, overflow: "auto", lineHeight: 1.5,
        }}>
          <code dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
      )}
    </div>
  );
}

/* ── Inline view ── */

function InlineView({ data, onExpand }: { data: DashboardData; onExpand?: () => void }) {
  const trace = data._trace;
  const result = data._input?.result;
  const cov = data.coverage;
  return (
    <div style={{ fontFamily: T.sans, padding: 14, maxWidth: 480, lineHeight: 1.5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>🏁</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text1 }}>{trace?.script_ref ?? "Conclude"}</div>
          {data._input?.invocation_id && <div style={{ fontSize: 10, fontFamily: T.mono, color: T.textGhost }}>{data._input.invocation_id}</div>}
        </div>
        <StatusBadge ok={data.ok} status={data.status} />
        {cov?.final_result_trust && <TrustBadge trust={cov.final_result_trust} />}
      </div>
      <div style={{ marginBottom: 12 }}>
        <CoverageSummary coverage={cov} events={trace?.events} compact />
      </div>
      {result && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: T.text3, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Result</div>
          <div style={{ padding: 8, background: T.bg2, borderRadius: 6, border: `1px solid ${T.border}` }}><ResultFields result={result} /></div>
        </div>
      )}
      {onExpand && (
        <button onClick={onExpand} style={{
          width: "100%", padding: "6px 0", border: `1px solid ${T.border}`, borderRadius: 6,
          background: T.bg1, cursor: "pointer", fontSize: 11, fontWeight: 600,
          color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
        }}>
          ⛶ Full Dashboard
        </button>
      )}
    </div>
  );
}

/* ── Fullscreen view ── */

function FullscreenView({ data, onCollapse }: { data: DashboardData; onCollapse?: () => void }) {
  const trace = data._trace;
  const result = data._input?.result;
  const cov = data.coverage;
  const events = trace?.events ?? [];
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  return (
    <div style={{ fontFamily: T.sans, padding: 20, maxWidth: 720, margin: "0 auto", lineHeight: 1.5, color: T.text1 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 22 }}>📜</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{trace?.script_ref ?? data.trace_ref ?? "Script"}</div>
          {data._input?.invocation_id && <div style={{ fontSize: 11, fontFamily: T.mono, color: T.textGhost }}>{data._input.invocation_id}</div>}
        </div>
        <StatusBadge ok={data.ok} status={data.status} />
        {cov?.final_result_trust && <TrustBadge trust={cov.final_result_trust} />}
        {onCollapse && (
          <button onClick={onCollapse} style={{ padding: "4px 10px", border: `1px solid ${T.border}`, borderRadius: 4, background: T.bg1, cursor: "pointer", fontSize: 11, color: T.text3 }}>✕</button>
        )}
      </div>

      {/* Coverage */}
      <div style={{ marginBottom: 20 }}><CoverageSummary coverage={cov} events={events} /></div>

      {/* Result */}
      {result && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.text2, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Result</div>
          <div style={{ padding: 12, background: T.bg2, borderRadius: 8, border: `1px solid ${T.border}` }}><ResultFields result={result} /></div>
        </div>
      )}

      {/* Timeline */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.text2, textTransform: "uppercase", letterSpacing: "0.04em" }}>Events</span>
          <span style={{ fontSize: 11, color: T.textGhost }}>({events.length})</span>
        </div>
        <div style={{ maxHeight: 500, overflowY: "auto" }}>
          {events.map(ev => (
            <EventRow key={ev.seq} ev={ev} open={!!expanded[ev.seq]}
              onToggle={() => setExpanded(s => ({ ...s, [ev.seq]: !s[ev.seq] }))} />
          ))}
          {events.length === 0 && <div style={{ fontSize: 12, color: T.textGhost, padding: 10 }}>No events recorded</div>}
        </div>
      </div>

      {/* Code */}
      {trace?.code_snapshot && <CodePanel code={trace.code_snapshot} />}

      <div style={{ height: 80 }} />
    </div>
  );
}

/* ── Main ── */

function TraceDashboardApp() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [mode, setMode] = useState<string>("inline");

  const { app, error } = useApp({
    appInfo: { name: "ZS Dashboard", version: "1.0.0" },
    capabilities: { availableDisplayModes: ["inline", "fullscreen"] },
    onAppCreated: (a) => {
      a.ontoolresult = async (result) => {
        const text = result.content?.find((c: { type: string }) => c.type === "text");
        if (!text) return;
        try { setData(JSON.parse((text as { text: string }).text)); } catch {}
      };
      a.onhostcontextchanged = (ctx) => {
        if (ctx.displayMode) setMode(ctx.displayMode);
      };
    },
  });

  useHostStyles(app, app?.getHostContext());

  if (error) return <div style={{ padding: 12, color: "#ef4444", fontSize: 12 }}>Error: {error.message}</div>;
  if (!data) return <div style={{ padding: 12, color: T.textGhost, fontSize: 12 }}>Waiting for result...</div>;

  const canToggle = app?.getHostContext()?.availableDisplayModes?.includes("fullscreen");

  if (mode === "fullscreen") {
    return <FullscreenView data={data} onCollapse={canToggle ? () => { app?.requestDisplayMode({ mode: "inline" }); } : undefined} />;
  }
  return <InlineView data={data} onExpand={canToggle ? () => { app?.requestDisplayMode({ mode: "fullscreen" }); } : undefined} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><TraceDashboardApp /></StrictMode>,
);
