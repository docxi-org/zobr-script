import { useRef, useEffect } from "react";

const KEYWORDS = new Set(
  "export function const let var return if else for while type interface class extends import from default async await new this void number string boolean true false null undefined as keyof typeof in of switch case break continue try catch throw".split(" "),
);
const ZS_PRIMS = new Set(
  "survey doubt commit synthesize checkpoint conclude report invoke".split(" "),
);
const TYPES = new Set("Result Digest Greeting ZsScript Promise".split(" "));

interface Token {
  text: string;
  cls: string;
}

interface TokenState {
  block: boolean;
}

function tokenizeLine(line: string, state: TokenState): Token[] {
  const out: Token[] = [];
  let i = 0;
  if (state.block) {
    const end = line.indexOf("*/");
    if (end === -1) {
      out.push({ text: line, cls: "c" });
      return out;
    }
    out.push({ text: line.slice(0, end + 2), cls: "c" });
    state.block = false;
    i = end + 2;
  }
  const n = line.length;
  while (i < n) {
    const ch = line[i]!;
    if (ch === "/" && line[i + 1] === "/") {
      out.push({ text: line.slice(i), cls: "c" });
      break;
    }
    if (ch === "/" && line[i + 1] === "*") {
      const end = line.indexOf("*/", i + 2);
      if (end === -1) {
        out.push({ text: line.slice(i), cls: "c" });
        state.block = true;
        break;
      }
      out.push({ text: line.slice(i, end + 2), cls: "c" });
      i = end + 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < n && line[j] !== ch) {
        if (line[j] === "\\") j++;
        j++;
      }
      out.push({ text: line.slice(i, Math.min(j + 1, n)), cls: "s" });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_$]/.test(line[j]!)) j++;
      const word = line.slice(i, j);
      const after = /^\s*\(/.test(line.slice(j));
      let cls = "id";
      if (KEYWORDS.has(word)) cls = "k";
      else if (ZS_PRIMS.has(word)) cls = "zs";
      else if (TYPES.has(word) || /^[A-Z]/.test(word)) cls = "t";
      else if (after) cls = "fn";
      out.push({ text: word, cls });
      i = j;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i + 1;
      while (j < n && /[0-9.eE_]/.test(line[j]!)) j++;
      out.push({ text: line.slice(i, j), cls: "num" });
      i = j;
      continue;
    }
    if (/[{}()\[\];,.<>:?=&|!+\-*/%]/.test(ch)) {
      out.push({ text: ch, cls: "p" });
      i++;
      continue;
    }
    out.push({ text: ch, cls: "" });
    i++;
  }
  return out;
}

const COLORS: Record<string, string> = {
  k: "var(--cc-k)",
  s: "var(--cc-s)",
  c: "var(--cc-c)",
  num: "var(--cc-num)",
  t: "var(--cc-t)",
  fn: "var(--cc-fn)",
  zs: "var(--cc-zs)",
  p: "var(--cc-p)",
  id: "var(--cc-id)",
};

interface CodeBlockProps {
  code: string;
  highlightLine?: number | null;
  startLine?: number;
}

export function CodeBlock({ code, highlightLine, startLine = 1 }: CodeBlockProps) {
  const lines = (code || "").replace(/\n$/, "").split("\n");
  const state: TokenState = { block: false };
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlightLine && ref.current) {
      const el = ref.current.querySelector(`[data-ln="${highlightLine}"]`);
      if (el instanceof HTMLElement) {
        const top = el.offsetTop - ref.current.clientHeight / 2 + el.clientHeight;
        ref.current.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      }
    }
  }, [highlightLine]);

  return (
    <div
      ref={ref}
      className="mono"
      style={{
        overflow: "auto",
        fontSize: "var(--fs-code)",
        lineHeight: 1.65,
        background: "var(--bg-inset)",
        height: "100%",
      }}
    >
      <div style={{ minWidth: "min-content" }}>
        {lines.map((ln, idx) => {
          const lineNo = startLine + idx;
          const toks = tokenizeLine(ln, state);
          const hl = highlightLine === lineNo;
          return (
            <div
              key={idx}
              data-ln={lineNo}
              className="flex items-start"
              style={{
                background: hl
                  ? "color-mix(in oklch, var(--accent) 14%, transparent)"
                  : "transparent",
                borderLeft: `2px solid ${hl ? "var(--accent)" : "transparent"}`,
              }}
            >
              <span
                style={{
                  width: 44,
                  flexShrink: 0,
                  textAlign: "right",
                  paddingRight: 14,
                  paddingLeft: 8,
                  color: hl ? "var(--text-1)" : "var(--text-3)",
                  userSelect: "none",
                  borderRight: "1px solid var(--border)",
                }}
              >
                {lineNo}
              </span>
              <code
                style={{
                  paddingLeft: 14,
                  paddingRight: 16,
                  whiteSpace: "pre",
                  flex: 1,
                  lineHeight: 1.65,
                }}
              >
                {toks.length === 0
                  ? " "
                  : toks.map((t, k) => (
                      <span key={k} style={{ color: COLORS[t.cls] ?? "var(--cc-id)" }}>
                        {t.text}
                      </span>
                    ))}
              </code>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function JsonView({ data }: { data: unknown }) {
  const json = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const html = json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/("(\\.|[^"\\])*")(\s*:)?/g, (_m, str: string, _g: string, colon: string | undefined) =>
      colon
        ? `<span style="color:var(--cc-key)">${str}</span>${colon}`
        : `<span style="color:var(--cc-s)">${str}</span>`,
    )
    .replace(/\b(true|false|null)\b/g, '<span style="color:var(--cc-k)">$1</span>')
    .replace(/\b(-?\d+\.?\d*)\b/g, '<span style="color:var(--cc-num)">$1</span>');
  return (
    <pre
      className="mono"
      style={{
        margin: 0,
        fontSize: "var(--fs-code)",
        lineHeight: 1.6,
        color: "var(--cc-id)",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
