"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import Link from "next/link";
import { unwrap } from "@/lib/api/client";
import { useApi } from "@/hooks/useApi";
import { daysAgoIso, money, num, todayIso, date } from "@/lib/format";
import { Alert, Btn, Card, ErrorState, FieldWrap, Loading, PageHeader, SimpleTable, Stat, StatusBadge, inputCls } from "./ui";

type Mode = "range" | "asof" | "none";

function exportCsv(name: string, head: string[], rows: (string | number)[][]) {
  const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `${name}.csv`; a.click();
}

export function ReportShell({ title, subtitle, path, mode = "range", children }: { title: string; subtitle?: string; path: string; mode?: Mode; children: (d: any) => React.ReactNode }) {
  const [q, setQ] = useState({ from: daysAgoIso(180), to: todayIso(), as_of: todayIso() });
  const query = mode === "range" ? { from: q.from, to: q.to } : mode === "asof" ? { as_of: q.as_of } : undefined;
  const { data, loading, error, reload } = useApi<any>(path, query);
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} actions={<>
        {mode === "range" && <><FieldWrap label="From"><input type="date" className={inputCls} value={q.from} onChange={(e) => setQ({ ...q, from: e.target.value })} /></FieldWrap><FieldWrap label="To"><input type="date" className={inputCls} value={q.to} onChange={(e) => setQ({ ...q, to: e.target.value })} /></FieldWrap></>}
        {mode === "asof" && <FieldWrap label="As of"><input type="date" className={inputCls} value={q.as_of} onChange={(e) => setQ({ ...q, as_of: e.target.value })} /></FieldWrap>}
        <div className="flex items-end"><Btn variant="outline" onClick={() => window.print()}>Print</Btn></div>
      </>} />
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <Loading /> : data ? children(unwrap<any>(data)) : null}
    </div>
  );
}

export function Bars({ rows }: { rows: { period: string; amount: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.amount));
  return (
    <div className="flex h-40 items-end gap-2">
      {rows.map((r) => (
        <div key={r.period} className="flex flex-1 flex-col items-center gap-1">
          <div className="w-full rounded-t bg-brand-500" style={{ height: `${(r.amount / max) * 100}%`, minHeight: 2 }} title={money(r.amount)} />
          <span className="text-[10px] text-gray-500">{r.period}</span>
        </div>
      ))}
      {rows.length === 0 && <p className="text-sm text-gray-500">No data in range.</p>}
    </div>
  );
}

const acctRows = (list: any[]) => list.map((a) => [a.code, a.name, money(a.amount)]);

export function ProfitLoss() {
  return <ReportShell title="Profit & loss" path="/reports/profit-loss">{(d) => (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3"><Stat title="Income" value={money(d.total_income)} /><Stat title="Gross profit" value={money(d.gross_profit)} /><Stat title="Net profit" value={<span className={d.net_profit < 0 ? "text-error-500" : "text-success-600"}>{money(d.net_profit)}</span>} /></div>
      <Card title="Income"><SimpleTable head={["Code", "Account", "Amount"]} rows={acctRows(d.income)} foot={["", "Total income", money(d.total_income)]} /></Card>
      <Card title="Cost of sales"><SimpleTable head={["Code", "Account", "Amount"]} rows={acctRows(d.cost_of_sales)} foot={["", "Gross profit", money(d.gross_profit)]} /></Card>
      <Card title="Operating expenses"><SimpleTable head={["Code", "Account", "Amount"]} rows={acctRows(d.operating_expenses)} foot={["", "Net profit", money(d.net_profit)]} /></Card>
    </div>)}</ReportShell>;
}

