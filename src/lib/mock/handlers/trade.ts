/* eslint-disable @typescript-eslint/no-explicit-any */
import { DB, Row, find, insert, patch, remove, round2 } from "../db";
import {
  HttpError, cancelPurchase, cancelSale, confirmPurchase, confirmSale, conflict, createPurchaseReturn, createSalesReturn,
  deliverOutward, dispatchOutward, invalid, outstanding, req, savePurchase, saveSale, tallyInward,
} from "../engine";
import { Route, Tenant, branchFor, filterList, getScoped, list, ok, raw, requirePerm, scoped } from "../router";

const wName = (db: DB, id: number) => find(db, "warehouses", id)?.name ?? null;
const bName = (db: DB, id: number) => find(db, "businesses", id)?.name ?? null;

export function presentDoc(db: DB, d: Row) {
  return { ...d, business: bName(db, d.business_id), warehouse: wName(db, d.warehouse_id), outstanding_amount: outstanding(d) };
}

function presentInward(db: DB, i: Row) {
  const p = find(db, "purchases", i.purchase_id);
  return { ...i, business: bName(db, i.business_id), warehouse: wName(db, i.warehouse_id), purchase_status: p?.status, purchase_date: p?.purchase_date, total_ordered: round2(i.items.reduce((s: number, l: Row) => s + l.ordered_quantity, 0)), total_received: round2(i.items.reduce((s: number, l: Row) => s + l.received_quantity, 0)) };
}

function presentOutward(db: DB, o: Row) {
  const s = find(db, "sales", o.sale_id);
  return { ...o, business: bName(db, o.business_id), warehouse: wName(db, o.warehouse_id), sale_status: s?.status, sale_date: s?.sale_date, total_amount: s?.total_amount, total_quantity: round2(o.items.reduce((x: number, l: Row) => x + l.quantity, 0)) };
}

function partyBalance(db: DB, t: Tenant, type: "supplier" | "customer", party: Row) {
  const docs = scoped(db, t, type === "supplier" ? "purchases" : "sales").filter((d) => d[`${type}_id`] === party.id && d.status !== "cancelled");
  const payments = scoped(db, t, "payments").filter((p) => p.party_type === type && p.party_id === party.id && p.status !== "void");
  const billed = round2(docs.reduce((s, d) => s + (d.billed_amount ?? 0) - (d.returned_amount ?? 0), 0));
  const paid = round2(payments.reduce((s, p) => s + p.amount, 0));
  const balance = round2((party.opening_balance ?? 0) + billed - paid);
  return { docs, payments, billed, paid, balance, open_documents: docs.filter((d) => outstanding(d) > 0).length };
}

