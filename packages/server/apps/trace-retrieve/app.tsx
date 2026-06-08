import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";

function App() {
  const [query, setQuery] = useState<string | null>(null);
  const [data, setData] = useState<unknown>(null);
  const [provenance, setProvenance] = useState<Record<string, unknown> | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);

  useApp({
    appInfo: { name: "ZS Retrieve", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (a) => {
      a.ontoolinput = async (input) => {
        if (input && typeof input === "object") {
          const r = input as Record<string, unknown>;
          setQuery(r.query as string);
          setData(r.data);
          if (r.provenance && typeof r.provenance === "object") setProvenance(r.provenance as Record<string, unknown>);
        }
      };
      a.ontoolresult = async (result) => {
        const text = result.content?.find((c) => c.type === "text");
        if (!text) return;
        try {
          const d = JSON.parse((text as { text: string }).text) as { ok?: boolean; _input?: Record<string, unknown> };
          setOk(d.ok ?? true);
          if (d._input) {
            setQuery((q) => q ?? d._input!.query as string);
            setData((prev) => prev ?? d._input!.data);
            if (d._input.provenance && typeof d._input.provenance === "object") setProvenance((p) => p ?? d._input!.provenance as Record<string, unknown>);
          }
        } catch {}
      };
    },
  });

  if (!query && !data) return <div style={{ padding: 10, fontSize: 12, color: "#94a3b8" }}>Waiting...</div>;

  const hasProvenance = provenance && Object.keys(provenance).length > 0;
  const trustColor = hasProvenance ? "#22c55e" : "#f59e0b";
  const trustLabel = hasProvenance ? "verified" : "asserted";

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 12, maxWidth: 440, lineHeight: 1.4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>📡</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>retrieve</span>
        <span style={{ padding: "1px 6px", borderRadius: 3, fontSize: 10, fontWeight: 600, background: `${trustColor}22`, color: trustColor }}>
          {trustLabel}
        </span>
        {ok !== null && (
          <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: ok ? "#16a34a" : "#dc2626" }}>{ok ? "✓" : "✗"}</span>
        )}
      </div>

      {query && <div style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>query: <span style={{ fontFamily: "monospace", color: "#1e293b" }}>{query}</span></div>}

      {hasProvenance && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", fontSize: 11, color: "#64748b", marginBottom: 4 }}>
          {Object.entries(provenance!).map(([k, v]) => (
            <span key={k}>
              <span style={{ fontWeight: 600, color: "#16a34a" }}>{k}:</span>{" "}
              <span style={{ fontFamily: "monospace" }}>{String(v)}</span>
            </span>
          ))}
        </div>
      )}

      {data != null && (
        <pre style={{
          margin: 0, marginTop: 4, padding: 6, borderRadius: 4, fontSize: 11, lineHeight: 1.4,
          background: "#f8fafc", border: "1px solid #e2e8f0", overflow: "auto",
          maxHeight: 80, fontFamily: "monospace", color: "#334155", whiteSpace: "pre-wrap",
        }}>
          {typeof data === "string" ? (data.length > 200 ? data.slice(0, 197) + "…" : data) : JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
