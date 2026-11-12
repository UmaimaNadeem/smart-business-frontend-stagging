"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import toast from "react-hot-toast";
import { api, extractList } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { date, money, todayIso } from "@/lib/format";
import { DataTable } from "./DataTable";
import { text } from "./cols";
import { QtyLines, QtyLine } from "./QtyLines";
import { Btn, FieldWrap, PageHeader, SbModal, inputCls } from "./ui";

export function StockDocPage({ kind }: { kind: "adjustment" | "transfer" }) {
  const { can } = useAuth();
  const adj = kind === "adjustment";
  const path = adj ? "/stock/adjustments" : "/stock/transfers";
  const { data, loading, error, reload } = useApi(path);
  const { data: whRaw } = useApi("/warehouses");
  const { data: prodRaw } = useApi("/products/all");
  const whs = extractList<any>(whRaw);
  const products = extractList<any>(prodRaw);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<QtyLine[]>([{ product_id: "", qty: "" }]);
  const [errors, setErrors] = useState<Record<string, string[]> | null>(null);
  const [busy, setBusy] = useState(false);

  const start = () => { setF({ date: todayIso(), warehouse_id: "", from_warehouse_id: "", to_warehouse_id: "", reason: "", notes: "" }); setLines([{ product_id: "", qty: "" }]); setErrors(null); setOpen(true); };
  const save = async () => {
    setBusy(true); setErrors(null);
    const items = lines.filter((l) => l.product_id).map((l) => (adj ? { product_id: Number(l.product_id), quantity_change: Number(l.qty) } : { product_id: Number(l.product_id), quantity: Number(l.qty) }));
    const body = adj
      ? { warehouse_id: Number(f.warehouse_id) || null, reason: f.reason, notes: f.notes, adjustment_date: f.date, items }
      : { from_warehouse_id: Number(f.from_warehouse_id) || null, to_warehouse_id: Number(f.to_warehouse_id) || null, notes: f.notes, transfer_date: f.date, items };
    try { await api.post(path, body); toast.success(adj ? "Adjustment posted" : "Transfer completed"); setOpen(false); reload(); }
    catch (e) { if (e instanceof ApiError && e.errors) setErrors(e.errors); toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  const whSelect = (k: string, label: string) => (
    <FieldWrap label={label} required error={errors?.[k]?.[0]}>
      <select className={inputCls} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })}><option value="">Select…</option>{whs.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.business})</option>)}</select>
    </FieldWrap>
  );

  return (
    <div>
      <PageHeader title={adj ? "Stock adjustments" : "Stock transfers"} subtitle={adj ? "Correct stock for damage, loss, counts or found items. Posts to the Stock Adjustment account." : "Move stock between warehouses. No accounting impact."}
        actions={can(adj ? "stock.adjust" : "stock.transfer") && <Btn onClick={start}>+ New {adj ? "adjustment" : "transfer"}</Btn>} />
      <DataTable rows={extractList<any>(data)} loading={loading} error={error} onRetry={reload} searchKeys={adj ? ["adjustment_no", "reason", "warehouse_name"] : ["transfer_no", "from_warehouse_name", "to_warehouse_name"]}
        columns={adj
          ? [text("adjustment_no", "Number"), { key: "adjustment_date", label: "Date", render: (r: any) => date(r.adjustment_date) }, text("warehouse_name", "Warehouse"), text("reason", "Reason"), { key: "items", label: "Items", render: (r: any) => r.items.map((i: any) => `${i.product_name} ${i.quantity_change > 0 ? "+" : ""}${i.quantity_change}`).join(", ") }, { key: "value", label: "Value", render: (r: any) => money(r.value) }, text("actor_name", "By")]
          : [text("transfer_no", "Number"), { key: "transfer_date", label: "Date", render: (r: any) => date(r.transfer_date) }, text("from_warehouse_name", "From"), text("to_warehouse_name", "To"), { key: "items", label: "Items", render: (r: any) => r.items.map((i: any) => `${i.product_name} × ${i.quantity}`).join(", ") }, text("actor_name", "By")]} />
      <SbModal open={open} onClose={() => setOpen(false)} title={adj ? "New stock adjustment" : "New stock transfer"} wide
        footer={<><Btn variant="outline" onClick={() => setOpen(false)}>Cancel</Btn><Btn loading={busy} onClick={save}>Post</Btn></>}>
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          {adj ? whSelect("warehouse_id", "Warehouse") : <>{whSelect("from_warehouse_id", "From warehouse")}{whSelect("to_warehouse_id", "To warehouse")}</>}
          <FieldWrap label="Date"><input type="date" className={inputCls} value={f.date ?? ""} onChange={(e) => setF({ ...f, date: e.target.value })} /></FieldWrap>
          {adj && <FieldWrap label="Reason" required error={errors?.reason?.[0]}><select className={inputCls} value={f.reason ?? ""} onChange={(e) => setF({ ...f, reason: e.target.value })}><option value="">Select…</option>{["Damaged", "Expired", "Lost / theft", "Stock count correction", "Found stock", "Sample / internal use"].map((r) => <option key={r}>{r}</option>)}</select></FieldWrap>}
          <FieldWrap label="Notes" className="sm:col-span-2"><input className={inputCls} value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} /></FieldWrap>
        </div>
        <QtyLines lines={lines} setLines={setLines} products={products} qtyLabel={adj ? "Change (+/-)" : "Quantity"} allowNegative={adj} />
        {errors && Object.entries(errors).filter(([k]) => k.startsWith("items")).map(([k, v]) => <p key={k} className="mt-1 text-xs text-error-500">{v[0]}</p>)}
      </SbModal>
    </div>
  );
}
