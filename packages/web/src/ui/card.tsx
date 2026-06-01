import { useState, type CSSProperties, type ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  pad?: boolean;
  hover?: boolean;
  onClick?: (() => void) | undefined;
  className?: string;
}

export function Card({
  children,
  style,
  pad = true,
  hover = false,
  onClick,
  className,
}: CardProps) {
  const [h, setH] = useState(false);
  return (
    <div
      className={className}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        background: "var(--bg-1)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: pad ? "var(--pad)" : 0,
        transition: "border-color .15s var(--ease), background .15s var(--ease)",
        cursor: onClick ? "pointer" : "default",
        borderColor: hover && h ? "var(--border-2)" : "var(--border)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
