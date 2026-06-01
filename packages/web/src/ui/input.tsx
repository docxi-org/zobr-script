import type { CSSProperties } from "react";
import { Icon } from "./icon";

interface InputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: string;
  type?: string;
  style?: CSSProperties;
  mono?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  autoFocus?: boolean;
}

export function Input({
  value,
  onChange,
  placeholder,
  icon,
  type = "text",
  style,
  mono,
  onKeyDown,
  autoFocus,
}: InputProps) {
  return (
    <div className="relative flex items-center" style={style}>
      {icon && (
        <Icon
          name={icon}
          size={15}
          style={{ position: "absolute", left: 11, color: "var(--text-2)" }}
        />
      )}
      <input
        value={value}
        type={type}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        className={mono ? "mono" : ""}
        style={{
          width: "100%",
          height: 34,
          padding: icon ? "0 12px 0 34px" : "0 12px",
          background: "var(--bg-2)",
          color: "var(--text-0)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          fontSize: "var(--fs-sm)",
          outline: "none",
          fontFamily: mono ? "var(--font-mono)" : "inherit",
        }}
        onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
        onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
      />
    </div>
  );
}
