import type { ReactNode } from "react";
import { CodeBlock } from "./code-block";

const CODE_LANGS = new Set(["ts", "typescript", "tsx", "js", "javascript", "jsx"]);

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function inline(text: string, kp: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let rest = text;
  let i = 0;
  const pats = [
    { re: /`([^`]+)`/, kind: "code" },
    { re: /\[([^\]]+)\]\(([^)]+)\)/, kind: "link" },
    { re: /\*\*([^*]+)\*\*/, kind: "bold" },
    { re: /\*([^*]+)\*/, kind: "italic" },
  ] as const;

  while (rest) {
    let best: { p: (typeof pats)[number]; m: RegExpExecArray } | null = null;
    for (const p of pats) {
      const m = p.re.exec(rest);
      if (m && (!best || m.index < best.m.index)) best = { p, m };
    }
    if (!best) { nodes.push(rest); break; }
    const { p, m } = best;
    if (m.index > 0) nodes.push(rest.slice(0, m.index));
    const key = kp + "-" + (i++);
    if (p.kind === "code") nodes.push(<code key={key} className="zs-md-code">{m[1]}</code>);
    else if (p.kind === "bold") nodes.push(<strong key={key}>{inline(m[1]!, key)}</strong>);
    else if (p.kind === "italic") nodes.push(<em key={key}>{inline(m[1]!, key)}</em>);
    else if (p.kind === "link") {
      const href = m[2]!;
      const external = /^https?:/.test(href);
      const to = external ? href : (href.startsWith("#") || href.startsWith("/")) ? href : "#/help/" + href;
      nodes.push(
        <a key={key} href={to} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
          style={{ color: "var(--accent)", fontWeight: 500, textDecoration: "none", borderBottom: "1px solid color-mix(in oklch, var(--accent) 35%, transparent)" }}>
          {m[1]}{external && " ↗"}
        </a>,
      );
    }
    rest = rest.slice(m.index + m[0].length);
  }
  return nodes;
}

export function Markdown({ body }: { body: string }) {
  const lines = (body || "").replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) { i++; continue; }

    // fenced code
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim().toLowerCase();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith("```")) { buf.push(lines[i]!); i++; }
      i++;
      const code = buf.join("\n");
      blocks.push(
        <div key={blocks.length} className="my-4 overflow-hidden rounded-[var(--r-md)] border border-[var(--border)]">
          {CODE_LANGS.has(lang)
            ? <CodeBlock code={code} />
            : <pre className="mono" style={{ margin: 0, padding: "12px 16px", background: "var(--bg-inset)", fontSize: "var(--fs-code)", overflow: "auto", lineHeight: 1.6 }}>{code}</pre>}
        </div>,
      );
      continue;
    }

    // heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const lvl = h[1]!.length;
      const txt = h[2]!;
      const id = slugify(txt);
      const size = ({ 1: 26, 2: 19, 3: 16, 4: 14 } as Record<number, number>)[lvl] ?? 14;
      blocks.push(
        <div key={blocks.length} id={id} style={{
          scrollMarginTop: 16, fontSize: size, fontWeight: 700, letterSpacing: "-0.01em",
          color: "var(--text-0)", margin: lvl <= 2 ? "26px 0 10px" : "20px 0 8px", lineHeight: 1.25,
        }}>
          {inline(txt, "h" + blocks.length)}
        </div>,
      );
      i++;
      continue;
    }

    // hr
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      blocks.push(<hr key={blocks.length} style={{ border: "none", borderTop: "1px solid var(--border)", margin: "22px 0" }} />);
      i++;
      continue;
    }

    // table
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]!) && lines[i + 1]!.includes("-")) {
      const parseRow = (l: string) => {
        const cells = l.split("|").map((c) => c.trim());
        if (cells[0] === "") cells.shift();
        if (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
        return cells;
      };
      const head = parseRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.includes("|") && lines[i]!.trim()) {
        rows.push(parseRow(lines[i]!));
        i++;
      }
      blocks.push(
        <div key={blocks.length} className="my-4 overflow-hidden rounded-[var(--r-md)] border border-[var(--border)]">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-sm)" }}>
            <thead>
              <tr style={{ background: "var(--bg-2)" }}>
                {head.map((c, k) => <th key={k} style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "var(--text-1)", borderBottom: "1px solid var(--border)" }}>{inline(c, "th" + k)}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} style={{ borderBottom: ri === rows.length - 1 ? "none" : "1px solid var(--border)" }}>
                  {r.map((c, ci) => <td key={ci} style={{ padding: "8px 12px", color: "var(--text-1)", verticalAlign: "top" }}>{inline(c, `td${ri}-${ci}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // blockquote / callout
    if (line.startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i]!.startsWith(">")) { buf.push(lines[i]!.replace(/^>\s?/, "")); i++; }
      const joined = buf.join(" ").trim();
      const cm = joined.match(/^\*\*(Note|Tip|Warning):\*\*\s*([\s\S]*)$/);
      const kind = cm ? cm[1] : null;
      const accent = kind === "Warning" ? "var(--st-halted)" : kind === "Tip" ? "var(--st-done)" : "var(--accent)";
      const txt = cm ? cm[2]! : joined;
      blocks.push(
        <div key={blocks.length} style={{
          margin: "16px 0", padding: "11px 14px", borderRadius: "var(--r-md)",
          borderLeft: `3px solid ${accent}`, background: `color-mix(in oklch, ${accent} 9%, transparent)`,
          color: "var(--text-1)", fontSize: "var(--fs-sm)",
        }}>
          {kind && <span style={{ fontWeight: 700, color: accent, marginRight: 6 }}>{kind}</span>}
          {inline(txt, "bq" + blocks.length)}
        </div>,
      );
      continue;
    }

    // lists
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      const itemRe = ordered ? /^\s*\d+\.\s+(.*)$/ : /^\s*[-*]\s+(.*)$/;
      while (i < lines.length && itemRe.test(lines[i]!)) { items.push(lines[i]!.match(itemRe)![1]!); i++; }
      const Tag = ordered ? "ol" : "ul";
      blocks.push(
        <Tag key={blocks.length} style={{ margin: "10px 0", paddingLeft: 22, color: "var(--text-1)", fontSize: "var(--fs-base)", lineHeight: 1.6 }}>
          {items.map((it, k) => <li key={k} style={{ margin: "4px 0" }}>{inline(it, `li${blocks.length}-${k}`)}</li>)}
        </Tag>,
      );
      continue;
    }

    // paragraph
    const para = [line];
    i++;
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,6}\s|```|>|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i]!) && !(lines[i]!.includes("|") && i + 1 < lines.length)) {
      para.push(lines[i]!);
      i++;
    }
    blocks.push(
      <p key={blocks.length} style={{ margin: "12px 0", color: "var(--text-1)", fontSize: "var(--fs-base)", lineHeight: 1.7 }}>
        {inline(para.join(" "), "p" + blocks.length)}
      </p>,
    );
  }

  return <div className="zs-md">{blocks}</div>;
}

export { slugify };
