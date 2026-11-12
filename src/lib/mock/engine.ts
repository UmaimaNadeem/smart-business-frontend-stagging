/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Business rules of the mock backend. These mirror what the Laravel services should do
 * (see API_CONTRACT.md). Every stock change writes a movement; every financial event posts a
 * balanced journal; documents follow explicit state transitions.
 */
import { DB, Row, find, insert, nextNumber, nowIso, patch, round2, today, where, addDays } from "./db";

export class HttpError extends Error {
  status: number;
  errors: Record<string, string[]> | null;
  code: string | null;
  constructor(status: number, message: string, errors: Record<string, string[]> | null = null, code: string | null = null) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.code = code;
  }
}

export const invalid = (field: string, msg: string) => new HttpError(422, "Validation failed", { [field]: [msg] });
export const notFound = (what = "Resource") => new HttpError(404, `${what} not found`);
export const conflict = (msg: string) => new HttpError(409, msg);

export interface Ctx {
  db: DB;
  companyId: number;
  userId: number;
  userName: string;
}

/* ------------------------------------------------------------------ validation helpers */

export function req(body: Row, field: string, label = field): any {
  const v = body?.[field];
  if (v === undefined || v === null || v === "") throw invalid(field, `The ${label.replace(/_/g, " ")} field is required.`);
  return v;
}

export function num(body: Row, field: string, { min, required = true }: { min?: number; required?: boolean } = {}): number {
  const v = body?.[field];
  if (v === undefined || v === null || v === "") {
    if (required) throw invalid(field, `The ${field.replace(/_/g, " ")} field is required.`);
    return 0;
  }
  const n = Number(v);
  if (Number.isNaN(n)) throw invalid(field, `The ${field.replace(/_/g, " ")} must be a number.`);
  if (min !== undefined && n < min) throw invalid(field, `The ${field.replace(/_/g, " ")} must be at least ${min}.`);
  return n;
}

export function owned(ctx: Ctx, table: any, id: any, label: string): Row {
  const row = find(ctx.db, table, id);
  if (!row || (row.company_id !== undefined && row.company_id !== ctx.companyId)) throw invalid(`${label}_id`, `The selected ${label.replace(/_/g, " ")} is invalid.`);
  return row;
}

/* ------------------------------------------------------------------ chart of accounts */

export const DEFAULT_ACCOUNTS: { code: string; name: string; type: string; system_key?: string }[] = [
  { code: "1000", name: "Cash in Hand", type: "asset", system_key: "cash" },
  { code: "1010", name: "Bank Account", type: "asset", system_key: "bank" },
  { code: "1100", name: "Accounts Receivable", type: "asset", system_key: "ar" },
  { code: "1200", name: "Inventory", type: "asset", system_key: "inventory" },
  { code: "1300", name: "Input Tax Receivable", type: "asset", system_key: "input_tax" },
  { code: "2000", name: "Accounts Payable", type: "liability", system_key: "ap" },
  { code: "2100", name: "Sales Tax Payable", type: "liability", system_key: "output_tax" },
  { code: "3000", name: "Owner's Equity", type: "equity", system_key: "equity" },
  { code: "3100", name: "Retained Earnings", type: "equity", system_key: "retained" },
  { code: "4000", name: "Sales Revenue", type: "income", system_key: "revenue" },
  { code: "4100", name: "Sales Returns", type: "income", system_key: "sales_returns" },
  { code: "4900", name: "Other Income", type: "income" },
  { code: "5000", name: "Cost of Goods Sold", type: "expense", system_key: "cogs" },
  { code: "5100", name: "Inventory Adjustments", type: "expense", system_key: "stock_adjust" },
  { code: "6000", name: "Rent Expense", type: "expense" },
  { code: "6100", name: "Utilities Expense", type: "expense" },
  { code: "6200", name: "Salaries & Wages", type: "expense" },
  { code: "6300", name: "Transport & Delivery", type: "expense" },
  { code: "6900", name: "General Expenses", type: "expense" },
];

export function account(ctx: Ctx, key: string): Row {
  const acc = ctx.db.tables.accounts.find((a) => a.company_id === ctx.companyId && a.system_key === key);
  if (!acc) throw new HttpError(500, `System account "${key}" missing`);
  return acc;
}

export function accountByCode(ctx: Ctx, code: string): Row | undefined {
  return ctx.db.tables.accounts.find((a) => a.company_id === ctx.companyId && a.code === code);
}

/** Seeds accounts, payment methods, expense categories, units and a trial subscription for a new company. */
export function bootstrapCompany(db: DB, companyId: number, opts: { planCode?: string; trial?: boolean } = {}) {
  DEFAULT_ACCOUNTS.forEach((a) => insert(db, "accounts", { company_id: companyId, ...a, is_system: !!a.system_key, status: "active", description: null }));
  const acc = (key: string) => db.tables.accounts.find((a) => a.company_id === companyId && a.system_key === key)!;
  const byCode = (code: string) => db.tables.accounts.find((a) => a.company_id === companyId && a.code === code)!;

  const cash = insert(db, "cash_bank_accounts", { company_id: companyId, name: "Cash in Hand", type: "cash", account_id: acc("cash").id, bank_name: null, account_number: null, currency: null, status: "active" });
  const bank = insert(db, "cash_bank_accounts", { company_id: companyId, name: "Main Bank Account", type: "bank", account_id: acc("bank").id, bank_name: "Meezan Bank", account_number: "0100-XXXX-001", currency: null, status: "active" });

  insert(db, "payment_methods", { company_id: companyId, name: "Cash", type: "cash", default_cash_bank_account_id: cash.id, requires_reference: false, status: "active" });
  insert(db, "payment_methods", { company_id: companyId, name: "Bank Transfer", type: "bank_transfer", default_cash_bank_account_id: bank.id, requires_reference: true, status: "active" });
  insert(db, "payment_methods", { company_id: companyId, name: "Cheque", type: "cheque", default_cash_bank_account_id: bank.id, requires_reference: true, status: "active" });

  [["Rent", "6000"], ["Utilities", "6100"], ["Salaries", "6200"], ["Transport", "6300"], ["Office & General", "6900"]].forEach(([name, code]) =>
    insert(db, "expense_categories", { company_id: companyId, name, account_id: byCode(code).id, status: "active" })
  );
  [["Piece", "pcs"], ["Kilogram", "kg"], ["Litre", "ltr"], ["Box", "box"], ["Carton", "ctn"]].forEach(([name, short_name]) =>
    insert(db, "units", { company_id: companyId, name, short_name, status: "active" })
  );

  const plan = db.tables.plans.find((p) => p.code === (opts.planCode ?? "growth")) ?? db.tables.plans[0];
  const start = nowIso();
  const trial = opts.trial ?? true;
  const sub = insert(db, "subscriptions", {
    company_id: companyId,
    plan_id: plan?.id ?? null,
    status: trial ? "trialing" : "active",
    billing_cycle: "monthly",
    trial_ends_at: trial ? addDays(start, plan?.trial_days ?? 14) : null,
    current_period_start: start,
    current_period_end: addDays(start, trial ? plan?.trial_days ?? 14 : 30),
    grace_ends_at: null,
    cancel_at_period_end: false,
    cancelled_at: null,
  });
  insert(db, "subscription_events", { company_id: companyId, subscription_id: sub.id, type: trial ? "trial.started" : "subscription.activated", payload: { plan: plan?.code } });
}

