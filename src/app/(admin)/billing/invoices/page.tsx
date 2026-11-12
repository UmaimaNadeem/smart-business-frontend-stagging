"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useApi } from "@/hooks/useApi";
import { extractList } from "@/lib/api/client";
import { DataTable } from "@/components/sb/DataTable";
import { statusCol, text } from "@/components/sb/cols";
import { PageHeader } from "@/components/sb/ui";
import { date, money } from "@/lib/format";

export default function InvoicesPage() {
  const { data, loading, error, reload } = useApi("/subscription/invoices");
  return (
    <div>
      <PageHeader title="Subscription invoices" back={{ href: "/billing", label: "Subscription" }} />
      <DataTable rows={extractList<any>(data)} loading={loading} error={error} onRetry={reload} searchKeys={["invoice_no", "plan_name"]}
        columns={[text("invoice_no", "Invoice"), text("plan_name", "Plan"), text("billing_cycle", "Cycle"), { key: "issued_at", label: "Issued", render: (r: any) => date(r.issued_at) }, { key: "period", label: "Period", render: (r: any) => `${date(r.period_start)} – ${date(r.period_end)}` }, { key: "amount", label: "Amount", render: (r: any) => money(r.amount, r.currency) }, { key: "paid_at", label: "Paid", render: (r: any) => date(r.paid_at) }, text("gateway_reference", "Gateway ref"), statusCol()]} />
    </div>
  );
}
