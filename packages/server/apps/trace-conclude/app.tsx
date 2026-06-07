import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

interface ConcludeData {
  ok?: boolean;
  status?: string;
  coverage?: { verified: number; asserted: number; authority_gates: number; final_result_trust?: string | null };
}

interface ConcludeInput {
  invocation_id?: string;
  result?: unknown;
}

function Donut({ verified, asserted }: { verified: number; asserted: number }) {
  const total = verified + asserted || 1;
  const vPct = Math.round((verified / total) * 100);
  const r = 24;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width="60" height="60" viewBox="0 0 60 60">
        <circle cx="30" cy="30" r={r} fill="none" stroke="#f59e0b33" strokeWidth="8" />
        <circle cx="30" cy="30" r={r} fill="none" stroke="#22c55e" strokeWidth="8"
          strokeDasharray={`${c * (vPct / 100)} ${c}`} transform="rotate(-90 30 30)"
          style={{ transition: "stroke-dasharray .4s" }} />
        <text x="30" y="30" textAnchor="middle" dominantBaseline="central"
          style={{ fontSize: 12, fontWeight: 700, fill: "#1e293b", fontFamily: "monospace" }}>
          {vPct}%
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontSize: 11 }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#22c55e", marginRight: 4 }} />
          verified <strong style={{ color: "#1e293b" }}>{verified}</strong>
        </span>
        <span style={{ fontSize: 11 }}>
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "#f59e0b", marginRight: 4 }} />
          asserted <strong style={{ color: "#1e293b" }}>{asserted}</strong>
        </span>
      </div>
    </div>
  );
}

function ResultFields({ result }: { result: unknown }) {
  if (result == null) return null;
  if (typeof result !== "object") return <span style={{ fontFamily: "monospace", fontSize: 12 }}>{String(result)}</span>;

  const entries = Object.entries(result as Record<string, unknown>);
  if (entries.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {entries.map(([k, v]) => (
        <div key={k} style={{ fontSize: 12, display: "flex", gap: 6 }}>
          <span style={{ fontWeight: 600, color: "#475569", minWidth: 80 }}>{k}</span>
          <span style={{ fontFamily: "monospace", color: "#1e293b", wordBreak: "break-word" }}>
            {typeof v === "string" ? (v.length > 100 ? v.slice(0, 97) + "…" : v)
              : Array.isArray(v) ? v.map((item, i) => (
                <span key={i}>
                  {i > 0 && <span style={{ color: "#cbd5e1" }}> · </span>}
                  {typeof item === "string" ? (item.length > 50 ? item.slice(0, 47) + "…" : item) : JSON.stringify(item)}
                </span>
              ))
              : JSON.stringify(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

function TraceConcludeApp() {
  const [data, setData] = useState<ConcludeData | null>(null);
  const [input, setInput] = useState<ConcludeInput | null>(null);

  useApp({
    appInfo: { name: "ZS Conclude", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (a) => {
      a.ontoolinput = async (args) => {
        if (args && typeof args === "object") {
          const r = args as Record<string, unknown>;
          setInput({ invocation_id: r.invocation_id as string, result: r.result });
        }
      };
      a.ontoolresult = async (result) => {
        const text = result.content?.find((c) => c.type === "text");
        if (!text) return;
        try { setData(JSON.parse((text as { text: string }).text)); } catch {}
      };
    },
  });

  if (!data && !input) return <div style={{ padding: 10, fontSize: 12, color: "#94a3b8" }}>Waiting for result...</div>;

  const cov = data?.coverage;
  const resultData = input?.result ?? null;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 14, maxWidth: 480, lineHeight: 1.5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>🏁</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>Conclude</span>
        {data && (
          <span style={{
            padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
            background: data.ok ? "#22c55e22" : "#ef444422",
            color: data.ok ? "#16a34a" : "#dc2626",
          }}>
            {data.status ?? (data.ok ? "done" : "error")}
          </span>
        )}
        {cov?.final_result_trust && (
          <span style={{
            padding: "1px 6px", borderRadius: 3, fontSize: 10, fontWeight: 600,
            background: cov.final_result_trust === "verified" ? "#22c55e22" : "#f59e0b22",
            color: cov.final_result_trust === "verified" ? "#16a34a" : "#d97706",
          }}>
            {cov.final_result_trust}
          </span>
        )}
      </div>

      {cov && (
        <div style={{ marginBottom: 12 }}>
          <Donut verified={cov.verified} asserted={cov.asserted} />
          {cov.authority_gates > 0 && (
            <div style={{ fontSize: 11, color: "#3b82f6", marginTop: 4 }}>
              {cov.authority_gates} authority gate{cov.authority_gates > 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      {resultData && (
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Result
          </div>
          <div style={{ padding: 10, background: "#f8fafc", borderRadius: 6, border: "1px solid #e2e8f0" }}>
            <ResultFields result={resultData} />
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><TraceConcludeApp /></StrictMode>,
);
