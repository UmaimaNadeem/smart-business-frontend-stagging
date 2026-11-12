"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { api, extractList, unwrap } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { date, dateTime, money, num, todayIso } from "@/lib/format";
import { DataTable } from "./DataTable";
import { dateCol, linkCol, moneyCol, statusCol, statusFilter, text } from "./cols";
import { LinesEditor, Line, emptyLine } from "./LinesEditor";
import { Alert, Btn, Card, ErrorState, FieldWrap, KV, Loading, PageHeader, SimpleTable, StatusBadge, inputCls } from "./ui";

export type DocKind = "purchase" | "sale";
const M = {
  purchase: { title: "Purchase orders", one: "Purchase", list: "/purchases", base: "/purchases", party: "supplier", partyPath: "/suppliers", dateKey: "purchase_date", perm: "purchases", price: "cost_price" as const, statuses: ["draft", "confirmed", "partially_received", "received", "cancelled"] },
  sale: { title: "Sales orders", one: "Sale", list: "/sales", base: "/sales", party: "customer", partyPath: "/customers", dateKey: "sale_date", perm: "sales", price: "selling_price" as const, statuses: ["draft", "confirmed", "dispatched", "delivered", "cancelled"] },
};

export function DocList({ kind }: { kind: DocKind }) {
  const m = M[kind];
  const { can } = useAuth();
  const router = useRouter();
  const { data, loading, error, reload } = useApi(m.list);
  return (
    <div>
      <PageHeader title={m.title} actions={can(`${m.perm}.create`) && <Link href={`${m.base}/new`}><Btn>+ New {m.one.toLowerCase()}</Btn></Link>} />
      <DataTable rows={extractList<any>(data)} loading={loading} error={error} onRetry={reload}
        searchKeys={["invoice_no", `${m.party}_name`, "reference"]}
        filters={[statusFilter(m.statuses), statusFilter(["not_billed", "unpaid", "partial", "paid"], "payment_status")].map((f, i) => (i === 1 ? { ...f, label: "Payment" } : f))}
        onRowClick={(r) => router.push(`${m.base}/${r.id}`)}
        columns={[linkCol("invoice_no", "Number", (r) => `${m.base}/${r.id}`), dateCol(m.dateKey, "Date"), text(`${m.party}_name`, m.party === "supplier" ? "Supplier" : "Customer"), text("business", "Branch"), text("warehouse", "Warehouse"), moneyCol("total_amount", "Total"), moneyCol("outstanding_amount", "Outstanding"), statusCol(), statusCol("payment_status", "Payment")]} />
    </div>
  );
}

