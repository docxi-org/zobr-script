import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

function App() {
  const [fn, setFn] = useState<string | null>(null);
  const [args, setArgs] = useState<unknown>(null);
  const [result, setResult] = useState<unknown>(null);
  const [ok, setOk] = useState<boolean | null>(null);

  useApp({
    appInfo: { name: "ZS Sandbox", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (a) => {
      a.ontoolinput = async (input) => {
        if (input && typeof input === "object") {
          const r = input as Record<string, unknown>;
          setFn(r.fn as string);
          setArgs(r.args);
        }
      };
      a.ontoolresult = async (toolResult) => {
        const text = toolResult.content?.find((c) => c.type === "text");
        if (!text) return;
        try {
          const d = JSON.parse((text as { text: string }).text) as { ok?: boolean; preview?: string; handle?: unknown };
          setOk(d.ok ?? null);
          setResult(d.preview ?? d.handle ?? null);
        } catch {}
      };
    },
  });

  if (!fn) return <div style={{ padding: 10, fontSize: 12, color: "#94a3b8" }}>Waiting...</div>;

  const argsStr = args != null ? (typeof args === "string" ? args : JSON.stringify(args)) : null;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 12, maxWidth: 440, lineHeight: 1.4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16 }}>⚙️</span>
        <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: "#8b5cf6" }}>{fn}()</span>
        <span style={{ padding: "1px 6px", borderRadius: 3, fontSize: 10, fontWeight: 600, background: "#22c55e22", color: "#16a34a" }}>verified</span>
        {ok !== null && (
          <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: ok ? "#16a34a" : "#dc2626" }}>
            {ok ? "✓" : "✗"}
          </span>
        )}
      </div>
      {argsStr && (
        <div style={{ marginTop: 6, padding: "4px 8px", background: "#f1f5f9", borderRadius: 4, fontSize: 11, fontFamily: "monospace", color: "#475569", maxHeight: 60, overflow: "auto" }}>
          args: {argsStr}
        </div>
      )}
      {result != null && (
        <div style={{ marginTop: 4, padding: "4px 8px", background: "#f0fdf4", borderRadius: 4, fontSize: 11, fontFamily: "monospace", color: "#166534", maxHeight: 60, overflow: "auto" }}>
          → {typeof result === "string" ? result : JSON.stringify(result)}
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
