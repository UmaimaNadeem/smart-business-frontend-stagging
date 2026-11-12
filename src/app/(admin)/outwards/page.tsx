"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { api, extractList, newIdempotencyKey } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { DataTable } from "@/components/sb/DataTable";
import { dateCol, moneyCol, statusCol, statusFilter, text } from "@/components/sb/cols";
import { Btn, FieldWrap, PageHeader, SbModal, SimpleTable, inputCls } from "@/components/sb/ui";
import { dateTime, num } from "@/lib/format";

function Outwards() {
  const { can } = useAuth();
  const focus = useSearchParams().get("focus");
  const { data, loading, error, reload } = useApi("/sales/outwards/all");
  const [view, setView] = useState<any>(null);
  const [deliver, setDeliver] = useState<any>(null);
  const [receivedBy, setReceivedBy] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const rows = extractList<any>(data);
  const sorted = focus ? [...rows].sort((a) => (String(a.id) === focus ? -1 : 0)) : rows;

  const dispatch = async (o: any) => {
    setBusy(o.id);
    try {
      const r = await api.post<{ message: string; already_processed?: boolean }>(`/sales/outwards/${o.id}/dispatch`, {}, { headers: { "Idempotency-Key": newIdempotencyKey() } });
      r.already_processed ? toast(r.message) : toast.success(r.message); reload();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(null); }
  };
  const markDelivered = async () => {
    setBusy(deliver.id);
    try { const r = await api.post<{ message: string }>(`/sales/outwards/${deliver.id}/delivered`, { received_by: receivedBy }, { headers: { "Idempotency-Key": newIdempotencyKey() } }); toast.success(r.message); setDeliver(null); reload(); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusy(null); }
  };

  return (
    <div>
      <PageHeader title="Warehouse outwards" subtitle="Confirmed sales wait here for dispatch. Dispatch reduces stock and bills the customer; repeating it is safe." />
      <DataTable rows={sorted} loading={loading} error={error} onRetry={reload} searchKeys={["gate_pass_no", "sale_no", "customer_name"]}
        filters={[statusFilter(["pending", "dispatched", "delivered", "cancelled"])]} onRowClick={setView}
        columns={[text("gate_pass_no", "Gate pass"), { key: "sale_no", label: "Sale", render: (r: any) => <Link className="text-brand-500" onClick={(e) => e.stopPropagation()} href={`/sales/${r.sale_id}`}>{r.sale_no}</Link> }, text("customer_name", "Customer"), text("warehouse", "Warehouse"), dateCol("sale_date", "Sale date"), { key: "total_quantity", label: "Qty", render: (r: any) => num(r.total_quantity) }, moneyCol("total_amount", "Value"), statusCol()]}
        actions={(o) => <>
          {o.status === "pending" && can("outward.dispatch") && <Btn size="sm" loading={busy === o.id} onClick={() => dispatch(o)}>Dispatch</Btn>}
          {o.status === "dispatched" && can("outward.deliver") && <Btn size="sm" variant="success" onClick={() => { setReceivedBy(""); setDeliver(o); }}>Delivered</Btn>}
        </>} />
      <SbModal open={!!view} onClose={() => setView(null)} title={`Outward ${view?.gate_pass_no ?? ""}`}>
        {view && <><p className="mb-3 text-sm text-gray-500">{view.customer_name} · {view.delivery_address ?? "No address"} · dispatched {dateTime(view.dispatched_at)} · delivered {dateTime(view.delivered_at)}</p>
          <SimpleTable head={["Product", "SKU", "Qty"]} rows={view.items.map((l: any) => [l.product_name, l.sku, num(l.quantity)])} /></>}
      </SbModal>
      <SbModal open={!!deliver} onClose={() => setDeliver(null)} title="Confirm delivery" footer={<><Btn variant="outline" onClick={() => setDeliver(null)}>Cancel</Btn><Btn loading={busy === deliver?.id} onClick={markDelivered}>Mark delivered</Btn></>}>
        <FieldWrap label="Received by"><input className={inputCls} value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder="Name of person who received the goods" /></FieldWrap>
      </SbModal>
    </div>
  );
}
export default function OutwardsPage() { return <Suspense><Outwards /></Suspense>; }