/* ------------------------------------------------------------------ journals */

export interface JournalLine { account_id: number; debit?: number; credit?: number; description?: string | null }

export function postJournal(ctx: Ctx, input: { date: string; memo: string; source_type: string; source_id?: number | null; source_no?: string | null; business_id?: number | null; lines: JournalLine[] }): Row {
  const lines = input.lines
    .map((l) => ({ account_id: Number(l.account_id), debit: round2(Number(l.debit || 0)), credit: round2(Number(l.credit || 0)), description: l.description ?? null }))
    .filter((l) => l.debit !== 0 || l.credit !== 0);
  if (lines.length < 2) throw invalid("lines", "A journal needs at least two lines.");
  lines.forEach((l, i) => {
    if (l.debit < 0 || l.credit < 0) throw invalid(`lines.${i}`, "Amounts cannot be negative.");
    if (l.debit > 0 && l.credit > 0) throw invalid(`lines.${i}`, "A line cannot have both a debit and a credit.");
    const acc = find(ctx.db, "accounts", l.account_id);
    if (!acc || acc.company_id !== ctx.companyId) throw invalid(`lines.${i}.account_id`, "The selected account is invalid.");
  });
  const dr = round2(lines.reduce((s, l) => s + l.debit, 0));
  const cr = round2(lines.reduce((s, l) => s + l.credit, 0));
  if (dr !== cr) throw invalid("lines", `Journal is not balanced: debits ${dr} vs credits ${cr}.`);
  return insert(ctx.db, "journals", {
    company_id: ctx.companyId,
    business_id: input.business_id ?? null,
    journal_no: nextNumber(ctx.db, ctx.companyId, "JV"),
    date: input.date,
    memo: input.memo,
    source_type: input.source_type,
    source_id: input.source_id ?? null,
    source_no: input.source_no ?? null,
    status: "posted",
    total: dr,
    lines,
    created_by: ctx.userName,
    reversed_by_id: null,
    reversal_of_id: null,
  });
}

export function reverseJournal(ctx: Ctx, journal: Row, memo?: string): Row {
  if (journal.reversed_by_id) throw conflict("This journal has already been reversed.");
  const rev = postJournal(ctx, {
    date: today(),
    memo: memo ?? `Reversal of ${journal.journal_no}`,
    source_type: "reversal",
    source_id: journal.id,
    source_no: journal.journal_no,
    business_id: journal.business_id,
    lines: journal.lines.map((l: Row) => ({ account_id: l.account_id, debit: l.credit, credit: l.debit, description: l.description })),
  });
  rev.reversal_of_id = journal.id;
  journal.reversed_by_id = rev.id;
  journal.status = "reversed";
  return rev;
}

export function reverseJournalsFor(ctx: Ctx, sourceType: string, sourceId: number) {
  ctx.db.tables.journals
    .filter((j) => j.company_id === ctx.companyId && j.source_type === sourceType && j.source_id === sourceId && !j.reversed_by_id && j.status === "posted")
    .forEach((j) => reverseJournal(ctx, j));
}

/* ------------------------------------------------------------------ stock */

export function balanceRow(ctx: Ctx, warehouseId: number, productId: number): Row {
  let row = ctx.db.tables.stock_balances.find((b) => b.warehouse_id === warehouseId && b.product_id === productId);
  if (!row) row = insert(ctx.db, "stock_balances", { company_id: ctx.companyId, warehouse_id: warehouseId, product_id: productId, quantity: 0 });
  return row;
}

export function moveStock(ctx: Ctx, m: { warehouse_id: number; product_id: number; qty_in?: number; qty_out?: number; reference_type: string; reference_id?: number | null; reference_no?: string | null; reason?: string | null; date?: string }) {
  const product = find(ctx.db, "products", m.product_id);
  const wh = find(ctx.db, "warehouses", m.warehouse_id);
  if (!product || product.company_id !== ctx.companyId) throw invalid("product_id", "The selected product is invalid.");
  if (!wh || wh.company_id !== ctx.companyId) throw invalid("warehouse_id", "The selected warehouse is invalid.");
  const qin = round2(m.qty_in ?? 0);
  const qout = round2(m.qty_out ?? 0);
  const bal = balanceRow(ctx, wh.id, product.id);
  if (qout > 0 && bal.quantity < qout) {
    throw new HttpError(422, `Insufficient stock for ${product.name} in ${wh.name}: available ${bal.quantity}, required ${qout}.`, { stock: [`Insufficient stock for ${product.name}`] }, "insufficient_stock");
  }
  bal.quantity = round2(bal.quantity + qin - qout);
  bal.updated_at = nowIso();
  product.current_stock = round2(ctx.db.tables.stock_balances.filter((b) => b.product_id === product.id).reduce((s, b) => s + b.quantity, 0));
  return insert(ctx.db, "stock_movements", {
    company_id: ctx.companyId,
    business_id: wh.business_id,
    warehouse_id: wh.id,
    product_id: product.id,
    reference_type: m.reference_type,
    reference_id: m.reference_id ?? null,
    reference_no: m.reference_no ?? null,
    quantity_in: qin,
    quantity_out: qout,
    balance_after: bal.quantity,
    unit_cost: product.cost_price,
    reason: m.reason ?? null,
    actor_id: ctx.userId,
    actor_name: ctx.userName,
    movement_date: m.date ?? nowIso(),
  });
}

