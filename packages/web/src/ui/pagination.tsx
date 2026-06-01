import { Button } from "./button";

interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
}

export function Pagination({ total, limit, offset, onChange }: PaginationProps) {
  const pages = Math.ceil(total / limit);
  const cur = Math.floor(offset / limit) + 1;

  if (pages <= 1)
    return (
      <div
        className="flex justify-end"
        style={{ padding: "4px 2px", fontSize: "var(--fs-sm)", color: "var(--text-2)" }}
      >
        Showing {total === 0 ? 0 : 1}–{total} of {total}
      </div>
    );

  const nums: (number | string)[] = [];
  nums.push(1);
  const lo = Math.max(2, cur - 1);
  const hi = Math.min(pages - 1, cur + 1);
  if (lo > 2) nums.push("…l");
  for (let i = lo; i <= hi; i++) nums.push(i);
  if (hi < pages - 1) nums.push("…r");
  if (pages > 1) nums.push(pages);

  return (
    <div
      className="flex items-center justify-between"
      style={{ padding: "4px 2px", gap: 12 }}
    >
      <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-2)" }}>
        Showing{" "}
        <b style={{ color: "var(--text-1)" }}>
          {offset + 1}–{Math.min(offset + limit, total)}
        </b>{" "}
        of {total}
      </span>
      <div className="flex items-center" style={{ gap: 4 }}>
        <Button
          size="icon"
          variant="ghost"
          disabled={cur === 1}
          icon="chevronLeft"
          onClick={() => onChange(offset - limit)}
        />
        {nums.map((n, i) =>
          typeof n === "string" ? (
            <span key={i} style={{ color: "var(--text-3)", padding: "0 4px" }}>
              …
            </span>
          ) : (
            <button
              key={i}
              onClick={() => onChange((n - 1) * limit)}
              style={{
                minWidth: 30,
                height: 30,
                borderRadius: "var(--r-md)",
                fontSize: "var(--fs-sm)",
                fontWeight: 600,
                cursor: "pointer",
                border: "1px solid",
                padding: "0 6px",
                borderColor: n === cur ? "var(--accent)" : "transparent",
                background:
                  n === cur
                    ? "color-mix(in oklch, var(--accent) 16%, transparent)"
                    : "transparent",
                color: n === cur ? "var(--accent)" : "var(--text-1)",
              }}
            >
              {n}
            </button>
          ),
        )}
        <Button
          size="icon"
          variant="ghost"
          disabled={cur === pages}
          icon="chevronRight"
          onClick={() => onChange(offset + limit)}
        />
      </div>
    </div>
  );
}
