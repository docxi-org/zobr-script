import { useState, useCallback } from "react";
import { useLocale, type Locale } from "../i18n/context";

type Tweaks = Record<string, string>;

const STORAGE_KEY = "zs_tweaks";

function loadTweaks(defaults: Tweaks): Tweaks {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) as Tweaks };
  } catch { /* ignore */ }
  return defaults;
}

export function useTweaks(defaults: Tweaks): [Tweaks, (key: string, val: string) => void] {
  const [values, setValues] = useState(() => loadTweaks(defaults));
  const setTweak = useCallback((key: string, val: string) => {
    setValues((prev) => {
      const next = { ...prev, [key]: val };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  return [values, setTweak];
}

function Section({ label }: { label: string }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-3)", padding: "8px 0 4px" }}>
      {label}
    </div>
  );
}

function Radio({ label, value, options, onChange }: {
  label: string; value: string; options: (string | { value: string; label: string })[]; onChange: (v: string) => void;
}) {
  const opts = options.map((o) => typeof o === "string" ? { value: o, label: o } : o);
  return (
    <div className="flex flex-col" style={{ gap: 4 }}>
      <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-2)", fontWeight: 500 }}>{label}</span>
      <div className="inline-flex rounded-[var(--r-md)] border border-[var(--border)]" style={{ padding: 2, gap: 2, background: "var(--bg-2)" }}>
        {opts.map((o) => {
          const on = value === o.value;
          return (
            <button key={o.value} onClick={() => onChange(o.value)} className="cursor-pointer rounded-[6px]"
              style={{
                padding: "3px 10px", fontSize: "var(--fs-xs)", fontWeight: 600, flex: 1,
                background: on ? "var(--bg-0)" : "transparent", color: on ? "var(--text-0)" : "var(--text-2)",
                border: on ? "1px solid var(--border)" : "1px solid transparent",
                boxShadow: on ? "var(--shadow)" : "none", transition: "all .14s var(--ease)",
              }}>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ColorPicker({ label, value, options, onChange }: {
  label: string; value: string; options: { hex: string; name: string }[]; onChange: (name: string) => void;
}) {
  return (
    <div className="flex flex-col" style={{ gap: 4 }}>
      <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-2)", fontWeight: 500 }}>{label}</span>
      <div className="flex" style={{ gap: 6 }}>
        {options.map((o) => {
          const on = value === o.name;
          return (
            <button key={o.name} onClick={() => onChange(o.name)} title={o.name}
              className="cursor-pointer rounded-[6px]"
              style={{
                width: 28, height: 28, background: o.hex, border: "none", flexShrink: 0,
                boxShadow: on ? `0 0 0 2px var(--bg-0), 0 0 0 3.5px ${o.hex}` : "0 0 0 1px rgba(255,255,255,0.1)",
                transition: "box-shadow .14s var(--ease)",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

const ACCENTS = [
  { hex: "#6366f1", name: "indigo" },
  { hex: "#a855f7", name: "violet" },
  { hex: "#14b8a6", name: "teal" },
  { hex: "#3b82f6", name: "blue" },
];

interface TweaksPanelProps {
  tweaks: Tweaks;
  setTweak: (key: string, val: string) => void;
  open: boolean;
  onClose: () => void;
}

export function TweaksPanel({ tweaks, setTweak, open, onClose }: TweaksPanelProps) {
  const { locale, setLocale } = useLocale();

  if (!open) return null;

  return (
    <div
      className="fixed z-50 flex flex-col overflow-hidden rounded-[var(--r-lg)] border border-[var(--border-2)]"
      style={{ right: 16, top: 56, width: 260, maxHeight: "calc(100vh - 80px)", background: "var(--bg-1)", boxShadow: "var(--shadow)" }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)]" style={{ padding: "10px 14px" }}>
        <span style={{ fontWeight: 700, fontSize: "var(--fs-sm)" }}>Tweaks</span>
        <button onClick={onClose} className="cursor-pointer border-none" style={{ background: "transparent", color: "var(--text-2)", fontSize: 13, width: 22, height: 22, borderRadius: 6 }}>✕</button>
      </div>
      <div className="flex flex-col overflow-y-auto" style={{ padding: "8px 14px 14px", gap: 10 }}>
        <Section label="Appearance" />
        <Radio label="Theme" value={tweaks["theme"]!} options={["dark", "light"]} onChange={(v) => setTweak("theme", v)} />
        <Radio label="Density" value={tweaks["density"]!} options={["comfortable", "compact"]} onChange={(v) => setTweak("density", v)} />
        <Section label="Accent" />
        <ColorPicker label="Accent color" value={tweaks["accent"]!} options={ACCENTS} onChange={(v) => setTweak("accent", v)} />
        <Section label="Typography" />
        <Radio label="Font" value={tweaks["font"]!} options={["inter", "geist", "system"]} onChange={(v) => setTweak("font", v)} />
        <Section label="Language" />
        <Radio label="Locale" value={locale} options={[{ value: "en", label: "English" }, { value: "ru", label: "Русский" }]} onChange={(v) => setLocale(v as Locale)} />
      </div>
    </div>
  );
}