/* ------------------------------------------------------------------ documents */

export interface LineInput { product_id: any; quantity: any; unit_price: any; discount?: any; tax_rate?: any }

export function computeLines(ctx: Ctx, items: LineInput[]): { lines: Row[]; subtotal: number; discount_amount: number; tax_amount: number; total_amount: number } {
  if (!Array.isArray(items) || items.length === 0) throw invalid("items", "Add at least one item.");
  const lines = items.map((it, i) => {
    const product = find(ctx.db, "products", it.product_id);
    if (!product || product.company_id !== ctx.companyId) throw invalid(`items.${i}.product_id`, "The selected product is invalid.");
    const quantity = Number(it.quantity);
    const unit_price = Number(it.unit_price);
    const discount = Number(it.discount || 0);
    const tax_rate = Number(it.tax_rate || 0);
    if (!(quantity > 0)) throw invalid(`items.${i}.quantity`, "Quantity must be greater than 0.");
    if (!(unit_price >= 0)) throw invalid(`items.${i}.unit_price`, "Unit price must be 0 or more.");
    if (discount < 0 || discount > 100) throw invalid(`items.${i}.discount`, "Discount must be between 0 and 100%.");
    if (tax_rate < 0 || tax_rate > 100) throw invalid(`items.${i}.tax_rate`, "Tax rate must be between 0 and 100%.");
    const gross = round2(quantity * unit_price);
    const disc = round2((gross * discount) / 100);
    const net = round2(gross - disc);
    const tax = round2((net * tax_rate) / 100);
    return { id: i + 1, product_id: product.id, product_name: product.name, sku: product.sku, unit: product.unit, quantity, unit_price, discount, tax_rate, line_subtotal: gross, discount_amount: disc, tax_amount: tax, total: round2(net + tax) };
  });
  const subtotal = round2(lines.reduce((s, l) => s + l.line_subtotal, 0));
  const discount_amount = round2(lines.reduce((s, l) => s + l.discount_amount, 0));
  const tax_amount = round2(lines.reduce((s, l) => s + l.tax_amount, 0));
  return { lines, subtotal, discount_amount, tax_amount, total_amount: round2(subtotal - discount_amount + tax_amount) };
}

/** Value (net, tax) of `qty` units of a document line. */
export function lineValue(line: Row, qty: number) {
  const net = round2((qty * line.unit_price * (100 - (line.discount || 0))) / 100);
  const tax = round2((net * (line.tax_rate || 0)) / 100);
  return { net, tax, total: round2(net + tax) };
}

export function paymentStatus(doc: Row): string {
  const due = round2((doc.billed_amount ?? 0) - (doc.returned_amount ?? 0));
  const paid = round2(doc.paid_amount ?? 0);
  if (due <= 0 && paid <= 0) return "not_billed";
  if (paid <= 0) return "unpaid";
  if (paid + 0.005 >= due) return "paid";
  return "partial";
}

export function outstanding(doc: Row): number {
  return Math.max(0, round2((doc.billed_amount ?? 0) - (doc.returned_amount ?? 0) - (doc.paid_amount ?? 0)));
}

function defaultWarehouse(ctx: Ctx, businessId: number): Row {
  const wh = ctx.db.tables.warehouses.find((w) => w.company_id === ctx.companyId && w.business_id === businessId && w.status !== "inactive")
    ?? ctx.db.tables.warehouses.find((w) => w.company_id === ctx.companyId && w.status !== "inactive");
  if (!wh) throw invalid("warehouse_id", "Create a warehouse first.");
  return wh;
}

export function resolveWarehouse(ctx: Ctx, warehouseId: any, businessId: number): Row {
  if (warehouseId) return owned(ctx, "warehouses", warehouseId, "warehouse");
  return defaultWarehouse(ctx, businessId);
}

/* ------------------------------------------------------------------ products */

export function createProduct(ctx: Ctx, body: Row, businessId: number): Row {
  const name = req(body, "name");
  const sku = String(req(body, "sku"));
  if (ctx.db.tables.products.some((p) => p.company_id === ctx.companyId && String(p.sku).toLowerCase() === sku.toLowerCase())) throw invalid("sku", "The sku has already been taken.");
  const selling_price = num(body, "selling_price", { min: 0 });
  const cost_price = num(body, "cost_price", { min: 0, required: false });
  const opening = num(body, "opening_stock", { min: 0, required: false });
  const status = body.status ?? "active";
  if (!["active", "inactive"].includes(status)) throw invalid("status", "The selected status is invalid.");
  const product = insert(ctx.db, "products", {
    company_id: ctx.companyId,
    business_id: businessId,
    name,
    sku,
    barcode: body.barcode || null,
    unit: body.unit || "pcs",
    category: body.category || null,
    description: body.description || null,
    selling_price,
    cost_price,
    current_stock: 0,
    min_stock_alert: num(body, "min_stock_alert", { min: 0, required: false }),
    status,
  });
  if (opening > 0) {
    const wh = resolveWarehouse(ctx, body.warehouse_id, businessId);
    moveStock(ctx, { warehouse_id: wh.id, product_id: product.id, qty_in: opening, reference_type: "opening_stock", reference_id: product.id, reference_no: product.sku, reason: "Opening stock" });
    const value = round2(opening * cost_price);
    if (value > 0) postJournal(ctx, { date: today(), memo: `Opening stock ${product.name}`, source_type: "opening_stock", source_id: product.id, source_no: product.sku, business_id: businessId, lines: [{ account_id: account(ctx, "inventory").id, debit: value }, { account_id: account(ctx, "equity").id, credit: value }] });
  }
  return product;
}

/* ------------------------------------------------------------------ purchases */

