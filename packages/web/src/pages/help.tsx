import { useState, useEffect, useMemo, useRef } from "react";
import { Icon } from "../ui/icon";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Markdown } from "../ui/markdown";
import { loadDocs, type DocsData, type DocEntry } from "../data/docs-store";
import { useLocale, useT } from "../i18n/context";
import { navigate } from "../router";

function useDocs() {
  const { locale } = useLocale();
  const [state, setState] = useState<{ loading: boolean; data: DocsData | null; error: string | null }>({ loading: true, data: null, error: null });
  useEffect(() => {
    let alive = true;
    setState({ loading: true, data: null, error: null });
    loadDocs(locale)
      .then((d) => alive && setState({ loading: false, data: d, error: null }))
      .catch((e: unknown) => alive && setState({ loading: false, data: null, error: String(e) }));
    return () => { alive = false; };
  }, [locale]);
  return state;
}

const kbdStyle = { marginLeft: 6, padding: "1px 6px", borderRadius: 5, background: "var(--bg-0)", border: "1px solid var(--border)", fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-2)" } as const;

function RelGroup({ title, slugs, data, icon }: { title: string; slugs: string[]; data: DocsData; icon: string }) {
  if (!slugs.length) return <div />;
  return (
    <div>
      <div style={{ fontSize: "var(--fs-xs)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 700, color: "var(--text-3)", marginBottom: 8 }}>{title}</div>
      <div className="flex flex-col" style={{ gap: 6 }}>
        {slugs.map((s) => {
          const d = data.bySlug[s];
          if (!d) return null;
          return (
            <a key={s} href={"#/help/" + s} className="flex items-center rounded-[var(--r-md)] border border-[var(--border)]"
              style={{ gap: 8, padding: "9px 11px", background: "var(--bg-1)", fontSize: "var(--fs-sm)", fontWeight: 600 }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}>
              <Icon name={icon} size={13} style={{ color: "var(--text-3)" }} />{d.title}
            </a>
          );
        })}
      </div>
    </div>
  );
}

function PrevNext({ dir, doc, prevLabel, nextLabel }: { dir: "prev" | "next"; doc: DocEntry; prevLabel: string; nextLabel: string }) {
  const isNext = dir === "next";
  return (
    <a href={"#/help/" + doc.slug} className="flex flex-1 flex-col rounded-[var(--r-md)] border border-[var(--border)]"
      style={{ gap: 3, padding: "12px 14px", background: "var(--bg-1)", textAlign: isNext ? "right" : "left" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-2)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}>
      <span className="flex items-center" style={{ gap: 5, fontSize: "var(--fs-xs)", color: "var(--text-3)", justifyContent: isNext ? "flex-end" : "flex-start" }}>
        {!isNext && <Icon name="chevronLeft" size={12} />}{isNext ? nextLabel : prevLabel}{isNext && <Icon name="chevronRight" size={12} />}
      </span>
      <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--text-0)" }}>{doc.title}</span>
    </a>
  );
}

export function Help({ slug }: { slug?: string }) {
  const { loading, data, error } = useDocs();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    contentRef.current?.closest("main")?.scrollTo(0, 0);
  }, [slug]);
  const t = useT();

  if (loading) return (
    <div>
      <div style={{ marginBottom: "var(--gap)" }}>
        <h1 style={{ margin: 0, fontSize: "var(--fs-h1)", fontWeight: 700, color: "var(--text-0)" }}>Help</h1>
        <p style={{ margin: "4px 0 0", color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>Loading documentation…</p>
      </div>
    </div>
  );
  if (error || !data || !data.docs.length) return (
    <div className="flex flex-col items-center justify-center" style={{ padding: "56px 24px", color: "var(--text-2)" }}>
      <Icon name="alert" size={28} style={{ color: "var(--text-3)" }} />
      <div style={{ fontWeight: 600, color: "var(--text-1)", marginTop: 10 }}>Docs unavailable</div>
      <div style={{ fontSize: "var(--fs-sm)", marginTop: 4 }}>{error ?? "No documentation files found."}</div>
    </div>
  );

  const flat = data.tree.flatMap((g) => g.items);
  const current = (slug && data.bySlug[slug]) || flat[0]!;
  const idx = flat.findIndex((d) => d.slug === current.slug);
  const prev = flat[idx - 1];
  const next = flat[idx + 1];
  const bodyNoTitle = current.body.replace(/^\s*#\s+.*\n/, "");

  return (
    <div ref={contentRef}>
      <div className="flex flex-wrap items-start justify-between" style={{ gap: 16, marginBottom: "var(--gap)" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "var(--fs-h1)", fontWeight: 700, color: "var(--text-0)" }}>Help</h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>Concepts & reference for Zobr Script</p>
        </div>
        <Button variant="default" icon="search" onClick={() => window.dispatchEvent(new CustomEvent("zs-open-palette"))}>
          Search <kbd style={kbdStyle}>⌘K</kbd>
        </Button>
      </div>

      <div className="zs-help flex items-start" style={{ gap: 28 }}>
        {/* tree */}
        <nav className="zs-help-tree sticky top-0 shrink-0" style={{ width: 232 }}>
          {data.tree.map((grp) => (
            <div key={grp.category} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: "var(--fs-xs)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700, color: "var(--text-3)", padding: "0 10px 6px" }}>{grp.category}</div>
              {grp.items.map((d) => {
                const on = d.slug === current.slug;
                return (
                  <a key={d.slug} href={"#/help/" + d.slug}
                    className="block rounded-[var(--r-md)]"
                    style={{ padding: "7px 10px", fontSize: "var(--fs-sm)", fontWeight: on ? 600 : 500, color: on ? "var(--text-0)" : "var(--text-1)", background: on ? "var(--bg-2)" : "transparent", borderLeft: `2px solid ${on ? "var(--accent)" : "transparent"}` }}
                    onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "var(--bg-1)"; }}
                    onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}>
                    {d.title}
                  </a>
                );
              })}
            </div>
          ))}
        </nav>

        {/* content */}
        <article className="min-w-0 flex-1" style={{ maxWidth: 760 }}>
          <div className="flex" style={{ gap: 8, marginBottom: 4 }}>
            {current.tags.map((t) => <Badge key={t} color="var(--text-2)">{t}</Badge>)}
          </div>
          <h1 style={{ margin: "6px 0 0", fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>{current.title}</h1>
          {current.summary && <p style={{ margin: "10px 0 0", fontSize: 16, color: "var(--text-2)", lineHeight: 1.6 }}>{current.summary}</p>}
          <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "20px 0" }} />
          <Markdown body={bodyNoTitle} />

          {(current.related.length > 0 || current.backlinks.length > 0) && (
            <div className="zs-help-rel mt-8 grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <RelGroup title={t("help.related")} slugs={current.related} data={data} icon="external" />
              <RelGroup title={t("help.referenced_by")} slugs={current.backlinks} data={data} icon="activity" />
            </div>
          )}

          <div className="mt-7 flex" style={{ gap: 12 }}>
            {prev ? <PrevNext dir="prev" doc={prev} prevLabel={t("help.previous")} nextLabel={t("help.next")} /> : <div className="flex-1" />}
            {next ? <PrevNext dir="next" doc={next} prevLabel={t("help.previous")} nextLabel={t("help.next")} /> : <div className="flex-1" />}
          </div>
        </article>
      </div>
    </div>
  );
}

