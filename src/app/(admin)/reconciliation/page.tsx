"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api, extractList, unwrap } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { DataTable } from "@/components/sb/DataTable";
import { dateCol, text } from "@/components/sb/cols";
import { FieldWrap, PageHeader, Stat, inputCls } from "@/components/sb/ui";
import { money } from "@/lib/format";

export default function ReconciliationPage() {
  const { can } = useAuth();
  const { data: cbaRaw } = useApi("/cash-bank-accounts");
  const cbas = extractList<any>(cbaRaw);
  const [acc, setAcc] = useState("");
  const [statement, setStatement] = useState("");
  useEffect(() => { if (!acc && cbas.length) setAcc(String(cbas.find((c) => c.type === "bank")?.id ?? cbas[0].id)); }, [cbas, acc]);
  const { data, loading, error, reload } = useApi<any>(acc ? "/reconciliation" : null, { cash_bank_account_id: acc });
  const r = data ? unwrap<any>(data) : null;
  const toggle = async (row: any) => {
    try { await api.post("/reconciliation/toggle", { kind: row.kind, id: row.id, reconciled: !row.reconciled }); reload(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const recBalance = r ? r.reconciled_in - r.reconciled_out : 0;
  return (
    <div>
      <PageHeader title="Bank reconciliation" subtitle="Tick each transaction that appears on your bank statement." />
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <FieldWrap label="Account"><select className={inputCls} value={acc} onChange={(e) => setAcc(e.target.value)}>{cbas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></FieldWrap>
        <FieldWrap label="Statement closing balance"><input type="number" className={inputCls} value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="From your bank statement" /></FieldWrap>
        <Stat title="Book balance" value={money(r?.book_balance)} />
        <Stat title="Cleared (reconciled) net" value={money(recBalance)} hint={statement ? `Difference vs statement: ${money(Number(statement) - recBalance)}` : undefined} />
      </div>
      <DataTable rows={r?.items ?? []} loading={loading} error={error} onRetry={reload} pageSize={20} searchKeys={["reference", "description"]}
        filters={[{ key: "reconciled", label: "Reconciled", options: [{ value: "true", label: "Reconciled" }, { value: "false", label: "Unreconciled" }] }]}
        columns={[{ key: "reconciled", label: "✓", render: (x: any) => <input type="checkbox" disabled={!can("payments.manage")} checked={!!x.reconciled} onChange={() => toggle(x)} /> }, dateCol("date", "Date"), text("reference", "Reference"), text("description", "Description"),
          { key: "amount_in", label: "In", render: (x: any) => (x.amount_in ? money(x.amount_in) : "") }, { key: "amount_out", label: "Out", render: (x: any) => (x.amount_out ? money(x.amount_out) : "") }]} />
    </div>
  );
}