export function savePurchase(ctx: Ctx, body: Row, businessId: number, existing?: Row): Row {
  const supplier = owned(ctx, "suppliers", req(body, "supplier_id", "supplier"), "supplier");
  const purchase_date = req(body, "purchase_date", "purchase date");
  const wh = resolveWarehouse(ctx, body.warehouse_id, businessId);
  const calc = computeLines(ctx, body.items);
  const values = {
    business_id: businessId,
    supplier_id: supplier.id,
    supplier_name: supplier.name,
    warehouse_id: wh.id,
    purchase_date,
    expected_date: body.expected_date || null,
    reference: body.reference || null,
    notes: body.notes || null,
    items: calc.lines.map((l) => ({ ...l, received_quantity: 0, returned_quantity: 0 })),
    subtotal: calc.subtotal,
    discount_amount: calc.discount_amount,
    tax_amount: calc.tax_amount,
    total_amount: calc.total_amount,
  };
  if (existing) {
    if (existing.status !== "draft") throw conflict("Only draft purchases can be edited.");
    return patch(existing, values);
  }
  return insert(ctx.db, "purchases", {
    company_id: ctx.companyId,
    invoice_no: nextNumber(ctx.db, ctx.companyId, "PO"),
    status: "draft",
    billed_amount: 0,
    paid_amount: 0,
    returned_amount: 0,
    payment_status: "not_billed",
    created_by: ctx.userName,
    ...values,
  });
}

export function confirmPurchase(ctx: Ctx, purchase: Row): Row {
  if (purchase.status !== "draft") throw conflict(`Purchase is already ${purchase.status}.`);
  const inward = insert(ctx.db, "warehouse_inwards", {
    company_id: ctx.companyId,
    business_id: purchase.business_id,
    purchase_id: purchase.id,
    purchase_no: purchase.invoice_no,
    supplier_name: purchase.supplier_name,
    warehouse_id: purchase.warehouse_id,
    gate_pass_no: nextNumber(ctx.db, ctx.companyId, "IN"),
    status: "pending",
    items: purchase.items.map((l: Row) => ({ product_id: l.product_id, product_name: l.product_name, sku: l.sku, ordered_quantity: l.quantity, received_quantity: 0, pending_quantity: l.quantity })),
    tallies: [],
  });
  patch(purchase, { status: "confirmed", confirmed_at: nowIso(), inward_id: inward.id });
  return inward;
}

/**
 * Tally = cumulative received quantity per product (same body as the Laravel endpoint:
 * `{ items: [{ product_id, received_quantity }] }`), plus optional `complete: true` to close short.
 */
export function tallyInward(ctx: Ctx, inward: Row, body: Row): Row {
  if (inward.status === "completed" || inward.status === "cancelled") throw conflict(`Inward is already ${inward.status}.`);
  const purchase = find(ctx.db, "purchases", inward.purchase_id)!;
  const items: Row[] = Array.isArray(body.items) ? body.items : [];
  const changes: Row[] = [];
  items.forEach((it, i) => {
    const line = inward.items.find((l: Row) => l.product_id === Number(it.product_id));
    if (!line) throw invalid(`items.${i}.product_id`, "Invalid inward item.");
    const newQty = Number(it.received_quantity);
    if (Number.isNaN(newQty) || newQty < 0) throw invalid(`items.${i}.received_quantity`, "Received quantity must be 0 or more.");
    if (newQty > line.ordered_quantity) throw invalid(`items.${i}.received_quantity`, `Cannot receive more than ordered (${line.ordered_quantity}).`);
    if (newQty < line.received_quantity) throw invalid(`items.${i}.received_quantity`, "Received quantity cannot go down. Use a supplier return instead.");
    const diff = round2(newQty - line.received_quantity);
    if (diff > 0) changes.push({ line, diff, newQty });
  });

  let net = 0, tax = 0;
  changes.forEach(({ line, diff, newQty }) => {
    const pLine = purchase.items.find((l: Row) => l.product_id === line.product_id);
    const value = lineValue(pLine, diff);
    net += value.net;
    tax += value.tax;
    // weighted average cost
    const product = find(ctx.db, "products", line.product_id)!;
    const oldQty = Math.max(0, product.current_stock);
    const unitNet = diff > 0 ? value.net / diff : 0;
    product.cost_price = round2(oldQty + diff > 0 ? (oldQty * product.cost_price + diff * unitNet) / (oldQty + diff) : unitNet);
    moveStock(ctx, { warehouse_id: inward.warehouse_id, product_id: line.product_id, qty_in: diff, reference_type: "warehouse_inward", reference_id: inward.id, reference_no: inward.gate_pass_no, reason: `Received against ${purchase.invoice_no}` });
    line.received_quantity = newQty;
    line.pending_quantity = round2(line.ordered_quantity - newQty);
    pLine.received_quantity = newQty;
  });

  net = round2(net); tax = round2(tax);
  if (net + tax > 0) {
    postJournal(ctx, {
      date: today(), memo: `Goods received ${inward.gate_pass_no} (${purchase.invoice_no})`, source_type: "warehouse_inward", source_id: inward.id, source_no: inward.gate_pass_no, business_id: inward.business_id,
      lines: [{ account_id: account(ctx, "inventory").id, debit: net }, { account_id: account(ctx, "input_tax").id, debit: tax }, { account_id: account(ctx, "ap").id, credit: round2(net + tax) }],
    });
    purchase.billed_amount = round2((purchase.billed_amount ?? 0) + net + tax);
  }

  const allReceived = inward.items.every((l: Row) => l.received_quantity >= l.ordered_quantity);
  const anyReceived = inward.items.some((l: Row) => l.received_quantity > 0);
  const closeShort = body.complete === true || body.complete === "true";
  if (changes.length === 0 && !closeShort) throw invalid("items", "Nothing new to receive.");
  inward.tallies.push({ at: nowIso(), by: ctx.userName, lines: changes.map((c) => ({ product_id: c.line.product_id, product_name: c.line.product_name, quantity: c.diff })), closed_short: closeShort && !allReceived });
  if (allReceived || closeShort) {
    patch(inward, { status: "completed", completed_at: nowIso() });
    patch(purchase, { status: anyReceived ? "received" : "cancelled", received_at: nowIso() });
  } else if (anyReceived) {
    patch(inward, { status: "partially_received" });
    patch(purchase, { status: "partially_received" });
  }
  purchase.payment_status = paymentStatus(purchase);
  return inward;
}

export function cancelPurchase(ctx: Ctx, purchase: Row, reason?: string) {
  if (!["draft", "confirmed"].includes(purchase.status)) throw conflict("Only draft or confirmed purchases with nothing received can be cancelled. Use a supplier return for received goods.");
  if (purchase.inward_id) {
    const inward = find(ctx.db, "warehouse_inwards", purchase.inward_id);
    if (inward && inward.items.some((l: Row) => l.received_quantity > 0)) throw conflict("Goods were already received. Use a supplier return.");
    if (inward) patch(inward, { status: "cancelled" });
  }
  return patch(purchase, { status: "cancelled", cancelled_at: nowIso(), cancel_reason: reason || null });
}

