"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { use } from "react";
import { useApi } from "@/hooks/useApi";
import { unwrap } from "@/lib/api/client";
import { money, num } from "@/lib/format";
import { Card, ErrorState, KV, Loading, PageHeader, SimpleTable, StatusBadge } from "@/components/sb/ui";

export default function WarehouseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error, reload } = useApi<any>(`/warehouses/${id}`);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const w = unwrap<any>(data);
  return (
    <div className="space-y-6">
      <PageHeader title={w.name} subtitle={<StatusBadge status={w.status} />} back={{ href: "/warehouses", label: "Warehouses" }} />
      <Card><KV items={[["Code", w.code], ["Branch", w.business], ["Location", w.location], ["Manager", w.manager_name], ["Products in stock", num(w.products_in_stock)], ["Stock value", money(w.stock_value)]]} /></Card>
      <Card title="Stock balances"><SimpleTable head={["Product", "SKU", "Qty", "Unit cost", "Value"]} rows={w.balances.map((b: any) => [b.product, b.sku, `${num(b.quantity)} ${b.unit ?? ""}`, money(b.unit_cost), money(b.value)])} /></Card>
    </div>
  );
}
