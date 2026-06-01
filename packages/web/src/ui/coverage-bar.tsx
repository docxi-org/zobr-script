import type { Coverage } from "../api/types";

interface CoverageBarProps {
  coverage: Coverage;
  width?: number;
  showPct?: boolean;
  height?: number;
}

export function CoverageBar({
  coverage,
  width = 120,
  showPct = true,
  height = 6,
}: CoverageBarProps) {
  const v = Math.round((coverage.verified || 0) * 100);
  const a = Math.round((coverage.asserted || 0) * 100);
  return (
    <div className="flex items-center" style={{ gap: 8 }}>
      <div
        className="flex shrink-0 overflow-hidden rounded-full"
        style={{ width, height, background: "var(--bg-2)" }}
      >
        <div
          style={{ width: v + "%", background: "var(--trust-verified)" }}
          title={`verified ${v}%`}
        />
        <div
          style={{ width: a + "%", background: "var(--trust-asserted)" }}
          title={`asserted ${a}%`}
        />
      </div>
      {showPct && (
        <span
          className="mono"
          style={{
            fontSize: "var(--fs-xs)",
            color: "var(--text-2)",
            minWidth: 30,
          }}
        >
          {v}%
        </span>
      )}
    </div>
  );
}