/* ------------------------------------------------------------------ sales */

export function saveSale(ctx: Ctx, body: Row, businessId: number, existing?: Row): Row {
  const customer = owned(ctx, "customers", req(body, "customer_id", "customer"), "customer");
  const sale_date = req(body, "sale_date", "sale date");
  const wh = resolveWarehouse(ctx, body.warehouse_id, businessId);
  const calc = computeLines(ctx, body.items);
  const values = {
    business_id: businessId,
    customer_id: customer.id,
    customer_name: customer.name,
    warehouse_id: wh.id,
    sale_date,
    due_date: body.due_date || null,
    reference: body.reference || null,
    delivery_address: body.delivery_address || customer.address || null,
    notes: body.notes || null,
    items: calc.lines.map((l) => ({ ...l, returned_quantity: 0 })),
    subtotal: calc.subtotal,
    discount_amount: calc.discount_amount,
    tax_amount: calc.tax_amount,
    total_amount: calc.total_amount,
  };
  if (existing) {
    if (existing.status !== "draft") throw conflict("Only draft sales can be edited.");
    return patch(existing, values);
  }
  return insert(ctx.db, "sales", {
    company_id: ctx.companyId,
    invoice_no: nextNumber(ctx.db, ctx.companyId, "SO"),
    status: "draft",
    billed_amount: 0,
    paid_amount: 0,
    returned_amount: 0,
    payment_status: "not_billed",
    created_by: ctx.userName,
    ...values,
  });
}

export function confirmSale(ctx: Ctx, sale: Row): Row {
  if (sale.status !== "draft") throw conflict(`Sale is already ${sale.status}.`);
  const customer = find(ctx.db, "customers", sale.customer_id);
  if (customer?.credit_limit) {
    const open = ctx.db.tables.sales.filter((s) => s.customer_id === customer.id).reduce((s, d) => s + outstanding(d), 0);
    if (open + sale.total_amount > customer.credit_limit) throw new HttpError(422, `Credit limit exceeded for ${customer.name} (limit ${customer.credit_limit}, open ${round2(open)}).`, { customer_id: ["Credit limit exceeded"] }, "credit_limit");
  }
  const outward = insert(ctx.db, "warehouse_outwards", {
    company_id: ctx.companyId,
    business_id: sale.business_id,
    sale_id: sale.id,
    sale_no: sale.invoice_no,
    customer_name: sale.customer_name,
    warehouse_id: sale.warehouse_id,
    gate_pass_no: nextNumber(ctx.db, ctx.companyId, "OUT"),
    status: "pending",
    delivery_address: sale.delivery_address,
    items: sale.items.map((l: Row) => ({ product_id: l.product_id, product_name: l.product_name, sku: l.sku, quantity: l.quantity })),
    dispatched_at: null,
    delivered_at: null,
  });
  patch(sale, { status: "confirmed", confirmed_at: nowIso(), outward_id: outward.id });
  return outward;
}

/** Idempotent: a repeated dispatch returns the outward without touching stock again. */
export function dispatchOutward(ctx: Ctx, outward: Row): { outward: Row; already: boolean } {
  if (outward.status === "dispatched" || outward.status === "delivered") return { outward, already: true };
  if (outward.status !== "pending") throw conflict(`Outward is ${outward.status}.`);
  const sale = find(ctx.db, "sales", outward.sale_id)!;
  // check everything first so a failure leaves no partial effects
  outward.items.forEach((l: Row) => {
    const bal = balanceRow(ctx, outward.warehouse_id, l.product_id);
    if (bal.quantity < l.quantity) throw new HttpError(422, `Insufficient stock for ${l.product_name}: available ${bal.quantity}, required ${l.quantity}.`, { stock: [`Insufficient stock for ${l.product_name}`] }, "insufficient_stock");
  });
  let cost = 0;
  outward.items.forEach((l: Row) => {
    const product = find(ctx.db, "products", l.product_id)!;
    cost += round2(l.quantity * product.cost_price);
    l.unit_cost = product.cost_price;
    moveStock(ctx, { warehouse_id: outward.warehouse_id, product_id: l.product_id, qty_out: l.quantity, reference_type: "warehouse_outward", reference_id: outward.id, reference_no: outward.gate_pass_no, reason: `Dispatched for ${sale.invoice_no}` });
  });
  const net = round2(sale.subtotal - sale.discount_amount);
  postJournal(ctx, {
    date: today(), memo: `Sale invoice ${sale.invoice_no} to ${sale.customer_name}`, source_type: "sale", source_id: sale.id, source_no: sale.invoice_no, business_id: sale.business_id,
    lines: [{ account_id: account(ctx, "ar").id, debit: sale.total_amount }, { account_id: account(ctx, "revenue").id, credit: net }, { account_id: account(ctx, "output_tax").id, credit: sale.tax_amount }],
  });
  cost = round2(cost);
  if (cost > 0) postJournal(ctx, { date: today(), memo: `Cost of goods ${sale.invoice_no}`, source_type: "sale_cogs", source_id: sale.id, source_no: sale.invoice_no, business_id: sale.business_id, lines: [{ account_id: account(ctx, "cogs").id, debit: cost }, { account_id: account(ctx, "inventory").id, credit: cost }] });
  patch(outward, { status: "dispatched", dispatched_at: nowIso(), dispatched_by: ctx.userName });
  patch(sale, { status: "dispatched", billed_amount: sale.total_amount, cost_amount: cost });
  sale.payment_status = paymentStatus(sale);
  return { outward, already: false };
}

export function deliverOutward(ctx: Ctx, outward: Row, body: Row = {}): { outward: Row; already: boolean } {
  if (outward.status === "delivered") return { outward, already: true };
  if (outward.status !== "dispatched") throw conflict("Only dispatched outwards can be marked delivered.");
  patch(outward, { status: "delivered", delivered_at: nowIso(), received_by: body.received_by || null, delivery_notes: body.notes || null });
  const sale = find(ctx.db, "sales", outward.sale_id)!;
  patch(sale, { status: "delivered", delivered_at: nowIso() });
  return { outward, already: false };
}

