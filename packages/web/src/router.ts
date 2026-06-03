import { useState, useEffect } from "react";

export interface Route {
  path: string;
  query: URLSearchParams;
}

function parseHash(): Route {
  let h = window.location.hash.replace(/^#/, "");
  if (!h) h = "/";
  const [path, query] = h.split("?");
  return { path: path!, query: new URLSearchParams(query ?? "") };
}

export function navigate(to: string) {
  window.location.hash = to;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const handler = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  return route;
}

export function useQueryParam(key: string, fallback = ""): [string, (v: string) => void] {
  const [val, setVal] = useState(() => parseHash().query.get(key) ?? fallback);
  useEffect(() => {
    const handler = () => setVal(parseHash().query.get(key) ?? fallback);
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, [key, fallback]);
  const setValue = (v: string) => {
    const cur = parseHash();
    const q = new URLSearchParams(cur.query);
    if (v && v !== fallback) q.set(key, v);
    else q.delete(key);
    const qs = q.toString();
    window.location.hash = cur.path + (qs ? "?" + qs : "");
  };
  return [val, setValue];
}

export function match(
  pattern: string,
  path: string,
): Record<string, string> | null {
  const pp = pattern.split("/").filter(Boolean);
  const ap = path.split("/").filter(Boolean);
  if (pattern === "/") return path === "/" ? {} : null;
  if (pp.length !== ap.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i]!.startsWith(":")) params[pp[i]!.slice(1)] = decodeURIComponent(ap[i]!);
    else if (pp[i] !== ap[i]) return null;
  }
  return params;
}
