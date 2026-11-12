"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { unwrap } from "@/lib/api/client";
import { money } from "@/lib/format";
import { DataTable } from "./DataTable";
import { dateCol, moneyCol, numCol } from "./cols";
import { PageHeader, Stat } from "./ui";

const BUCKETS: [string, string][] = [["current", "Current"], ["1_30", "1–30 days"], ["31_60", "31–60"], ["61_90", "61–90"], ["90_plus", "90+"]];

export function AgingPage({ kind }: { kind: "receivables" | "payables" }) {
  const r = kind === "receivables";
  const { data, loading, error, reload } = useApi<any>(`/${kind}`);
  const d = data ? unwrap<any>(data) : { items: [], buckets: {}, total: 0 };
  return (
    <div>
      <PageHeader title={r ? "Receivables" : "Payables"} subtitle={`${r ? "What customers owe you" : "What you owe suppliers"}, aged by due date.`} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat title="Total outstanding" value={money(d.total)} />
        {BUCKETS.map(([k, l]) => <Stat key={k} title={l} value={money(d.buckets?.[k] ?? 0)} />)}
      </div>
      <DataTable rows={d.items} loading={loading} error={error} onRetry={reload} searchKeys={["invoice_no", "party_name"]}
        filters={[{ key: "bucket", label: "Age", options: BUCKETS.map(([value, label]) => ({ value, label })) }]}
        columns={[{ key: "invoice_no", label: "Document", render: (x: any) => <Link className="text-brand-500" href={`/${r ? "sales" : "purchases"}/${x.document_id}`}>{x.invoice_no}</Link> },
          { key: "party_name", label: r ? "Customer" : "Supplier", render: (x: any) => <Link className="hover:underline" href={`/${r ? "customers" : "suppliers"}/${x.party_id}`}>{x.party_name}</Link> },
          dateCol("date", "Date"), dateCol("due_date", "Due"), numCol("days_overdue", "Days overdue"), moneyCol("total", "Total"), moneyCol("paid", "Paid"), moneyCol("outstanding", "Outstanding")]}
        actions={(x: any) => <Link className="text-sm text-brand-500" href={`/${r ? "customer-receipts" : "supplier-payments"}?party_id=${x.party_id}&document_id=${x.document_id}&new=1`}>{r ? "Receive" : "Pay"}</Link>} />
    </div>
  );
}
