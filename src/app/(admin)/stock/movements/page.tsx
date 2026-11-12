"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useApi } from "@/hooks/useApi";
import { extractList } from "@/lib/api/client";
import { DataTable } from "@/components/sb/DataTable";
import { text } from "@/components/sb/cols";
import { PageHeader } from "@/components/sb/ui";
import { dateTime, num } from "@/lib/format";

const TYPES = ["opening_stock", "warehouse_inward", "warehouse_outward", "purchase_return", "sales_return", "stock_adjustment", "stock_transfer", "sale_cancel"];

export default function StockMovementsPage() {
  const { data, loading, error, reload } = useApi("/stock/movements");
  return (
    <div>
      <PageHeader title="Stock movements" subtitle="Audit trail of every stock change: who, when, why and which document." />
      <DataTable rows={extractList<any>(data)} loading={loading} error={error} onRetry={reload} pageSize={20} searchKeys={["product", "sku", "reference_no", "reason", "actor_name"]}
        filters={[{ key: "reference_type", label: "Type", options: TYPES.map((t) => ({ value: t, label: t.replace(/_/g, " ") })) }]}
        columns={[{ key: "movement_date", label: "Date", render: (r: any) => dateTime(r.movement_date) }, text("product", "Product"), text("warehouse", "Warehouse"), { key: "reference_type", label: "Type", render: (r: any) => r.reference_type?.replace(/_/g, " ") }, text("reference_no", "Reference"),
          { key: "quantity_in", label: "In", render: (r: any) => (r.quantity_in ? <span className="text-success-600">+{num(r.quantity_in)}</span> : "") }, { key: "quantity_out", label: "Out", render: (r: any) => (r.quantity_out ? <span className="text-error-600">-{num(r.quantity_out)}</span> : "") },
          { key: "balance_after", label: "Balance", render: (r: any) => num(r.balance_after) }, text("reason", "Reason"), text("actor_name", "By")]} />
    </div>
  );
}
