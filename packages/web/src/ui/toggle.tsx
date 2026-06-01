interface ToggleProps {
  on: boolean;
  onClick: () => void;
}

export function Toggle({ on, onClick }: ToggleProps) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className="relative shrink-0 cursor-pointer rounded-full border border-[var(--border)]"
      style={{
        width: 38,
        height: 22,
        background: on ? "var(--accent)" : "var(--bg-3)",
        transition: "background .15s var(--ease)",
      }}
    >
      <span
        className="absolute rounded-full"
        style={{
          top: 2,
          left: on ? 18 : 2,
          width: 16,
          height: 16,
          background: "#fff",
          transition: "left .15s var(--ease)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
        }}
      />
    </button>
  );
}
