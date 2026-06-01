import { useApi } from "../api/hooks";
import { useT } from "../i18n/context";
import type { StatusResponse } from "../api/types";

export function Footer() {
  const { data } = useApi<StatusResponse>("/status");
  const t = useT();

  return (
    <footer
      className="mono flex h-8 shrink-0 items-center border-t border-[var(--border)]"
      style={{
        padding: "0 20px",
        background: "var(--bg-0)",
        fontSize: "var(--fs-xs)",
        color: "var(--text-3)",
        gap: 14,
      }}
    >
      <span>ZS v{data?.version ?? "…"}</span>
      <span style={{ color: "var(--border-2)" }}>·</span>
      <span>zs.docxi.org</span>
      {data && (
        <>
          <span style={{ color: "var(--border-2)" }}>·</span>
          <span className="inline-flex items-center" style={{ gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: "var(--st-done)" }} />
            {t("footer.uptime")} {Math.floor(data.uptime / 3600)}h {Math.floor((data.uptime % 3600) / 60)}m
          </span>
        </>
      )}
    </footer>
  );
}
