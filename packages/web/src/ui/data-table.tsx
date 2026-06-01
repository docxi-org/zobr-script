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
}: DataTableProps<T>) {
  const t = useT();
  const [internalSort, setInternalSort] = useState<SortState | null>(null);
  const managed = !externalSort && !externalOnSort;
  const sort = managed ? internalSort : externalSort;

  const handleSort = (key: string) => {
    if (externalOnSort) { externalOnSort(key); return; }
    setInternalSort((s) => ({
      key,
      dir: s?.key === key && s.dir === "desc" ? "asc" : "desc",
    }));
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

  return (
    <div
      className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--border)]"
      style={{ background: "var(--bg-1)" }}
    >
      <div style={{ overflowX: "auto" }}>
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
    </div>
  );
}
