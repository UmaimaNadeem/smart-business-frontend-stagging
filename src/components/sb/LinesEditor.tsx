"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { inputCls, Btn } from "./ui";
import { money, round2Safe } from "@/lib/format";

export interface Line { product_id: string; quantity: string; unit_price: string; discount: string; tax_rate: string }
export const emptyLine = (): Line => ({ product_id: "", quantity: "1", unit_price: "", discount: "0", tax_rate: "0" });

export function lineTotals(lines: Line[]) {
  let subtotal = 0, discount = 0, tax = 0;
  lines.forEach((l) => {
    const gross = Number(l.quantity || 0) * Number(l.unit_price || 0);
    const d = (gross * Number(l.discount || 0)) / 100;
    const t = ((gross - d) * Number(l.tax_rate || 0)) / 100;
    subtotal += gross; discount += d; tax += t;
  });
  return { subtotal: round2Safe(subtotal), discount: round2Safe(discount), tax: round2Safe(tax), total: round2Safe(subtotal - discount + tax) };
}

export function LinesEditor({ lines, setLines, products, priceKey, errors }: { lines: Line[]; setLines: (l: Line[]) => void; products: any[]; priceKey: "cost_price" | "selling_price"; errors?: Record<string, string[]> | null }) {
  const set = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const t = lineTotals(lines);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead><tr className="text-left text-xs uppercase text-gray-500"><th className="p-2">Product</th><th className="p-2 w-24">Qty</th><th className="p-2 w-32">Unit price</th><th className="p-2 w-24">Disc %</th><th className="p-2 w-24">Tax %</th><th className="p-2 w-32 text-right">Total</th><th /></tr></thead>
          <tbody>
            {lines.map((l, i) => {
              const gross = Number(l.quantity || 0) * Number(l.unit_price || 0);
              const net = gross - (gross * Number(l.discount || 0)) / 100;
              const p = products.find((x) => String(x.id) === l.product_id);
              const err = (k: string) => errors?.[`items.${i}.${k}`]?.[0];
              return (
                <tr key={i} className="align-top">
                  <td className="p-2 min-w-[220px]">
                    <select className={inputCls} value={l.product_id} onChange={(e) => { const prod = products.find((x) => String(x.id) === e.target.value); set(i, { product_id: e.target.value, unit_price: prod ? String(prod[priceKey]) : l.unit_price }); }}>
                      <option value="">Select product…</option>
                      {products.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.sku}) · stock {x.current_stock}</option>)}
                    </select>
                    {p && priceKey === "selling_price" && Number(l.quantity) > p.current_stock && <p className="mt-1 text-xs text-warning-600">Only {p.current_stock} in stock</p>}
                    {err("product_id") && <p className="mt-1 text-xs text-error-500">{err("product_id")}</p>}
                  </td>
                  <td className="p-2"><input className={inputCls} type="number" min="0" step="any" value={l.quantity} onChange={(e) => set(i, { quantity: e.target.value })} />{err("quantity") && <p className="text-xs text-error-500">{err("quantity")}</p>}</td>
                  <td className="p-2"><input className={inputCls} type="number" min="0" step="any" value={l.unit_price} onChange={(e) => set(i, { unit_price: e.target.value })} /></td>
                  <td className="p-2"><input className={inputCls} type="number" min="0" max="100" step="any" value={l.discount} onChange={(e) => set(i, { discount: e.target.value })} /></td>
                  <td className="p-2"><input className={inputCls} type="number" min="0" max="100" step="any" value={l.tax_rate} onChange={(e) => set(i, { tax_rate: e.target.value })} /></td>
                  <td className="p-2 pt-4 text-right">{money(net * (1 + Number(l.tax_rate || 0) / 100))}</td>
                  <td className="p-2 pt-3"><button type="button" className="text-error-500" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Remove line">✕</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {errors?.items && <p className="mt-1 text-xs text-error-500">{errors.items[0]}</p>}
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Btn variant="outline" size="sm" onClick={() => setLines([...lines, emptyLine()])}>+ Add line</Btn>
        <dl className="w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-gray-500">Subtotal</dt><dd>{money(t.subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500">Discount</dt><dd>- {money(t.discount)}</dd></div>
          <div className="flex justify-between"><dt className="text-gray-500">Tax</dt><dd>{money(t.tax)}</dd></div>
          <div className="flex justify-between border-t pt-1 font-semibold dark:border-gray-700"><dt>Total</dt><dd>{money(t.total)}</dd></div>
        </dl>
      </div>
    </div>
  );
}