export function DocForm({ kind, id }: { kind: DocKind; id?: string }) {
  const m = M[kind];
  const router = useRouter();
  const params = useSearchParams();
  const { workspace } = useAuth();
  const { data: partiesRaw } = useApi(m.partyPath);
  const { data: productsRaw } = useApi("/products/all");
  const { data: branchesRaw } = useApi("/businesses");
  const { data: whRaw } = useApi("/warehouses");
  const { data: existing, loading } = useApi<any>(id ? `${m.base}/${id}` : null);
  const parties = extractList<any>(partiesRaw).filter((p) => p.status === "active");
  const products = extractList<any>(productsRaw).filter((p) => p.status === "active");
  const branches = extractList<any>(branchesRaw);
  const warehouses = extractList<any>(whRaw);

  const [head, setHead] = useState<Record<string, string>>({ [`${m.party}_id`]: params.get(`${m.party}_id`) ?? "", [m.dateKey]: todayIso(), business_id: workspace.businessId ? String(workspace.businessId) : "", warehouse_id: "", reference: "", notes: "", expected_date: "", due_date: "", delivery_address: "" });
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [errors, setErrors] = useState<Record<string, string[]> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!head.business_id && branches.length) setHead((h) => ({ ...h, business_id: String(branches[0].id) }));
  }, [branches, head.business_id]);
  useEffect(() => {
    if (!existing) return;
    const d = unwrap<any>(existing);
    setHead({ [`${m.party}_id`]: String(d[`${m.party}_id`]), [m.dateKey]: d[m.dateKey], business_id: String(d.business_id), warehouse_id: String(d.warehouse_id ?? ""), reference: d.reference ?? "", notes: d.notes ?? "", expected_date: d.expected_date ?? "", due_date: d.due_date ?? "", delivery_address: d.delivery_address ?? "" });
    setLines(d.items.map((l: any) => ({ product_id: String(l.product_id), quantity: String(l.quantity), unit_price: String(l.unit_price), discount: String(l.discount ?? 0), tax_rate: String(l.tax_rate ?? 0) })));
  }, [existing, m.party, m.dateKey]);

  const branchWh = useMemo(() => warehouses.filter((w) => String(w.business_id) === head.business_id && w.status === "active"), [warehouses, head.business_id]);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setHead({ ...head, [k]: e.target.value });

  if (id && loading) return <Loading />;
  const doc = existing ? unwrap<any>(existing) : null;
  if (doc && doc.status !== "draft") return <Alert kind="warning">Only draft documents can be edited. <Link className="underline" href={`${m.base}/${id}`}>Back</Link></Alert>;

  const save = async (confirmAfter: boolean) => {
    setBusy(true); setErrors(null);
    const body = {
      ...head,
      [`${m.party}_id`]: Number(head[`${m.party}_id`]) || null,
      business_id: Number(head.business_id) || null,
      warehouse_id: Number(head.warehouse_id) || null,
      items: lines.filter((l) => l.product_id).map((l) => ({ product_id: Number(l.product_id), quantity: Number(l.quantity), unit_price: Number(l.unit_price), discount: Number(l.discount || 0), tax_rate: Number(l.tax_rate || 0) })),
    };
    try {
      const res = id ? await api.put(`${m.base}/${id}`, body) : await api.post(`${m.base}/create`, body);
      const saved = unwrap<any>(res);
      if (confirmAfter) await api.post(`${m.base}/${saved.id}/confirmed`);
      toast.success(confirmAfter ? `${m.one} saved and confirmed` : `${m.one} saved as draft`);
      router.push(`${m.base}/${saved.id}`);
    } catch (e) {
      if (e instanceof ApiError && e.errors) setErrors(e.errors);
      toast.error(errorMessage(e));
    } finally { setBusy(false); }
  };
  const err = (k: string) => errors?.[k]?.[0];

  return (
    <div className="space-y-6">
      <PageHeader title={id ? `Edit ${doc?.invoice_no ?? ""}` : `New ${m.one.toLowerCase()}`} back={{ href: m.base, label: m.title }} />
      <Card title="Details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FieldWrap label={m.party === "supplier" ? "Supplier" : "Customer"} required error={err(`${m.party}_id`)}>
            {/* The backend now has /suppliers and /customers, so both modes pick from the list. */}
            <select className={inputCls} value={head[`${m.party}_id`]} onChange={set(`${m.party}_id`)}><option value="">Select…</option>{parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          </FieldWrap>
          <FieldWrap label="Date" required error={err(m.dateKey)}><input type="date" className={inputCls} value={head[m.dateKey]} onChange={set(m.dateKey)} /></FieldWrap>
          {kind === "purchase"
            ? <FieldWrap label="Expected delivery"><input type="date" className={inputCls} value={head.expected_date} onChange={set("expected_date")} /></FieldWrap>
            : <FieldWrap label="Due date"><input type="date" className={inputCls} value={head.due_date} onChange={set("due_date")} /></FieldWrap>}
          <FieldWrap label="Branch" required error={err("business_id")}>
            <select className={inputCls} value={head.business_id} disabled={!!id} onChange={(e) => setHead({ ...head, business_id: e.target.value, warehouse_id: "" })}><option value="">Select…</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          </FieldWrap>
          <FieldWrap label="Warehouse" error={err("warehouse_id")} hint="Defaults to the branch's first warehouse">
            <select className={inputCls} value={head.warehouse_id} onChange={set("warehouse_id")}><option value="">Default</option>{branchWh.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
          </FieldWrap>
          <FieldWrap label="Reference"><input className={inputCls} value={head.reference} onChange={set("reference")} placeholder={kind === "purchase" ? "Supplier invoice #" : "Customer PO #"} /></FieldWrap>
          {kind === "sale" && <FieldWrap label="Delivery address" className="sm:col-span-2"><input className={inputCls} value={head.delivery_address} onChange={set("delivery_address")} /></FieldWrap>}
          <FieldWrap label="Notes" className="sm:col-span-2 lg:col-span-3"><textarea className={`${inputCls} h-20 py-2`} value={head.notes} onChange={set("notes")} /></FieldWrap>
        </div>
      </Card>
      <Card title="Items"><LinesEditor lines={lines} setLines={setLines} products={products} priceKey={m.price} errors={errors} /></Card>
      <div className="flex flex-wrap justify-end gap-2">
        <Btn variant="outline" onClick={() => router.back()}>Cancel</Btn>
        <Btn variant="outline" loading={busy} onClick={() => save(false)}>Save draft</Btn>
        <Btn loading={busy} onClick={() => save(true)}>Save & confirm</Btn>
      </div>
    </div>
  );
}

export function DocDetail({ kind, id }: { kind: DocKind; id: string }) {
  const m = M[kind];
  const { can } = useAuth();
  const router = useRouter();
  const { data, loading, error, reload } = useApi<any>(`${m.base}/${id}`);
  const [busy, setBusy] = useState<string | null>(null);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const d = unwrap<any>(data);
  const flow = kind === "purchase" ? d.inward : d.outward;

  const act = async (key: string, fn: () => Promise<unknown>, msg: string) => {
    setBusy(key);
    try { await fn(); toast.success(msg); reload(); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(null); }
  };
  const cancel = () => { const reason = window.prompt("Reason for cancelling?"); if (reason === null) return; act("cancel", () => api.post(`${m.base}/${d.id}/cancel`, { reason }), `${m.one} cancelled`); };
  const del = () => { if (window.confirm("Delete this draft?")) act("del", async () => { await api.del(`${m.base}/${d.id}`); router.push(m.base); }, "Draft deleted"); };

  const canCancel = kind === "purchase" ? ["draft", "confirmed"].includes(d.status) && !(d.inward?.total_received > 0) : ["draft", "confirmed"].includes(d.status);

  return (
    <div className="space-y-6">
      <PageHeader title={`${m.one} ${d.invoice_no}`} back={{ href: m.base, label: m.title }}
        subtitle={<span className="flex gap-2"><StatusBadge status={d.status} /><StatusBadge status={d.payment_status} /></span>}
        actions={<>
          {d.status === "draft" && can(`${m.perm}.update`) && <Link href={`${m.base}/${d.id}/edit`}><Btn variant="outline">Edit</Btn></Link>}
          {d.status === "draft" && can(`${m.perm}.delete`) && <Btn variant="ghost" className="text-error-500" onClick={del}>Delete</Btn>}
          {d.status === "draft" && can(`${m.perm}.confirm`) && <Btn loading={busy === "confirm"} onClick={() => act("confirm", () => api.post(`${m.base}/${d.id}/confirmed`), kind === "purchase" ? "Confirmed — sent to warehouse inward" : "Confirmed — sent to warehouse outward")}>Confirm</Btn>}
          {kind === "purchase" && flow && ["pending", "partially_received"].includes(flow.status) && can("inward.tally") && <Link href={`/inwards/${flow.id}`}><Btn>Receive goods</Btn></Link>}
          {kind === "sale" && flow && flow.status === "pending" && can("outward.dispatch") && <Link href={`/outwards?focus=${flow.id}`}><Btn>Dispatch</Btn></Link>}
          {d.outstanding_amount > 0 && can("payments.manage") && <Link href={`${kind === "purchase" ? "/supplier-payments" : "/customer-receipts"}?party_id=${d[`${m.party}_id`]}&document_id=${d.id}&new=1`}><Btn variant="success">{kind === "purchase" ? "Pay" : "Receive payment"}</Btn></Link>}
          {d.billed_amount > 0 && can("returns.manage") && <Link href={`${kind === "purchase" ? "/purchase-returns" : "/sales-returns"}?document_id=${d.id}&new=1`}><Btn variant="outline">Return</Btn></Link>}
          {canCancel && d.status !== "draft" && can(`${m.perm}.confirm`) && <Btn variant="danger" loading={busy === "cancel"} onClick={cancel}>Cancel</Btn>}
        </>} />
      <Card>
        <KV items={[
          [m.party === "supplier" ? "Supplier" : "Customer", <Link key="p" className="text-brand-500" href={`${m.partyPath}/${d[`${m.party}_id`]}`}>{d[`${m.party}_name`]}</Link>],
          ["Date", date(d[m.dateKey])], ["Branch", d.business], ["Warehouse", d.warehouse], ["Reference", d.reference],
          [kind === "purchase" ? "Expected" : "Due", date(d.expected_date ?? d.due_date)], ["Billed", money(d.billed_amount)], ["Paid", money(d.paid_amount)], ["Outstanding", money(d.outstanding_amount)],
          ...(d.cancel_reason ? [["Cancel reason", d.cancel_reason] as [string, React.ReactNode]] : []), ["Created by", d.created_by],
        ]} />
      </Card>
      <Card title="Items">
        <SimpleTable head={["Product", "SKU", "Qty", kind === "purchase" ? "Received" : "Returned", "Unit price", "Disc %", "Tax %", "Total"]}
          rows={d.items.map((l: any) => [l.product_name, l.sku, num(l.quantity), kind === "purchase" ? num(l.received_quantity) : num(l.returned_quantity), money(l.unit_price), num(l.discount), num(l.tax_rate), money(l.total)])}
          foot={["", "", "", "", "", "", "Total", money(d.total_amount)]} />
        <div className="mt-3 text-right text-sm text-gray-500">Subtotal {money(d.subtotal)} · Discount {money(d.discount_amount)} · Tax {money(d.tax_amount)}</div>
      </Card>
      {flow && (
        <Card title={kind === "purchase" ? `Warehouse inward ${flow.gate_pass_no}` : `Warehouse outward ${flow.gate_pass_no}`} actions={<StatusBadge status={flow.status} />}>
          {kind === "purchase"
            ? <SimpleTable head={["Product", "Ordered", "Received", "Pending"]} rows={flow.items.map((l: any) => [l.product_name, num(l.ordered_quantity), num(l.received_quantity), num(l.pending_quantity)])} />
            : <KV items={[["Dispatched", dateTime(flow.dispatched_at)], ["Delivered", dateTime(flow.delivered_at)], ["Received by", flow.received_by], ["Address", flow.delivery_address]]} />}
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Payments"><SimpleTable head={["Number", "Date", "Amount"]} rows={d.payments.map((p: any) => [p.payment_no, date(p.payment_date), money(p.amount)])} /></Card>
        <Card title="Returns"><SimpleTable head={["Number", "Date", "Amount"]} rows={d.returns.map((r: any) => [r.return_no, date(r.return_date), money(r.total_amount)])} /></Card>
        <Card title="Journal entries"><SimpleTable head={["Journal", "Date", "Amount"]} rows={d.journals.map((j: any) => [<Link key={j.id} className="text-brand-500" href={`/accounting/journals?focus=${j.id}`}>{j.journal_no}</Link>, date(j.date), money(j.total)])} /></Card>
      </div>
    </div>
  );
}
