import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

interface StartInput {
  script_ref?: string;
  agent_id?: string;
}

interface StartResult {
  invocation_id?: string;
  code?: string;
  serverFunctions?: string[];
}

function parseCode(code: string): { description: string; entryFn: string; params: string } {
  const jsdoc = code.match(/\/\*\*\s*(.*?)\s*\*\//s);
  const description = jsdoc?.[1]?.replace(/\s*\*\s*/g, " ").trim() ?? "";
  const fn = code.match(/export\s+function\s+(\w+)\s*\(([^)]*)\)/);
  const entryFn = fn?.[1] ?? "";
  const params = fn?.[2]?.trim() ?? "";
  return { description, entryFn, params };
}

function TraceProgressApp() {
  const [input, setInput] = useState<StartInput | null>(null);
  const [result, setResult] = useState<StartResult | null>(null);
  const [codeInfo, setCodeInfo] = useState<{ description: string; entryFn: string; params: string } | null>(null);

  const { app, error } = useApp({
    appInfo: { name: "ZS Trace Progress", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (a) => {
      a.ontoolinput = async (args) => {
        if (args && typeof args === "object") {
          const r = args as Record<string, unknown>;
          setInput({ script_ref: r.script_ref as string, agent_id: r.agent_id as string });
        }
      };
      a.ontoolresult = async (toolResult) => {
        const text = toolResult.content?.find((c) => c.type === "text");
        if (!text) return;
        try {
          const data = JSON.parse((text as { text: string }).text) as StartResult;
          setResult(data);
          if (data.code) setCodeInfo(parseCode(data.code));
        } catch {}
      };
    },
  });

  if (error) return <div style={{ padding: 12, color: "#e55", fontSize: 12 }}>Error: {error.message}</div>;
  if (!app) return <div style={{ padding: 12, color: "#888", fontSize: 12 }}>Connecting...</div>;

  const hasSrv = (result?.serverFunctions?.length ?? 0) > 0;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 14, maxWidth: 440, lineHeight: 1.5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 15 }}>📜</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: "#1e293b" }}>
          {input?.script_ref ?? "ZS Script"}
        </span>
        <span style={{
          padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
          background: "#22c55e22", color: "#16a34a",
          animation: "pulse 2s infinite",
        }}>
          running
        </span>
      </div>

      {codeInfo?.description && (
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, fontStyle: "italic" }}>
          {codeInfo.description}
        </div>
      )}

      {codeInfo?.entryFn && (
        <div style={{ fontSize: 11, fontFamily: "monospace", color: "#475569", marginBottom: 6,
          padding: "4px 8px", background: "#f1f5f9", borderRadius: 4, display: "inline-block" }}>
          {codeInfo.entryFn}({codeInfo.params})
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 11, color: "#64748b" }}>
        {result?.invocation_id && (
          <span>ID: <span style={{ fontFamily: "monospace", color: "#475569" }}>{result.invocation_id.slice(0, 22)}</span></span>
        )}
        {hasSrv && (
          <span>@sandbox: <span style={{ fontFamily: "monospace", color: "#8b5cf6" }}>{result!.serverFunctions!.join(", ")}</span></span>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.5 } }`}</style>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><TraceProgressApp /></StrictMode>,
);
