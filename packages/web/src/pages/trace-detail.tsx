import { useState, useRef, useEffect } from "react";
import { Icon } from "../ui/icon";
import { Badge, StatusBadge, TrustBadge } from "../ui/badge";
import { CoverageBar } from "../ui/coverage-bar";
import { CodeBlock, JsonView } from "../ui/code-block";
import { fmtDate, fmtDuration } from "../ui/helpers";
import { useApi } from "../api/hooks";
import { useT } from "../i18n/context";
import type { TraceDetail as TraceDetailType, TraceEvent } from "../api/types";

const OP_ICON: Record<string, string> = {
  start: "play", conclude: "check", status_transition: "refresh",
  survey: "search", doubt: "alert", commit: "check",
  synthesize: "zap", checkpoint: "play", report: "doc",
  invoke: "external", error: "x", ask_user: "users", act: "external",
};

const TRUST_COLORS: Record<string, string> = {
  asserted: "var(--trust-asserted)", verified: "var(--trust-verified)",
  authority: "var(--trust-authority)", error: "var(--trust-error)",
};

const DIRECTIVE_META: Record<string, { c: string }> = {
  proceed: { c: "var(--st-done)" }, halt: { c: "var(--st-halted)" }, ask: { c: "var(--st-running)" },
};

function EventRow({ ev, active, onHover, onLeave, expanded, onToggle }: {
  ev: TraceEvent; active: boolean; expanded: boolean;
  onHover: () => void; onLeave: () => void; onToggle: () => void;
}) {
  const trustColor = TRUST_COLORS[ev.trust] ?? TRUST_COLORS["asserted"]!;
  const isErr = ev.op === "error" || ev.trust === "error";
  return (
    <div onMouseEnter={onHover} onMouseLeave={onLeave} style={{ position: "relative", paddingLeft: 34 }}>
      <span style={{
        position: "absolute", left: 9, top: 14, width: 14, height: 14, borderRadius: 99,
        background: "var(--bg-0)", border: `2px solid ${isErr ? "var(--trust-error)" : trustColor}`,
        boxShadow: active ? `0 0 0 4px color-mix(in oklch, ${trustColor} 25%, transparent)` : "none",
        transition: "box-shadow .15s var(--ease)", zIndex: 2,
      }} />
      <div onClick={onToggle} style={{
        marginBottom: 8, border: "1px solid", cursor: "pointer", overflow: "hidden",
        borderRadius: "var(--r-md)", transition: "border-color .15s var(--ease), background .15s var(--ease)",
        borderColor: isErr ? "color-mix(in oklch, var(--trust-error) 45%, transparent)" : active ? "var(--border-2)" : "var(--border)",
        background: isErr ? "color-mix(in oklch, var(--trust-error) 8%, var(--bg-1))" : active ? "var(--bg-2)" : "var(--bg-1)",
      }}>
        <div className="flex items-center" style={{ gap: 9, padding: "9px 11px" }}>
          <span className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--text-3)", width: 22, flexShrink: 0 }}>#{ev.seq}</span>
          <Icon name={OP_ICON[ev.op] ?? "dot"} size={14} style={{ color: isErr ? "var(--trust-error)" : "var(--text-1)", flexShrink: 0 }} />
          <span className="mono" style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--text-0)" }}>{ev.op}</span>
          {ev.directive && <Badge color={DIRECTIVE_META[ev.directive]?.c ?? "var(--text-2)"}>→ {ev.directive}</Badge>}
          <div className="flex-1" />
          <TrustBadge trust={ev.trust} />
          <Icon name="chevronDown" size={13} style={{ color: "var(--text-3)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform .15s var(--ease)" }} />
        </div>
        <div className="flex items-center" style={{ padding: "0 11px 9px 42px", gap: 10 }}>
          <span style={{ fontSize: "var(--fs-sm)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, color: isErr ? "var(--trust-error)" : "var(--text-1)", fontWeight: isErr ? 600 : 400 }}>
            {isErr ? <span className="mono">{ev.kind}</span> : ev.preview}
          </span>
          {(ev.inputs.length > 0 || ev.output) && (
            <span className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--text-3)", whiteSpace: "nowrap" }}>
              {ev.inputs.length ? ev.inputs.join(", ") : "∅"} <span style={{ color: "var(--text-2)" }}>→</span> {ev.output ?? "∅"}
            </span>
          )}
          <span className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--text-3)", whiteSpace: "nowrap" }}>{new Date(ev.t).toLocaleTimeString("en-GB")}</span>
        </div>
        {expanded && (
          <div style={{ borderTop: "1px solid var(--border)", padding: 11, background: "var(--bg-inset)" }}>
            {isErr && (
              <div style={{ marginBottom: 10, padding: "8px 10px", borderRadius: "var(--r-sm)", background: "color-mix(in oklch, var(--trust-error) 12%, transparent)", color: "var(--trust-error)", fontSize: "var(--fs-sm)" }}>
                <b className="mono">{ev.kind}</b> — {ev.message}
              </div>
            )}
            <JsonView data={ev.detail ?? ev.meta ?? { preview: ev.preview }} />
            <div className="mono flex" style={{ gap: 16, marginTop: 10, fontSize: "var(--fs-xs)", color: "var(--text-3)" }}>
              <span>realizer: <span style={{ color: "var(--text-1)" }}>{ev.realizer}</span></span>
              {ev.line != null && <span>line: <span style={{ color: "var(--text-1)" }}>{ev.line}</span></span>}
              <span>{new Date(ev.t).toISOString()}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Donut({ verified, asserted }: { verified: number; asserted: number }) {
  const total = verified + asserted || 1;
  const vPct = verified / total;
  const r = 32;
  const c = 2 * Math.PI * r;
  return (
    <svg width="84" height="84" viewBox="0 0 84 84">
      <circle cx="42" cy="42" r={r} fill="none" stroke="var(--trust-asserted)" strokeWidth="14" />
      <circle cx="42" cy="42" r={r} fill="none" stroke="var(--trust-verified)" strokeWidth="14"
        strokeDasharray={`${c * vPct} ${c}`} strokeDashoffset={c * 0.25} transform="rotate(-90 42 42)"
        style={{ transition: "stroke-dasharray .4s var(--ease)" }} />
      <text x="42" y="42" textAnchor="middle" dominantBaseline="central" className="mono"
        style={{ fontSize: 15, fontWeight: 700, fill: "var(--text-0)" }}>{Math.round(vPct * 100)}%</text>
    </svg>
  );
}

function PanelHead({ icon, title, sub, action }: { icon: string; title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center" style={{ gap: 8, padding: "9px 14px", borderBottom: "1px solid var(--border)", background: "var(--bg-2)" }}>
      <Icon name={icon} size={14} style={{ color: "var(--text-2)" }} />
      <span className="mono" style={{ fontSize: "var(--fs-sm)", fontWeight: 600 }}>{title}</span>
      {sub && <span className="mono" style={{ fontSize: "var(--fs-xs)", color: "var(--text-3)" }}>{sub}</span>}
      <div className="flex-1" />
      {action}
    </div>
  );
}

export function TraceDetail({ id }: { id: string }) {
  const { data: trace, loading } = useApi<TraceDetailType>(`/traces/${id}`, [id]);
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [split, setSplit] = useState(50);
  const [covOpen, setCovOpen] = useState(true);
  const dragging = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current || !wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplit(Math.min(72, Math.max(28, pct)));
    };
    const up = () => { dragging.current = false; document.body.style.cursor = ""; document.body.style.userSelect = ""; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);

  const t = useT();
  if (loading) return <div style={{ padding: "56px 24px", textAlign: "center", color: "var(--text-2)" }}>{t("trace.loading")}</div>;
  if (!trace) return (
    <div className="flex flex-col items-center justify-center" style={{ padding: "56px 24px", color: "var(--text-2)" }}>
      <Icon name="alert" size={28} style={{ color: "var(--text-3)" }} />
      <div style={{ fontWeight: 600, color: "var(--text-1)", marginTop: 10 }}>{t("trace.not_found")}</div>
      <div className="mono" style={{ fontSize: "var(--fs-sm)", marginTop: 4 }}>{id}</div>
    </div>
  );

  const evs = trace.events ?? [];
  const vCount = evs.filter((e) => e.trust === "verified").length;
  const aCount = evs.filter((e) => e.trust === "asserted").length;
  const cov = trace.coverage ?? { verified: 0, asserted: 0, authority_gates: 0, grounded_claims: 0, asserted_claims: 0 };

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0">
        <a href="#/traces" className="mb-3 inline-flex items-center" style={{ gap: 6, fontSize: "var(--fs-sm)", color: "var(--text-2)", fontWeight: 600 }}>
          <Icon name="arrowLeft" size={14} /> {t("trace.back")}
        </a>
        <div className="flex flex-wrap items-start justify-between" style={{ gap: 16 }}>
          <div>
            <div className="flex flex-wrap items-center" style={{ gap: 10 }}>
              <h1 className="mono" style={{ margin: 0, fontSize: "var(--fs-h1)", fontWeight: 700, letterSpacing: "-0.01em" }}>{trace.invocation_id}</h1>
              <StatusBadge status={trace.status} />
            </div>
            <div className="flex flex-wrap items-center" style={{ gap: 14, marginTop: 8, fontSize: "var(--fs-sm)", color: "var(--text-2)" }}>
              <span>script <a href={"#/scripts/" + trace.script_ref} className="mono" style={{ color: "var(--accent)", fontWeight: 600 }}>{trace.script_ref}</a></span>
              <span style={{ color: "var(--border-2)" }}>·</span>
              <span className="mono">{fmtDate(trace.created_at ?? 0)}</span>
            </div>
          </div>
          <div style={{ minWidth: 200 }}>
            <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-2)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Coverage</div>
            <CoverageBar coverage={cov} width={200} />
          </div>
        </div>
      </div>

      <div ref={wrapRef} className="mt-4 flex flex-1 overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)]"
        style={{ minHeight: 380, background: "var(--bg-1)" }}>
        <div className="flex min-w-0 flex-col" style={{ width: split + "%" }}>
          <PanelHead icon="filecode" title={t("trace.code_snapshot")} sub={`${trace.script_ref}.cog.ts`} />
          <div className="flex-1 overflow-hidden">
            <CodeBlock code={trace.code_snapshot ?? ""} highlightLine={activeLine} />
          </div>
        </div>
        <div className="zs-divider shrink-0 relative"
          onMouseDown={() => { dragging.current = true; document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; }}
          style={{ width: 6, cursor: "col-resize", background: "var(--border)" }}>
          <div style={{ position: "absolute", inset: "0 -3px" }} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <PanelHead icon="activity" title={t("trace.events")} sub={t("trace.steps", { count: evs.length })}
            action={<button onClick={() => setExpanded(Object.fromEntries(evs.map((e) => [e.seq, !Object.values(expanded).some(Boolean)])))}
              style={{ background: "transparent", border: "none", color: "var(--text-2)", fontSize: "var(--fs-xs)", cursor: "pointer", fontWeight: 600 }}>
              {Object.values(expanded).some(Boolean) ? t("trace.collapse_all") : t("trace.expand_all")}</button>} />
          <div className="flex-1 overflow-auto" style={{ padding: "14px 14px 14px 4px" }}>
            <div className="relative">
              <span style={{ position: "absolute", left: 16, top: 6, bottom: 6, width: 2, background: "var(--border)" }} />
              {evs.map((ev) => (
                <EventRow key={ev.seq} ev={ev} active={activeLine === (ev.line ?? -1)}
                  onHover={() => ev.line != null && setActiveLine(ev.line)} onLeave={() => setActiveLine(null)}
                  expanded={!!expanded[ev.seq]} onToggle={() => setExpanded((s) => ({ ...s, [ev.seq]: !s[ev.seq] }))} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 shrink-0 overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)]" style={{ background: "var(--bg-1)" }}>
        <button onClick={() => setCovOpen((o) => !o)} className="flex w-full items-center border-none" style={{ gap: 9, padding: "11px 16px", background: "transparent", cursor: "pointer", color: "var(--text-0)" }}>
          <Icon name="pulse" size={15} style={{ color: "var(--text-2)" }} />
          <span style={{ fontWeight: 700, fontSize: 14 }}>{t("trace.coverage_summary")}</span>
          <div className="flex-1" />
          <Icon name="chevronDown" size={15} style={{ color: "var(--text-2)", transform: covOpen ? "none" : "rotate(-90deg)", transition: "transform .15s var(--ease)" }} />
        </button>
        {covOpen && (
          <div style={{ padding: "4px 16px 18px", borderTop: "1px solid var(--border)" }}>
            <div className="flex flex-wrap items-center pt-3.5" style={{ gap: 28 }}>
              <div className="flex items-center" style={{ gap: 16 }}>
                <Donut verified={vCount} asserted={aCount} />
                <div className="flex flex-col" style={{ gap: 8 }}>
                  {[{ label: t("trace.verified"), count: vCount, c: "var(--trust-verified)" }, { label: t("trace.asserted"), count: aCount, c: "var(--trust-asserted)" }].map((r) => (
                    <div key={r.label} className="flex items-center" style={{ gap: 8, fontSize: "var(--fs-sm)" }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: r.c }} />
                      <span style={{ width: 64, color: "var(--text-1)", fontWeight: 600 }}>{r.label}</span>
                      <span className="mono" style={{ color: "var(--text-0)" }}>{r.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid" style={{ gridTemplateColumns: "repeat(2, auto)", gap: "10px 28px" }}>
                {[{ label: t("trace.authority_gates"), value: cov.authority_gates }, { label: t("trace.grounded_claims"), value: cov.grounded_claims }, { label: t("trace.asserted_claims"), value: cov.asserted_claims }, { label: t("trace.total_events"), value: evs.length }].map((m) => (
                  <div key={m.label}>
                    <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: "var(--text-0)", lineHeight: 1 }}>{m.value}</div>
                    <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-2)", marginTop: 3 }}>{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
            {trace.result != null && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>{t("trace.result")}</div>
                <div className="rounded-[var(--r-md)] border border-[var(--border)]" style={{ background: "var(--bg-inset)", padding: 12 }}>
                  <JsonView data={trace.result} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