export function cancelSale(ctx: Ctx, sale: Row, reason?: string) {
  if (!["draft", "confirmed"].includes(sale.status)) throw conflict("Only draft or confirmed (not dispatched) sales can be cancelled. Use a sales return instead.");
  if (sale.outward_id) {
    const o = find(ctx.db, "warehouse_outwards", sale.outward_id);
    if (o) patch(o, { status: "cancelled" });
  }
  return patch(sale, { status: "cancelled", cancelled_at: nowIso(), cancel_reason: reason || null });
}

/* ------------------------------------------------------------------ returns */

export function createPurchaseReturn(ctx: Ctx, body: Row): Row {
  const purchase = owned(ctx, "purchases", req(body, "purchase_id", "purchase"), "purchase");
  if (!["partially_received", "received"].includes(purchase.status)) throw conflict("Only received purchases can be returned.");
  const items: Row[] = Array.isArray(body.items) ? body.items.filter((i: Row) => Number(i.quantity) > 0) : [];
  if (!items.length) throw invalid("items", "Enter a quantity to return.");
  const wh = resolveWarehouse(ctx, body.warehouse_id ?? purchase.warehouse_id, purchase.business_id);
  let net = 0, tax = 0;
  const lines = items.map((it, i) => {
    const line = purchase.items.find((l: Row) => l.product_id === Number(it.product_id));
    if (!line) throw invalid(`items.${i}.product_id`, "Product is not on this purchase.");
    const qty = Number(it.quantity);
    const max = round2(line.received_quantity - (line.returned_quantity ?? 0));
    if (qty > max) throw invalid(`items.${i}.quantity`, `Cannot return more than ${max} of ${line.product_name}.`);
    const v = lineValue(line, qty);
    net += v.net; tax += v.tax;
    return { product_id: line.product_id, product_name: line.product_name, quantity: qty, unit_price: line.unit_price, total: v.total, _line: line };
  });
  net = round2(net); tax = round2(tax);
  const ret = insert(ctx.db, "purchase_returns", {
    company_id: ctx.companyId, business_id: purchase.business_id, purchase_id: purchase.id, purchase_no: purchase.invoice_no,
    supplier_id: purchase.supplier_id, supplier_name: purchase.supplier_name, warehouse_id: wh.id,
    return_no: nextNumber(ctx.db, ctx.companyId, "PRN"), return_date: body.return_date || today(), reason: body.reason || null,
    items: lines.map(({ _line, ...rest }) => rest), subtotal: net, tax_amount: tax, total_amount: round2(net + tax), status: "completed", created_by: ctx.userName,
  });
  lines.forEach((l) => {
    moveStock(ctx, { warehouse_id: wh.id, product_id: l.product_id, qty_out: l.quantity, reference_type: "purchase_return", reference_id: ret.id, reference_no: ret.return_no, reason: body.reason || "Returned to supplier" });
    l._line.returned_quantity = round2((l._line.returned_quantity ?? 0) + l.quantity);
  });
  postJournal(ctx, { date: ret.return_date, memo: `Supplier return ${ret.return_no} (${purchase.invoice_no})`, source_type: "purchase_return", source_id: ret.id, source_no: ret.return_no, business_id: purchase.business_id,
    lines: [{ account_id: account(ctx, "ap").id, debit: round2(net + tax) }, { account_id: account(ctx, "inventory").id, credit: net }, { account_id: account(ctx, "input_tax").id, credit: tax }] });
  purchase.returned_amount = round2((purchase.returned_amount ?? 0) + net + tax);
  purchase.payment_status = paymentStatus(purchase);
  return ret;
}

export function createSalesReturn(ctx: Ctx, body: Row): Row {
  const sale = owned(ctx, "sales", req(body, "sale_id", "sale"), "sale");
  if (!["dispatched", "delivered"].includes(sale.status)) throw conflict("Only dispatched or delivered sales can be returned.");
  const items: Row[] = Array.isArray(body.items) ? body.items.filter((i: Row) => Number(i.quantity) > 0) : [];
  if (!items.length) throw invalid("items", "Enter a quantity to return.");
  const wh = resolveWarehouse(ctx, body.warehouse_id ?? sale.warehouse_id, sale.business_id);
  let net = 0, tax = 0, cost = 0;
  const lines = items.map((it, i) => {
    const line = sale.items.find((l: Row) => l.product_id === Number(it.product_id));
    if (!line) throw invalid(`items.${i}.product_id`, "Product is not on this sale.");
    const qty = Number(it.quantity);
    const max = round2(line.quantity - (line.returned_quantity ?? 0));
    if (qty > max) throw invalid(`items.${i}.quantity`, `Cannot return more than ${max} of ${line.product_name}.`);
    const v = lineValue(line, qty);
    net += v.net; tax += v.tax;
    const product = find(ctx.db, "products", line.product_id)!;
    const outward = find(ctx.db, "warehouse_outwards", sale.outward_id);
    const unitCost = outward?.items.find((o: Row) => o.product_id === line.product_id)?.unit_cost ?? product.cost_price;
    cost += round2(qty * unitCost);
    return { product_id: line.product_id, product_name: line.product_name, quantity: qty, unit_price: line.unit_price, total: v.total, _line: line };
  });
  net = round2(net); tax = round2(tax); cost = round2(cost);
  const ret = insert(ctx.db, "sales_returns", {
    company_id: ctx.companyId, business_id: sale.business_id, sale_id: sale.id, sale_no: sale.invoice_no,
    customer_id: sale.customer_id, customer_name: sale.customer_name, warehouse_id: wh.id,
    return_no: nextNumber(ctx.db, ctx.companyId, "SRN"), return_date: body.return_date || today(), reason: body.reason || null,
    items: lines.map(({ _line, ...rest }) => rest), subtotal: net, tax_amount: tax, total_amount: round2(net + tax), status: "completed", created_by: ctx.userName,
  });
  lines.forEach((l) => {
    moveStock(ctx, { warehouse_id: wh.id, product_id: l.product_id, qty_in: l.quantity, reference_type: "sales_return", reference_id: ret.id, reference_no: ret.return_no, reason: body.reason || "Customer return" });
    l._line.returned_quantity = round2((l._line.returned_quantity ?? 0) + l.quantity);
  });
  postJournal(ctx, { date: ret.return_date, memo: `Sales return ${ret.return_no} (${sale.invoice_no})`, source_type: "sales_return", source_id: ret.id, source_no: ret.return_no, business_id: sale.business_id,
    lines: [{ account_id: account(ctx, "sales_returns").id, debit: net }, { account_id: account(ctx, "output_tax").id, debit: tax }, { account_id: account(ctx, "ar").id, credit: round2(net + tax) }] });
  if (cost > 0) postJournal(ctx, { date: ret.return_date, memo: `Cost reversal ${ret.return_no}`, source_type: "sales_return_cogs", source_id: ret.id, source_no: ret.return_no, business_id: sale.business_id,
    lines: [{ account_id: account(ctx, "inventory").id, debit: cost }, { account_id: account(ctx, "cogs").id, credit: cost }] });
  sale.returned_amount = round2((sale.returned_amount ?? 0) + net + tax);
  sale.payment_status = paymentStatus(sale);
  return ret;
}

