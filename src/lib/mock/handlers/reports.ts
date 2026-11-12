/* eslint-disable @typescript-eslint/no-explicit-any */
import { DB, Row, daysAgo, find, round2, today } from "../db";
import { accountBalances, normalBalance, outstanding } from "../engine";
import { Route, Tenant, ok, scoped } from "../router";
import { aging, ctxOf } from "./finance";
import { effectiveStatus, subscriptionOf, usage } from "./billing-helpers";

const range = (q: URLSearchParams) => ({ from: q.get("from") || daysAgo(180), to: q.get("to") || today() });
const inRange = (d: string, r: { from: string; to: string }) => String(d).slice(0, 10) >= r.from && String(d).slice(0, 10) <= r.to;
const sum = (rows: Row[], k: string) => round2(rows.reduce((s, r) => s + Number(r[k] || 0), 0));
const month = (d: string) => String(d).slice(0, 7);

function byMonth(rows: Row[], dateKey: string, valKey: string) {
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(month(r[dateKey]), round2((m.get(month(r[dateKey])) ?? 0) + Number(r[valKey] || 0))));
  return Array.from(m.entries()).sort().map(([k, v]) => ({ period: k, amount: v }));
}

function accountsByType(db: DB, t: Tenant, types: string[], opts: { from?: string; to?: string }) {
  const c = ctxOf(db, t);
  const bal = accountBalances(c, opts);
  return db.tables.accounts.filter((a) => a.company_id === c.companyId && types.includes(a.type)).sort((a, b) => a.code.localeCompare(b.code)).map((a) => {
    const b = bal.get(a.id) ?? { debit: 0, credit: 0 };
    return { account_id: a.id, code: a.code, name: a.name, type: a.type, amount: normalBalance(a.type, b.debit, b.credit) };
  }).filter((r) => r.amount !== 0);
}

function profitLoss(db: DB, t: Tenant, r: { from: string; to: string }) {
  const income = accountsByType(db, t, ["income"], r);
  const expenses = accountsByType(db, t, ["expense"], r);
  const cogs = expenses.filter((e) => e.code === "5000");
  const opex = expenses.filter((e) => e.code !== "5000");
  const totalIncome = sum(income, "amount"), totalCogs = sum(cogs, "amount"), totalOpex = sum(opex, "amount");
  return { ...r, income, cost_of_sales: cogs, operating_expenses: opex, total_income: totalIncome, gross_profit: round2(totalIncome - totalCogs), total_expenses: round2(totalCogs + totalOpex), net_profit: round2(totalIncome - totalCogs - totalOpex) };
}

