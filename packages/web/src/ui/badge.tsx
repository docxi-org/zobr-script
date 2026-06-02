import type { CSSProperties, ReactNode } from "react";
import { useT } from "../i18n/context";

interface BadgeProps {
  children: ReactNode;
  color: string;
  tone?: "soft" | "solid" | "outline";
  style?: CSSProperties;
}

export function Badge({ children, color, tone = "soft", style }: BadgeProps) {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    height: 20,
    padding: "0 8px",
    borderRadius: 999,
    fontSize: "var(--fs-xs)",
    fontWeight: 600,
    letterSpacing: "0.01em",
    whiteSpace: "nowrap",
    lineHeight: 1,
    ...style,
  };

  if (tone === "solid")
    return <span style={{ ...base, background: color, color: "var(--accent-fg)" }}>{children}</span>;
  if (tone === "outline")
    return <span style={{ ...base, border: `1px solid ${color}`, color }}>{children}</span>;
  return (
    <span
      style={{
        ...base,
        background: `color-mix(in oklch, ${color} calc(var(--tint) * 100%), transparent)`,
        color,
      }}
    >
      {children}
    </span>
  );
}

const STATUS_COLORS: Record<string, string> = {
  running: "var(--st-running)",
  done: "var(--st-done)",
  halted: "var(--st-halted)",
  aborted: "var(--st-aborted)",
  errored: "var(--st-errored)",
  expired: "var(--st-expired)",
  suspended: "var(--st-suspended)",
};

const STATUS_KEYS: Record<string, string> = {
  running: "status.running",
  done: "status.done",
  halted: "status.halted",
  aborted: "status.aborted",
  errored: "status.errored",
  expired: "status.expired",
  suspended: "status.suspended",
};

const TRUST_META: Record<string, { c: string }> = {
  asserted: { c: "var(--trust-asserted)" },
  verified: { c: "var(--trust-verified)" },
  authority: { c: "var(--trust-authority)" },
  error: { c: "var(--trust-error)" },
  "n/a": { c: "var(--text-3)" },
};

export function TrustBadge({ trust }: { trust: string }) {
  const m = TRUST_META[trust] ?? TRUST_META["asserted"]!;
  return <Badge color={m.c}>{trust}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const t = useT();
  const c = STATUS_COLORS[status] ?? STATUS_COLORS["suspended"]!;
  const label = t((STATUS_KEYS[status] ?? "status.suspended") as Parameters<typeof t>[0]);
  return (
    <Badge color={c}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 99,
          background: c,
          boxShadow:
            status === "running"
              ? `0 0 0 3px color-mix(in oklch, ${c} 30%, transparent)`
              : "none",
          animation:
            status === "running"
              ? "zs-pulse 1.6s var(--ease) infinite"
              : "none",
        }}
      />
      {label}
    </Badge>
  );
}
