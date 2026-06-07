import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

interface TraceStatus {
  status: string;
  events_count: number;
  coverage?: { verified: number; asserted: number };
}

function extractStatus(result: CallToolResult): TraceStatus | null {
  const text = result.content?.find((c) => c.type === "text");
  if (!text) return null;
  try { return JSON.parse((text as { text: string }).text); } catch { return null; }
}

function TraceProgressApp() {
  const [status, setStatus] = useState<TraceStatus | null>(null);

  const { app, error } = useApp({
    appInfo: { name: "ZS Trace Progress", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (a) => {
      a.ontoolresult = async (result) => {
        const s = extractStatus(result);
        if (s) setStatus(s);
      };
    },
  });

  const handleRefresh = async () => {
    if (!app) return;
    try {
      const result = await app.callServerTool({ name: "zs_status", arguments: {} });
      const s = extractStatus(result);
      if (s) setStatus(s);
    } catch {}
  };

  if (error) return <div style={{ padding: 12, color: "#e55" }}>Error: {error.message}</div>;
  if (!app) return <div style={{ padding: 12, color: "#888" }}>Connecting...</div>;

  const cov = status?.coverage;
  const total = (cov?.verified ?? 0) + (cov?.asserted ?? 0) || 1;
  const vPct = Math.round(((cov?.verified ?? 0) / total) * 100);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 16, maxWidth: 400 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>ZS Trace</span>
        {status && (
          <span style={{
            padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
            background: status.status === "running" ? "#22c55e22" : "#64748b22",
            color: status.status === "running" ? "#16a34a" : "#64748b",
          }}>
            {status.status}
          </span>
        )}
        <button onClick={handleRefresh} style={{ marginLeft: "auto", cursor: "pointer", border: "1px solid #ddd", borderRadius: 4, padding: "3px 8px", fontSize: 11 }}>
          Refresh
        </button>
      </div>

      {status && (
        <>
          <div style={{ marginBottom: 8, fontSize: 12, color: "#666" }}>
            Events: <strong>{status.events_count}</strong> · Coverage: <strong>{vPct}%</strong> verified
          </div>
          <div style={{ height: 6, borderRadius: 3, background: "#f1c40f33", overflow: "hidden" }}>
            <div style={{ width: `${vPct}%`, height: "100%", background: "#22c55e", borderRadius: 3, transition: "width 0.3s" }} />
          </div>
        </>
      )}

      {!status && <div style={{ fontSize: 12, color: "#888" }}>Waiting for trace data...</div>}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><TraceProgressApp /></StrictMode>,
);
