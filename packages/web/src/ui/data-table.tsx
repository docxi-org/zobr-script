import { useState, useMemo, type ReactNode } from "react";
import { Icon } from "./icon";
import { useT } from "../i18n/context";

export interface Column<T> {
  key: string;
  label: string;
  width?: number | undefined;
  maxWidth?: number | undefined;
  align?: "left" | "right" | undefined;
  mono?: boolean | undefined;
  muted?: boolean | undefined;
  sortable?: boolean | undefined;
  sortVal?: (row: T) => string | number;
  render?: (row: T) => ReactNode;
  cardRole?: "title" | "badge" | "hide" | undefined;
}

interface SortState { key: string; dir: "asc" | "desc" }

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
  sort?: SortState;
  onSort?: (key: string) => void;
  empty?: ReactNode;
  page?: number;
  pageCount?: number;
  onPage?: (p: number) => void;
}

function defaultSortVal<T>(row: T, key: string): string | number {
  const v = (row as Record<string, unknown>)[key];
  if (typeof v === "number") return v;
  if (typeof v === "string") return v.toLowerCase();
  return String(v ?? "");
}

export function DataTable<T>({
  columns,
  rows,
  onRowClick,
  rowKey,
  sort: externalSort,
  onSort: externalOnSort,
  empty,
  page,
  pageCount,
  onPage,
}: DataTableProps<T>) {
  const t = useT();
  const [internalSort, setInternalSort] = useState<SortState | null>(null);
  const managed = !externalSort && !externalOnSort;
  const sort = managed ? internalSort : externalSort;

  const handleSort = (key: string, mode?: "keep" | "flip") => {
    if (externalOnSort) { externalOnSort(key); return; }
    setInternalSort((s) => {
      if (mode === "keep") return { key, dir: s?.dir ?? "desc" };
      return { key, dir: s?.key === key && s.dir === "desc" ? "asc" : "desc" };
    });
  };

  const sortedRows = useMemo(() => {
    if (!managed || !internalSort) return rows;
    const col = columns.find((c) => c.key === internalSort.key);
    const valFn = col?.sortVal ?? ((r: T) => defaultSortVal(r, internalSort.key));
    const dir = internalSort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = valFn(a);
      const vb = valFn(b);
      return va < vb ? -dir : va > vb ? dir : 0;
    });
  }, [rows, internalSort, managed, columns]);

  const displayRows = managed ? sortedRows : rows;

  const titleCol = columns.find((c) => c.cardRole === "title") ?? columns[0];
  const badgeCol = columns.find((c) => c.cardRole === "badge") ?? columns.find((c) => c.key === "status");
  const metaCols = columns.filter((c) => c !== titleCol && c !== badgeCol && c.cardRole !== "hide");
  const sortableCols = columns.filter((c) => c.sortable);

  const renderCell = (col: Column<T> | undefined, row: T) => {
    if (!col) return null;
    return col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "");
  };

  const pagination = page != null && pageCount != null && pageCount > 1 && onPage ? (
    <div className="flex items-center justify-center border-t border-[var(--border)]" style={{ padding: "8px 14px", gap: 4 }}>
      <button onClick={() => onPage(page - 1)} disabled={page <= 1}
        className="grid cursor-pointer place-items-center rounded-[var(--r-sm)] border-none"
        style={{ width: 28, height: 28, background: "transparent", color: page <= 1 ? "var(--text-3)" : "var(--text-1)" }}>
        <Icon name="chevronLeft" size={14} />
      </button>
      <span className="zs-page-nums" style={{ display: "inline-flex", gap: 2 }}>
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
          <button key={p} onClick={() => onPage(p)}
            className="mono grid cursor-pointer place-items-center rounded-[var(--r-sm)] border-none"
            style={{ width: 28, height: 28, fontSize: "var(--fs-xs)", fontWeight: p === page ? 700 : 500, background: p === page ? "var(--bg-3)" : "transparent", color: p === page ? "var(--text-0)" : "var(--text-2)" }}>
            {p}
          </button>
        ))}
      </span>
      <span className="zs-page-compact mono hidden items-center" style={{ fontSize: "var(--fs-sm)", color: "var(--text-1)", fontWeight: 600 }}>
        {page} / {pageCount}
      </span>
      <button onClick={() => onPage(page + 1)} disabled={page >= pageCount}
        className="grid cursor-pointer place-items-center rounded-[var(--r-sm)] border-none"
        style={{ width: 28, height: 28, background: "transparent", color: page >= pageCount ? "var(--text-3)" : "var(--text-1)" }}>
        <Icon name="chevronRight" size={14} />
      </button>
    </div>
  ) : null;

  return (
    <div
      className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)]"
      style={{ background: "var(--bg-1)" }}
    >
      {/* mobile sort control */}
      {sortableCols.length > 0 && (
        <div className="zs-dt-sort hidden items-center border-b border-[var(--border)]" style={{ padding: "8px 14px", gap: 8, background: "var(--bg-2)" }}>
          <select
            value={sort?.key ?? sortableCols[0]!.key}
            onChange={(e) => handleSort(e.target.value, "keep")}
            style={{ flex: 1, padding: "6px 8px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", background: "var(--bg-1)", color: "var(--text-0)", fontSize: "var(--fs-sm)", fontFamily: "inherit" }}
          >
            {sortableCols.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <button
            onClick={() => { const key = sort?.key ?? sortableCols[0]!.key; handleSort(key); }}
            className="grid cursor-pointer place-items-center rounded-[var(--r-sm)] border border-[var(--border)]"
            style={{ width: 32, height: 32, background: "var(--bg-1)", color: "var(--text-1)", flexShrink: 0 }}>
            <Icon name="chevronDown" size={14} style={{ transform: sort?.dir === "asc" ? "rotate(180deg)" : "none", transition: "transform .15s var(--ease)" }} />
          </button>
        </div>
      )}

      {/* desktop table */}
      <div className="zs-dt-table" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--fs-sm)" }}>
          <thead>
            <tr style={{ background: "var(--bg-2)" }}>
              {columns.map((c) => {
                const canSort = c.sortable;
                const isSorted = sort && sort.key === c.key;
                return (
                  <th
                    key={c.key}
                    onClick={canSort ? () => handleSort(c.key) : undefined}
                    style={{
                      textAlign: c.align ?? "left",
                      padding: "9px 14px",
                      fontWeight: 600,
                      fontSize: "var(--fs-xs)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: isSorted ? "var(--text-0)" : "var(--text-2)",
                      whiteSpace: "nowrap",
                      width: c.width,
                      borderBottom: "1px solid var(--border)",
                      cursor: canSort ? "pointer" : "default",
                      userSelect: "none",
                      position: "sticky",
                      top: 0,
                    }}
                  >
                    <span
                      className="inline-flex items-center"
                      style={{ gap: 4, justifyContent: c.align === "right" ? "flex-end" : "flex-start" }}
                    >
                      {c.label}
                      {isSorted && (
                        <Icon
                          name="chevronDown"
                          size={12}
                          style={{ transform: sort!.dir === "asc" ? "rotate(180deg)" : "none", color: "var(--accent)" }}
                        />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  {empty ?? (
                    <div className="flex flex-col items-center justify-center" style={{ padding: "56px 24px", color: "var(--text-2)" }}>
                      {t("common.nothing_here")}
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              displayRows.map((row, i) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className="zs-row"
                  style={{
                    cursor: onRowClick ? "pointer" : "default",
                    borderBottom: i === displayRows.length - 1 ? "none" : "1px solid var(--border)",
                  }}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={c.mono ? "mono" : ""}
                      style={{
                        padding: "var(--cell-py) 14px",
                        textAlign: c.align ?? "left",
                        color: c.muted ? "var(--text-2)" : "var(--text-0)",
                        whiteSpace: "nowrap",
                        verticalAlign: "middle",
                        maxWidth: c.maxWidth,
                        overflow: c.maxWidth ? "hidden" : "visible",
                        textOverflow: c.maxWidth ? "ellipsis" : "clip",
                      }}
                    >
                      {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* mobile cards */}
      <div className="zs-dt-cards hidden flex-col" style={{ gap: 0 }}>
        {displayRows.length === 0 ? (
          empty ?? (
            <div className="flex flex-col items-center justify-center" style={{ padding: "56px 24px", color: "var(--text-2)" }}>
              {t("common.nothing_here")}
            </div>
          )
        ) : displayRows.map((row, i) => (
          <div
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            style={{
              padding: 14,
              cursor: onRowClick ? "pointer" : "default",
              borderBottom: i === displayRows.length - 1 ? "none" : "1px solid var(--border)",
            }}
          >
            <div className="flex items-center" style={{ gap: 10, marginBottom: metaCols.length > 0 ? 10 : 0 }}>
              <div style={{ flex: 1, fontWeight: 600, fontSize: "var(--fs-sm)", color: "var(--text-0)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {renderCell(titleCol, row)}
              </div>
              {badgeCol && <div style={{ flexShrink: 0 }}>{renderCell(badgeCol, row)}</div>}
            </div>
            {metaCols.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
                {metaCols.map((c) => (
                  <div key={c.key}>
                    <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>{c.label}</div>
                    <div className={c.mono ? "mono" : ""} style={{ fontSize: "var(--fs-sm)", color: c.muted ? "var(--text-2)" : "var(--text-0)", marginTop: 1 }}>
                      {renderCell(c, row)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {pagination}
    </div>
  );
}
