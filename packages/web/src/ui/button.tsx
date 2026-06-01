import { useState, type CSSProperties, type ReactNode } from "react";
import { Icon } from "./icon";

interface ButtonProps {
  children?: ReactNode;
  variant?: "primary" | "default" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  icon?: string;
  onClick?: (() => void) | undefined;
  disabled?: boolean;
  active?: boolean;
  style?: CSSProperties;
  title?: string;
  type?: "button" | "submit";
}

const SIZES = {
  sm: { h: 28, px: 10, fs: "var(--fs-sm)" },
  md: { h: 34, px: 14, fs: "var(--fs-sm)" },
  lg: { h: 40, px: 18, fs: "var(--fs-base)" },
  icon: { h: 32, px: 0, fs: "var(--fs-sm)", w: 32 },
} as const;

export function Button({
  children,
  variant = "default",
  size = "md",
  icon,
  onClick,
  disabled,
  active,
  style,
  title,
  type,
}: ButtonProps) {
  const [h, setH] = useState(false);
  const s = SIZES[size];

  const variants: Record<string, CSSProperties> = {
    primary: {
      background: disabled ? "var(--bg-2)" : "var(--accent)",
      color: disabled ? "var(--text-3)" : "var(--accent-fg)",
      border: "1px solid transparent",
    },
    default: {
      background: h && !disabled ? "var(--bg-3)" : "var(--bg-2)",
      color: "var(--text-0)",
      border: "1px solid var(--border)",
    },
    ghost: {
      background: h && !disabled ? "var(--bg-2)" : active ? "var(--bg-2)" : "transparent",
      color: active ? "var(--text-0)" : "var(--text-1)",
      border: "1px solid transparent",
    },
    outline: {
      background: h && !disabled ? "var(--bg-2)" : "transparent",
      color: "var(--text-0)",
      border: "1px solid var(--border-2)",
    },
    danger: {
      background: h && !disabled ? "color-mix(in oklch, var(--trust-error) 22%, transparent)" : "transparent",
      color: "var(--trust-error)",
      border: "1px solid color-mix(in oklch, var(--trust-error) 40%, transparent)",
    },
  };

  return (
    <button
      type={type ?? "button"}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        height: s.h,
        width: size === "icon" ? (s as { w: number }).w : "auto",
        padding: size === "icon" ? 0 : `0 ${s.px}px`,
        borderRadius: "var(--r-md)",
        fontSize: s.fs,
        fontWeight: 600,
        whiteSpace: "nowrap",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        transition: "background .14s var(--ease), border-color .14s var(--ease)",
        ...variants[variant],
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={size === "lg" ? 16 : 14} />}
      {children}
    </button>
  );
}
