"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { use, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { api, unwrap } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { dateTime, num } from "@/lib/format";
import { Alert, Btn, Card, ErrorState, KV, Loading, PageHeader, SimpleTable, StatusBadge, inputCls } from "@/components/sb/ui";

export default function InwardTallyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { can } = useAuth();
  const { data, loading, error, reload } = useApi<any>(`/purchases/inwards/${id}`);
  const [qty, setQty] = useState<Record<number, string>>({});
  const [complete, setComplete] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]> | null>(null);
  const [busy, setBusy] = useState(false);
  const inw = data ? unwrap<any>(data) : null;

  useEffect(() => { if (inw) setQty(Object.fromEntries(inw.items.map((l: any) => [l.product_id, String(l.received_quantity)]))); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !data) return <Loading />;
  if (error || !inw) return <ErrorState message={error ?? "Not found"} onRetry={reload} />;
  const open = ["pending", "partially_received"].includes(inw.status) && can("inward.tally");

  const submit = async () => {
    setBusy(true); setErrors(null);
    try {
      const r = await api.post<{ message: string }>(`/purchases/inwards/${inw.id}/tally`, { items: inw.items.map((l: any) => ({ product_id: l.product_id, received_quantity: Number(qty[l.product_id] ?? 0) })), complete });
      toast.success(r.message); reload();
    } catch (e) { if (e instanceof ApiError && e.errors) setErrors(e.errors); toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  const fillAll = () => setQty(Object.fromEntries(inw.items.map((l: any) => [l.product_id, String(l.ordered_quantity)])));

  return (
    <div className="space-y-6">
      <PageHeader title={`Inward ${inw.gate_pass_no}`} subtitle={<StatusBadge status={inw.status} />} back={{ href: "/inwards", label: "Inwards" }}
        actions={<Link href={`/purchases/${inw.purchase_id}`}><Btn variant="outline">View {inw.purchase_no}</Btn></Link>} />
      <Card><KV items={[["Supplier", inw.supplier_name], ["Warehouse", inw.warehouse], ["Purchase", inw.purchase_no], ["Ordered", num(inw.total_ordered)], ["Received", num(inw.total_received)], ["Completed", dateTime(inw.completed_at)]]} /></Card>
      <Card title="Tally received quantities" actions={open && <Btn size="sm" variant="outline" onClick={fillAll}>Receive all</Btn>}>
        {open && <div className="mb-4"><Alert kind="info">Enter the <b>total received so far</b> for each line (cumulative). Stock and the supplier payable are posted for the difference only.</Alert></div>}
        <SimpleTable head={["Product", "SKU", "Ordered", "Received so far", "Pending", open ? "Total received now" : ""]}
          rows={inw.items.map((l: any, i: number) => [l.product_name, l.sku, num(l.ordered_quantity), num(l.received_quantity), num(l.pending_quantity),
            open ? <div key="q"><input className={`${inputCls} w-28`} type="number" min={l.received_quantity} max={l.ordered_quantity} step="any" value={qty[l.product_id] ?? ""} onChange={(e) => setQty({ ...qty, [l.product_id]: e.target.value })} />{errors?.[`items.${i}.received_quantity`] && <p className="text-xs text-error-500">{errors[`items.${i}.received_quantity`][0]}</p>}</div> : ""])} />
        {open && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={complete} onChange={(e) => setComplete(e.target.checked)} /> Close this inward (supplier will not send the rest)</label>
            <Btn loading={busy} onClick={submit}>Save tally</Btn>
          </div>
        )}
      </Card>
      {inw.tallies?.length > 0 && <Card title="Receiving history"><SimpleTable head={["When", "By", "Lines"]} rows={inw.tallies.map((t: any) => [dateTime(t.at ?? t.created_at), t.by ?? t.actor_name, (t.items ?? t.lines ?? []).map((x: any) => `${x.product_name ?? x.product_id}: +${x.quantity ?? x.diff}`).join(", ")])} /></Card>}
    </div>
  );
}
