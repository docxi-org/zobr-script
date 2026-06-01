import type { CSSProperties, ReactNode } from "react";

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

const STATUS_META: Record<string, { c: string; label: string }> = {
  running: { c: "var(--st-running)", label: "running" },
  done: { c: "var(--st-done)", label: "done" },
  halted: { c: "var(--st-halted)", label: "halted" },
  aborted: { c: "var(--st-aborted)", label: "aborted" },
  errored: { c: "var(--st-errored)", label: "errored" },
  expired: { c: "var(--st-expired)", label: "expired" },
  suspended: { c: "var(--st-suspended)", label: "suspended" },
};

const TRUST_META: Record<string, { c: string }> = {
  asserted: { c: "var(--trust-asserted)" },
  verified: { c: "var(--trust-verified)" },
  authority: { c: "var(--trust-authority)" },
  error: { c: "var(--trust-error)" },
};

export function TrustBadge({ trust }: { trust: string }) {
  const m = TRUST_META[trust] ?? TRUST_META["asserted"]!;
  return <Badge color={m.c}>{trust}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META["suspended"]!;
  return (
    <Badge color={m.c}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 99,
          background: m.c,
          boxShadow:
            status === "running"
              ? `0 0 0 3px color-mix(in oklch, ${m.c} 30%, transparent)`
              : "none",
          animation:
            status === "running"
              ? "zs-pulse 1.6s var(--ease) infinite"
              : "none",
        }}
      />
      {m.label}
    </Badge>
  );
}
