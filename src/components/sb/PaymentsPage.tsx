"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { api, extractList, unwrap } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { date, money, round2Safe, todayIso } from "@/lib/format";
import { DataTable } from "./DataTable";
import { dateCol, moneyCol, statusCol, text } from "./cols";
import { Btn, FieldWrap, PageHeader, SbModal, SimpleTable, inputCls } from "./ui";

export function PaymentsPage({ direction }: { direction: "in" | "out" }) {
  const inbound = direction === "in";
  const { can } = useAuth();
  const params = useSearchParams();
  const { data, loading, error, reload } = useApi("/payments", { direction });
  const { data: partiesRaw } = useApi(inbound ? "/customers" : "/suppliers");
  const { data: methodsRaw } = useApi("/payment-methods");
  const { data: cbaRaw } = useApi("/cash-bank-accounts");
  const { data: openRaw, reload: reloadOpen } = useApi<any>(inbound ? "/receivables" : "/payables");
  const parties = extractList<any>(partiesRaw);
  const methods = extractList<any>(methodsRaw).filter((m) => m.status === "active");
  const cbas = extractList<any>(cbaRaw);
  const openDocs = openRaw ? unwrap<any>(openRaw).items ?? [] : [];

  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Record<string, string>>({});
  const [alloc, setAlloc] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<string, string[]> | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<any>(null);

  const partyDocs = useMemo(() => openDocs.filter((d: any) => String(d.party_id) === f.party_id), [openDocs, f.party_id]);
  const allocated = round2Safe(Object.values(alloc).reduce((s, v) => s + Number(v || 0), 0));

  const start = (partyId = "", docId?: string) => {
    setF({ party_id: partyId, amount: "", payment_method_id: methods[0] ? String(methods[0].id) : "", cash_bank_account_id: "", payment_date: todayIso(), reference: "", notes: "" });
    setAlloc({}); setErrors(null); setOpen(true);
    if (docId) setTimeout(() => setF((x) => ({ ...x, _doc: docId })), 0);
  };
  useEffect(() => { if (params.get("new") && methods.length) start(params.get("party_id") ?? "", params.get("document_id") ?? undefined); }, [methods.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!f._doc || !partyDocs.length) return;
    const d = partyDocs.find((x: any) => String(x.document_id) === f._doc);
    if (d) { setAlloc({ [d.document_id]: String(d.outstanding) }); setF((x) => ({ ...x, amount: String(d.outstanding), _doc: "" })); }
  }, [f._doc, partyDocs]);

  const autoAllocate = () => {
    let left = Number(f.amount || 0); const next: Record<number, string> = {};
    partyDocs.forEach((d: any) => { const a = Math.min(left, d.outstanding); if (a > 0) { next[d.document_id] = String(round2Safe(a)); left -= a; } });
    setAlloc(next);
  };
  const save = async () => {
    setBusy(true); setErrors(null);
    try {
      await api.post("/payments", {
        direction, party_id: Number(f.party_id) || null, amount: Number(f.amount), payment_method_id: Number(f.payment_method_id) || null,
        cash_bank_account_id: f.cash_bank_account_id ? Number(f.cash_bank_account_id) : null, payment_date: f.payment_date, reference: f.reference, notes: f.notes,
        allocations: Object.entries(alloc).filter(([, v]) => Number(v) > 0).map(([k, v]) => ({ document_id: Number(k), amount: Number(v) })),
      });
      toast.success(inbound ? "Receipt recorded" : "Payment recorded"); setOpen(false); reload(); reloadOpen();
    } catch (e) { if (e instanceof ApiError && e.errors) setErrors(e.errors); toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  const voidIt = async (p: any) => {
    if (!window.confirm(`Void ${p.payment_no}? Allocations and the journal will be reversed.`)) return;
    try { await api.post(`/payments/${p.id}/void`); toast.success("Payment voided"); reload(); reloadOpen(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const err = (k: string) => errors?.[k]?.[0];
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div>
      <PageHeader title={inbound ? "Customer receipts" : "Supplier payments"} subtitle={inbound ? "Money received from customers, allocated against sales invoices." : "Money paid to suppliers, allocated against purchase bills."}
        actions={can("payments.manage") && <Btn onClick={() => start()}>+ {inbound ? "Record receipt" : "Pay supplier"}</Btn>} />
      <DataTable rows={extractList<any>(data)} loading={loading} error={error} onRetry={reload} searchKeys={["payment_no", "party_name", "reference"]} onRowClick={setView}
        filters={[{ key: "status", label: "Status", options: [{ value: "posted", label: "Posted" }, { value: "void", label: "Void" }] }]}
        columns={[text("payment_no", "Number"), dateCol("payment_date", "Date"), text("party_name", inbound ? "Customer" : "Supplier"), text("payment_method_name", "Method"), text("cash_bank_account_name", "Account"), text("reference", "Reference"), moneyCol("amount", "Amount"), moneyCol("unallocated_amount", "Unallocated"), statusCol()]}
        actions={(p) => p.status !== "void" && can("payments.manage") ? <Btn size="sm" variant="ghost" className="text-error-500" onClick={() => voidIt(p)}>Void</Btn> : null} />
      <SbModal open={!!view} onClose={() => setView(null)} title={`${view?.payment_no ?? ""}`}>
        {view && <><p className="mb-3 text-sm text-gray-500">{view.party_name} · {date(view.payment_date)} · {money(view.amount)} via {view.payment_method_name}</p>
          <SimpleTable head={["Document", "Allocated"]} rows={view.allocations.map((a: any) => [a.document_no, money(a.amount)])} /></>}
      </SbModal>
      <SbModal open={open} onClose={() => setOpen(false)} title={inbound ? "Record customer receipt" : "Pay supplier"} wide
        footer={<><Btn variant="outline" onClick={() => setOpen(false)}>Cancel</Btn><Btn loading={busy} onClick={save}>Save</Btn></>}>
        <div className="grid gap-4 sm:grid-cols-3">
          <FieldWrap label={inbound ? "Customer" : "Supplier"} required error={err("party_id")}><select className={inputCls} value={f.party_id ?? ""} onChange={(e) => { setF({ ...f, party_id: e.target.value }); setAlloc({}); }}><option value="">Select…</option>{parties.map((p) => <option key={p.id} value={p.id}>{p.name} ({money(p.balance)})</option>)}</select></FieldWrap>
          <FieldWrap label="Amount" required error={err("amount")}><input type="number" step="any" className={inputCls} value={f.amount ?? ""} onChange={set("amount")} /></FieldWrap>
          <FieldWrap label="Date" required error={err("payment_date")}><input type="date" className={inputCls} value={f.payment_date ?? ""} onChange={set("payment_date")} /></FieldWrap>
          <FieldWrap label="Method" required error={err("payment_method_id")}><select className={inputCls} value={f.payment_method_id ?? ""} onChange={set("payment_method_id")}><option value="">Select…</option>{methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></FieldWrap>
          <FieldWrap label="Cash / bank account" hint="Defaults to the method's account"><select className={inputCls} value={f.cash_bank_account_id ?? ""} onChange={set("cash_bank_account_id")}><option value="">Default</option>{cbas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></FieldWrap>
          <FieldWrap label="Reference" error={err("reference")}><input className={inputCls} value={f.reference ?? ""} onChange={set("reference")} placeholder="Cheque / transfer #" /></FieldWrap>
        </div>
        {f.party_id && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between"><h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">Allocate to open documents</h5><Btn size="sm" variant="outline" onClick={autoAllocate}>Auto-allocate (oldest first)</Btn></div>
            <SimpleTable head={["Document", "Date", "Due", "Outstanding", "Allocate"]} rows={partyDocs.map((d: any) => [d.invoice_no, date(d.date), date(d.due_date), money(d.outstanding),
              <input key="a" type="number" step="any" className={`${inputCls} w-32`} value={alloc[d.document_id] ?? ""} onChange={(e) => setAlloc({ ...alloc, [d.document_id]: e.target.value })} />])} />
            <p className="mt-2 text-right text-sm text-gray-500">Allocated {money(allocated)} of {money(f.amount || 0)} · Unallocated (advance) {money(Math.max(0, Number(f.amount || 0) - allocated))}</p>
            {errors && Object.entries(errors).filter(([k]) => k.startsWith("allocations")).map(([k, v]) => <p key={k} className="text-xs text-error-500">{v[0]}</p>)}
          </div>
        )}
      </SbModal>
    </div>
  );
}
