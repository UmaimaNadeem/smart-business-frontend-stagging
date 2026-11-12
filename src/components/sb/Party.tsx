"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ResourcePage } from "./ResourcePage";
import { ACTIVE_OPTIONS, linkCol, moneyCol, numCol, statusCol, statusFilter, text } from "./cols";
import { FieldDef } from "./Form";
import { Btn, Card, ErrorState, KV, Loading, PageHeader, SbModal, SimpleTable, StatusBadge, Tabs, inputCls } from "./ui";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { api, unwrap } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { date, money } from "@/lib/format";

type Kind = "supplier" | "customer";
const META = {
  supplier: { title: "Suppliers", path: "/suppliers", perm: "suppliers", docPath: "/purchases", payPath: "/supplier-payments", docLabel: "Purchases" },
  customer: { title: "Customers", path: "/customers", perm: "customers", docPath: "/sales", payPath: "/customer-receipts", docLabel: "Sales" },
};

function fields(kind: Kind): FieldDef[] {
  return [
    { name: "name", label: "Name", required: true }, { name: "contact_person", label: "Contact person" },
    { name: "phone", label: "Phone" }, { name: "email", label: "Email", type: "email" },
    { name: "tax_number", label: "Tax number" }, { name: "payment_terms_days", label: "Payment terms (days)", type: "number" },
    ...(kind === "customer" ? [{ name: "credit_limit", label: "Credit limit", type: "number" } as FieldDef] : []),
    { name: "opening_balance", label: "Opening balance", type: "number", hideOnEdit: true },
    { name: "status", label: "Status", type: "select", options: ACTIVE_OPTIONS },
    { name: "address", label: "Address", span: 2 }, { name: "notes", label: "Notes", type: "textarea", span: 2 },
  ];
}

export function PartyList({ kind }: { kind: Kind }) {
  const m = META[kind];
  return <ResourcePage config={{
    title: m.title, singular: kind === "supplier" ? "Supplier" : "Customer", listPath: m.path, createPath: m.path,
    updatePath: (r) => `${m.path}/${r.id}`, deletePath: (r) => `${m.path}/${r.id}`,
    perms: { create: `${m.perm}.manage`, update: `${m.perm}.manage`, delete: `${m.perm}.manage` },
    columns: [linkCol("name", "Name", (r) => `${m.path}/${r.id}`), text("contact_person", "Contact"), text("phone", "Phone"), moneyCol("total_billed", "Billed"), moneyCol("total_paid", "Paid"), moneyCol("balance", "Balance"), numCol("open_documents", "Open docs"), statusCol()],
    fields: fields(kind), searchKeys: ["name", "phone", "email", "contact_person"], filters: [statusFilter(["active", "inactive"])],
    defaults: { status: "active", payment_terms_days: kind === "supplier" ? 30 : 15 },
    toPayload: (f) => ({ ...f, payment_terms_days: f.payment_terms_days === "" ? null : Number(f.payment_terms_days), credit_limit: f.credit_limit === "" || f.credit_limit === undefined ? null : Number(f.credit_limit), opening_balance: Number(f.opening_balance || 0) }),
    detailHref: (r) => `${m.path}/${r.id}`,
  }} />;
}

