/* eslint-disable @typescript-eslint/no-explicit-any */
import { DB, Row, find } from "../db";
import { HttpError } from "../engine";

export type LimitKey = "users" | "branches" | "warehouses" | "products";

export function usage(db: DB, companyId: number): Record<LimitKey, number> {
  const users = new Set(db.tables.assignments.filter((a) => a.company_id === companyId).map((a) => a.user_id));
  const pendingInvites = db.tables.invitations.filter((i) => i.company_id === companyId && i.status === "pending").length;
  return {
    users: users.size + pendingInvites,
    branches: db.tables.businesses.filter((b) => b.company_id === companyId).length,
    warehouses: db.tables.warehouses.filter((w) => w.company_id === companyId).length,
    products: db.tables.products.filter((p) => p.company_id === companyId).length,
  };
}

export function subscriptionOf(db: DB, companyId: number): { sub: Row | undefined; plan: Row | undefined } {
  const sub = db.tables.subscriptions.find((s) => s.company_id === companyId);
  return { sub, plan: sub ? find(db, "plans", sub.plan_id) : undefined };
}

/** Effective status, deriving expiry from dates (the backend scheduler should do this). */
export function effectiveStatus(sub: Row | undefined): string {
  if (!sub) return "none";
  const now = new Date();
  if (sub.status === "trialing" && sub.trial_ends_at && new Date(sub.trial_ends_at) < now) return "expired";
  if (sub.status === "past_due" && sub.grace_ends_at && new Date(sub.grace_ends_at) < now) return "expired";
  if (sub.status === "cancelled" && sub.current_period_end && new Date(sub.current_period_end) < now) return "expired";
  if (sub.status === "active" && sub.cancel_at_period_end && new Date(sub.current_period_end) < now) return "expired";
  return sub.status;
}

export function assertLimit(db: DB, companyId: number, key: LimitKey, adding = 1) {
  const { plan } = subscriptionOf(db, companyId);
  const limit = plan?.limits?.[key];
  if (limit === null || limit === undefined) return;
  const used = usage(db, companyId)[key];
  if (used + adding > limit) {
    throw new HttpError(402, `Your ${plan!.name} plan allows ${limit} ${key}. Upgrade your plan to add more.`, null, "plan_limit_reached");
  }
}

export function assertWritable(db: DB, companyId: number) {
  const { sub } = subscriptionOf(db, companyId);
  const status = effectiveStatus(sub);
  if (status === "expired" || status === "suspended") {
    throw new HttpError(402, "Your subscription has expired. Renew your plan to make changes; your data is read-only.", null, "subscription_expired");
  }
  const company = find(db, "companies", companyId);
  if (company?.account_status === "suspended") throw new HttpError(403, "This company account is suspended by the platform administrator.", null, "account_suspended");
}