function partyRoutes(type: "supplier" | "customer"): Route[] {
  const table = type === "supplier" ? "suppliers" : "customers";
  const base = `/api/${table}`;
  const perm = `${table}.view`;
  const manage = `${table}.manage`;
  const fields = ["name", "email", "phone", "address", "tax_number", "contact_person", "payment_terms_days", "status", "notes", "credit_limit", "opening_balance", "contacts", "business_id"];
  const present = (db: DB, t: Tenant, p: Row) => { const b = partyBalance(db, t, type, p); return { ...p, balance: b.balance, total_billed: b.billed, total_paid: b.paid, open_documents: b.open_documents }; };
  return [
    { method: "GET", pattern: base, access: "verified", tenant: "required", perm, handler: ({ db, tenant, query }) => list(filterList(scoped(db, tenant!, table), query, { search: ["name", "email", "phone", "contact_person"] }).map((p) => present(db, tenant!, p))) },
    {
      method: "GET", pattern: `${base}/:id`, access: "verified", tenant: "required", perm,
      handler: ({ db, tenant, params }) => {
        const p = getScoped(db, tenant!, table, params.id, type === "supplier" ? "Supplier" : "Customer");
        const b = partyBalance(db, tenant!, type, p);
        const returns = scoped(db, tenant!, type === "supplier" ? "purchase_returns" : "sales_returns").filter((r) => r[`${type}_id`] === p.id);
        // statement: billed (+), returns (-), payments (-)
        const lines: Row[] = [];
        b.docs.filter((d) => (d.billed_amount ?? 0) > 0).forEach((d) => lines.push({ date: d.purchase_date ?? d.sale_date, type: type === "supplier" ? "Purchase" : "Sale", reference: d.invoice_no, document_id: d.id, debit: d.billed_amount, credit: 0 }));
        returns.forEach((r) => lines.push({ date: r.return_date, type: "Return", reference: r.return_no, debit: 0, credit: r.total_amount }));
        b.payments.forEach((x) => lines.push({ date: x.payment_date, type: type === "supplier" ? "Payment" : "Receipt", reference: x.payment_no, debit: 0, credit: x.amount }));
        lines.sort((a, c) => String(a.date).localeCompare(String(c.date)));
        let run = p.opening_balance ?? 0;
        lines.forEach((l) => { run = round2(run + l.debit - l.credit); l.balance = run; });
        return ok({
          ...p, balance: b.balance, total_billed: b.billed, total_paid: b.paid,
          documents: b.docs.map((d) => presentDoc(db, d)).reverse(),
          payments: b.payments.slice().reverse(),
          returns: returns.slice().reverse(),
          statement: lines,
        });
      },
    },
    {
      method: "POST", pattern: base, access: "verified", tenant: "required", perm: manage,
      handler: ({ db, tenant, body }) => {
        const name = req(body, "name");
        if (scoped(db, tenant!, table).some((x) => x.name.toLowerCase() === String(name).toLowerCase())) throw invalid("name", `A ${type} with this name already exists.`);
        const values: Row = { company_id: tenant!.companyId, business_id: null, status: "active", contacts: [], opening_balance: 0, payment_terms_days: type === "supplier" ? 30 : 15, credit_limit: null };
        fields.forEach((k) => body[k] !== undefined && body[k] !== "" && (values[k] = body[k]));
        ["payment_terms_days", "credit_limit", "opening_balance"].forEach((k) => values[k] !== null && values[k] !== undefined && (values[k] = Number(values[k])));
        return ok(insert(db, table, values), `${type === "supplier" ? "Supplier" : "Customer"} created`, 201);
      },
    },
    {
      method: "PUT", pattern: `${base}/:id`, access: "verified", tenant: "required", perm: manage,
      handler: ({ db, tenant, params, body }) => {
        const p = getScoped(db, tenant!, table, params.id);
        const values: Row = {};
        fields.forEach((k) => body[k] !== undefined && (values[k] = body[k] === "" ? null : body[k]));
        if (values.name === null) throw invalid("name", "The name field is required.");
        ["payment_terms_days", "credit_limit", "opening_balance"].forEach((k) => values[k] !== null && values[k] !== undefined && (values[k] = Number(values[k])));
        patch(p, values);
        return ok(present(db, tenant!, p), "Saved");
      },
    },
    {
      method: "DELETE", pattern: `${base}/:id`, access: "verified", tenant: "required", perm: manage,
      handler: ({ db, tenant, params }) => {
        const p = getScoped(db, tenant!, table, params.id);
        if (partyBalance(db, tenant!, type, p).docs.length) throw conflict(`This ${type} has documents. Set it to inactive instead.`);
        remove(db, table, p.id);
        return ok(null, "Deleted");
      },
    },
  ];
}

const docGet = (db: DB, t: Tenant, table: "purchases" | "sales", id: any) => getScoped(db, t, table, id, table === "purchases" ? "Purchase" : "Sale");

