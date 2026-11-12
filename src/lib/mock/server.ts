/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * In-app mock of the Laravel API. Same paths, methods, headers and bodies as the real backend.
 * Enabled when NEXT_PUBLIC_USE_MOCK !== "false".
 */
import { DB, Row, Table, emptyDB, getDB, nowIso, resetDB, saveDB, useStorageKey } from "./db";
import { HttpError, bootstrapCompany } from "./engine";
import { API_MODE } from "@/lib/config";
import { SYSTEM_ROLE_PERMISSIONS } from "@/lib/permissions";
import { Route, matchRoute, resolveTenant } from "./router";
import { seed as demoSeed, seedPlatform } from "./seed";

/** Hybrid mode: separate store that starts empty (plans + system roles only); live identity is mirrored in. */
const HYBRID = API_MODE === "hybrid";
if (HYBRID) useStorageKey("sb_mock_db_hybrid_v1");
function hybridSeed(): DB { const db = emptyDB(); seedPlatform(db); return db; }
const seed = HYBRID ? hybridSeed : demoSeed;
import { authRoutes } from "./handlers/auth";
import { orgRoutes } from "./handlers/org";
import { inventoryRoutes } from "./handlers/inventory";
import { tradeRoutes } from "./handlers/trade";
import { financeRoutes } from "./handlers/finance";
import { reportRoutes } from "./handlers/reports";
import { billingRoutes, platformRoutes } from "./handlers/billing";
import { assertWritable } from "./handlers/billing-helpers";

const routes: Route[] = [...authRoutes, ...orgRoutes, ...inventoryRoutes, ...tradeRoutes, ...financeRoutes, ...reportRoutes, ...billingRoutes, ...platformRoutes];

export function resetMockData() {
  resetDB(seed);
}

