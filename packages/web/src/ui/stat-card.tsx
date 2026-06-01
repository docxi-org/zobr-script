import { Icon } from "./icon";
import { Card } from "./card";

interface StatCardProps {
  label: string;
  value: number;
  sub: string;
  icon: string;
  accent?: string;
  onClick?: (() => void) | undefined;
}

export function StatCard({ label, value, sub, icon, accent, onClick }: StatCardProps) {
  return (
    <Card hover={!!onClick} onClick={onClick} style={{ padding: 18 }}>
      <div className="flex items-start justify-between">
        <span
          style={{
            fontSize: "var(--fs-sm)",
            color: "var(--text-2)",
            fontWeight: 600,
          }}
        >
          {label}
        </span>
        <Icon
          name={icon}
          size={16}
          style={{ color: accent ?? "var(--text-3)" }}
        />
      </div>
      <div className="flex items-baseline" style={{ gap: 8, marginTop: 12 }}>
        <span
          className="mono"
          style={{
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--text-0)",
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-2)" }}>
          {sub}
        </span>
      </div>
    </Card>
  );
}
