import { useState } from "react";
import { Icon } from "../ui/icon";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Tabs } from "../ui/tabs";
import { Toggle } from "../ui/toggle";
import { ZsMonacoEditor } from "../ui/monaco-editor";
import { navigate } from "../router";
import { api } from "../api/client";

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

export function NewScript({ theme }: { theme: "dark" | "light" }) {
  const [name, setName] = useState("");
  const [addSrv, setAddSrv] = useState(false);
  const [tab, setTab] = useState("cognitive");
  const [cog, setCog] = useState(TEMPLATE_COG);
  const [srv, setSrv] = useState(TEMPLATE_SRV);
  const [result, setResult] = useState<{ err?: string; ok?: boolean } | null>(null);

  const create = async () => {
    if (!name.trim()) {
      setResult({ err: "Script name is required." });
      return;
    }
    try {
      const res = await api.post<{ ok: boolean; errors?: string[] }>("/scripts", {
        script_ref: name.trim(),
        cog: [{ name: `${name.trim()}.cog.ts`, content: cog }],
        srv: addSrv ? [{ name: `${name.trim()}.srv.ts`, content: srv }] : [],
      });
      if (res.ok) {
        setResult({ ok: true });
        setTimeout(() => navigate("/scripts"), 700);
      } else {
        setResult({ err: res.errors?.join("; ") ?? "Validation failed" });
      }
    } catch (e) {
      setResult({ err: (e as Error).message });
    }
  };

  const fileName = (name || "my-script") + (tab === "cognitive" ? ".cog.ts" : ".srv.ts");
  const value = tab === "cognitive" ? cog : srv;
  const onChange = tab === "cognitive" ? setCog : setSrv;

  return (
    <div style={{ maxWidth: 980 }}>
      <a
        href="#/scripts"
        className="mb-3 inline-flex items-center"
        style={{ gap: 6, fontSize: "var(--fs-sm)", color: "var(--text-2)", fontWeight: 600 }}
      >
        <Icon name="arrowLeft" size={14} /> Scripts
      </a>

      <div style={{ marginBottom: "var(--gap)" }}>
        <h1 style={{ margin: 0, fontSize: "var(--fs-h1)", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-0)" }}>
          New script
        </h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>
          Create a cognitive script, optionally with a server module. Validated on create.
        </p>
      </div>

      {/* name + toggle */}
      <Card style={{ marginBottom: 16 }}>
        <div className="flex flex-wrap items-end" style={{ gap: 24 }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <label
              className="mb-1.5 block"
              style={{ fontSize: "var(--fs-xs)", color: "var(--text-2)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}
            >
              Script name
            </label>
            <Input value={name} onChange={setName} placeholder="my-script" mono autoFocus />
          </div>
          <label className="flex cursor-pointer items-center" style={{ gap: 9, paddingBottom: 8 }}>
            <Toggle on={addSrv} onClick={() => setAddSrv((s) => !s)} />
            <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600 }}>Add server module</span>
          </label>
        </div>
      </Card>

      {/* tabs + create */}
      <div className="flex items-end justify-between" style={{ gap: 12 }}>
        <Tabs
          tabs={
            addSrv
              ? [{ id: "cognitive", label: "Cognitive" }, { id: "server", label: "Server" }]
              : [{ id: "cognitive", label: "Cognitive" }]
          }
          active={tab}
          onChange={setTab}
        />
        <div style={{ paddingBottom: 6 }}>
          <Button variant="primary" icon="plus" onClick={create}>
            Create
          </Button>
        </div>
      </div>

      {/* editor */}
      <div className="mt-3.5" style={{ height: 360 }}>
        <ZsMonacoEditor
          value={value}
          onChange={onChange}
          file={fileName}
          theme={theme}
        />
      </div>

      {/* result */}
      {result && (
        <div className="mt-3.5">
          {result.err ? (
            <div
              className="flex items-center rounded-[var(--r-md)]"
              style={{
                gap: 9,
                padding: "11px 14px",
                border: "1px solid color-mix(in oklch, var(--trust-error) 45%, transparent)",
                color: "var(--trust-error)",
                background: "color-mix(in oklch, var(--trust-error) 10%, transparent)",
                fontSize: "var(--fs-sm)",
                fontWeight: 600,
              }}
            >
              <Icon name="x" size={15} /> {result.err}
            </div>
          ) : (
            <div
              className="flex items-center rounded-[var(--r-md)]"
              style={{
                gap: 9,
                padding: "11px 14px",
                border: "1px solid color-mix(in oklch, var(--st-done) 45%, transparent)",
                color: "var(--st-done)",
                background: "color-mix(in oklch, var(--st-done) 10%, transparent)",
                fontSize: "var(--fs-sm)",
                fontWeight: 600,
              }}
            >
              <Icon name="check" size={15} /> Validated · script created. Redirecting…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
