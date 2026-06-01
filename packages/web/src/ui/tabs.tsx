interface Tab {
  id: string;
  label: string;
  dot?: boolean;
}

interface TabsProps {
  tabs: (string | Tab)[];
  active: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="flex border-b border-[var(--border)]" style={{ gap: 2, position: "relative" }}>
      {tabs.map((t) => {
        const id = typeof t === "string" ? t : t.id;
        const label = typeof t === "string" ? t : t.label;
        const dot = typeof t === "object" && t.dot;
        const on = active === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className="relative inline-flex cursor-pointer items-center"
            style={{
              gap: 7,
              padding: "9px 14px",
              marginBottom: -1,
              background: "transparent",
              fontSize: "var(--fs-sm)",
              fontWeight: 600,
              color: on ? "var(--text-0)" : "var(--text-2)",
              border: "none",
              borderBottomWidth: 2,
              borderBottomStyle: "solid",
              borderBottomColor: on ? "var(--accent)" : "transparent",
            }}
          >
            {label}
            {dot && (
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 99,
                  background: "var(--st-halted)",
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
