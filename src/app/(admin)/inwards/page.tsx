"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRouter } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { extractList } from "@/lib/api/client";
import { DataTable } from "@/components/sb/DataTable";
import { dateCol, linkCol, statusCol, statusFilter, text } from "@/components/sb/cols";
import { PageHeader } from "@/components/sb/ui";
import { num } from "@/lib/format";

export default function InwardsPage() {
  const router = useRouter();
  const { data, loading, error, reload } = useApi("/purchases/inwards/all");
  return (
    <div>
      <PageHeader title="Warehouse inwards" subtitle="Confirmed purchases arrive here. Tally what was received — partial receipts are allowed." />
      <DataTable rows={extractList<any>(data)} loading={loading} error={error} onRetry={reload} searchKeys={["gate_pass_no", "purchase_no", "supplier_name"]}
        filters={[statusFilter(["pending", "partially_received", "completed", "cancelled"])]} onRowClick={(r) => router.push(`/inwards/${r.id}`)}
        columns={[linkCol("gate_pass_no", "Gate pass", (r) => `/inwards/${r.id}`), text("purchase_no", "PO"), text("supplier_name", "Supplier"), text("warehouse", "Warehouse"), dateCol("purchase_date", "PO date"),
          { key: "progress", label: "Received", value: (r: any) => r.total_received / (r.total_ordered || 1), render: (r: any) => `${num(r.total_received)} / ${num(r.total_ordered)}` }, statusCol()]} />
    </div>
  );
}