export function mockRoutes() {
  return routes.map((r) => `${r.method} ${r.pattern}`);
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function mockFetch(method: string, url: string, headers: Record<string, string>, body: unknown): Promise<{ status: number; body: unknown }> {
  await delay(120 + Math.random() * 120);
  const db: DB = getDB(seed);
  const [path, qs] = url.split("?");
  const query = new URLSearchParams(qs ?? "");
  const match = matchRoute(routes, method, path);
  if (!match) return { status: 404, body: { success: false, message: `Mock route not found: ${method} ${path}` } };
  const { route, params } = match;

  // Work on a copy so a failed request leaves no partial writes (like a DB transaction).
  const snapshot = method === "GET" ? null : JSON.stringify(db.tables);
  try {
    let user = null;
    let token: string | null = null;
    const auth = headers.Authorization ?? "";
    if (auth.startsWith("Bearer ")) {
      token = auth.slice(7);
      const uid = db.tokens[token];
      user = uid ? db.tables.users.find((u) => u.id === uid) ?? null : null;
    }
    const access = route.access ?? "verified";
    if (access !== "public") {
      if (!user) return { status: 401, body: { success: false, message: "Unauthenticated.", errors: null } };
      if (user.status === "suspended") return { status: 403, body: { success: false, message: "This account is suspended.", errors: null } };
      if (access === "verified" && !user.email_verified_at) return { status: 403, body: { success: false, message: "Your email address is not verified.", errors: { code: "email_not_verified" } } };
    }
    if (route.platform && !user?.is_platform_admin) return { status: 403, body: { success: false, message: "Platform administrator access required.", errors: null } };

    const tenant = user && route.tenant && route.tenant !== "none" ? resolveTenant(db, user, headers, route.tenant === "optional") : null;
    if (route.perm && tenant) {
      const perms = Array.isArray(route.perm) ? route.perm : [route.perm];
      if (!perms.some((p) => tenant.can(p))) throw new HttpError(403, `This action is unauthorized (requires ${perms.join(" or ")}).`);
    }
    if (method !== "GET" && tenant?.companyId && route.tenant === "required" && !route.billing) assertWritable(db, tenant.companyId);

    const result = route.handler({
      db, method, path, params, query, body: (body ?? {}) as any, headers, user, token, tenant,
      ctx: () => {
        if (!tenant?.companyId) throw new HttpError(422, "Select a company.", null, "company_required");
        return { db, companyId: tenant.companyId, userId: user!.id, userName: user!.name };
      },
    });
    if (method !== "GET") saveDB();
    return { status: result.__status ?? 200, body: result.body };
  } catch (e) {
    if (snapshot) db.tables = JSON.parse(snapshot);
    if (e instanceof HttpError) {
      const errors = e.errors ?? (e.code ? { code: e.code } : null);
      return { status: e.status, body: { success: false, message: e.message, errors, code: e.code } };
    }
    console.error("[mock api]", e);
    return { status: 500, body: { success: false, message: "Server Error", error: e instanceof Error ? e.message : String(e) } };
  }
}


/* ------------------------------------------------------------------ hybrid bridge */
function upsert(db: DB, table: Table, id: number, row: Row): { row: Row; created: boolean } {
  const existing = db.tables[table].find((r) => r.id === id);
  if (existing) { Object.assign(existing, row, { updated_at: nowIso() }); return { row: existing, created: false }; }
  const rec = { id, ...row, created_at: nowIso(), updated_at: nowIso() };
  db.tables[table].push(rec);
  db.seq[table] = Math.max(db.seq[table] ?? 0, id);
  return { row: rec, created: true };
}

export interface LiveIdentity {
  me: { id: number; name: string; email: string; is_platform_admin?: boolean; assignments: { role: string; company: string | null; company_id: number; business_id: number | null; business?: string | null; permissions: string[] }[] };
  branches: { id: number; name: string; company_id: number }[];
}

/**
 * Mirrors the logged-in live user, their companies, branches and role permissions into the
 * hybrid mock store (same ids as Laravel) and returns a mock token for mock-served modules.
 */
export function bridgeIdentity(id: LiveIdentity): string {
  const db = getDB(seed);
  const { me } = id;
  const uid = 1_000_000 + me.id; // never collides with mock-created users
  upsert(db, "users", uid, { name: me.name, email: me.email, password: null, email_verified_at: nowIso(), is_platform_admin: !!me.is_platform_admin, status: "active", phone: null, live_id: me.id });
  const companies = new Map<number, string>();
  me.assignments.forEach((a) => companies.set(a.company_id, a.company ?? `Company ${a.company_id}`));
  companies.forEach((name, cid) => {
    const { created } = upsert(db, "companies", cid, { name, owner_id: uid, currency: "PKR", country: "Pakistan", timezone: "Asia/Karachi", status: 1, account_status: "active", onboarding_completed_at: nowIso() });
    if (created) bootstrapCompany(db, cid, { planCode: "business", trial: false });
  });
  id.branches.forEach((b) => { if (companies.has(Number(b.company_id))) upsert(db, "businesses", Number(b.id), { company_id: Number(b.company_id), name: b.name, type: "branch", status: 1 }); });
  me.assignments.forEach((a) => { if (a.business_id) upsert(db, "businesses", a.business_id, { company_id: a.company_id, name: a.business ?? `Branch ${a.business_id}`, type: "branch", status: 1 }); });
  db.tables.assignments = db.tables.assignments.filter((x) => x.user_id !== uid);
  me.assignments.forEach((a) => {
    // System roles keep their full frontend permission set (the backend catalogue has no keys for mock-only modules yet).
    const perms = SYSTEM_ROLE_PERMISSIONS[a.role] ?? a.permissions ?? [];
    let role = db.tables.roles.find((r) => r.name === a.role && (r.company_id === null || r.company_id === a.company_id));
    if (!role) role = upsert(db, "roles", 1_000_000 + db.tables.roles.length, { name: a.role, company_id: a.company_id, is_system: false, permissions: perms }).row;
    else if (!role.is_system) role.permissions = perms;
    db.tables.assignments.push({ id: (db.seq.assignments = (db.seq.assignments ?? 0) + 1), user_id: uid, role_id: role.id, company_id: a.company_id, business_id: a.business_id, created_at: nowIso(), updated_at: nowIso() });
  });
  const token = `hybrid-${me.id}`;
  db.tokens[token] = uid;
  saveDB();
  return token;
}

/** Copies live products into the hybrid store so stock, adjustments and reports can reference them. */
export function mirrorProducts(companyId: number | null, products: Row[]) {
  if (!HYBRID || !companyId || !products.length) return;
  const db = getDB(seed);
  if (!db.tables.companies.some((c) => c.id === companyId)) return;
  products.forEach((p) => {
    if (!p?.id) return;
    upsert(db, "products", Number(p.id), {
      company_id: Number(p.company_id ?? companyId), business_id: p.business_id ?? null, name: p.name, sku: p.sku ?? null, barcode: p.barcode ?? null,
      unit_id: null, unit: p.unit ?? null, category: p.category ?? null, selling_price: Number(p.selling_price ?? p.price ?? 0), cost_price: Number(p.cost_price ?? 0),
      opening_stock: Number(p.opening_stock ?? 0), current_stock: Number(p.current_stock ?? 0), min_stock_alert: Number(p.min_stock_alert ?? 0), status: p.status ?? "active", live: true,
    });
  });
  saveDB();
}
