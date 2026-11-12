/* eslint-disable @typescript-eslint/no-explicit-any */
import { expandPermissions } from "@/lib/permissions";
import { DB, Row, find } from "./db";
import { Ctx, HttpError } from "./engine";

export interface Tenant {
  user: Row;
  rows: { role: string; role_id: number; company_id: number; business_id: number | null; permissions: string[] }[];
  companyId: number | null;
  businessId: number | null;
  branchIds: number[];
  can: (perm: string, businessId?: number | null) => boolean;
  isAdmin: boolean;
}

export interface HandlerArgs {
  db: DB;
  method: string;
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
  body: Row;
  headers: Record<string, string>;
  user: Row | null;
  token: string | null;
  tenant: Tenant | null;
  /** Engine context for the verified company (throws if none). */
  ctx: () => Ctx;
}

export interface Route {
  method: string;
  pattern: string;
  /** public | auth (token, unverified ok) | verified (token + verified email) */
  access?: "public" | "auth" | "verified";
  tenant?: "none" | "optional" | "required";
  platform?: boolean;
  perm?: string | string[];
  /** Skip the expired-subscription write block (billing endpoints). */
  billing?: boolean;
  handler: (a: HandlerArgs) => any;
}

export const ok = (data: any = null, message = "Request successful", status = 200) => ({ __status: status, body: { success: true, message, data } });
export const raw = (body: any, status = 200) => ({ __status: status, body });

export function matchRoute(routes: Route[], method: string, path: string): { route: Route; params: Record<string, string> } | null {
  for (const route of routes) {
    if (route.method !== method) continue;
    const pParts = route.pattern.split("/").filter(Boolean);
    const uParts = path.split("/").filter(Boolean);
    if (pParts.length !== uParts.length) continue;
    const params: Record<string, string> = {};
    let okMatch = true;
    for (let i = 0; i < pParts.length; i++) {
      if (pParts[i].startsWith(":")) params[pParts[i].slice(1)] = decodeURIComponent(uParts[i]);
      else if (pParts[i] !== uParts[i]) { okMatch = false; break; }
    }
    if (okMatch) return { route, params };
  }
  return null;
}

export function loadAssignments(db: DB, userId: number): Tenant["rows"] {
  return db.tables.assignments
    .filter((a) => a.user_id === userId)
    .map((a) => {
      const role = find(db, "roles", a.role_id);
      const company = find(db, "companies", a.company_id);
      const business = a.business_id ? find(db, "businesses", a.business_id) : null;
      if (!role || !company) return null;
      if (a.business_id && (!business || business.company_id !== a.company_id)) return null;
      return { role: role.name, role_id: role.id, company_id: a.company_id, business_id: a.business_id ?? null, permissions: expandPermissions(role.permissions ?? []) };
    })
    .filter(Boolean) as Tenant["rows"];
}

const ADMIN_ROLES = ["Super Admin", "Company Owner"];

/** Mirrors backend App\Support\Tenancy\TenantResolver: headers are requests, verified against assignments. */
export function resolveTenant(db: DB, user: Row, headers: Record<string, string>, optional: boolean): Tenant {
  const rows = loadAssignments(db, user.id);
  const companyIds = Array.from(new Set(rows.map((r) => r.company_id)));
  const ch = headers["X-Company-ID"];
  const bh = headers["X-Business-ID"];
  let companyId: number | null = null;

  if (ch) {
    companyId = Number(ch);
    if (!companyIds.includes(companyId)) throw new HttpError(403, "You do not have access to this company.");
  } else if (companyIds.length === 1) {
    companyId = companyIds[0];
  } else if (!optional) {
    if (companyIds.length === 0) throw new HttpError(403, "You are not a member of any company.", null, "no_company");
    throw new HttpError(422, "Select a company (X-Company-ID header).", { company: ["Select a company."] }, "company_required");
  }

  const inCompany = rows.filter((r) => r.company_id === companyId);
  const companyWide = inCompany.some((r) => r.business_id === null);
  const allBranches = db.tables.businesses.filter((b) => b.company_id === companyId).map((b) => b.id);
  const branchIds = companyWide ? allBranches : Array.from(new Set(inCompany.map((r) => r.business_id!).filter(Boolean)));

  let businessId: number | null = null;
  if (bh && companyId) {
    businessId = Number(bh);
    if (!branchIds.includes(businessId)) throw new HttpError(403, "You do not have access to this branch.");
  }

  const can = (perm: string, bid?: number | null) => {
    const target = bid ?? businessId;
    return inCompany.some((r) => (r.business_id === null || target === null || target === undefined || r.business_id === target) && r.permissions.includes(perm));
  };
  return { user, rows, companyId, businessId, branchIds, can, isAdmin: inCompany.some((r) => r.business_id === null && ADMIN_ROLES.includes(r.role)) };
}

/** Tenant row visibility (company + accessible branch + active branch filter). */
export function visible(t: Tenant, row: Row): boolean {
  if (row.company_id !== t.companyId) return false;
  if (row.business_id === null || row.business_id === undefined) return true;
  if (!t.branchIds.includes(row.business_id)) return false;
  if (t.businessId && row.business_id !== t.businessId) return false;
  return true;
}

export function scoped(db: DB, t: Tenant, table: any): Row[] {
  return (db.tables as any)[table].filter((r: Row) => visible(t, r));
}

export function getScoped(db: DB, t: Tenant, table: any, id: any, label = "Resource"): Row {
  const row = find(db, table, id);
  if (!row || !visible(t, row)) throw new HttpError(404, `${label} not found`);
  return row;
}

/** Branch for a new record: body.business_id, else the active branch, else the first accessible branch. */
export function branchFor(t: Tenant, body: Row): number {
  const bid = body?.business_id ? Number(body.business_id) : t.businessId ?? t.branchIds[0];
  if (!bid) throw new HttpError(422, "Validation failed", { business_id: ["Select a branch."] });
  if (!t.branchIds.includes(bid)) throw new HttpError(403, "You do not have access to this branch.");
  return bid;
}

export function requirePerm(t: Tenant, perm: string, businessId?: number | null) {
  if (!t.can(perm, businessId)) throw new HttpError(403, `This action is unauthorized (requires ${perm}).`);
}

/** Simple list query helpers used by new endpoints: ?search=&status=&from=&to= */
export function filterList(rows: Row[], q: URLSearchParams, opts: { search?: string[]; date?: string } = {}): Row[] {
  let out = rows;
  const search = q.get("search")?.toLowerCase().trim();
  if (search && opts.search) out = out.filter((r) => opts.search!.some((k) => String(r[k] ?? "").toLowerCase().includes(search)));
  const status = q.get("status");
  if (status && status !== "all") out = out.filter((r) => String(r.status) === status);
  if (opts.date) {
    const from = q.get("from"), to = q.get("to");
    if (from) out = out.filter((r) => String(r[opts.date!]).slice(0, 10) >= from);
    if (to) out = out.filter((r) => String(r[opts.date!]).slice(0, 10) <= to);
  }
  ["business_id", "warehouse_id", "product_id", "customer_id", "supplier_id", "party_id", "direction", "account_id", "cash_bank_account_id", "type", "expense_category_id"].forEach((k) => {
    const v = q.get(k);
    if (v && v !== "all") out = out.filter((r) => String(r[k]) === v);
  });
  return out;
}

export function list(items: Row[], key = "items") {
  return ok({ [key]: items, total: items.length });
}