export function PartyDetail({ kind, id }: { kind: Kind; id: string }) {
  const m = META[kind];
  const { can } = useAuth();
  const { data, loading, error, reload } = useApi<any>(`${m.path}/${id}`);
  const [tab, setTab] = useState("documents");
  const [contactOpen, setContactOpen] = useState(false);
  const [contact, setContact] = useState({ name: "", role: "", phone: "", email: "" });
  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const p = unwrap<any>(data);
  const contacts: any[] = p.contacts ?? [];

  const saveContacts = async (list: any[]) => {
    try { await api.put(`${m.path}/${p.id}`, { contacts: list }); toast.success("Contacts saved"); setContactOpen(false); reload(); } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={p.name} back={{ href: m.path, label: m.title }} subtitle={<StatusBadge status={p.status} />}
        actions={<>
          {can(kind === "supplier" ? "purchases.create" : "sales.create") && <Link href={`${m.docPath}/new?${kind}_id=${p.id}`}><Btn variant="outline">New {kind === "supplier" ? "purchase" : "sale"}</Btn></Link>}
          {can("payments.manage") && <Link href={`${m.payPath}?party_id=${p.id}&new=1`}><Btn>{kind === "supplier" ? "Pay supplier" : "Record receipt"}</Btn></Link>}
        </>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><p className="text-sm text-gray-500">Total billed</p><p className="text-xl font-semibold">{money(p.total_billed)}</p></Card>
        <Card><p className="text-sm text-gray-500">Total {kind === "supplier" ? "paid" : "received"}</p><p className="text-xl font-semibold">{money(p.total_paid)}</p></Card>
        <Card><p className="text-sm text-gray-500">Balance {kind === "supplier" ? "payable" : "receivable"}</p><p className="text-xl font-semibold text-brand-500">{money(p.balance)}</p></Card>
      </div>
      <Card title="Details">
        <KV items={[["Contact", p.contact_person], ["Phone", p.phone], ["Email", p.email], ["Address", p.address], ["Tax number", p.tax_number], ["Payment terms", p.payment_terms_days ? `${p.payment_terms_days} days` : "-"], ...(kind === "customer" ? [["Credit limit", p.credit_limit ? money(p.credit_limit) : "None"] as [string, React.ReactNode]] : []), ["Opening balance", money(p.opening_balance)]]} />
      </Card>
      {kind === "customer" && (
        <Card title="Contacts" actions={can("customers.manage") && <Btn size="sm" onClick={() => { setContact({ name: "", role: "", phone: "", email: "" }); setContactOpen(true); }}>+ Add contact</Btn>}>
          <SimpleTable head={["Name", "Role", "Phone", "Email", ""]} rows={contacts.map((c, i) => [c.name, c.role, c.phone, c.email, can("customers.manage") ? <button key={i} className="text-error-500 text-xs" onClick={() => saveContacts(contacts.filter((_, j) => j !== i))}>Remove</button> : null])} />
        </Card>
      )}
      <div>
        <Tabs value={tab} onChange={setTab} tabs={[{ key: "documents", label: m.docLabel }, { key: "payments", label: "Payments" }, { key: "returns", label: "Returns" }, { key: "statement", label: "Statement" }]} />
        <Card>
          {tab === "documents" && <SimpleTable head={["Number", "Date", "Status", "Payment", "Total", "Outstanding"]} rows={p.documents.map((d: any) => [<Link key={d.id} className="text-brand-500" href={`${m.docPath}/${d.id}`}>{d.invoice_no}</Link>, date(d.purchase_date ?? d.sale_date), <StatusBadge key="s" status={d.status} />, <StatusBadge key="p" status={d.payment_status} />, money(d.total_amount), money(d.outstanding_amount)])} />}
          {tab === "payments" && <SimpleTable head={["Number", "Date", "Method", "Reference", "Amount", "Status"]} rows={p.payments.map((x: any) => [x.payment_no, date(x.payment_date), x.payment_method_name, x.reference ?? "-", money(x.amount), <StatusBadge key="s" status={x.status ?? "posted"} />])} />}
          {tab === "returns" && <SimpleTable head={["Number", "Date", "Document", "Reason", "Amount"]} rows={p.returns.map((r: any) => [r.return_no, date(r.return_date), r.purchase_no ?? r.sale_no, r.reason ?? "-", money(r.total_amount)])} />}
          {tab === "statement" && <SimpleTable head={["Date", "Type", "Reference", "Debit", "Credit", "Balance"]} rows={[["", "Opening", "", "", "", money(p.opening_balance)], ...p.statement.map((l: any) => [date(l.date), l.type, l.reference, l.debit ? money(l.debit) : "", l.credit ? money(l.credit) : "", money(l.balance)])]} />}
        </Card>
      </div>
      <SbModal open={contactOpen} onClose={() => setContactOpen(false)} title="Add contact" footer={<><Btn variant="outline" onClick={() => setContactOpen(false)}>Cancel</Btn><Btn onClick={() => contact.name ? saveContacts([...contacts, contact]) : toast.error("Name is required")}>Save</Btn></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["name", "role", "phone", "email"] as const).map((k) => <input key={k} className={inputCls} placeholder={k[0].toUpperCase() + k.slice(1)} value={contact[k]} onChange={(e) => setContact({ ...contact, [k]: e.target.value })} />)}
        </div>
      </SbModal>
    </div>
  );
}
