"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { extractList, unwrap } from "@/lib/api/client";
import { useApi } from "@/hooks/useApi";
import { DataTable } from "@/components/sb/DataTable";
import { dateCol, text } from "@/components/sb/cols";
import { FieldWrap, PageHeader, Stat, inputCls } from "@/components/sb/ui";
import { daysAgoIso, money, todayIso } from "@/lib/format";

export default function LedgerPage() {
  const { data: accRaw } = useApi("/accounts");
  const accounts = extractList<any>(accRaw);
  const [q, setQ] = useState({ account_id: "", from: daysAgoIso(365), to: todayIso() });
  useEffect(() => { if (!q.account_id && accounts.length) setQ((x) => ({ ...x, account_id: String(accounts.find((a) => a.code === "1000")?.id ?? accounts[0].id) })); }, [accounts, q.account_id]);
  const { data, loading, error, reload } = useApi<any>(q.account_id ? "/ledger" : null, q);
  const l = data ? unwrap<any>(data) : null;
  return (
    <div>
      <PageHeader title="General ledger" subtitle="All postings to one account with a running balance." />
      <div className="mb-6 grid gap-4 md:grid-cols-5">
        <FieldWrap label="Account" className="md:col-span-2"><select className={inputCls} value={q.account_id} onChange={(e) => setQ({ ...q, account_id: e.target.value })}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></FieldWrap>
        <FieldWrap label="From"><input type="date" className={inputCls} value={q.from} onChange={(e) => setQ({ ...q, from: e.target.value })} /></FieldWrap>
        <FieldWrap label="To"><input type="date" className={inputCls} value={q.to} onChange={(e) => setQ({ ...q, to: e.target.value })} /></FieldWrap>
      </div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2"><Stat title="Opening balance" value={money(l?.opening_balance)} /><Stat title="Closing balance" value={money(l?.closing_balance)} /></div>
      <DataTable rows={l?.items ?? []} loading={loading} error={error} onRetry={reload} pageSize={25} searchKeys={["journal_no", "memo", "source_no"]}
        columns={[dateCol("date", "Date"), text("journal_no", "Journal"), text("memo", "Description"), text("source_no", "Doc"), { key: "debit", label: "Debit", render: (r: any) => (r.debit ? money(r.debit) : "") }, { key: "credit", label: "Credit", render: (r: any) => (r.credit ? money(r.credit) : "") }, { key: "balance", label: "Balance", render: (r: any) => money(r.balance) }]} />
    </div>
  );
}
