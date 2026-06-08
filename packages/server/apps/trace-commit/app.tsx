import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { useApp } from "@modelcontextprotocol/ext-apps/react";

function App() {
  const [criteria, setCriteria] = useState<{ what?: string; basis?: string; verify?: string; boundaries?: string } | null>(null);
  const [seq, setSeq] = useState<number | null>(null);

  useApp({
    appInfo: { name: "ZS Commit", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (a) => {
      a.ontoolinput = async (input) => {
        if (input && typeof input === "object") {
          const r = input as Record<string, unknown>;
          setCriteria({ what: r.what as string, basis: r.basis as string, verify: r.verify as string, boundaries: r.boundaries as string });
        }
      };
      a.ontoolresult = async (result) => {
        const text = result.content?.find((c) => c.type === "text");
        if (!text) return;
        try {
          const d = JSON.parse((text as { text: string }).text) as { commit_seq?: number };
          if (d.commit_seq) setSeq(d.commit_seq);
        } catch {}
      };
    },
  });

  if (!criteria) return <div style={{ padding: 10, fontSize: 12, color: "#94a3b8" }}>Waiting...</div>;

  const fields = [
    { key: "what", label: "What", icon: "🎯", value: criteria.what },
    { key: "basis", label: "Basis", icon: "📎", value: criteria.basis },
    { key: "verify", label: "Verify", icon: "🔍", value: criteria.verify },
    { key: "boundaries", label: "Boundaries", icon: "🚧", value: criteria.boundaries },
  ];

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 12, maxWidth: 440, lineHeight: 1.4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>📋</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>Commit</span>
        <span style={{ padding: "1px 6px", borderRadius: 3, fontSize: 10, fontWeight: 600, background: "#f59e0b22", color: "#d97706" }}>pre-commitment</span>
        {seq && <span style={{ marginLeft: "auto", fontSize: 10, fontFamily: "monospace", color: "#94a3b8" }}>seq {seq}</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {fields.map((f) => f.value ? (
          <div key={f.key} style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "baseline" }}>
            <span style={{ fontSize: 11 }}>{f.icon}</span>
            <span style={{ fontWeight: 600, color: "#475569", minWidth: 70 }}>{f.label}</span>
            <span style={{ color: "#1e293b" }}>{f.value.length > 80 ? f.value.slice(0, 77) + "…" : f.value}</span>
          </div>
        ) : null)}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