/* ------------------------------------------------------------------ payments */

export function createPayment(ctx: Ctx, body: Row): Row {
  const direction = req(body, "direction");
  if (!["in", "out"].includes(direction)) throw invalid("direction", "Direction must be in (customer receipt) or out (supplier payment).");
  const partyTable = direction === "in" ? "customers" : "suppliers";
  const docTable = direction === "in" ? "sales" : "purchases";
  const party = owned(ctx, partyTable, req(body, "party_id", direction === "in" ? "customer" : "supplier"), direction === "in" ? "customer" : "supplier");
  const amount = num(body, "amount", { min: 0.01 });
  const method = owned(ctx, "payment_methods", req(body, "payment_method_id", "payment method"), "payment_method");
  const cba = owned(ctx, "cash_bank_accounts", body.cash_bank_account_id || method.default_cash_bank_account_id, "cash_bank_account");
  if (method.requires_reference && !body.reference) throw invalid("reference", `A reference is required for ${method.name}.`);
  const date = req(body, "payment_date", "payment date");
  const allocations: Row[] = (Array.isArray(body.allocations) ? body.allocations : []).filter((a: Row) => Number(a.amount) > 0);
  let allocated = 0;
  const resolved = allocations.map((a, i) => {
    const doc = owned(ctx, docTable, a.document_id, direction === "in" ? "sale" : "purchase");
    const partyKey = direction === "in" ? "customer_id" : "supplier_id";
    if (doc[partyKey] !== party.id) throw invalid(`allocations.${i}.document_id`, "Document belongs to another party.");
    const amt = round2(Number(a.amount));
    if (amt > outstanding(doc) + 0.005) throw invalid(`allocations.${i}.amount`, `Cannot allocate more than outstanding ${outstanding(doc)} on ${doc.invoice_no}.`);
    allocated += amt;
    return { doc, amount: amt };
  });
  allocated = round2(allocated);
  if (allocated > amount + 0.005) throw invalid("allocations", "Allocated total is greater than the payment amount.");
  const payment = insert(ctx.db, "payments", {
    company_id: ctx.companyId,
    business_id: body.business_id ? Number(body.business_id) : null,
    direction,
    party_type: direction === "in" ? "customer" : "supplier",
    party_id: party.id,
    party_name: party.name,
    payment_no: nextNumber(ctx.db, ctx.companyId, direction === "in" ? "RCT" : "PAY"),
    payment_date: date,
    amount,
    allocated_amount: allocated,
    unallocated_amount: round2(amount - allocated),
    payment_method_id: method.id,
    payment_method_name: method.name,
    cash_bank_account_id: cba.id,
    cash_bank_account_name: cba.name,
    reference: body.reference || null,
    notes: body.notes || null,
    allocations: resolved.map((r) => ({ document_type: docTable === "sales" ? "sale" : "purchase", document_id: r.doc.id, document_no: r.doc.invoice_no, amount: r.amount })),
    status: "posted",
    reconciled: false,
    reconciled_at: null,
    created_by: ctx.userName,
  });
  resolved.forEach((r) => {
    r.doc.paid_amount = round2((r.doc.paid_amount ?? 0) + r.amount);
    r.doc.payment_status = paymentStatus(r.doc);
  });
  const cashAcc = cba.account_id;
  const lines = direction === "in"
    ? [{ account_id: cashAcc, debit: amount }, { account_id: account(ctx, "ar").id, credit: amount }]
    : [{ account_id: account(ctx, "ap").id, debit: amount }, { account_id: cashAcc, credit: amount }];
  const j = postJournal(ctx, { date, memo: `${direction === "in" ? "Receipt from" : "Payment to"} ${party.name} ${payment.payment_no}`, source_type: direction === "in" ? "customer_receipt" : "supplier_payment", source_id: payment.id, source_no: payment.payment_no, business_id: payment.business_id, lines });
  payment.journal_id = j.id;
  return payment;
}

export function voidPayment(ctx: Ctx, payment: Row) {
  if (payment.status === "void") throw conflict("Payment is already void.");
  const docTable = payment.direction === "in" ? "sales" : "purchases";
  payment.allocations.forEach((a: Row) => {
    const doc = find(ctx.db, docTable, a.document_id);
    if (doc) { doc.paid_amount = round2((doc.paid_amount ?? 0) - a.amount); doc.payment_status = paymentStatus(doc); }
  });
  reverseJournalsFor(ctx, payment.direction === "in" ? "customer_receipt" : "supplier_payment", payment.id);
  return patch(payment, { status: "void", voided_at: nowIso() });
}

/* ------------------------------------------------------------------ expenses */

export function createExpense(ctx: Ctx, body: Row): Row {
  const category = owned(ctx, "expense_categories", req(body, "expense_category_id", "category"), "expense_category");
  const amount = num(body, "amount", { min: 0.01 });
  const method = owned(ctx, "payment_methods", req(body, "payment_method_id", "payment method"), "payment_method");
  const cba = owned(ctx, "cash_bank_accounts", body.cash_bank_account_id || method.default_cash_bank_account_id, "cash_bank_account");
  const date = req(body, "expense_date", "expense date");
  const exp = insert(ctx.db, "expenses", {
    company_id: ctx.companyId,
    business_id: body.business_id ? Number(body.business_id) : null,
    expense_no: nextNumber(ctx.db, ctx.companyId, "EXP"),
    expense_date: date,
    expense_category_id: category.id,
    category_name: category.name,
    amount,
    payment_method_id: method.id,
    payment_method_name: method.name,
    cash_bank_account_id: cba.id,
    cash_bank_account_name: cba.name,
    payee: body.payee || null,
    reference: body.reference || null,
    notes: body.notes || null,
    status: "posted",
    reconciled: false,
    created_by: ctx.userName,
  });
  const j = postJournal(ctx, { date, memo: `Expense ${exp.expense_no} ${category.name}${exp.payee ? ` - ${exp.payee}` : ""}`, source_type: "expense", source_id: exp.id, source_no: exp.expense_no, business_id: exp.business_id,
    lines: [{ account_id: category.account_id, debit: amount }, { account_id: cba.account_id, credit: amount }] });
  exp.journal_id = j.id;
  return exp;
}