export function BalanceSheet() {
  return <ReportShell title="Balance sheet" path="/reports/balance-sheet" mode="asof">{(d) => (
    <div className="space-y-6">
      {d.balanced ? <Alert kind="success">Assets = Liabilities + Equity</Alert> : <Alert kind="error">Not balanced — check postings.</Alert>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Assets"><SimpleTable head={["Code", "Account", "Amount"]} rows={acctRows(d.assets)} foot={["", "Total assets", money(d.total_assets)]} /></Card>
        <div className="space-y-6">
          <Card title="Liabilities"><SimpleTable head={["Code", "Account", "Amount"]} rows={acctRows(d.liabilities)} foot={["", "Total liabilities", money(d.total_liabilities)]} /></Card>
          <Card title="Equity"><SimpleTable head={["Code", "Account", "Amount"]} rows={acctRows(d.equity)} foot={["", "Total equity", money(d.total_equity)]} /></Card>
        </div>
      </div>
    </div>)}</ReportShell>;
}

export function CashFlow() {
  return <ReportShell title="Cash flow" subtitle="Movements in cash & bank accounts, grouped by source." path="/reports/cash-flow">{(d) => (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3"><Stat title="Opening cash" value={money(d.opening_cash)} /><Stat title="Net change" value={money(d.net_change)} /><Stat title="Closing cash" value={money(d.closing_cash)} /></div>
      <Card><SimpleTable head={["Activity", "Amount"]} rows={d.lines.map((l: any) => [l.label, <span key="a" className={l.amount < 0 ? "text-error-500" : ""}>{money(l.amount)}</span>])} foot={["Net change", money(d.net_change)]} /></Card>
    </div>)}</ReportShell>;
}

export function SalesReport() {
  return <ReportShell title="Sales report" subtitle="Dispatched and delivered sales." path="/reports/sales">{(d) => (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4"><Stat title="Sales" value={money(d.total_sales)} /><Stat title="Invoices" value={num(d.invoices)} /><Stat title="Tax" value={money(d.total_tax)} /><Stat title="Discounts" value={money(d.total_discount)} /></div>
      <Card title="By month"><Bars rows={d.by_month} /></Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Top products"><SimpleTable head={["Product", "Qty", "Amount"]} rows={d.by_product.map((p: any) => [p.product, num(p.quantity), money(p.amount)])} /></Card>
        <Card title="By customer"><SimpleTable head={["Customer", "Invoices", "Amount", "Outstanding"]} rows={d.by_customer.map((c: any) => [c.customer, c.invoices, money(c.amount), money(c.outstanding)])} /></Card>
      </div>
      <Card title="Invoices" actions={<Btn size="sm" variant="outline" onClick={() => exportCsv("sales", ["Number", "Date", "Customer", "Status", "Total", "Outstanding"], d.items.map((i: any) => [i.invoice_no, i.date, i.customer, i.status, i.total, i.outstanding]))}>Export CSV</Btn>}>
        <SimpleTable head={["Number", "Date", "Customer", "Status", "Total", "Outstanding"]} rows={d.items.map((i: any) => [<Link key={i.id} className="text-brand-500" href={`/sales/${i.id}`}>{i.invoice_no}</Link>, date(i.date), i.customer, <StatusBadge key="s" status={i.status} />, money(i.total), money(i.outstanding)])} />
      </Card>
    </div>)}</ReportShell>;
}

export function PurchasesReport() {
  return <ReportShell title="Purchases report" path="/reports/purchases">{(d) => (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3"><Stat title="Ordered" value={money(d.total_ordered)} /><Stat title="Received (billed)" value={money(d.total_received)} /><Stat title="Orders" value={num(d.orders)} /></div>
      <Card title="By month"><Bars rows={d.by_month} /></Card>
      <Card title="By supplier"><SimpleTable head={["Supplier", "Orders", "Ordered", "Received", "Outstanding"]} rows={d.by_supplier.map((s: any) => [s.supplier, s.orders, money(s.ordered), money(s.received), money(s.outstanding)])} /></Card>
      <Card title="Orders" actions={<Btn size="sm" variant="outline" onClick={() => exportCsv("purchases", ["Number", "Date", "Supplier", "Status", "Total", "Received", "Outstanding"], d.items.map((i: any) => [i.invoice_no, i.date, i.supplier, i.status, i.total, i.received, i.outstanding]))}>Export CSV</Btn>}>
        <SimpleTable head={["Number", "Date", "Supplier", "Status", "Total", "Received", "Outstanding"]} rows={d.items.map((i: any) => [<Link key={i.id} className="text-brand-500" href={`/purchases/${i.id}`}>{i.invoice_no}</Link>, date(i.date), i.supplier, <StatusBadge key="s" status={i.status} />, money(i.total), money(i.received), money(i.outstanding)])} />
      </Card>
    </div>)}</ReportShell>;
}

export function ExpensesReport() {
  return <ReportShell title="Expenses report" path="/reports/expenses">{(d) => (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2"><Stat title="Total expenses" value={money(d.total)} /><Stat title="Entries" value={num(d.count)} /></div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="By month"><Bars rows={d.by_month} /></Card>
        <Card title="By category"><SimpleTable head={["Category", "Amount"]} rows={d.by_category.map((c: any) => [c.category, money(c.amount)])} /></Card>
      </div>
      <Card title="Entries"><SimpleTable head={["Number", "Date", "Category", "Payee", "Amount"]} rows={d.items.map((e: any) => [e.expense_no, date(e.expense_date), e.category_name, e.payee ?? "-", money(e.amount)])} /></Card>
    </div>)}</ReportShell>;
}

export function StockValuation() {
  return <ReportShell title="Stock valuation" subtitle="At weighted-average cost, per warehouse." path="/reports/stock-valuation" mode="none">{(d) => (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3"><Stat title="Stock value (cost)" value={money(d.total_value)} /><Stat title="Retail value" value={money(d.total_retail_value)} /><Stat title="Inventory GL balance" value={money(d.ledger_inventory_balance)} hint={Math.abs(d.ledger_inventory_balance - d.total_value) < 1 ? "Matches stock value" : "Differs from stock value"} /></div>
      <Card actions={<Btn size="sm" variant="outline" onClick={() => exportCsv("stock-valuation", ["Product", "SKU", "Warehouse", "Qty", "Unit cost", "Value"], d.items.map((i: any) => [i.product, i.sku, i.warehouse, i.quantity, i.unit_cost, i.value]))}>Export CSV</Btn>} title="Items">
        <SimpleTable head={["Product", "SKU", "Warehouse", "Qty", "Unit cost", "Value", "Retail value"]} rows={d.items.map((i: any) => [i.product, i.sku, i.warehouse, num(i.quantity), money(i.unit_cost), money(i.value), money(i.retail_value)])} foot={["Total", "", "", "", "", money(d.total_value), money(d.total_retail_value)]} />
      </Card>
    </div>)}</ReportShell>;
}

export function LowStock() {
  return <ReportShell title="Low stock" subtitle="Active products at or below their alert level." path="/reports/low-stock" mode="none">{(d) => (
    <Card>
      <SimpleTable head={["Product", "SKU", "Branch", "In stock", "Alert at", "Shortfall", "Suggested order", ""]} rows={d.items.map((i: any) => [i.product, i.sku, i.business, num(i.current_stock), num(i.min_stock_alert), num(i.shortfall), num(i.suggested_order), <Link key="p" className="text-brand-500 text-sm" href="/purchases/new">Reorder</Link>])} />
    </Card>)}</ReportShell>;
}
