import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";

interface State { fn?: string; args?: unknown; result?: unknown; ok?: boolean }

function App() {
  const [state, setState] = useState<State>({});

  useApp({
    appInfo: { name: "ZS Sandbox", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (a) => {
      a.ontoolinput = async (input) => {
        if (input && typeof input === "object") {
          const r = input as Record<string, unknown>;
          setState((s) => ({ ...s, fn: r.fn as string, args: r.args }));
        }
      };
      a.ontoolresult = async (toolResult) => {
        const text = toolResult.content?.find((c) => c.type === "text");
        if (!text) return;
        try {
          const d = JSON.parse((text as { text: string }).text) as { ok?: boolean; preview?: string; handle?: unknown; _input?: Record<string, unknown> };
          setState((s) => ({
            ...s,
            ok: d.ok,
            result: d.preview ?? d.handle,
            fn: s.fn ?? d._input?.fn as string,
            args: s.args ?? d._input?.args,
          }));
        } catch {}
      };
    },
  });

  if (!state.fn && state.ok == null) return <div style={{ padding: 10, fontSize: 12, color: "#94a3b8" }}>Waiting...</div>;

  const argsStr = state.args != null ? (typeof state.args === "string" ? state.args : JSON.stringify(state.args)) : null;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 12, maxWidth: 440, lineHeight: 1.4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16 }}>⚙️</span>
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: "#8b5cf6" }}>{state.fn ?? "sandbox"}()</span>
        <span style={{ padding: "1px 6px", borderRadius: 3, fontSize: 10, fontWeight: 600, background: "#22c55e22", color: "#16a34a" }}>verified</span>
        {state.ok != null && (
          <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: state.ok ? "#16a34a" : "#dc2626" }}>
            {state.ok ? "✓" : "✗"}
          </span>
        )}
      </div>
      {argsStr && (
        <div style={{ marginTop: 6, padding: "4px 8px", background: "#f1f5f9", borderRadius: 4, fontSize: 11, fontFamily: "monospace", color: "#475569", maxHeight: 60, overflow: "auto" }}>
          args: {argsStr}
        </div>
      )}
      {state.result != null && (
        <div style={{ marginTop: 4, padding: "4px 8px", background: "#f0fdf4", borderRadius: 4, fontSize: 11, fontFamily: "monospace", color: "#166534", maxHeight: 60, overflow: "auto" }}>
          → {typeof state.result === "string" ? state.result : JSON.stringify(state.result)}
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
