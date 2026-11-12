/* eslint-disable @typescript-eslint/no-explicit-any */
import { DB, Row, addDays, find, insert, nowIso, patch } from "../db";
import { HttpError, conflict, invalid, req } from "../engine";
import { Route, list, ok, requirePerm } from "../router";
import { effectiveStatus, subscriptionOf, usage } from "./billing-helpers";
import { presentCompany } from "./org";

function presentSub(db: DB, companyId: number) {
  const { sub, plan } = subscriptionOf(db, companyId);
  const u = usage(db, companyId);
  return {
    subscription: sub ? { ...sub, status: effectiveStatus(sub), stored_status: sub.status } : null,
    plan: plan ?? null,
    usage: u,
    entitlements: plan?.limits ?? {},
    open_invoices: db.tables.subscription_invoices.filter((i) => i.company_id === companyId && ["open", "failed"].includes(i.status)),
  };
}

function newInvoice(db: DB, sub: Row, plan: Row, cycle: string) {
  return insert(db, "subscription_invoices", {
    company_id: sub.company_id, subscription_id: sub.id, invoice_no: `SB-INV-${3000 + db.tables.subscription_invoices.length}`, plan_name: plan.name, billing_cycle: cycle,
    amount: cycle === "yearly" ? plan.price_yearly : plan.price_monthly, currency: plan.currency, status: "open", issued_at: nowIso(), paid_at: null,
    period_start: nowIso(), period_end: addDays(nowIso(), cycle === "yearly" ? 365 : 30), gateway: "mock", gateway_reference: null,
  });
}

function event(db: DB, sub: Row, type: string, payload: Row = {}) {
  insert(db, "subscription_events", { company_id: sub.company_id, subscription_id: sub.id, type, payload });
}

