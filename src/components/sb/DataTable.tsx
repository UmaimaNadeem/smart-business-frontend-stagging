"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useState } from "react";
import { Empty, ErrorState, Loading, inputCls } from "./ui";

export interface Column<T = any> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  /** value used for sorting/searching when render is custom */
  value?: (row: T) => any;
  className?: string;
}
export interface Filter { key: string; label: string; options: { value: string; label: string }[] }

export function DataTable<T extends Record<string, any>>({
  columns, rows, loading, error, onRetry, searchKeys, filters = [], pageSize = 10, actions, onRowClick, emptyText, toolbar,
}: {
  columns: Column<T>[]; rows: T[]; loading?: boolean; error?: string | null; onRetry?: () => void; searchKeys?: string[];
  filters?: Filter[]; pageSize?: number; actions?: (row: T) => React.ReactNode; onRowClick?: (row: T) => void; emptyText?: string; toolbar?: React.ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(1);
  const [fv, setFv] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    let out = rows;
    const q = search.trim().toLowerCase();
    if (q && searchKeys?.length) out = out.filter((r) => searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(q)));
    Object.entries(fv).forEach(([k, v]) => { if (v) out = out.filter((r) => String(r[k]) === v); });
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      const get = (r: T) => (col?.value ? col.value(r) : r[sort.key]);
      out = [...out].sort((a, b) => {
        const x = get(a), y = get(b);
        if (typeof x === "number" && typeof y === "number") return (x - y) * sort.dir;
        return String(x ?? "").localeCompare(String(y ?? ""), undefined, { numeric: true }) * sort.dir;
      });
    }
    return out;
  }, [rows, search, searchKeys, fv, sort, columns]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const slice = filtered.slice((current - 1) * pageSize, current * pageSize);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      {(searchKeys || filters.length > 0 || toolbar) && (
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center dark:border-gray-800">
          {searchKeys && <input className={`${inputCls} sm:max-w-xs`} placeholder="Search…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />}
          {filters.map((f) => (
            <select key={f.key} className={`${inputCls} sm:max-w-[200px]`} value={fv[f.key] ?? ""} onChange={(e) => { setFv({ ...fv, [f.key]: e.target.value }); setPage(1); }}>
              <option value="">{f.label}: all</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ))}
          <div className="flex-1" />
          {toolbar}
        </div>
      )}
      {error ? <div className="p-4"><ErrorState message={error} onRetry={onRetry} /></div> : loading ? <div className="px-4"><Loading /></div> : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                {columns.map((c) => (
                  <th key={c.key} onClick={() => c.sortable !== false && setSort((s) => (s?.key === c.key ? { key: c.key, dir: (s.dir * -1) as 1 | -1 } : { key: c.key, dir: 1 }))}
                    className={`cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 ${c.className ?? ""}`}>
                    {c.label}{sort?.key === c.key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                  </th>
                ))}
                {actions && <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {slice.length === 0 && <tr><td colSpan={columns.length + (actions ? 1 : 0)}><Empty text={emptyText} /></td></tr>}
              {slice.map((r, i) => (
                <tr key={r.id ?? i} onClick={() => onRowClick?.(r)} className={`border-b border-gray-100 dark:border-gray-800 ${onRowClick ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02]" : ""}`}>
                  {columns.map((c) => <td key={c.key} className={`whitespace-nowrap px-4 py-3 text-sm text-gray-700 dark:text-gray-300 ${c.className ?? ""}`}>{c.render ? c.render(r) : String(r[c.key] ?? "-")}</td>)}
                  {actions && <td className="whitespace-nowrap px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}><div className="flex justify-end gap-1">{actions(r)}</div></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between px-4 py-3 text-sm text-gray-500">
        <span>{filtered.length} record{filtered.length === 1 ? "" : "s"}</span>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <button disabled={current <= 1} onClick={() => setPage(current - 1)} className="rounded border px-2 py-1 disabled:opacity-40 dark:border-gray-700">Prev</button>
            <span>{current} / {pages}</span>
            <button disabled={current >= pages} onClick={() => setPage(current + 1)} className="rounded border px-2 py-1 disabled:opacity-40 dark:border-gray-700">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
