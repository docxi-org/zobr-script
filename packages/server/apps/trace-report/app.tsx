import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

interface ReportInput {
  label?: string;
  data?: unknown;
  invocation_id?: string;
}

const OP_ICONS: Record<string, string> = {
  survey: "🔍", doubt: "⚡", synthesize: "🔗", contrast: "⚖️", assert: "📌",
  ground: "📎", retrieve: "📡", reframe: "🔄", analogy: "🪞", commit: "📋",
  check: "✅", report: "📝", checkpoint: "🚦",
};

const OP_COLORS: Record<string, string> = {
  survey: "#3b82f6", doubt: "#ef4444", synthesize: "#8b5cf6", contrast: "#f97316",
  assert: "#14b8a6", ground: "#64748b", retrieve: "#22c55e", reframe: "#ec4899",
};

function extractOp(label: string): { op: string; detail: string } {
  const parts = label.split("_");
  const known = Object.keys(OP_ICONS);
  const op = known.find((k) => parts[0] === k) ?? parts[0] ?? "report";
  const detail = parts.slice(1).join(" ");
  return { op, detail };
}

function DataFields({ data }: { data: unknown }) {
  if (data == null) return null;
  const obj = typeof data === "object" ? data as Record<string, unknown> : null;
  if (!obj) return <span style={{ fontSize: 12, color: "#64748b" }}>{String(data)}</span>;

  const entries = Object.entries(obj);
  if (entries.length === 0) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 6 }}>
      {entries.map(([k, v]) => (
        <span key={k} style={{ fontSize: 11, color: "#64748b" }}>
          <span style={{ fontWeight: 600, color: "#475569" }}>{k}:</span>{" "}
          <span style={{ fontFamily: "monospace" }}>
            {typeof v === "string" ? (v.length > 60 ? v.slice(0, 57) + "…" : v)
              : typeof v === "number" ? String(v)
              : JSON.stringify(v)}
          </span>
        </span>
      ))}
    </div>
  );
}

function TraceReportApp() {
  const [input, setInput] = useState<ReportInput | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);

  useApp({
    appInfo: { name: "ZS Report", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (a) => {
      a.ontoolinput = async (args) => {
        if (args && typeof args === "object") {
          const r = args as Record<string, unknown>;
          setInput({ label: r.label as string, data: r.data, invocation_id: r.invocation_id as string });
        }
      };
      a.ontoolresult = async (result) => {
        const text = result.content?.find((c) => c.type === "text");
        if (!text) return;
        try {
          const d = JSON.parse((text as { text: string }).text) as { ok?: boolean; _input?: Record<string, unknown> };
          setOk(d.ok ?? true);
          if (d._input) setInput((prev) => prev ?? { label: d._input!.label as string, data: d._input!.data });
        } catch {}
      };
    },
  });

  if (!input) return <div style={{ padding: 10, fontSize: 12, color: "#94a3b8" }}>Waiting...</div>;

  const { op, detail } = extractOp(input.label ?? "report");
  const icon = OP_ICONS[op] ?? "📝";
  const color = OP_COLORS[op] ?? "#64748b";

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 12, maxWidth: 440, lineHeight: 1.4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{op}</span>
        {detail && <span style={{ fontSize: 12, color: "#94a3b8" }}>{detail}</span>}
        <span style={{
          padding: "1px 6px", borderRadius: 3, fontSize: 10, fontWeight: 600,
          background: "#f59e0b22", color: "#d97706",
        }}>
          asserted
        </span>
        {ok !== null && (
          <span style={{ marginLeft: "auto", fontSize: 12, color: ok ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
            {ok ? "✓" : "✗"}
          </span>
        )}
      </div>
      <DataFields data={input.data} />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><TraceReportApp /></StrictMode>,
);
