import { Icon } from "./icon";

export function ScriptChip({ name }: { name: string }) {
  return (
    <span
      className="mono inline-flex items-center"
      style={{ gap: 6, fontWeight: 600 }}
    >
      <Icon name="filecode" size={13} style={{ color: "var(--text-3)" }} />
      {name}
    </span>
  );
}
