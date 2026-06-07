import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

interface TraceState {
  invocation_id?: string;
  script_ref?: string;
  status: string;
  events_count: number;
  coverage: { verified: number; asserted: number };
}

function parseToolResult(result: CallToolResult): Partial<TraceState> | null {
  const text = result.content?.find((c) => c.type === "text");
  if (!text) return null;
  try { return JSON.parse((text as { text: string }).text); } catch { return null; }
}

function CoverageBar({ verified, asserted }: { verified: number; asserted: number }) {
  const total = verified + asserted || 1;
  const vPct = Math.round((verified / total) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#f59e0b33", overflow: "hidden" }}>
        <div style={{ width: `${vPct}%`, height: "100%", background: "#22c55e", borderRadius: 3, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: 11, fontFamily: "monospace", color: "#666", whiteSpace: "nowrap" }}>{vPct}% verified</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    running: { bg: "#22c55e22", fg: "#16a34a" },
    done: { bg: "#3b82f622", fg: "#2563eb" },
    halted: { bg: "#ef444422", fg: "#dc2626" },
    aborted: { bg: "#64748b22", fg: "#475569" },
    errored: { bg: "#ef444422", fg: "#dc2626" },
  };
  const c = colors[status] ?? colors["aborted"]!;
  return (
    <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: c.bg, color: c.fg }}>
      {status}
    </span>
  );
}

function TraceProgressApp() {
  const [state, setState] = useState<TraceState | null>(null);

  const { app, error } = useApp({
    appInfo: { name: "ZS Trace Progress", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (a) => {
      a.ontoolresult = async (result) => {
        const data = parseToolResult(result);
        if (data && data.invocation_id) {
          setState((prev) => ({
            invocation_id: data.invocation_id ?? prev?.invocation_id,
            script_ref: data.script_ref ?? prev?.script_ref,
            status: data.status ?? prev?.status ?? "running",
            events_count: data.events_count ?? prev?.events_count ?? 0,
            coverage: data.coverage ?? prev?.coverage ?? { verified: 0, asserted: 0 },
          }));
        }
      };

      a.ontoolinput = async (input) => {
        if (input && typeof input === "object" && "script_ref" in input) {
          setState((prev) => ({
            invocation_id: prev?.invocation_id,
            script_ref: (input as { script_ref: string }).script_ref,
            status: "starting...",
            events_count: 0,
            coverage: { verified: 0, asserted: 0 },
          }));
        }
      };
    },
  });

  const handleRefresh = async () => {
    if (!app || !state?.invocation_id) return;
    try {
      const result = await app.callServerTool({
        name: "zs_status",
        arguments: { invocation_id: state.invocation_id, agent_id: "" },
      });
      const data = parseToolResult(result);
      if (data) setState((prev) => prev ? { ...prev, ...data } : prev);
    } catch {}
  };

  if (error) return <div style={{ padding: 12, color: "#e55", fontSize: 12 }}>Error: {error.message}</div>;
  if (!app) return <div style={{ padding: 12, color: "#888", fontSize: 12 }}>Connecting...</div>;

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", padding: 14, maxWidth: 420, lineHeight: 1.4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>
          {state?.script_ref ?? "ZS Trace"}
        </span>
        {state && <StatusBadge status={state.status} />}
        <button
          onClick={handleRefresh}
          style={{ marginLeft: "auto", cursor: "pointer", border: "1px solid #e2e8f0", borderRadius: 4, padding: "3px 8px", fontSize: 11, background: "#fff" }}
        >
          ↻
        </button>
      </div>

      {state ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <CoverageBar verified={state.coverage.verified} asserted={state.coverage.asserted} />
          <div style={{ display: "flex", gap: 16, fontSize: 11, color: "#64748b" }}>
            <span>Events: <strong style={{ color: "#1e293b" }}>{state.events_count}</strong></span>
            {state.invocation_id && (
              <span style={{ fontFamily: "monospace", fontSize: 10 }}>{state.invocation_id.slice(0, 20)}</span>
            )}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "#94a3b8" }}>Waiting for script to start...</div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><TraceProgressApp /></StrictMode>,
);