export const tradeRoutes: Route[] = [
  ...partyRoutes("supplier"),
  ...partyRoutes("customer"),

  /* ---------------- purchases (existing paths + new cancel/inwards list) */
  { method: "GET", pattern: "/api/purchases", access: "verified", tenant: "required", perm: "purchases.view",
    handler: ({ db, tenant, query }) => { const items = filterList(scoped(db, tenant!, "purchases"), query, { search: ["invoice_no", "supplier_name", "reference"], date: "purchase_date" }).map((d) => presentDoc(db, d)).reverse(); return ok({ total_purchases: items.length, purchases: items }); } },
  { method: "GET", pattern: "/api/purchases/business/:id", access: "verified", tenant: "required", perm: "purchases.view",
    handler: ({ db, tenant, params }) => { const items = scoped(db, tenant!, "purchases").filter((d) => d.business_id === Number(params.id)).map((d) => presentDoc(db, d)).reverse(); return ok({ total_purchases: items.length, purchases: items }); } },
  { method: "POST", pattern: "/api/purchases/create", access: "verified", tenant: "required",
    handler: ({ tenant, body, ctx }) => { const bid = branchFor(tenant!, body); requirePerm(tenant!, "purchases.create", bid); const d = savePurchase(ctx(), body, bid); return ok(d, "Purchase created successfully", 201); } },
  { method: "GET", pattern: "/api/purchases/inwards/pending", access: "verified", tenant: "required", perm: "inward.view",
    handler: ({ db, tenant }) => { const items = scoped(db, tenant!, "warehouse_inwards").filter((i) => ["pending", "partially_received"].includes(i.status)).map((i) => presentInward(db, i)).reverse(); return ok({ total_inwards: items.length, inwards: items }); } },
  { method: "GET", pattern: "/api/purchases/inwards/all", access: "verified", tenant: "required", perm: "inward.view",
    handler: ({ db, tenant, query }) => { const items = filterList(scoped(db, tenant!, "warehouse_inwards"), query, { search: ["gate_pass_no", "purchase_no", "supplier_name"] }).map((i) => presentInward(db, i)).reverse(); return ok({ total_inwards: items.length, inwards: items }); } },
  { method: "GET", pattern: "/api/purchases/inwards/:id", access: "verified", tenant: "required", perm: "inward.view",
    handler: ({ db, tenant, params }) => ok(presentInward(db, getScoped(db, tenant!, "warehouse_inwards", params.id, "Inward"))) },
  { method: "POST", pattern: "/api/purchases/inwards/:id/tally", access: "verified", tenant: "required",
    handler: ({ db, tenant, params, body, ctx }) => {
      const i = getScoped(db, tenant!, "warehouse_inwards", params.id, "Inward");
      requirePerm(tenant!, "inward.tally", i.business_id);
      tallyInward(ctx(), i, body);
      return ok(presentInward(db, i), i.status === "completed" ? "Tally completed, stock updated" : "Partial receipt recorded, stock updated");
    } },
  { method: "GET", pattern: "/api/purchases/:id", access: "verified", tenant: "required", perm: "purchases.view",
    handler: ({ db, tenant, params }) => {
      const d = docGet(db, tenant!, "purchases", params.id);
      const inward = d.inward_id ? presentInward(db, find(db, "warehouse_inwards", d.inward_id)!) : null;
      const payments = db.tables.payments.filter((p) => p.direction === "out" && p.allocations.some((a: Row) => a.document_id === d.id)).map((p) => ({ id: p.id, payment_no: p.payment_no, payment_date: p.payment_date, status: p.status, amount: p.allocations.find((a: Row) => a.document_id === d.id).amount }));
      const returns = db.tables.purchase_returns.filter((r) => r.purchase_id === d.id);
      const journals = db.tables.journals.filter((j) => j.company_id === d.company_id && ((j.source_type === "warehouse_inward" && j.source_id === d.inward_id))).map((j) => ({ id: j.id, journal_no: j.journal_no, date: j.date, total: j.total, memo: j.memo }));
      return ok({ ...presentDoc(db, d), inward, payments, returns, journals });
    } },
  { method: "PUT", pattern: "/api/purchases/:id", access: "verified", tenant: "required",
    handler: ({ db, tenant, params, body, ctx }) => { const d = docGet(db, tenant!, "purchases", params.id); requirePerm(tenant!, "purchases.update", d.business_id); savePurchase(ctx(), body, d.business_id, d); return ok(presentDoc(db, d), "Purchase updated successfully"); } },
  { method: "DELETE", pattern: "/api/purchases/:id", access: "verified", tenant: "required",
    handler: ({ db, tenant, params }) => { const d = docGet(db, tenant!, "purchases", params.id); requirePerm(tenant!, "purchases.delete", d.business_id); if (d.status !== "draft") throw conflict("Only draft purchases can be deleted. Cancel it instead."); remove(db, "purchases", d.id); return ok(null, "Purchase deleted successfully"); } },
  { method: "POST", pattern: "/api/purchases/status/:id", access: "verified", tenant: "required",
    handler: ({ db, tenant, params, body, ctx }) => { const d = docGet(db, tenant!, "purchases", params.id); requirePerm(tenant!, "purchases.confirm", d.business_id); if (body.status !== "cancelled") throw invalid("status", "Only cancelled is supported; receiving happens through the inward tally."); cancelPurchase(ctx(), d, body.reason); return ok(presentDoc(db, d), "Purchase status updated"); } },
  { method: "POST", pattern: "/api/purchases/:id/confirmed", access: "verified", tenant: "required",
    handler: ({ db, tenant, params, ctx }) => { const d = docGet(db, tenant!, "purchases", params.id); requirePerm(tenant!, "purchases.confirm", d.business_id); const inward = confirmPurchase(ctx(), d); return ok({ purchase: presentDoc(db, d), inward: presentInward(db, inward) }, "Purchase confirmed and sent to warehouse inward"); } },
  { method: "POST", pattern: "/api/purchases/:id/cancel", access: "verified", tenant: "required",
    handler: ({ db, tenant, params, body, ctx }) => { const d = docGet(db, tenant!, "purchases", params.id); requirePerm(tenant!, "purchases.confirm", d.business_id); cancelPurchase(ctx(), d, body.reason); return ok(presentDoc(db, d), "Purchase cancelled"); } },

  /* ---------------- purchase returns (NEW) */
  { method: "GET", pattern: "/api/purchase-returns", access: "verified", tenant: "required", perm: "purchases.view",
    handler: ({ db, tenant, query }) => list(filterList(scoped(db, tenant!, "purchase_returns"), query, { search: ["return_no", "purchase_no", "supplier_name", "reason"], date: "return_date" }).map((r) => ({ ...r, warehouse: wName(db, r.warehouse_id) })).reverse()) },
  { method: "GET", pattern: "/api/purchase-returns/:id", access: "verified", tenant: "required", perm: "purchases.view",
    handler: ({ db, tenant, params }) => ok(getScoped(db, tenant!, "purchase_returns", params.id, "Return")) },
  { method: "POST", pattern: "/api/purchase-returns", access: "verified", tenant: "required",
    handler: ({ db, tenant, body, ctx }) => { const d = docGet(db, tenant!, "purchases", req(body, "purchase_id", "purchase")); requirePerm(tenant!, "returns.manage", d.business_id); return ok(createPurchaseReturn(ctx(), body), "Supplier return recorded", 201); } },

  /* ---------------- sales (existing paths + new cancel/outwards list) */
  { method: "GET", pattern: "/api/sales", access: "verified", tenant: "required", perm: "sales.view",
    handler: ({ db, tenant, query }) => { const items = filterList(scoped(db, tenant!, "sales"), query, { search: ["invoice_no", "customer_name", "reference"], date: "sale_date" }).map((d) => presentDoc(db, d)).reverse(); return ok({ total_sales: items.length, sales: items }); } },
  { method: "GET", pattern: "/api/sales/business/:id", access: "verified", tenant: "required", perm: "sales.view",
    handler: ({ db, tenant, params }) => { const items = scoped(db, tenant!, "sales").filter((d) => d.business_id === Number(params.id)).map((d) => presentDoc(db, d)).reverse(); return ok({ total_sales: items.length, sales: items }); } },
  { method: "POST", pattern: "/api/sales/create", access: "verified", tenant: "required",
    handler: ({ tenant, body, ctx }) => { const bid = branchFor(tenant!, body); requirePerm(tenant!, "sales.create", bid); return ok(saveSale(ctx(), body, bid), "Sale created successfully", 201); } },
  { method: "GET", pattern: "/api/sales/outwards/pending", access: "verified", tenant: "required", perm: "outward.view",
    handler: ({ db, tenant }) => { const items = scoped(db, tenant!, "warehouse_outwards").filter((o) => o.status === "pending").map((o) => presentOutward(db, o)).reverse(); return ok({ total_outwards: items.length, outwards: items }); } },
  { method: "GET", pattern: "/api/sales/outwards/all", access: "verified", tenant: "required", perm: "outward.view",
    handler: ({ db, tenant, query }) => { const items = filterList(scoped(db, tenant!, "warehouse_outwards"), query, { search: ["gate_pass_no", "sale_no", "customer_name"] }).map((o) => presentOutward(db, o)).reverse(); return ok({ total_outwards: items.length, outwards: items }); } },
  { method: "GET", pattern: "/api/sales/outwards/:id", access: "verified", tenant: "required", perm: "outward.view",
    handler: ({ db, tenant, params }) => ok(presentOutward(db, getScoped(db, tenant!, "warehouse_outwards", params.id, "Outward"))) },
  { method: "POST", pattern: "/api/sales/outwards/:id/dispatch", access: "verified", tenant: "required",
    handler: ({ db, tenant, params, ctx }) => {
      const o = getScoped(db, tenant!, "warehouse_outwards", params.id, "Outward");
      requirePerm(tenant!, "outward.dispatch", o.business_id);
      const r = dispatchOutward(ctx(), o);
      return raw({ success: true, message: r.already ? "Already dispatched (no stock change)" : "Order dispatched successfully", data: presentOutward(db, o), already_processed: r.already });
    } },
  { method: "POST", pattern: "/api/sales/outwards/:id/delivered", access: "verified", tenant: "required",
    handler: ({ db, tenant, params, body, ctx }) => {
      const o = getScoped(db, tenant!, "warehouse_outwards", params.id, "Outward");
      requirePerm(tenant!, "outward.deliver", o.business_id);
      const r = deliverOutward(ctx(), o, body);
      return raw({ success: true, message: r.already ? "Already delivered" : "Marked as delivered", data: presentOutward(db, o), already_processed: r.already });
    } },
  { method: "GET", pattern: "/api/sales/:id", access: "verified", tenant: "required", perm: "sales.view",
    handler: ({ db, tenant, params }) => {
      const d = docGet(db, tenant!, "sales", params.id);
      const outward = d.outward_id ? presentOutward(db, find(db, "warehouse_outwards", d.outward_id)!) : null;
      const payments = db.tables.payments.filter((p) => p.direction === "in" && p.allocations.some((a: Row) => a.document_id === d.id)).map((p) => ({ id: p.id, payment_no: p.payment_no, payment_date: p.payment_date, status: p.status, amount: p.allocations.find((a: Row) => a.document_id === d.id).amount }));
      const returns = db.tables.sales_returns.filter((r) => r.sale_id === d.id);
      const journals = db.tables.journals.filter((j) => j.company_id === d.company_id && ["sale", "sale_cogs"].includes(j.source_type) && j.source_id === d.id).map((j) => ({ id: j.id, journal_no: j.journal_no, date: j.date, total: j.total, memo: j.memo }));
      return ok({ ...presentDoc(db, d), outward, payments, returns, journals });
    } },
  { method: "PUT", pattern: "/api/sales/:id", access: "verified", tenant: "required",
    handler: ({ db, tenant, params, body, ctx }) => { const d = docGet(db, tenant!, "sales", params.id); requirePerm(tenant!, "sales.update", d.business_id); saveSale(ctx(), body, d.business_id, d); return ok(presentDoc(db, d), "Sale updated successfully"); } },
  { method: "DELETE", pattern: "/api/sales/:id", access: "verified", tenant: "required",
    handler: ({ db, tenant, params }) => { const d = docGet(db, tenant!, "sales", params.id); requirePerm(tenant!, "sales.delete", d.business_id); if (d.status !== "draft") throw conflict("Only draft sales can be deleted. Cancel it instead."); remove(db, "sales", d.id); return ok(null, "Sale deleted successfully"); } },
  { method: "POST", pattern: "/api/sales/:id/confirmed", access: "verified", tenant: "required",
    handler: ({ db, tenant, params, ctx }) => { const d = docGet(db, tenant!, "sales", params.id); requirePerm(tenant!, "sales.confirm", d.business_id); const o = confirmSale(ctx(), d); return ok({ sale: presentDoc(db, d), outward: presentOutward(db, o) }, "Sale confirmed and sent to warehouse outward"); } },
  { method: "POST", pattern: "/api/sales/:id/cancel", access: "verified", tenant: "required",
    handler: ({ db, tenant, params, body, ctx }) => { const d = docGet(db, tenant!, "sales", params.id); requirePerm(tenant!, "sales.confirm", d.business_id); cancelSale(ctx(), d, body.reason); return ok(presentDoc(db, d), "Sale cancelled"); } },

  /* ---------------- sales returns (NEW) */
  { method: "GET", pattern: "/api/sales-returns", access: "verified", tenant: "required", perm: "sales.view",
    handler: ({ db, tenant, query }) => list(filterList(scoped(db, tenant!, "sales_returns"), query, { search: ["return_no", "sale_no", "customer_name", "reason"], date: "return_date" }).map((r) => ({ ...r, warehouse: wName(db, r.warehouse_id) })).reverse()) },
  { method: "GET", pattern: "/api/sales-returns/:id", access: "verified", tenant: "required", perm: "sales.view",
    handler: ({ db, tenant, params }) => ok(getScoped(db, tenant!, "sales_returns", params.id, "Return")) },
  { method: "POST", pattern: "/api/sales-returns", access: "verified", tenant: "required",
    handler: ({ db, tenant, body, ctx }) => { const d = docGet(db, tenant!, "sales", req(body, "sale_id", "sale")); requirePerm(tenant!, "returns.manage", d.business_id); return ok(createSalesReturn(ctx(), body), "Sales return recorded", 201); } },
];

export { HttpError };