export const billingRoutes: Route[] = [
  { method: "GET", pattern: "/api/subscription", access: "verified", tenant: "required", billing: true, handler: ({ db, tenant }) => ok(presentSub(db, tenant!.companyId!)) },
  { method: "GET", pattern: "/api/subscription/plans", access: "verified", tenant: "optional", billing: true, handler: ({ db }) => list(db.tables.plans.filter((p) => p.is_active).sort((a, b) => a.sort_order - b.sort_order)) },
  { method: "GET", pattern: "/api/subscription/invoices", access: "verified", tenant: "required", billing: true, handler: ({ db, tenant }) => list(db.tables.subscription_invoices.filter((i) => i.company_id === tenant!.companyId).reverse()) },
  { method: "GET", pattern: "/api/subscription/events", access: "verified", tenant: "required", billing: true, handler: ({ db, tenant }) => list(db.tables.subscription_events.filter((i) => i.company_id === tenant!.companyId).reverse()) },
  {
    // Change plan / renew. Creates an open invoice; the plan switches immediately for upgrades,
    // downgrades are blocked if current usage exceeds the new limits.
    method: "POST", pattern: "/api/subscription/change", access: "verified", tenant: "required", billing: true,
    handler: ({ db, tenant, body }) => {
      requirePerm(tenant!, "subscription.manage");
      const plan = db.tables.plans.find((p) => p.code === req(body, "plan_code", "plan") && p.is_active);
      if (!plan) throw invalid("plan_code", "The selected plan is invalid.");
      const cycle = body.billing_cycle === "yearly" ? "yearly" : "monthly";
      const { sub } = subscriptionOf(db, tenant!.companyId!);
      if (!sub) throw new HttpError(404, "No subscription");
      const u = usage(db, tenant!.companyId!);
      const over = Object.entries(plan.limits).filter(([k, v]) => v !== null && (u as any)[k] > (v as number));
      if (over.length) throw new HttpError(422, `Current usage exceeds the ${plan.name} plan: ${over.map(([k, v]) => `${k} ${(u as any)[k]}/${v}`).join(", ")}.`, { plan_code: ["Usage exceeds plan limits"] }, "downgrade_blocked");
      const oldPlan = find(db, "plans", sub.plan_id);
      const invoice = newInvoice(db, sub, plan, cycle);
      patch(sub, { plan_id: plan.id, billing_cycle: cycle, cancel_at_period_end: false, cancelled_at: null });
      event(db, sub, "plan.changed", { from: oldPlan?.code, to: plan.code, cycle });
      return ok({ ...presentSub(db, tenant!.companyId!), invoice }, `Plan changed to ${plan.name}. Pay invoice ${invoice.invoice_no} to activate the new period.`);
    },
  },
  {
    // Gateway-agnostic checkout. Mock: always succeeds unless `simulate: "fail"`.
    method: "POST", pattern: "/api/subscription/invoices/:id/pay", access: "verified", tenant: "required", billing: true,
    handler: ({ db, tenant, params, body }) => {
      requirePerm(tenant!, "subscription.manage");
      const inv = find(db, "subscription_invoices", params.id);
      if (!inv || inv.company_id !== tenant!.companyId) throw new HttpError(404, "Invoice not found");
      if (inv.status === "paid") return ok(inv, "Invoice already paid");
      const sub = find(db, "subscriptions", inv.subscription_id)!;
      if (body.simulate === "fail") {
        patch(inv, { status: "failed" });
        patch(sub, { status: "past_due", grace_ends_at: addDays(nowIso(), db.settings.grace_period_days ?? 7) });
        event(db, sub, "payment.failed", { invoice: inv.invoice_no });
        throw new HttpError(402, "Payment was declined by the gateway (simulated). Your account is in the grace period.", null, "payment_failed");
      }
      patch(inv, { status: "paid", paid_at: nowIso(), gateway_reference: `MOCK-${Date.now().toString(36).toUpperCase()}` });
      patch(sub, { status: "active", trial_ends_at: sub.status === "trialing" ? nowIso() : sub.trial_ends_at, current_period_start: nowIso(), current_period_end: inv.period_end, grace_ends_at: null, cancel_at_period_end: false });
      event(db, sub, "invoice.paid", { invoice: inv.invoice_no });
      return ok(inv, "Payment successful. Subscription active.");
    },
  },
  {
    method: "POST", pattern: "/api/subscription/cancel", access: "verified", tenant: "required", billing: true,
    handler: ({ db, tenant, body }) => {
      requirePerm(tenant!, "subscription.manage");
      const { sub } = subscriptionOf(db, tenant!.companyId!);
      if (!sub) throw new HttpError(404, "No subscription");
      if (sub.cancel_at_period_end) throw conflict("Already scheduled to cancel.");
      patch(sub, { cancel_at_period_end: true, cancelled_at: nowIso(), cancel_reason: body.reason || null });
      event(db, sub, "subscription.cancel_scheduled", { reason: body.reason });
      return ok(presentSub(db, tenant!.companyId!), "Subscription will end at the end of the current period.");
    },
  },
  {
    method: "POST", pattern: "/api/subscription/resume", access: "verified", tenant: "required", billing: true,
    handler: ({ db, tenant }) => {
      requirePerm(tenant!, "subscription.manage");
      const { sub } = subscriptionOf(db, tenant!.companyId!);
      if (!sub) throw new HttpError(404, "No subscription");
      patch(sub, { cancel_at_period_end: false, cancelled_at: null });
      event(db, sub, "subscription.resumed");
      return ok(presentSub(db, tenant!.companyId!), "Subscription resumed.");
    },
  },
];

