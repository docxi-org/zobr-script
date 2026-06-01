interface SegmentedOption {
  value: string;
  label: string;
}

interface SegmentedProps {
  options: (string | SegmentedOption)[];
  value: string;
  onChange: (v: string) => void;
}

export function Segmented({ options, value, onChange }: SegmentedProps) {
  return (
    <div
      className="inline-flex rounded-[var(--r-md)] border border-[var(--border)]"
      style={{ padding: 3, gap: 2, background: "var(--bg-2)" }}
    >
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const l = typeof o === "string" ? o : o.label;
        const on = value === v;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            className="cursor-pointer rounded-[6px]"
            style={{
              padding: "4px 11px",
              fontSize: "var(--fs-sm)",
              fontWeight: 600,
              background: on ? "var(--bg-0)" : "transparent",
              color: on ? "var(--text-0)" : "var(--text-2)",
              border: on ? "1px solid var(--border)" : "1px solid transparent",
              boxShadow: on ? "var(--shadow)" : "none",
              transition: "all .14s var(--ease)",
            }}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
