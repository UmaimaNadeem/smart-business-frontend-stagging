/* eslint-disable @typescript-eslint/no-explicit-any */
import { DB, Row, daysAgo, find, insert, patch, remove, round2, today } from "../db";
import {
  Ctx, HttpError, accountBalances, cashBankBalance, conflict, createExpense, createPayment, invalid, normalBalance, outstanding,
  postJournal, req, reverseJournal, reverseJournalsFor, voidPayment,
} from "../engine";
import { Route, Tenant, filterList, getScoped, list, ok, scoped } from "../router";

const simple = (table: any, base: string, perm: string, manage: string, fields: string[], label: string, guard?: (db: DB, row: Row) => string | null): Route[] => [
  { method: "GET", pattern: base, access: "verified", tenant: "required", perm, handler: ({ db, tenant, query }) => list(filterList(scoped(db, tenant!, table), query, { search: ["name", "code"] })) },
  { method: "POST", pattern: base, access: "verified", tenant: "required", perm: manage,
    handler: ({ db, tenant, body }) => { req(body, "name"); const v: Row = { company_id: tenant!.companyId, status: "active" }; fields.forEach((k) => body[k] !== undefined && body[k] !== "" && (v[k] = body[k])); return ok(insert(db, table, v), `${label} created`, 201); } },
  { method: "PUT", pattern: `${base}/:id`, access: "verified", tenant: "required", perm: manage,
    handler: ({ db, tenant, params, body }) => { const r = getScoped(db, tenant!, table, params.id, label); if (r.is_system && body.code && body.code !== r.code) throw conflict("System account codes cannot change."); const v: Row = {}; fields.forEach((k) => body[k] !== undefined && (v[k] = body[k] === "" ? null : body[k])); patch(r, v); return ok(r, `${label} updated`); } },
  { method: "DELETE", pattern: `${base}/:id`, access: "verified", tenant: "required", perm: manage,
    handler: ({ db, tenant, params }) => { const r = getScoped(db, tenant!, table, params.id, label); const msg = guard?.(db, r); if (msg) throw conflict(msg); remove(db, table, r.id); return ok(null, `${label} deleted`); } },
];

export function ctxOf(db: DB, t: Tenant): Ctx { return { db, companyId: t.companyId!, userId: t.user.id, userName: t.user.name }; }

function trialBalance(c: Ctx, from?: string, to?: string) {
  const bal = accountBalances(c, { from, to });
  return c.db.tables.accounts.filter((a) => a.company_id === c.companyId).sort((a, b) => a.code.localeCompare(b.code)).map((a) => {
    const b = bal.get(a.id) ?? { debit: 0, credit: 0 };
    const net = round2(b.debit - b.credit);
    return { account_id: a.id, code: a.code, name: a.name, type: a.type, total_debit: b.debit, total_credit: b.credit, debit: net > 0 ? net : 0, credit: net < 0 ? -net : 0, balance: normalBalance(a.type, b.debit, b.credit) };
  });
}

export function aging(db: DB, t: Tenant, kind: "receivables" | "payables") {
  const docs = scoped(db, t, kind === "receivables" ? "sales" : "purchases").filter((d) => outstanding(d) > 0);
  const now = new Date(today()).getTime();
  const rows = docs.map((d) => {
    const party = find(db, kind === "receivables" ? "customers" : "suppliers", kind === "receivables" ? d.customer_id : d.supplier_id);
    const date = d.sale_date ?? d.purchase_date;
    const terms = party?.payment_terms_days ?? 30;
    const due = new Date(date); due.setDate(due.getDate() + terms);
    const overdue = Math.floor((now - due.getTime()) / 86400000);
    const bucket = overdue <= 0 ? "current" : overdue <= 30 ? "1_30" : overdue <= 60 ? "31_60" : overdue <= 90 ? "61_90" : "90_plus";
    return { document_id: d.id, invoice_no: d.invoice_no, party_id: party?.id, party_name: party?.name, date, due_date: due.toISOString().slice(0, 10), days_overdue: Math.max(0, overdue), total: d.billed_amount - (d.returned_amount ?? 0), paid: d.paid_amount, outstanding: outstanding(d), bucket };
  });
  const buckets: Row = { current: 0, "1_30": 0, "31_60": 0, "61_90": 0, "90_plus": 0 };
  rows.forEach((r) => (buckets[r.bucket] = round2(buckets[r.bucket] + r.outstanding)));
  return { items: rows, buckets, total: round2(rows.reduce((s, r) => s + r.outstanding, 0)) };
}

