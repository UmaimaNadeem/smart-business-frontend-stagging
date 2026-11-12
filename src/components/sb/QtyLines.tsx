"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Btn, inputCls } from "./ui";

export interface QtyLine { product_id: string; qty: string; max?: number; label?: string }

/** Product + quantity rows. If `fixed`, products are preset (e.g. returns) and only qty is editable. */
export function QtyLines({ lines, setLines, products, fixed, qtyLabel = "Quantity", allowNegative }: { lines: QtyLine[]; setLines: (l: QtyLine[]) => void; products?: any[]; fixed?: boolean; qtyLabel?: string; allowNegative?: boolean }) {
  const set = (i: number, p: Partial<QtyLine>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...p } : l)));
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_140px_32px] gap-2 text-xs font-medium uppercase text-gray-500"><span>Product</span><span>{qtyLabel}</span><span /></div>
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-[1fr_140px_32px] items-center gap-2">
          {fixed ? <span className="text-sm text-gray-700 dark:text-gray-300">{l.label}{l.max !== undefined && <span className="text-xs text-gray-400"> (max {l.max})</span>}</span> : (
            <select className={inputCls} value={l.product_id} onChange={(e) => set(i, { product_id: e.target.value })}>
              <option value="">Select product…</option>
              {products?.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
            </select>
          )}
          <input className={inputCls} type="number" step="any" min={allowNegative ? undefined : 0} max={l.max} value={l.qty} onChange={(e) => set(i, { qty: e.target.value })} />
          {!fixed ? <button type="button" className="text-error-500" onClick={() => setLines(lines.filter((_, j) => j !== i))}>✕</button> : <span />}
        </div>
      ))}
      {!fixed && <Btn size="sm" variant="outline" onClick={() => setLines([...lines, { product_id: "", qty: "" }])}>+ Add line</Btn>}
    </div>
  );
}
