import { Icon } from "./icon";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  options: (string | SelectOption)[];
  placeholder?: string;
  width?: number | string;
}

export function Select({ value, onChange, options, placeholder, width }: SelectProps) {
  return (
    <div className="relative inline-block" style={{ width }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          appearance: "none",
          width: width ?? "auto",
          height: 32,
          padding: "0 30px 0 11px",
          background: "var(--bg-2)",
          color: value ? "var(--text-0)" : "var(--text-2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          fontSize: "var(--fs-sm)",
          fontWeight: 500,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.value;
          const l = typeof o === "string" ? o : o.label;
          return (
            <option key={v} value={v}>{l}</option>
          );
        })}
      </select>
      <Icon
        name="chevronDown"
        size={14}
        style={{
          position: "absolute",
          right: 9,
          top: 9,
          pointerEvents: "none",
          color: "var(--text-2)",
        }}
      />
    </div>
  );
}