/* ---------------- platform administration */
export const platformRoutes: Route[] = [
  { method: "GET", pattern: "/api/platform/companies", access: "verified", platform: true,
    handler: ({ db }) => { const items = db.tables.companies.map((c) => ({ ...presentCompany(db, c), users_count: new Set(db.tables.assignments.filter((a) => a.company_id === c.id).map((a) => a.user_id)).size, usage: usage(db, c.id) })); return ok({ companies: items, total: items.length, pagination: { current_page: 1, total: items.length } }); } },
  { method: "PUT", pattern: "/api/platform/companies/:id/status", access: "verified", platform: true,
    handler: ({ db, params, body }) => { const c = find(db, "companies", params.id); if (!c) throw new HttpError(404, "Company not found"); if (!["active", "suspended"].includes(body.account_status)) throw invalid("account_status", "Use active or suspended."); patch(c, { account_status: body.account_status }); return ok(presentCompany(db, c), `Company ${body.account_status}`); } },
  { method: "GET", pattern: "/api/platform/users", access: "verified", platform: true,
    handler: ({ db }) => { const items = db.tables.users.map((u) => ({ id: u.id, name: u.name, email: u.email, status: u.status, is_platform_admin: !!u.is_platform_admin, email_verified: !!u.email_verified_at, companies: Array.from(new Set(db.tables.assignments.filter((a) => a.user_id === u.id).map((a) => find(db, "companies", a.company_id)?.name))), created_at: u.created_at })); return ok({ users: items, total: items.length }); } },
  { method: "PUT", pattern: "/api/platform/users/:id/status", access: "verified", platform: true,
    handler: ({ db, params, body, user }) => { const u = find(db, "users", params.id); if (!u) throw new HttpError(404, "User not found"); if (u.id === user!.id) throw conflict("You cannot change your own status."); patch(u, { status: body.status === "suspended" ? "suspended" : "active" }); if (u.status === "suspended") Object.keys(db.tokens).forEach((k) => db.tokens[k] === u.id && delete db.tokens[k]); return ok(u, "User updated"); } },
  { method: "GET", pattern: "/api/platform/plans", access: "verified", platform: true, handler: ({ db }) => list(db.tables.plans.map((p) => ({ ...p, subscribers: db.tables.subscriptions.filter((s) => s.plan_id === p.id).length }))) },
  { method: "POST", pattern: "/api/platform/plans", access: "verified", platform: true,
    handler: ({ db, body }) => { const code = req(body, "code"); if (db.tables.plans.some((p) => p.code === code)) throw invalid("code", "Code already used."); return ok(insert(db, "plans", { code, name: req(body, "name"), price_monthly: Number(body.price_monthly || 0), price_yearly: Number(body.price_yearly || 0), currency: body.currency || "PKR", trial_days: Number(body.trial_days || 14), limits: body.limits ?? { users: null, branches: null, warehouses: null, products: null }, features: body.features ?? [], is_active: body.is_active !== false, sort_order: db.tables.plans.length + 1 }), "Plan created", 201); } },
  { method: "PUT", pattern: "/api/platform/plans/:id", access: "verified", platform: true,
    handler: ({ db, params, body }) => { const p = find(db, "plans", params.id); if (!p) throw new HttpError(404, "Plan not found"); const v: Row = {}; ["name", "price_monthly", "price_yearly", "currency", "trial_days", "limits", "features", "is_active"].forEach((k) => body[k] !== undefined && (v[k] = body[k])); ["price_monthly", "price_yearly", "trial_days"].forEach((k) => v[k] !== undefined && (v[k] = Number(v[k]))); patch(p, v); return ok(p, "Plan updated"); } },
  { method: "GET", pattern: "/api/platform/subscriptions", access: "verified", platform: true,
    handler: ({ db }) => list(db.tables.subscriptions.map((s) => ({ ...s, effective_status: effectiveStatus(s), company: find(db, "companies", s.company_id)?.name, plan: find(db, "plans", s.plan_id)?.name, plan_code: find(db, "plans", s.plan_id)?.code }))) },
  { method: "PUT", pattern: "/api/platform/subscriptions/:id", access: "verified", platform: true,
    handler: ({ db, params, body }) => {
      const s = find(db, "subscriptions", params.id); if (!s) throw new HttpError(404, "Subscription not found");
      const v: Row = {};
      if (body.status) { if (!["trialing", "active", "past_due", "cancelled", "expired"].includes(body.status)) throw invalid("status", "Invalid status."); v.status = body.status; }
      if (body.plan_code) { const p = db.tables.plans.find((x) => x.code === body.plan_code); if (!p) throw invalid("plan_code", "Invalid plan."); v.plan_id = p.id; }
      if (body.extend_days) { v.current_period_end = addDays(s.current_period_end ?? nowIso(), Number(body.extend_days)); if (s.status === "trialing" || v.status === "trialing") v.trial_ends_at = addDays(s.trial_ends_at ?? nowIso(), Number(body.extend_days)); }
      if (v.status === "active") { v.grace_ends_at = null; if (new Date(s.current_period_end) < new Date()) v.current_period_end = addDays(nowIso(), 30); }
      if (v.status === "past_due") v.grace_ends_at = addDays(nowIso(), db.settings.grace_period_days ?? 7);
      patch(s, v);
      event(db, s, "platform.updated", v);
      return ok(s, "Subscription updated");
    } },
  { method: "GET", pattern: "/api/platform/payments", access: "verified", platform: true, handler: ({ db }) => list(db.tables.subscription_invoices.map((i) => ({ ...i, company: find(db, "companies", i.company_id)?.name })).reverse()) },
  { method: "GET", pattern: "/api/platform/events", access: "verified", platform: true, handler: ({ db }) => list(db.tables.subscription_events.map((i) => ({ ...i, company: find(db, "companies", i.company_id)?.name })).reverse()) },
  { method: "GET", pattern: "/api/platform/settings", access: "verified", platform: true, handler: ({ db }) => ok(db.settings) },
  { method: "PUT", pattern: "/api/platform/settings", access: "verified", platform: true, handler: ({ db, body }) => { Object.assign(db.settings, body); return ok(db.settings, "Settings saved"); } },
];