// Command Palette
function snippet(body: string, q: string) {
  const text = body.replace(/```[\s\S]*?```/g, " ").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[#>*`|]/g, "").replace(/\s+/g, " ").trim();
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return text.slice(0, 90) + "…";
  const start = Math.max(0, i - 35);
  return (start > 0 ? "…" : "") + text.slice(start, i + q.length + 55).trim() + "…";
}

export function CommandPalette() {
  const { data } = useDocs();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("zs-open-palette" as string, onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("zs-open-palette" as string, onOpen); };
  }, []);

  useEffect(() => {
    if (open) { setQ(""); setSel(0); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open]);

  const results = useMemo(() => {
    if (!data) return [];
    const docs = data.docs;
    if (!q.trim()) return docs.map((d) => ({ d, text: d.summary }));
    const ql = q.toLowerCase();
    const scored: { d: DocEntry; score: number; text: string }[] = [];
    docs.forEach((d) => {
      const inTitle = d.title.toLowerCase().includes(ql);
      const inTags = d.tags.some((t) => t.includes(ql));
      const inBody = d.body.toLowerCase().includes(ql);
      const inSummary = d.summary.toLowerCase().includes(ql);
      if (inTitle || inTags || inBody || inSummary) {
        scored.push({
          d,
          score: inTitle ? 0 : inSummary ? 1 : inTags ? 2 : 3,
          text: inBody && !inTitle ? snippet(d.body, q) : d.summary,
        });
      }
    });
    return scored.sort((a, b) => a.score - b.score).map(({ d, text }) => ({ d, text }));
  }, [q, data]);

  useEffect(() => { setSel(0); }, [q]);
  if (!open) return null;

  const go = (r: { d: DocEntry } | undefined) => { if (!r) return; navigate("/help/" + r.d.slug); setOpen(false); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); go(results[sel]); }
  };

  return (
    <div onClick={() => setOpen(false)} className="fixed inset-0 z-[100] flex items-start justify-center"
      style={{ background: "var(--overlay)", paddingTop: "12vh", backdropFilter: "blur(2px)" }}>
      <div onClick={(e) => e.stopPropagation()} className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--border-2)]"
        style={{ width: "min(620px, 92vw)", background: "var(--bg-1)", boxShadow: "var(--shadow)" }}>
        <div className="flex items-center border-b border-[var(--border)]" style={{ gap: 10, padding: "13px 16px" }}>
          <Icon name="search" size={17} style={{ color: "var(--text-2)" }} />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Search the docs…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text-0)", fontSize: 15, fontFamily: "inherit" }} />
          <kbd style={kbdStyle}>esc</kbd>
        </div>
        <div style={{ maxHeight: 380, overflowY: "auto", padding: 8 }}>
          {results.length === 0 ? (
            <div className="text-center" style={{ padding: "28px 16px", color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>No matches for &quot;{q}&quot;</div>
          ) : results.map((r, k) => (
            <button key={r.d.slug} onClick={() => go(r)} onMouseEnter={() => setSel(k)}
              className="flex w-full cursor-pointer items-start rounded-[var(--r-md)] border-none text-left"
              style={{ gap: 11, padding: "10px 12px", background: sel === k ? "var(--bg-2)" : "transparent" }}>
              <Icon name="doc" size={15} style={{ color: "var(--text-3)", marginTop: 2, flexShrink: 0 }} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center" style={{ gap: 8 }}>
                  <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--text-0)" }}>{r.d.title}</span>
                  <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-3)" }}>{r.d.category}</span>
                </span>
                {r.text && <span className="block overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: "var(--fs-xs)", color: "var(--text-2)", marginTop: 2 }}>{r.text}</span>}
              </span>
              {sel === k && <kbd style={{ ...kbdStyle, marginLeft: 0 }}>↵</kbd>}
            </button>
          ))}
        </div>
        <div className="flex border-t border-[var(--border)]" style={{ gap: 14, padding: "8px 14px", fontSize: "var(--fs-xs)", color: "var(--text-3)" }}>
          <span><kbd style={kbdStyle}>↑</kbd><kbd style={kbdStyle}>↓</kbd> navigate</span>
          <span><kbd style={kbdStyle}>↵</kbd> open</span>
          <div className="flex-1" />
          <span>{results.length} {results.length === 1 ? "result" : "results"}</span>
        </div>
      </div>
    </div>
  );
}
