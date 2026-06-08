import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";

function ResultPreview({ results }: { results: unknown }) {
  if (results == null) return null;
  const obj = typeof results === "object" ? results as Record<string, unknown> : null;
  if (!obj) return <span style={{ fontSize: 11, fontFamily: "monospace" }}>{String(results)}</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 12px" }}>
      {Object.entries(obj).map(([k, v]) => (
        <span key={k} style={{ fontSize: 11, color: "#64748b" }}>
          <span style={{ fontWeight: 600, color: "#475569" }}>{k}:</span>{" "}
          <span style={{ fontFamily: "monospace" }}>{typeof v === "string" ? (v.length > 40 ? v.slice(0, 37) + "…" : v) : JSON.stringify(v)}</span>
        </span>
      ))}
    </div>
  );
}

function App() {
  const [commitSeq, setCommitSeq] = useState<number | null>(null);
  const [results, setResults] = useState<unknown>(null);
  const [ok, setOk] = useState<boolean | null>(null);

  useApp({
    appInfo: { name: "ZS Check", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (a) => {
      a.ontoolinput = async (input) => {
        if (input && typeof input === "object") {
          const r = input as Record<string, unknown>;
          setCommitSeq(r.commit_seq as number);
          setResults(r.results);
        }
      };
      a.ontoolresult = async (result) => {
        const text = result.content?.find((c) => c.type === "text");
        if (!text) return;
        try {
          const d = JSON.parse((text as { text: string }).text) as { ok?: boolean };
          setOk(d.ok ?? null);
        } catch {}
      };
    },
  });

  if (commitSeq == null && results == null) return <div style={{ padding: 10, fontSize: 12, color: "#94a3b8" }}>Waiting...</div>;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 12, maxWidth: 440, lineHeight: 1.4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>✅</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>Check</span>
        {commitSeq != null && <span style={{ fontSize: 10, fontFamily: "monospace", color: "#94a3b8" }}>vs commit seq {commitSeq}</span>}
        {ok !== null && (
          <span style={{
            marginLeft: "auto", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700,
            background: ok ? "#22c55e22" : "#ef444422", color: ok ? "#16a34a" : "#dc2626",
          }}>
            {ok ? "PASS" : "FAIL"}
          </span>
        )}
      </div>
      <ResultPreview results={results} />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