export const financeRoutes: Route[] = [
  ...simple("payment_methods", "/api/payment-methods", "payments.view", "payments.manage", ["name", "type", "default_cash_bank_account_id", "requires_reference", "status"], "Payment method",
    (db, r) => (db.tables.payments.some((p) => p.payment_method_id === r.id) ? "Method is used by payments; deactivate it instead." : null)),
  ...simple("expense_categories", "/api/expense-categories", "expenses.view", "expenses.manage", ["name", "account_id", "status"], "Category",
    (db, r) => (db.tables.expenses.some((e) => e.expense_category_id === r.id) ? "Category has expenses; deactivate it instead." : null)),
  ...simple("accounts", "/api/accounts", "accounting.view", "accounting.manage", ["code", "name", "type", "description", "status"], "Account",
    (db, r) => (r.is_system ? "System accounts cannot be deleted." : db.tables.journals.some((j) => j.lines.some((l: Row) => l.account_id === r.id)) ? "Account has postings." : null)),

  /* cash & bank accounts: each links to a chart-of-accounts asset account */
  { method: "GET", pattern: "/api/cash-bank-accounts", access: "verified", tenant: "required", perm: "payments.view",
    handler: ({ db, tenant }) => { const c = ctxOf(db, tenant!); return list(scoped(db, tenant!, "cash_bank_accounts").map((a) => ({ ...a, balance: cashBankBalance(c, a), unreconciled: [...db.tables.payments, ...db.tables.expenses].filter((p) => p.cash_bank_account_id === a.id && !p.reconciled && p.status !== "void").length }))); } },
  { method: "POST", pattern: "/api/cash-bank-accounts", access: "verified", tenant: "required", perm: "accounting.manage",
    handler: ({ db, tenant, body }) => {
      const c = ctxOf(db, tenant!);
      const name = req(body, "name"); const type = req(body, "type");
      const codes = db.tables.accounts.filter((a) => a.company_id === c.companyId && a.code.startsWith("10")).map((a) => Number(a.code));
      const coa = insert(db, "accounts", { company_id: c.companyId, code: String(Math.max(...codes) + 1), name, type: "asset", is_system: false, status: "active" });
      const a = insert(db, "cash_bank_accounts", { company_id: c.companyId, name, type, account_id: coa.id, bank_name: body.bank_name || null, account_number: body.account_number || null, status: "active" });
      const opening = Number(body.opening_balance || 0);
      if (opening > 0) postJournal(c, { date: today(), memo: `Opening balance ${name}`, source_type: "opening_balance", lines: [{ account_id: coa.id, debit: opening }, { account_id: db.tables.accounts.find((x) => x.company_id === c.companyId && x.system_key === "equity")!.id, credit: opening }] });
      return ok(a, "Account created", 201);
    } },
  { method: "PUT", pattern: "/api/cash-bank-accounts/:id", access: "verified", tenant: "required", perm: "accounting.manage",
    handler: ({ db, tenant, params, body }) => { const a = getScoped(db, tenant!, "cash_bank_accounts", params.id); const v: Row = {}; ["name", "bank_name", "account_number", "status"].forEach((k) => body[k] !== undefined && (v[k] = body[k])); patch(a, v); return ok(a, "Account updated"); } },

  /* reconciliation: payments + expenses hitting a cash/bank account */
  { method: "GET", pattern: "/api/reconciliation", access: "verified", tenant: "required", perm: "payments.view",
    handler: ({ db, tenant, query }) => {
      const id = Number(query.get("cash_bank_account_id"));
      const a = getScoped(db, tenant!, "cash_bank_accounts", id, "Account");
      const rows = [
        ...scoped(db, tenant!, "payments").filter((p) => p.cash_bank_account_id === a.id && p.status !== "void").map((p) => ({ kind: "payment", id: p.id, date: p.payment_date, reference: p.payment_no, description: `${p.direction === "in" ? "Receipt from" : "Payment to"} ${p.party_name}${p.reference ? ` (${p.reference})` : ""}`, amount_in: p.direction === "in" ? p.amount : 0, amount_out: p.direction === "out" ? p.amount : 0, reconciled: p.reconciled })),
        ...scoped(db, tenant!, "expenses").filter((e) => e.cash_bank_account_id === a.id && e.status !== "void").map((e) => ({ kind: "expense", id: e.id, date: e.expense_date, reference: e.expense_no, description: `${e.category_name}${e.payee ? ` - ${e.payee}` : ""}`, amount_in: 0, amount_out: e.amount, reconciled: !!e.reconciled })),
      ].sort((x, y) => String(y.date).localeCompare(String(x.date)));
      const c = ctxOf(db, tenant!);
      const rec = rows.filter((r) => r.reconciled);
      return ok({ account: a, book_balance: cashBankBalance(c, a), reconciled_in: round2(rec.reduce((s, r) => s + r.amount_in, 0)), reconciled_out: round2(rec.reduce((s, r) => s + r.amount_out, 0)), items: rows });
    } },
  { method: "POST", pattern: "/api/reconciliation/toggle", access: "verified", tenant: "required", perm: "payments.manage",
    handler: ({ db, tenant, body }) => { const r = getScoped(db, tenant!, body.kind === "expense" ? "expenses" : "payments", body.id); patch(r, { reconciled: !!body.reconciled, reconciled_at: body.reconciled ? today() : null }); return ok(r, body.reconciled ? "Marked reconciled" : "Marked unreconciled"); } },

  /* payments (receipts in / supplier payments out) */
  { method: "GET", pattern: "/api/payments", access: "verified", tenant: "required", perm: "payments.view",
    handler: ({ db, tenant, query }) => list(filterList(scoped(db, tenant!, "payments"), query, { search: ["payment_no", "party_name", "reference"], date: "payment_date" }).reverse()) },
  { method: "GET", pattern: "/api/payments/:id", access: "verified", tenant: "required", perm: "payments.view", handler: ({ db, tenant, params }) => ok(getScoped(db, tenant!, "payments", params.id, "Payment")) },
  { method: "POST", pattern: "/api/payments", access: "verified", tenant: "required", perm: "payments.manage", handler: ({ db, tenant, body }) => ok(createPayment(ctxOf(db, tenant!), body), body.direction === "in" ? "Receipt recorded" : "Payment recorded", 201) },
  { method: "POST", pattern: "/api/payments/:id/void", access: "verified", tenant: "required", perm: "payments.manage", handler: ({ db, tenant, params }) => ok(voidPayment(ctxOf(db, tenant!), getScoped(db, tenant!, "payments", params.id, "Payment")), "Payment voided and journal reversed") },
  { method: "GET", pattern: "/api/receivables", access: "verified", tenant: "required", perm: "payments.view", handler: ({ db, tenant }) => ok(aging(db, tenant!, "receivables")) },
  { method: "GET", pattern: "/api/payables", access: "verified", tenant: "required", perm: "payments.view", handler: ({ db, tenant }) => ok(aging(db, tenant!, "payables")) },

  /* expenses */
  { method: "GET", pattern: "/api/expenses", access: "verified", tenant: "required", perm: "expenses.view",
    handler: ({ db, tenant, query }) => list(filterList(scoped(db, tenant!, "expenses"), query, { search: ["expense_no", "payee", "category_name", "reference"], date: "expense_date" }).reverse()) },
  { method: "POST", pattern: "/api/expenses", access: "verified", tenant: "required", perm: "expenses.manage", handler: ({ db, tenant, body }) => ok(createExpense(ctxOf(db, tenant!), body), "Expense recorded", 201) },
  { method: "POST", pattern: "/api/expenses/:id/void", access: "verified", tenant: "required", perm: "expenses.manage",
    handler: ({ db, tenant, params }) => { const e = getScoped(db, tenant!, "expenses", params.id, "Expense"); if (e.status === "void") throw conflict("Already void."); reverseJournalsFor(ctxOf(db, tenant!), "expense", e.id); patch(e, { status: "void" }); return ok(e, "Expense voided"); } },

  /* journals & ledgers */
  { method: "GET", pattern: "/api/journals", access: "verified", tenant: "required", perm: "accounting.view",
    handler: ({ db, tenant, query }) => list(filterList(scoped(db, tenant!, "journals"), query, { search: ["journal_no", "memo", "source_no"], date: "date" }).map((j) => ({ ...j, lines: j.lines.map((l: Row) => ({ ...l, account: find(db, "accounts", l.account_id)?.name, code: find(db, "accounts", l.account_id)?.code })) })).reverse()) },
  { method: "POST", pattern: "/api/journals", access: "verified", tenant: "required", perm: "accounting.manage",
    handler: ({ db, tenant, body }) => ok(postJournal(ctxOf(db, tenant!), { date: req(body, "date"), memo: req(body, "memo"), source_type: "manual", lines: Array.isArray(body.lines) ? body.lines : [] }), "Journal posted", 201) },
  { method: "POST", pattern: "/api/journals/:id/reverse", access: "verified", tenant: "required", perm: "accounting.manage",
    handler: ({ db, tenant, params }) => { const j = getScoped(db, tenant!, "journals", params.id, "Journal"); if (j.source_type !== "manual") throw conflict("Only manual journals can be reversed here; reverse the source document instead."); return ok(reverseJournal(ctxOf(db, tenant!), j), "Journal reversed"); } },
  { method: "GET", pattern: "/api/ledger", access: "verified", tenant: "required", perm: "accounting.view",
    handler: ({ db, tenant, query }) => {
      const c = ctxOf(db, tenant!);
      const acc = getScoped(db, tenant!, "accounts", query.get("account_id"), "Account");
      const from = query.get("from") || daysAgo(365); const to = query.get("to") || today();
      const before = { debit: 0, credit: 0 };
      db.tables.journals.filter((j) => j.company_id === c.companyId && j.date < from).forEach((j) => j.lines.filter((l: Row) => l.account_id === acc.id).forEach((l: Row) => { before.debit += l.debit; before.credit += l.credit; }));
      let run = normalBalance(acc.type, before.debit, before.credit);
      const opening = run;
      const sign = ["asset", "expense"].includes(acc.type) ? 1 : -1;
      const lines: Row[] = [];
      db.tables.journals.filter((j) => j.company_id === c.companyId && j.date >= from && j.date <= to).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).forEach((j) => j.lines.filter((l: Row) => l.account_id === acc.id).forEach((l: Row) => {
        run = round2(run + sign * (l.debit - l.credit));
        lines.push({ date: j.date, journal_id: j.id, journal_no: j.journal_no, memo: l.description || j.memo, source_type: j.source_type, source_no: j.source_no, debit: l.debit, credit: l.credit, balance: run });
      }));
      return ok({ account: acc, from, to, opening_balance: opening, closing_balance: run, items: lines });
    } },
  { method: "GET", pattern: "/api/trial-balance", access: "verified", tenant: "required", perm: "accounting.view",
    handler: ({ db, tenant, query }) => {
      const rows = trialBalance(ctxOf(db, tenant!), undefined, query.get("as_of") || undefined).filter((r) => r.total_debit || r.total_credit);
      const d = round2(rows.reduce((s, r) => s + r.debit, 0)); const cr = round2(rows.reduce((s, r) => s + r.credit, 0));
      return ok({ as_of: query.get("as_of") || today(), items: rows, total_debit: d, total_credit: cr, balanced: d === cr });
    } },
];

export { trialBalance, HttpError, invalid };