export const reportRoutes: Route[] = [
  { method: "GET", pattern: "/api/reports/profit-loss", access: "verified", tenant: "required", perm: "reports.view", handler: ({ db, tenant, query }) => ok(profitLoss(db, tenant!, range(query))) },
  { method: "GET", pattern: "/api/reports/balance-sheet", access: "verified", tenant: "required", perm: "reports.view",
    handler: ({ db, tenant, query }) => {
      const asOf = query.get("as_of") || today();
      const assets = accountsByType(db, tenant!, ["asset"], { to: asOf });
      const liabilities = accountsByType(db, tenant!, ["liability"], { to: asOf });
      const equity = accountsByType(db, tenant!, ["equity"], { to: asOf });
      const earnings = profitLoss(db, tenant!, { from: "1900-01-01", to: asOf }).net_profit;
      equity.push({ account_id: 0, code: "—", name: "Current earnings (unclosed)", type: "equity", amount: earnings });
      const ta = sum(assets, "amount"), tl = sum(liabilities, "amount"), te = sum(equity, "amount");
      return ok({ as_of: asOf, assets, liabilities, equity, total_assets: ta, total_liabilities: tl, total_equity: te, balanced: round2(ta - tl - te) === 0 });
    } },
  { method: "GET", pattern: "/api/reports/cash-flow", access: "verified", tenant: "required", perm: "reports.view",
    handler: ({ db, tenant, query }) => {
      const r = range(query); const c = ctxOf(db, tenant!);
      const cashIds = new Set(scoped(db, tenant!, "cash_bank_accounts").map((a) => a.account_id));
      const groups = new Map<string, number>();
      let opening = 0;
      db.tables.journals.filter((j) => j.company_id === c.companyId).forEach((j) => j.lines.filter((l: Row) => cashIds.has(l.account_id)).forEach((l: Row) => {
        const amt = round2(l.debit - l.credit);
        if (j.date < r.from) { opening += amt; return; }
        if (j.date > r.to) return;
        const label = ({ customer_receipt: "Receipts from customers", supplier_payment: "Payments to suppliers", expense: "Operating expenses paid", manual: "Other / manual entries", opening_balance: "Owner funding & opening balances", reversal: "Reversals" } as Row)[j.source_type] ?? j.source_type;
        groups.set(label, round2((groups.get(label) ?? 0) + amt));
      }));
      const lines = Array.from(groups.entries()).map(([label, amount]) => ({ label, amount }));
      const net = sum(lines, "amount");
      return ok({ ...r, opening_cash: round2(opening), lines, net_change: net, closing_cash: round2(opening + net) });
    } },
  { method: "GET", pattern: "/api/reports/sales", access: "verified", tenant: "required", perm: "reports.view",
    handler: ({ db, tenant, query }) => {
      const r = range(query);
      const docs = scoped(db, tenant!, "sales").filter((s) => ["dispatched", "delivered"].includes(s.status) && inRange(s.sale_date, r));
      const byProduct = new Map<string, Row>();
      docs.forEach((d) => d.items.forEach((l: Row) => { const x = byProduct.get(l.product_name) ?? { product: l.product_name, quantity: 0, amount: 0 }; x.quantity = round2(x.quantity + l.quantity); x.amount = round2(x.amount + l.total); byProduct.set(l.product_name, x); }));
      const byCustomer = new Map<string, Row>();
      docs.forEach((d) => { const x = byCustomer.get(d.customer_name) ?? { customer: d.customer_name, invoices: 0, amount: 0, outstanding: 0 }; x.invoices++; x.amount = round2(x.amount + d.total_amount); x.outstanding = round2(x.outstanding + outstanding(d)); byCustomer.set(d.customer_name, x); });
      return ok({ ...r, total_sales: sum(docs, "total_amount"), total_tax: sum(docs, "tax_amount"), total_discount: sum(docs, "discount_amount"), total_cost: sum(docs, "cost_amount"), invoices: docs.length, by_month: byMonth(docs, "sale_date", "total_amount"), by_product: Array.from(byProduct.values()).sort((a, b) => b.amount - a.amount), by_customer: Array.from(byCustomer.values()).sort((a, b) => b.amount - a.amount), items: docs.map((d) => ({ id: d.id, invoice_no: d.invoice_no, date: d.sale_date, customer: d.customer_name, status: d.status, total: d.total_amount, outstanding: outstanding(d) })).reverse() });
    } },
  { method: "GET", pattern: "/api/reports/purchases", access: "verified", tenant: "required", perm: "reports.view",
    handler: ({ db, tenant, query }) => {
      const r = range(query);
      const docs = scoped(db, tenant!, "purchases").filter((s) => !["draft", "cancelled"].includes(s.status) && inRange(s.purchase_date, r));
      const bySupplier = new Map<string, Row>();
      docs.forEach((d) => { const x = bySupplier.get(d.supplier_name) ?? { supplier: d.supplier_name, orders: 0, ordered: 0, received: 0, outstanding: 0 }; x.orders++; x.ordered = round2(x.ordered + d.total_amount); x.received = round2(x.received + d.billed_amount); x.outstanding = round2(x.outstanding + outstanding(d)); bySupplier.set(d.supplier_name, x); });
      return ok({ ...r, total_ordered: sum(docs, "total_amount"), total_received: sum(docs, "billed_amount"), orders: docs.length, by_month: byMonth(docs, "purchase_date", "total_amount"), by_supplier: Array.from(bySupplier.values()), items: docs.map((d) => ({ id: d.id, invoice_no: d.invoice_no, date: d.purchase_date, supplier: d.supplier_name, status: d.status, total: d.total_amount, received: d.billed_amount, outstanding: outstanding(d) })).reverse() });
    } },
  { method: "GET", pattern: "/api/reports/expenses", access: "verified", tenant: "required", perm: "reports.view",
    handler: ({ db, tenant, query }) => {
      const r = range(query);
      const rows = scoped(db, tenant!, "expenses").filter((e) => e.status !== "void" && inRange(e.expense_date, r));
      const byCat = new Map<string, number>();
      rows.forEach((e) => byCat.set(e.category_name, round2((byCat.get(e.category_name) ?? 0) + e.amount)));
      return ok({ ...r, total: sum(rows, "amount"), count: rows.length, by_category: Array.from(byCat.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount), by_month: byMonth(rows, "expense_date", "amount"), items: rows.slice().reverse() });
    } },
  { method: "GET", pattern: "/api/reports/stock-valuation", access: "verified", tenant: "required", perm: "reports.view",
    handler: ({ db, tenant, query }) => {
      const whs = scoped(db, tenant!, "warehouses").filter((w) => !query.get("warehouse_id") || String(w.id) === query.get("warehouse_id"));
      const rows = db.tables.stock_balances.filter((b) => whs.some((w) => w.id === b.warehouse_id) && b.quantity !== 0).map((b) => { const p = find(db, "products", b.product_id)!; return { product: p.name, sku: p.sku, warehouse: whs.find((w) => w.id === b.warehouse_id)!.name, quantity: b.quantity, unit_cost: p.cost_price, value: round2(b.quantity * p.cost_price), retail_value: round2(b.quantity * p.selling_price) }; });
      const c = ctxOf(db, tenant!);
      const inv = db.tables.accounts.find((a) => a.company_id === c.companyId && a.system_key === "inventory")!;
      const gl = accountBalances(c).get(inv.id) ?? { debit: 0, credit: 0 };
      return ok({ items: rows, total_value: sum(rows, "value"), total_retail_value: sum(rows, "retail_value"), ledger_inventory_balance: round2(gl.debit - gl.credit) });
    } },
  { method: "GET", pattern: "/api/reports/low-stock", access: "verified", tenant: "required", perm: "reports.view",
    handler: ({ db, tenant }) => {
      const rows = scoped(db, tenant!, "products").filter((p) => p.status === "active" && p.min_stock_alert > 0 && p.current_stock <= p.min_stock_alert).map((p) => ({ id: p.id, product: p.name, sku: p.sku, business: find(db, "businesses", p.business_id)?.name, current_stock: p.current_stock, min_stock_alert: p.min_stock_alert, shortfall: round2(p.min_stock_alert - p.current_stock), suggested_order: round2(p.min_stock_alert * 2 - p.current_stock), unit_cost: p.cost_price }));
      return ok({ items: rows, total: rows.length });
    } },
  { method: "GET", pattern: "/api/dashboard/summary", access: "verified", tenant: "required",
    handler: ({ db, tenant }) => {
      const t = tenant!;
      const r30 = { from: daysAgo(30), to: today() };
      const sales = scoped(db, t, "sales"); const purchases = scoped(db, t, "purchases");
      const billedSales = sales.filter((s) => ["dispatched", "delivered"].includes(s.status));
      const c = ctxOf(db, t);
      const cash = scoped(db, t, "cash_bank_accounts").map((a) => { const b = accountBalances(c).get(a.account_id) ?? { debit: 0, credit: 0 }; return { name: a.name, balance: round2(b.debit - b.credit) }; });
      const low = scoped(db, t, "products").filter((p) => p.status === "active" && p.min_stock_alert > 0 && p.current_stock <= p.min_stock_alert);
      const { sub, plan } = subscriptionOf(db, t.companyId!);
      const monthly: Row[] = [];
      for (let i = 5; i >= 0; i--) { const d = new Date(); d.setMonth(d.getMonth() - i); const k = d.toISOString().slice(0, 7); monthly.push({ period: k, sales: sum(billedSales.filter((s) => month(s.sale_date) === k), "total_amount"), purchases: sum(purchases.filter((p) => !["draft", "cancelled"].includes(p.status) && month(p.purchase_date) === k), "total_amount") }); }
      return ok({
        sales_30d: sum(billedSales.filter((s) => inRange(s.sale_date, r30)), "total_amount"),
        purchases_30d: sum(purchases.filter((p) => !["draft", "cancelled"].includes(p.status) && inRange(p.purchase_date, r30)), "total_amount"),
        receivables: aging(db, t, "receivables").total, payables: aging(db, t, "payables").total,
        cash_balance: sum(cash, "balance"), cash_accounts: cash,
        pending_inwards: scoped(db, t, "warehouse_inwards").filter((i) => ["pending", "partially_received"].includes(i.status)).length,
        pending_outwards: scoped(db, t, "warehouse_outwards").filter((o) => o.status === "pending").length,
        draft_sales: sales.filter((s) => s.status === "draft").length, draft_purchases: purchases.filter((p) => p.status === "draft").length,
        low_stock: low.map((p) => ({ id: p.id, name: p.name, sku: p.sku, current_stock: p.current_stock, min_stock_alert: p.min_stock_alert })),
        recent_sales: sales.slice(-6).reverse().map((s) => ({ id: s.id, invoice_no: s.invoice_no, customer_name: s.customer_name, total_amount: s.total_amount, status: s.status, payment_status: s.payment_status, sale_date: s.sale_date })),
        monthly,
        subscription: { status: effectiveStatus(sub), plan: plan?.name, trial_ends_at: sub?.trial_ends_at, current_period_end: sub?.current_period_end, usage: usage(db, t.companyId!), limits: plan?.limits },
      });
    } },
];
