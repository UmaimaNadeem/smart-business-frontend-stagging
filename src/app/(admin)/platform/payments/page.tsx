"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useApi } from "@/hooks/useApi";
import { extractList } from "@/lib/api/client";
import { DataTable } from "@/components/sb/DataTable";
import { statusCol, text } from "@/components/sb/cols";
import { Card, PageHeader, SimpleTable, Stat } from "@/components/sb/ui";
import { date, dateTime, money } from "@/lib/format";

export default function PlatformPaymentsPage() {
  const { data, loading, error, reload } = useApi("/platform/payments");
  const { data: ev } = useApi("/platform/events");
  const rows = extractList<any>(data);
  const paid = rows.filter((r) => r.status === "paid");
  return (
    <div className="space-y-6">
      <PageHeader title="Subscription payments" subtitle="Invoices and gateway results across all tenants." />
      <div className="grid gap-4 sm:grid-cols-3"><Stat title="Collected" value={money(paid.reduce((s, r) => s + r.amount, 0))} /><Stat title="Open" value={rows.filter((r) => r.status === "open").length} /><Stat title="Failed" value={rows.filter((r) => r.status === "failed").length} /></div>
      <DataTable rows={rows} loading={loading} error={error} onRetry={reload} searchKeys={["invoice_no", "company", "plan_name"]}
        filters={[{ key: "status", label: "Status", options: ["open", "paid", "failed"].map((v) => ({ value: v, label: v })) }]}
        columns={[text("invoice_no", "Invoice"), text("company", "Company"), text("plan_name", "Plan"), { key: "amount", label: "Amount", render: (r: any) => money(r.amount, r.currency) }, { key: "issued_at", label: "Issued", render: (r: any) => date(r.issued_at) }, { key: "paid_at", label: "Paid", render: (r: any) => date(r.paid_at) }, text("gateway", "Gateway"), text("gateway_reference", "Reference"), statusCol()]} />
      <Card title="Billing events"><SimpleTable head={["When", "Company", "Event"]} rows={extractList<any>(ev).slice(0, 30).map((e) => [dateTime(e.created_at), e.company, e.type])} /></Card>
    </div>
  );
}
