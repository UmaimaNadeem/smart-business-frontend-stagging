"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { unwrap } from "@/lib/api/client";
import { date, money } from "@/lib/format";
import { Bars } from "@/components/sb/Reports";
import { Btn, Card, ErrorState, Loading, PageHeader, SimpleTable, Stat, StatusBadge } from "@/components/sb/ui";

export default function DashboardPage() {
  const { me, company, can } = useAuth();
  const { data, loading, error, reload } = useApi<any>("/dashboard/summary");
  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const d = unwrap<any>(data);
  const finance = can("payments.view");
  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome, ${me?.name?.split(" ")[0] ?? ""}`} subtitle={company?.name}
        actions={<>
          {can("sales.create") && <Link href="/sales/new"><Btn>+ New sale</Btn></Link>}
          {can("purchases.create") && <Link href="/purchases/new"><Btn variant="outline">+ New purchase</Btn></Link>}
        </>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="Sales (30 days)" value={money(d.sales_30d)} href={can("reports.view") ? "/reports/sales" : undefined} />
        <Stat title="Purchases (30 days)" value={money(d.purchases_30d)} href={can("reports.view") ? "/reports/purchases" : undefined} />
        {finance && <Stat title="Receivables" value={money(d.receivables)} href="/receivables" />}
        {finance && <Stat title="Payables" value={money(d.payables)} href="/payables" />}
        {finance && <Stat title="Cash & bank" value={money(d.cash_balance)} hint={d.cash_accounts.map((a: any) => `${a.name}: ${money(a.balance)}`).join(" · ")} href="/cash-bank" />}
        <Stat title="Pending inwards" value={d.pending_inwards} hint="Purchases waiting to be received" href="/inwards" />
        <Stat title="Pending outwards" value={d.pending_outwards} hint="Sales waiting for dispatch" href="/outwards" />
        <Stat title="Drafts" value={`${d.draft_sales} sales · ${d.draft_purchases} POs`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Sales by month" className="lg:col-span-2"><Bars rows={d.monthly.map((m: any) => ({ period: m.period, amount: m.sales }))} /></Card>
        <Card title="Plan usage" actions={<Link href="/billing" className="text-sm text-brand-500">Manage</Link>}>
          <p className="mb-3 text-sm text-gray-500">{d.subscription.plan} · <StatusBadge status={d.subscription.status} /></p>
          {["users", "branches", "warehouses", "products"].map((k) => (
            <div key={k} className="mb-2 flex justify-between text-sm"><span className="capitalize text-gray-500">{k}</span><span>{d.subscription.usage?.[k]} / {d.subscription.limits?.[k] ?? "∞"}</span></div>
          ))}
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Recent sales" actions={<Link href="/sales" className="text-sm text-brand-500">View all</Link>}>
          <SimpleTable head={["Number", "Customer", "Date", "Total", "Status"]} rows={d.recent_sales.map((s: any) => [<Link key={s.id} className="text-brand-500" href={`/sales/${s.id}`}>{s.invoice_no}</Link>, s.customer_name, date(s.sale_date), money(s.total_amount), <StatusBadge key="st" status={s.status} />])} />
        </Card>
        <Card title="Low stock" actions={<Link href="/reports/low-stock" className="text-sm text-brand-500">Report</Link>}>
          <SimpleTable head={["Product", "SKU", "In stock", "Alert at"]} rows={d.low_stock.map((p: any) => [<Link key={p.id} className="text-brand-500" href={`/products/${p.id}`}>{p.name}</Link>, p.sku, <span key="q" className="font-medium text-warning-600">{p.current_stock}</span>, p.min_stock_alert])} />
        </Card>
      </div>
    </div>
  );
}
