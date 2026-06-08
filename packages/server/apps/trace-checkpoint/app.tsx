import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

const DIR_STYLE: Record<string, { bg: string; fg: string; icon: string }> = {
  proceed: { bg: "#22c55e22", fg: "#16a34a", icon: "✓" },
  warn: { bg: "#f59e0b22", fg: "#d97706", icon: "⚠" },
  halt: { bg: "#ef444422", fg: "#dc2626", icon: "✗" },
};

function DataPreview({ data }: { data: unknown }) {
  if (data == null) return null;
  const obj = typeof data === "object" ? data as Record<string, unknown> : null;
  if (!obj) return <span style={{ fontSize: 11, fontFamily: "monospace", color: "#64748b" }}>{String(data)}</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 12px", marginTop: 6 }}>
      {Object.entries(obj).map(([k, v]) => (
        <span key={k} style={{ fontSize: 11, color: "#64748b" }}>
          <span style={{ fontWeight: 600, color: "#475569" }}>{k}:</span>{" "}
          <span style={{ fontFamily: "monospace" }}>{typeof v === "string" ? (v.length > 50 ? v.slice(0, 47) + "…" : v) : JSON.stringify(v)}</span>
        </span>
      ))}
    </div>
  );
}

function App() {
  const [label, setLabel] = useState<string | null>(null);
  const [data, setData] = useState<unknown>(null);
  const [directive, setDirective] = useState<string | null>(null);

  useApp({
    appInfo: { name: "ZS Checkpoint", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (a) => {
      a.ontoolinput = async (args) => {
        if (args && typeof args === "object") {
          const r = args as Record<string, unknown>;
          setLabel(r.label as string);
          setData(r.data);
        }
      };
      a.ontoolresult = async (result) => {
        const text = result.content?.find((c) => c.type === "text");
        if (!text) return;
        try {
          const d = JSON.parse((text as { text: string }).text) as { directive?: string };
          if (d.directive) setDirective(d.directive);
        } catch {}
      };
    },
  });

  if (!label) return <div style={{ padding: 10, fontSize: 12, color: "#94a3b8" }}>Waiting...</div>;

  const dir = directive ?? "pending";
  const style = DIR_STYLE[dir] ?? { bg: "#64748b22", fg: "#64748b", icon: "⏳" };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 12, maxWidth: 440, lineHeight: 1.4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16 }}>🚦</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{label}</span>
        <span style={{ padding: "1px 6px", borderRadius: 3, fontSize: 10, fontWeight: 600, background: "#22c55e22", color: "#16a34a" }}>verified</span>
        <span style={{ marginLeft: "auto", padding: "2px 10px", borderRadius: 4, fontSize: 12, fontWeight: 700, background: style.bg, color: style.fg }}>
          {style.icon} {dir}
        </span>
      </div>
      <DataPreview data={data} />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
