import type { ReactNode } from "react";

interface SectionTitleProps {
  title: string;
  hint?: string;
  action?: ReactNode;
}

export function SectionTitle({ title, hint, action }: SectionTitleProps) {
  return (
    <div className="flex items-center" style={{ gap: 10, marginBottom: 12 }}>
      <h2
        style={{
          margin: 0,
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h2>
      {hint && (
        <span
          className="rounded-full"
          style={{
            fontSize: "var(--fs-xs)",
            color: "var(--text-2)",
            background: "var(--bg-2)",
            padding: "2px 8px",
            fontWeight: 600,
          }}
        >
          {hint}
        </span>
      )}
      <div className="flex-1" />
      {action}
    </div>
  );
}
