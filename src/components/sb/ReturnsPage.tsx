"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { api, extractList, unwrap } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { todayIso } from "@/lib/format";
import { DataTable } from "./DataTable";
import { dateCol, moneyCol, text } from "./cols";
import { QtyLines, QtyLine } from "./QtyLines";
import { Alert, Btn, FieldWrap, PageHeader, SbModal, inputCls } from "./ui";

export function ReturnsPage({ kind }: { kind: "purchase" | "sale" }) {
  const p = kind === "purchase";
  const { can } = useAuth();
  const params = useSearchParams();
  const path = p ? "/purchase-returns" : "/sales-returns";
  const { data, loading, error, reload } = useApi(path);
  const { data: docsRaw } = useApi(p ? "/purchases" : "/sales");
  const docs = extractList<any>(docsRaw).filter((d) => d.billed_amount > 0);
  const [open, setOpen] = useState(false);
  const [docId, setDocId] = useState("");
  const [lines, setLines] = useState<QtyLine[]>([]);
  const [f, setF] = useState({ return_date: todayIso(), reason: "", refund: false });
  const [errors, setErrors] = useState<Record<string, string[]> | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (id: string) => {
    setDocId(id); setLines([]);
    if (!id) return;
    const d = unwrap<any>(await api.get(`${p ? "/purchases" : "/sales"}/${id}`));
    setLines(d.items.map((l: any) => {
      const base = p ? l.received_quantity : l.quantity;
      const max = Math.max(0, (base ?? 0) - (l.returned_quantity ?? 0));
      return { product_id: String(l.product_id), qty: "0", max, label: `${l.product_name} (${l.sku})` };
    }).filter((l: QtyLine) => (l.max ?? 0) > 0));
  };
  useEffect(() => {
    if (params.get("new") && params.get("document_id")) { setOpen(true); pick(params.get("document_id")!); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setBusy(true); setErrors(null);
    try {
      await api.post(path, { [p ? "purchase_id" : "sale_id"]: Number(docId) || null, return_date: f.return_date, reason: f.reason, items: lines.filter((l) => Number(l.qty) > 0).map((l) => ({ product_id: Number(l.product_id), quantity: Number(l.qty) })) });
      toast.success(p ? "Supplier return recorded" : "Sales return recorded"); setOpen(false); reload();
    } catch (e) { if (e instanceof ApiError && e.errors) setErrors(e.errors); toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageHeader title={p ? "Supplier returns" : "Sales returns"} subtitle={p ? "Return received goods to a supplier. Reduces stock and the supplier balance." : "Accept goods back from a customer. Restocks and reduces the receivable."}
        actions={can("returns.manage") && <Btn onClick={() => { setDocId(""); setLines([]); setErrors(null); setOpen(true); }}>+ New return</Btn>} />
      <DataTable rows={extractList<any>(data)} loading={loading} error={error} onRetry={reload} searchKeys={["return_no", p ? "purchase_no" : "sale_no", p ? "supplier_name" : "customer_name", "reason"]}
        columns={[text("return_no", "Number"), dateCol("return_date", "Date"), text(p ? "purchase_no" : "sale_no", p ? "Purchase" : "Sale"), text(p ? "supplier_name" : "customer_name", p ? "Supplier" : "Customer"), text("warehouse", "Warehouse"), text("reason", "Reason"), moneyCol("total_amount", "Amount")]} />
      <SbModal open={open} onClose={() => setOpen(false)} title={p ? "New supplier return" : "New sales return"} wide
        footer={<><Btn variant="outline" onClick={() => setOpen(false)}>Cancel</Btn><Btn loading={busy} disabled={!lines.length} onClick={save}>Record return</Btn></>}>
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <FieldWrap label={p ? "Purchase" : "Sale"} required error={errors?.[p ? "purchase_id" : "sale_id"]?.[0]} className="sm:col-span-3">
            <select className={inputCls} value={docId} onChange={(e) => pick(e.target.value)}><option value="">Select a billed document…</option>{docs.map((d) => <option key={d.id} value={d.id}>{d.invoice_no} · {d.supplier_name ?? d.customer_name}</option>)}</select>
          </FieldWrap>
          <FieldWrap label="Date"><input type="date" className={inputCls} value={f.return_date} onChange={(e) => setF({ ...f, return_date: e.target.value })} /></FieldWrap>
          <FieldWrap label="Reason" className="sm:col-span-2"><input className={inputCls} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Damaged, wrong item…" /></FieldWrap>
        </div>
        {docId && lines.length === 0 && <Alert kind="warning">Nothing left to return on this document.</Alert>}
        {lines.length > 0 && <QtyLines fixed lines={lines} setLines={setLines} qtyLabel="Return qty" />}
        {errors && Object.entries(errors).filter(([k]) => k.startsWith("items")).map(([k, v]) => <p key={k} className="mt-1 text-xs text-error-500">{v[0]}</p>)}
      </SbModal>
    </div>
  );
}