/* ------------------------------------------------------------------ adjustments & transfers */

export function createAdjustment(ctx: Ctx, body: Row): Row {
  const wh = owned(ctx, "warehouses", req(body, "warehouse_id", "warehouse"), "warehouse");
  const reason = req(body, "reason");
  const items: Row[] = (Array.isArray(body.items) ? body.items : []).filter((i: Row) => Number(i.quantity_change) !== 0 && i.product_id);
  if (!items.length) throw invalid("items", "Add at least one product with a quantity change.");
  const adj = insert(ctx.db, "stock_adjustments", {
    company_id: ctx.companyId, business_id: wh.business_id, warehouse_id: wh.id, warehouse_name: wh.name,
    adjustment_no: nextNumber(ctx.db, ctx.companyId, "ADJ"), adjustment_date: body.adjustment_date || today(),
    reason, notes: body.notes || null, items: [], value: 0, actor_id: ctx.userId, actor_name: ctx.userName,
  });
  let value = 0;
  adj.items = items.map((it, i) => {
    const product = owned(ctx, "products", it.product_id, "product");
    const q = Number(it.quantity_change);
    if (Number.isNaN(q)) throw invalid(`items.${i}.quantity_change`, "Quantity must be a number.");
    moveStock(ctx, { warehouse_id: wh.id, product_id: product.id, qty_in: q > 0 ? q : 0, qty_out: q < 0 ? -q : 0, reference_type: "stock_adjustment", reference_id: adj.id, reference_no: adj.adjustment_no, reason });
    value += round2(q * product.cost_price);
    return { product_id: product.id, product_name: product.name, quantity_change: q, unit_cost: product.cost_price };
  });
  adj.value = round2(value);
  if (adj.value !== 0) {
    const abs = Math.abs(adj.value);
    postJournal(ctx, { date: adj.adjustment_date, memo: `Stock adjustment ${adj.adjustment_no}: ${reason}`, source_type: "stock_adjustment", source_id: adj.id, source_no: adj.adjustment_no, business_id: wh.business_id,
      lines: adj.value > 0
        ? [{ account_id: account(ctx, "inventory").id, debit: abs }, { account_id: account(ctx, "stock_adjust").id, credit: abs }]
        : [{ account_id: account(ctx, "stock_adjust").id, debit: abs }, { account_id: account(ctx, "inventory").id, credit: abs }] });
  }
  return adj;
}

export function createTransfer(ctx: Ctx, body: Row): Row {
  const from = owned(ctx, "warehouses", req(body, "from_warehouse_id", "from warehouse"), "from_warehouse");
  const to = owned(ctx, "warehouses", req(body, "to_warehouse_id", "to warehouse"), "to_warehouse");
  if (from.id === to.id) throw invalid("to_warehouse_id", "Choose two different warehouses.");
  const items: Row[] = (Array.isArray(body.items) ? body.items : []).filter((i: Row) => Number(i.quantity) > 0 && i.product_id);
  if (!items.length) throw invalid("items", "Add at least one product.");
  items.forEach((it, i) => {
    const product = owned(ctx, "products", it.product_id, "product");
    const bal = balanceRow(ctx, from.id, product.id);
    if (bal.quantity < Number(it.quantity)) throw invalid(`items.${i}.quantity`, `Only ${bal.quantity} of ${product.name} in ${from.name}.`);
  });
  const trf = insert(ctx.db, "stock_transfers", {
    company_id: ctx.companyId, business_id: from.business_id, transfer_no: nextNumber(ctx.db, ctx.companyId, "TRF"), transfer_date: body.transfer_date || today(),
    from_warehouse_id: from.id, from_warehouse_name: from.name, to_warehouse_id: to.id, to_warehouse_name: to.name, notes: body.notes || null, status: "completed", items: [], actor_name: ctx.userName,
  });
  trf.items = items.map((it) => {
    const product = find(ctx.db, "products", it.product_id)!;
    const q = Number(it.quantity);
    moveStock(ctx, { warehouse_id: from.id, product_id: product.id, qty_out: q, reference_type: "stock_transfer", reference_id: trf.id, reference_no: trf.transfer_no, reason: `Transfer to ${to.name}` });
    moveStock(ctx, { warehouse_id: to.id, product_id: product.id, qty_in: q, reference_type: "stock_transfer", reference_id: trf.id, reference_no: trf.transfer_no, reason: `Transfer from ${from.name}` });
    return { product_id: product.id, product_name: product.name, quantity: q };
  });
  return trf;
}

/* ------------------------------------------------------------------ ledger helpers */

export function accountBalances(ctx: Ctx, opts: { from?: string; to?: string } = {}): Map<number, { debit: number; credit: number }> {
  const map = new Map<number, { debit: number; credit: number }>();
  ctx.db.tables.journals.filter((j) => j.company_id === ctx.companyId && (!opts.from || j.date >= opts.from) && (!opts.to || j.date <= opts.to)).forEach((j) => {
    j.lines.forEach((l: Row) => {
      const cur = map.get(l.account_id) ?? { debit: 0, credit: 0 };
      cur.debit = round2(cur.debit + l.debit);
      cur.credit = round2(cur.credit + l.credit);
      map.set(l.account_id, cur);
    });
  });
  return map;
}

export function normalBalance(type: string, debit: number, credit: number) {
  return ["asset", "expense"].includes(type) ? round2(debit - credit) : round2(credit - debit);
}

export function cashBankBalance(ctx: Ctx, cba: Row): number {
  const b = accountBalances(ctx).get(cba.account_id) ?? { debit: 0, credit: 0 };
  return round2(b.debit - b.credit);
}

export { where };
