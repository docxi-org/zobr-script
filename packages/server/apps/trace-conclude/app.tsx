import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

interface ConcludeData {
  ok?: boolean;
  status?: string;
  coverage?: { verified: number; asserted: number; authority_gates: number };
  result?: unknown;
}

function parseResult(result: CallToolResult): ConcludeData | null {
  const text = result.content?.find((c) => c.type === "text");
  if (!text) return null;
  try { return JSON.parse((text as { text: string }).text); } catch { return null; }
}

function CoverageBar({ verified, asserted }: { verified: number; asserted: number }) {
  const total = verified + asserted || 1;
  const vPct = Math.round((verified / total) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: "#f59e0b33", overflow: "hidden" }}>
        <div style={{ width: `${vPct}%`, height: "100%", background: "#22c55e", borderRadius: 4, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600, color: "#1e293b" }}>{vPct}%</span>
    </div>
  );
}

function TraceConcludeApp() {
  const [data, setData] = useState<ConcludeData | null>(null);
  const [scriptRef, setScriptRef] = useState<string | null>(null);

  useApp({
    appInfo: { name: "ZS Conclude", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (a) => {
      a.ontoolinput = async (args) => {
        if (args && typeof args === "object") {
          const input = args as Record<string, unknown>;
          if (input.invocation_id) setScriptRef(input.invocation_id as string);
        }
      };
      a.ontoolresult = async (result) => {
        const d = parseResult(result);
        if (d) setData(d);
      };
    },
  });

  if (!data) return <div style={{ padding: 10, fontSize: 12, color: "#94a3b8" }}>Waiting for result...</div>;

  const cov = data.coverage;
  const resultStr = data.result != null ? JSON.stringify(data.result, null, 2) : null;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 14, maxWidth: 460, lineHeight: 1.4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>Conclude</span>
        <span style={{
          padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
          background: data.ok ? "#22c55e22" : "#ef444422",
          color: data.ok ? "#16a34a" : "#dc2626",
        }}>
          {data.status ?? (data.ok ? "done" : "error")}
        </span>
        {scriptRef && (
          <span style={{ marginLeft: "auto", fontSize: 10, fontFamily: "monospace", color: "#94a3b8" }}>
            {scriptRef.slice(0, 20)}
          </span>
        )}
      </div>

      {cov && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Coverage
          </div>
          <CoverageBar verified={cov.verified} asserted={cov.asserted} />
          <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 11, color: "#64748b" }}>
            <span>verified: <strong style={{ color: "#22c55e" }}>{cov.verified}</strong></span>
            <span>asserted: <strong style={{ color: "#f59e0b" }}>{cov.asserted}</strong></span>
            {cov.authority_gates > 0 && <span>authority: <strong style={{ color: "#3b82f6" }}>{cov.authority_gates}</strong></span>}
          </div>
        </div>
      )}

      {resultStr && (
        <div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Result
          </div>
          <pre style={{
            margin: 0, padding: 10, borderRadius: 6, fontSize: 11, lineHeight: 1.5,
            background: "#f8fafc", border: "1px solid #e2e8f0", overflow: "auto",
            maxHeight: 200, fontFamily: "monospace", color: "#334155", whiteSpace: "pre-wrap",
          }}>
            {resultStr}
          </pre>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><TraceConcludeApp /></StrictMode>,
);
