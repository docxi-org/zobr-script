import type { Locale } from "../i18n/context";

const FILES = [
  // What is ZS
  "concepts/what-is-zs",
  "concepts/how-scripts-work",
  "concepts/how-execution-works",
  "concepts/connecting",
  // Key concepts
  "concepts/trace",
  "concepts/trust-classes",
  "concepts/coverage",
  "concepts/checkpoints",
  // Scripting
  "scripting/server-module",
  "scripting/store",
  "scripting/library",
  // Platform
  "platform/agents",
  "platform/hot-cold",
];

export interface DocEntry {
  slug: string;
  path: string;
  title: string;
  category: string;
  order: number;
  summary: string;
  tags: string[];
  related: string[];
  body: string;
  backlinks: string[];
}

export interface DocsData {
  docs: DocEntry[];
  bySlug: Record<string, DocEntry>;
  tree: { category: string; items: DocEntry[] }[];
}

function parseFrontmatter(text: string): { data: Record<string, unknown>; body: string } {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  const data: Record<string, unknown> = {};
  m[1]!.split("\n").forEach((line) => {
    const i = line.indexOf(":");
    if (i === -1) return;
    const key = line.slice(0, i).trim();
    let val: unknown = line.slice(i + 1).trim();
    if (typeof val === "string" && val.startsWith("[") && val.endsWith("]")) {
      val = val.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
    } else if (typeof val === "string" && /^\d+$/.test(val)) {
      val = parseInt(val, 10);
    }
    data[key] = val;
  });
  return { data, body: m[2]! };
}

const slugOf = (path: string) => path.split("/").pop()!;

const cache = new Map<Locale, DocsData>();
const inflight = new Map<Locale, Promise<DocsData>>();

export async function loadDocs(locale: Locale = "en"): Promise<DocsData> {
  const cached = cache.get(locale);
  if (cached) return cached;
  const existing = inflight.get(locale);
  if (existing) return existing;

  const promise = (async () => {
    const docs: DocEntry[] = [];
    for (const path of FILES) {
      try {
        const res = await fetch(`docs/${locale}/${path}.md`);
        if (!res.ok) throw new Error(String(res.status));
        const text = await res.text();
        const { data, body } = parseFrontmatter(text);
        docs.push({
          slug: slugOf(path),
          path,
          title: (data["title"] as string) || slugOf(path),
          category: (data["category"] as string) || "Docs",
          order: typeof data["order"] === "number" ? data["order"] : 99,
          summary: (data["summary"] as string) || "",
          tags: Array.isArray(data["tags"]) ? data["tags"] as string[] : [],
          related: Array.isArray(data["related"]) ? data["related"] as string[] : [],
          body,
          backlinks: [],
        });
      } catch {
        // skip missing files
      }
    }
    const bySlug = Object.fromEntries(docs.map((d) => [d.slug, d]));
    docs.forEach((d) => {
      const linked = new Set(d.related);
      const re = /\]\(([a-z0-9-]+)\)/g;
      let mm;
      while ((mm = re.exec(d.body))) {
        if (bySlug[mm[1]!] && mm[1] !== d.slug) linked.add(mm[1]!);
      }
      linked.forEach((s) => {
        const t = bySlug[s];
        if (t && !t.backlinks.includes(d.slug)) t.backlinks.push(d.slug);
      });
    });
    const CATEGORY_ORDER: Record<string, number> = {
      "What is ZS": 0, "Key concepts": 1, "Scripting": 2, "Platform": 3,
      "Что такое ZS": 0, "Ключевые понятия": 1, "Скрипты": 2, "Платформа": 3,
    };
    const catOrd = (c: string) => CATEGORY_ORDER[c] ?? 99;
    docs.sort((a, b) => catOrd(a.category) - catOrd(b.category) || a.order - b.order);
    const tree: { category: string; items: DocEntry[] }[] = [];
    docs.forEach((d) => {
      let grp = tree.find((g) => g.category === d.category);
      if (!grp) { grp = { category: d.category, items: [] }; tree.push(grp); }
      grp.items.push(d);
    });
    const result: DocsData = { docs, bySlug, tree };
    cache.set(locale, result);
    return result;
  })();

  inflight.set(locale, promise);
  return promise;
}
