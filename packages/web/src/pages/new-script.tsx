import { useState, useMemo } from "react";
import { Icon } from "../ui/icon";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Tabs } from "../ui/tabs";
import { Toggle } from "../ui/toggle";
import { ZsMonacoEditor } from "../ui/monaco-editor";
import { navigate } from "../router";
import { api } from "../api/client";
import { useApi } from "../api/hooks";
import { allFolders } from "./scripts";
import { useT } from "../i18n/context";
import type { ScriptEntry } from "../api/types";

const TEMPLATE_COG = `/** New cognitive script. */
export type Result = { summary: string };

export function analyze(topic: string): Result {
  const mechanisms = survey(topic, { count: 5 });
  return conclude<Result>({
    summary: mechanisms.best,
  });
}`;

const TEMPLATE_SRV = `import { ZsScript } from "zs/server";

export default class extends ZsScript {
  async onStart(ctx) {
    this.report({ step: "boot" });
  }
}`;

const SEG_RE = /^[a-z0-9][a-z0-9_-]*$/i;
const MAX_DEPTH = 5;

export function NewScript({ theme }: { theme: "dark" | "light" }) {
  const { data } = useApi<{ scripts: ScriptEntry[] }>("/scripts");
  const scripts = data?.scripts ?? [];
  const folders = useMemo(() => allFolders(scripts), [scripts]);

  const t = useT();
  const [folder, setFolder] = useState("");
  const [name, setName] = useState("");
  const [addSrv, setAddSrv] = useState(false);
  const [tab, setTab] = useState("cognitive");
  const [cog, setCog] = useState(TEMPLATE_COG);
  const [srv, setSrv] = useState(TEMPLATE_SRV);
  const [result, setResult] = useState<{ err?: string; ok?: boolean; path?: string } | null>(null);
  const [showSug, setShowSug] = useState(false);

  const cleanFolder = folder.replace(/^\/+|\/+$/g, "");
  const fullPath = cleanFolder ? cleanFolder + "/" + name.trim() : name.trim();
  const suggestions = folders.filter((f) => f !== cleanFolder && f.toLowerCase().includes(cleanFolder.toLowerCase())).slice(0, 6);

  const validate = (): string | null => {
    if (!name.trim()) return "Script name is required.";
    if (!SEG_RE.test(name.trim())) return "Name may use letters, digits, '-' and '_', must start alphanumeric.";
    if (cleanFolder) {
      const segs = cleanFolder.split("/");
      for (const s of segs) if (!SEG_RE.test(s)) return `Invalid folder segment: "${s}".`;
      if (segs.length + 1 > MAX_DEPTH) return `Path too deep (max ${MAX_DEPTH} levels).`;
    }
    if (scripts.some((s) => s.name === fullPath)) return `Script "${fullPath}" already exists.`;
    return null;
  };

  const create = async () => {
    const err = validate();
    if (err) { setResult({ err }); return; }
    try {
      const res = await api.post<{ ok: boolean; errors?: string[] }>("/scripts", {
        script_ref: fullPath,
        cog: [{ name: `${fullPath}.cog.ts`, content: cog }],
        srv: addSrv ? [{ name: `${fullPath}.srv.ts`, content: srv }] : [],
      });
      if (res.ok) {
        setResult({ ok: true, path: fullPath });
        setTimeout(() => navigate("/scripts"), 800);
      } else {
        setResult({ err: res.errors?.join("; ") ?? "Validation failed" });
      }
    } catch (e) {
      setResult({ err: (e as Error).message });
    }
  };

  const liveErr = (name || cleanFolder) ? validate() : null;
  const value = tab === "cognitive" ? cog : srv;
  const onChange = tab === "cognitive" ? setCog : setSrv;
  const fileName = (fullPath || "my-script") + (tab === "cognitive" ? ".cog.ts" : ".srv.ts");

  return (
    <div style={{ maxWidth: 980 }}>
      <a href="#/scripts" className="mb-3 inline-flex items-center" style={{ gap: 6, fontSize: "var(--fs-sm)", color: "var(--text-2)", fontWeight: 600 }}>
        <Icon name="arrowLeft" size={14} /> {t("scripts.back")}
      </a>
      <div style={{ marginBottom: "var(--gap)" }}>
        <h1 style={{ margin: 0, fontSize: "var(--fs-h1)", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-0)" }}>{t("new_script.title")}</h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>{t("new_script.subtitle")}</p>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div className="zs-newpath grid items-start" style={{ gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
          {/* folder picker */}
          <div className="relative">
            <label className="mb-1.5 block" style={{ fontSize: "var(--fs-xs)", color: "var(--text-2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {t("new_script.folder")} <span style={{ color: "var(--text-3)", fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>{t("new_script.folder_hint")}</span>
            </label>
            <Input value={folder} onChange={(v) => { setFolder(v); setShowSug(true); }} placeholder="analysis/deep" icon="database" mono
              onKeyDown={() => setShowSug(true)} />
            {showSug && folder && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 z-30 overflow-hidden rounded-[var(--r-md)]"
                style={{ top: 60, background: "var(--bg-1)", border: "1px solid var(--border-2)", boxShadow: "var(--shadow)", padding: 4 }}>
                {suggestions.map((f) => (
                  <button key={f} onClick={() => { setFolder(f); setShowSug(false); }}
                    className="mono flex w-full cursor-pointer items-center rounded-[var(--r-sm)] border-none text-left"
                    style={{ gap: 8, padding: "7px 9px", background: "transparent", color: "var(--text-1)", fontSize: "var(--fs-sm)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-2)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <Icon name="database" size={13} style={{ color: "var(--accent)" }} />{f}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* name */}
          <div>
            <label className="mb-1.5 block" style={{ fontSize: "var(--fs-xs)", color: "var(--text-2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{t("new_script.name")}</label>
            <Input value={name} onChange={setName} placeholder="my-script" mono autoFocus onKeyDown={() => setShowSug(false)} />
          </div>
        </div>

        {/* path preview + add srv */}
        <div className="mt-4 flex flex-wrap items-center" style={{ gap: 16 }}>
          <div className="flex flex-1 items-center" style={{ gap: 8, minWidth: 220 }}>
            <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-2)", fontWeight: 600 }}>{t("new_script.path")}</span>
            <code className="mono rounded-[var(--r-sm)] border border-[var(--border)]" style={{ fontSize: "var(--fs-sm)", padding: "5px 10px", background: "var(--bg-inset)", color: liveErr ? "var(--text-2)" : "var(--text-0)" }}>
              {cleanFolder && <span style={{ color: "var(--text-3)" }}>{cleanFolder}/</span>}
              <span style={{ fontWeight: 700 }}>{name.trim() || "…"}</span>
            </code>
            {!liveErr && name.trim() && <Icon name="check" size={15} style={{ color: "var(--st-done)" }} />}
          </div>
          <label className="flex cursor-pointer items-center" style={{ gap: 9 }}>
            <Toggle on={addSrv} onClick={() => setAddSrv((s) => !s)} />
            <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600 }}>{t("new_script.add_srv")}</span>
          </label>
        </div>
        {liveErr && name.trim() && (
          <div className="mt-2.5 flex items-center" style={{ gap: 6, fontSize: "var(--fs-xs)", color: "var(--st-halted)" }}>
            <Icon name="alert" size={13} />{liveErr}
          </div>
        )}
      </Card>

      <div className="flex items-end justify-between" style={{ gap: 12 }}>
        <Tabs tabs={addSrv ? [{ id: "cognitive", label: t("new_script.cognitive") }, { id: "server", label: t("new_script.server") }] : [{ id: "cognitive", label: t("new_script.cognitive") }]} active={tab} onChange={setTab} />
        <div style={{ paddingBottom: 6 }}>
          <Button variant="primary" icon="plus" disabled={!!liveErr || !name.trim()} onClick={create}>{t("new_script.create")}</Button>
        </div>
      </div>

      <div className="mt-3.5" style={{ height: 360 }}>
        <ZsMonacoEditor value={value} onChange={onChange} file={fileName} theme={theme} />
      </div>

      {result && (
        <div className="mt-3.5">
          {result.err ? (
            <div className="flex items-center rounded-[var(--r-md)]" style={{ gap: 9, padding: "11px 14px", border: "1px solid color-mix(in oklch, var(--trust-error) 45%, transparent)", color: "var(--trust-error)", background: "color-mix(in oklch, var(--trust-error) 10%, transparent)", fontSize: "var(--fs-sm)", fontWeight: 600 }}>
              <Icon name="x" size={15} /> {result.err}
            </div>
          ) : (
            <div className="flex items-center rounded-[var(--r-md)]" style={{ gap: 9, padding: "11px 14px", border: "1px solid color-mix(in oklch, var(--st-done) 45%, transparent)", color: "var(--st-done)", background: "color-mix(in oklch, var(--st-done) 10%, transparent)", fontSize: "var(--fs-sm)", fontWeight: 600 }}>
              <Icon name="check" size={15} /> {t("new_script.validated")} <span className="mono">{result.path}</span>. {t("new_script.redirecting")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
