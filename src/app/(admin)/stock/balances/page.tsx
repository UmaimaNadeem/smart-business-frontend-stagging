"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useApi } from "@/hooks/useApi";
import { extractList } from "@/lib/api/client";
import { DataTable } from "@/components/sb/DataTable";
import { moneyCol, numCol, text } from "@/components/sb/cols";
import { PageHeader } from "@/components/sb/ui";

export default function StockBalancesPage() {
  const { data, loading, error, reload } = useApi("/stock/balances");
  const rows = extractList<any>(data);
  const whs = Array.from(new Set(rows.map((r) => r.warehouse))).map((w) => ({ value: w, label: w }));
  return (
    <div>
      <PageHeader title="Stock balances" subtitle="Quantity on hand per product per warehouse." />
      <DataTable rows={rows} loading={loading} error={error} onRetry={reload} searchKeys={["product", "sku", "warehouse"]} filters={[{ key: "warehouse", label: "Warehouse", options: whs }]}
        columns={[text("product", "Product"), text("sku", "SKU"), text("warehouse", "Warehouse"), { key: "quantity", label: "Qty", value: (r: any) => r.quantity, render: (r: any) => <span className={r.quantity <= (r.min_stock_alert ?? 0) ? "text-warning-600 font-medium" : ""}>{r.quantity} {r.unit}</span> }, moneyCol("unit_cost", "Unit cost"), moneyCol("value", "Value"), numCol("min_stock_alert", "Min alert")]} />
    </div>
  );
}
