"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { use } from "react";
import { useApi } from "@/hooks/useApi";
import { unwrap } from "@/lib/api/client";
import { dateTime, money, num } from "@/lib/format";
import { Card, ErrorState, KV, Loading, PageHeader, SimpleTable, StatusBadge } from "@/components/sb/ui";

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, loading, error, reload } = useApi<any>(`/products/detail/${id}`);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const p = unwrap<any>(data);
  return (
    <div className="space-y-6">
      <PageHeader title={p.name} subtitle={<StatusBadge status={p.status} />} back={{ href: "/products", label: "Products" }} />
      <Card><KV items={[["SKU", p.sku], ["Barcode", p.barcode], ["Category", p.category], ["Unit", p.unit], ["Branch", p.business], ["Cost price (avg)", money(p.cost_price)], ["Selling price", money(p.selling_price)], ["Stock on hand", `${num(p.current_stock)} ${p.unit}`], ["Low-stock alert", num(p.min_stock_alert)], ["Stock value", money(p.stock_value)]]} /></Card>
      <Card title="Stock by warehouse"><SimpleTable head={["Warehouse", "Quantity"]} rows={p.balances.map((b: any) => [b.warehouse, num(b.quantity)])} /></Card>
      <Card title="Recent movements"><SimpleTable head={["Date", "Type", "Reference", "Warehouse", "In", "Out", "Balance", "By"]} rows={p.movements.map((m: any) => [dateTime(m.movement_date), m.reference_type?.replace(/_/g, " "), m.reference_no, m.warehouse, m.quantity_in ? num(m.quantity_in) : "", m.quantity_out ? num(m.quantity_out) : "", num(m.balance_after), m.actor_name])} /></Card>
    </div>
  );
}
