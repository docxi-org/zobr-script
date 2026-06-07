import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

interface ReportData {
  label?: string;
  data?: unknown;
  invocation_id?: string;
}

function parseResult(result: CallToolResult): ReportData | null {
  const text = result.content?.find((c) => c.type === "text");
  if (!text) return null;
  try { return JSON.parse((text as { text: string }).text); } catch { return null; }
}

function parseInput(input: Record<string, unknown>): ReportData {
  return { label: input.label as string, data: input.data, invocation_id: input.invocation_id as string };
}

const TRUST_COLOR = "#f59e0b";

function TraceReportApp() {
  const [input, setInput] = useState<ReportData | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);

  useApp({
    appInfo: { name: "ZS Report", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (a) => {
      a.ontoolinput = async (args) => {
        if (args && typeof args === "object") setInput(parseInput(args as Record<string, unknown>));
      };
      a.ontoolresult = async (result) => {
        const r = parseResult(result);
        if (r) setOk((r as { ok?: boolean }).ok ?? true);
      };
    },
  });

  if (!input) return <div style={{ padding: 10, fontSize: 12, color: "#94a3b8" }}>Waiting...</div>;

  const dataStr = typeof input.data === "string" ? input.data
    : input.data != null ? JSON.stringify(input.data, null, 2) : null;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 12, maxWidth: 420, lineHeight: 1.4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{input.label ?? "report"}</span>
        <span style={{ padding: "1px 6px", borderRadius: 3, fontSize: 10, fontWeight: 600, background: `${TRUST_COLOR}22`, color: TRUST_COLOR }}>
          asserted
        </span>
        {ok !== null && (
          <span style={{ marginLeft: "auto", fontSize: 11, color: ok ? "#16a34a" : "#dc2626" }}>
            {ok ? "✓" : "✗"}
          </span>
        )}
      </div>
      {dataStr && (
        <pre style={{
          margin: 0, padding: 8, borderRadius: 4, fontSize: 11, lineHeight: 1.5,
          background: "#f8fafc", border: "1px solid #e2e8f0", overflow: "auto",
          maxHeight: 120, fontFamily: "monospace", color: "#334155", whiteSpace: "pre-wrap",
        }}>
          {dataStr}
        </pre>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><TraceReportApp /></StrictMode>,
);
