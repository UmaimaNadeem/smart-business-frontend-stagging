/* eslint-disable @typescript-eslint/no-explicit-any */
import { PERMISSIONS, expandPermissions } from "@/lib/permissions";
import { DB, Row, addDays, find, insert, nowIso, patch, remove } from "../db";
import { HttpError, bootstrapCompany, conflict, invalid, req } from "../engine";
import { Route, Tenant, list, ok, requirePerm, resolveTenant } from "../router";
import { assertLimit, effectiveStatus, subscriptionOf } from "./billing-helpers";

export function presentCompany(db: DB, c: Row) {
  const { sub, plan } = subscriptionOf(db, c.id);
  return {
    ...c,
    owner: (() => { const o = find(db, "users", c.owner_id); return o ? { id: o.id, name: o.name, email: o.email } : null; })(),
    total_businesses: db.tables.businesses.filter((b) => b.company_id === c.id).length,
    subscription_status: effectiveStatus(sub),
    plan_name: plan?.name ?? null,
  };
}

function presentBusiness(db: DB, b: Row) {
  const company = find(db, "companies", b.company_id);
  return {
    ...b,
    company: company?.name ?? null,
    warehouses_count: db.tables.warehouses.filter((w) => w.business_id === b.id).length,
    members_count: new Set(db.tables.assignments.filter((a) => a.company_id === b.company_id && (a.business_id === b.id || a.business_id === null)).map((a) => a.user_id)).size,
  };
}

function presentUser(db: DB, u: Row, companyId: number | null) {
  const rows = db.tables.assignments.filter((a) => a.user_id === u.id && (!companyId || a.company_id === companyId));
  const assignments = rows.map((a) => ({
    id: a.id,
    role: find(db, "roles", a.role_id)?.name,
    role_id: a.role_id,
    company_id: a.company_id,
    company: find(db, "companies", a.company_id)?.name,
    business_id: a.business_id,
    business: a.business_id ? find(db, "businesses", a.business_id)?.name : null,
  }));
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone ?? null,
    status: u.status ?? "active",
    email_verified: !!u.email_verified_at,
    roles: assignments.length ? Array.from(new Set(assignments.map((a) => a.role))) : ["Not Assigned"],
    companies: assignments.length ? Array.from(new Set(assignments.map((a) => a.company))) : ["Not Assigned"],
    businesses: assignments.filter((a) => a.business).length ? Array.from(new Set(assignments.filter((a) => a.business).map((a) => a.business))) : ["All branches"],
    assignments,
    created_at: u.created_at,
  };
}

function companyUsers(db: DB, t: Tenant): Row[] {
  const ids = new Set(db.tables.assignments.filter((a) => a.company_id === t.companyId && (a.business_id === null || t.branchIds.includes(a.business_id))).map((a) => a.user_id));
  return db.tables.users.filter((u) => ids.has(u.id) || (u.created_by === t.user.id && !db.tables.assignments.some((a) => a.user_id === u.id)));
}

function presentRole(db: DB, r: Row) {
  return { ...r, permissions: expandPermissions(r.permissions ?? []), users_count: db.tables.assignments.filter((a) => a.role_id === r.id).length };
}

function rolesFor(db: DB, t: Tenant) {
  return db.tables.roles.filter((r) => r.company_id === null || r.company_id === t.companyId);
}

function assertNoEscalation(db: DB, t: Tenant, roleId: number, businessId: number | null) {
  const role = find(db, "roles", roleId);
  if (!role || (role.company_id !== null && role.company_id !== t.companyId)) throw invalid("role_id", "The selected role is invalid.");
  if (role.name === "Super Admin" && !t.rows.some((r) => r.company_id === t.companyId && r.role === "Super Admin")) throw new HttpError(403, "Only a Super Admin can grant Super Admin.");
  if (t.isAdmin) return role;
  const missing = expandPermissions(role.permissions).filter((p) => !t.can(p, businessId));
  if (missing.length) throw new HttpError(403, `You cannot grant permissions you do not hold (${missing.slice(0, 3).join(", ")}).`);
  return role;
}

function checkBranch(db: DB, t: Tenant, businessId: any): number | null {
  if (businessId === null || businessId === undefined || businessId === "") return null;
  const b = find(db, "businesses", businessId);
  if (!b || b.company_id !== t.companyId) throw invalid("business_id", "The selected business does not belong to the selected company.");
  if (!t.branchIds.includes(b.id)) throw new HttpError(403, "You do not have access to this branch.");
  return b.id;
}

const companyFor = (t: Tenant, db: DB, id: any) => {
  const c = find(db, "companies", id);
  if (!c || !t.rows.some((r) => r.company_id === c.id)) throw new HttpError(404, "Company not found");
  return c;
};

const businessFor = (t: Tenant, db: DB, id: any) => {
  const b = find(db, "businesses", id);
  if (!b || !t.rows.some((r) => r.company_id === b.company_id && (r.business_id === null || r.business_id === b.id))) throw new HttpError(404, "Business not found");
  return b;
};

/** Admin checks against the record's own company (routes are tenant:optional). */
function adminIn(db: DB, t: Tenant, companyId: number, perm: string) {
  const sub = resolveTenant(db, t.user, { "X-Company-ID": String(companyId) }, false);
  requirePerm(sub, perm);
  return sub;
}

export const orgRoutes: Route[] = [
  /* ---------------- companies (existing endpoints) */
  {
    method: "GET", pattern: "/api/companies", access: "verified", tenant: "optional",
    handler: ({ db, tenant }) => {
      const ids = new Set(tenant!.rows.map((r) => r.company_id));
      const companies = db.tables.companies.filter((c) => ids.has(c.id)).map((c) => presentCompany(db, c));
      return ok({ total_companies: companies.length, companies });
    },
  },
  {
    method: "POST", pattern: "/api/companies/create", access: "verified", tenant: "optional",
    handler: ({ db, tenant, body }) => {
      const name = req(body, "name");
      const c = insert(db, "companies", { name, owner_id: tenant!.user.id, currency: body.currency || "PKR", country: body.country || null, timezone: body.timezone || null, address: body.address || null, phone: body.phone || null, email: body.email || null, tax_number: body.tax_number || null, status: 1, account_status: "active", onboarding_completed_at: null });
      insert(db, "businesses", { company_id: c.id, name: "Main Branch", type: "branch", address: null, status: 1 });
      const ownerRole = db.tables.roles.find((r) => r.name === "Company Owner" && r.company_id === null)!;
      insert(db, "assignments", { user_id: tenant!.user.id, role_id: ownerRole.id, company_id: c.id, business_id: null });
      bootstrapCompany(db, c.id, { planCode: "growth", trial: true });
      return ok(presentCompany(db, c), "Company created successfully", 201);
    },
  },
  { method: "GET", pattern: "/api/companies/detail/:id", access: "verified", tenant: "optional", handler: ({ db, tenant, params }) => ok(presentCompany(db, companyFor(tenant!, db, params.id))) },
  {
    method: "PUT", pattern: "/api/companies/update/:id", access: "verified", tenant: "optional",
    handler: ({ db, tenant, params, body }) => {
      const c = companyFor(tenant!, db, params.id);
      adminIn(db, tenant!, c.id, "company.manage");
      const allowed = ["name", "currency", "country", "status", "timezone", "address", "phone", "email", "tax_number", "fiscal_year_start"];
      const values: Row = {};
      allowed.forEach((k) => body[k] !== undefined && (values[k] = body[k]));
      if (values.name === "") throw invalid("name", "The name field is required.");
      patch(c, values);
      return ok(presentCompany(db, c), "Company updated successfully");
    },
  },
  {
    method: "DELETE", pattern: "/api/companies/delete/:id", access: "verified", tenant: "optional",
    handler: ({ db, tenant, params }) => {
      const c = companyFor(tenant!, db, params.id);
      if (c.owner_id !== tenant!.user.id) throw new HttpError(403, "Only the company owner can delete the company.");
      if (db.tables.sales.some((s) => s.company_id === c.id) || db.tables.purchases.some((p) => p.company_id === c.id)) throw conflict("This company has transactions. Contact support to close it (soft delete / export is required).");
      remove(db, "companies", c.id);
      db.tables.assignments = db.tables.assignments.filter((a) => a.company_id !== c.id);
      return ok(null, "Company deleted successfully");
    },
  },
  {
    method: "GET", pattern: "/api/companies/:id/structure", access: "verified", tenant: "optional",
    handler: ({ db, tenant, params }) => {
      const c = companyFor(tenant!, db, params.id);
      const businesses = db.tables.businesses.filter((b) => b.company_id === c.id).map((b) => presentBusiness(db, b));
      return ok({ company: presentCompany(db, c), total_businesses: businesses.length, businesses });
    },
  },
  {
    // NEW: finish the onboarding wizard.
    method: "POST", pattern: "/api/onboarding/complete", access: "verified", tenant: "required",
    handler: ({ db, tenant }) => {
      requirePerm(tenant!, "company.manage");
      const c = find(db, "companies", tenant!.companyId)!;
      if (!c.country || !c.currency || !c.timezone) throw invalid("company", "Set country, currency and timezone first.");
      if (!db.tables.warehouses.some((w) => w.company_id === c.id)) throw invalid("warehouse", "Create at least one warehouse.");
      patch(c, { onboarding_completed_at: nowIso() });
      return ok(presentCompany(db, c), "Onboarding completed");
    },
  },

  /* ---------------- businesses / branches (existing endpoints) */
  {
    method: "GET", pattern: "/api/businesses", access: "verified", tenant: "optional",
    handler: ({ db, tenant }) => {
      const t = tenant!;
      const all = db.tables.businesses.filter((b) => t.rows.some((r) => r.company_id === b.company_id && (r.business_id === null || r.business_id === b.id)));
      const rows = t.companyId ? all.filter((b) => b.company_id === t.companyId) : all;
      return ok({ total_businesses: rows.length, businesses: rows.map((b) => presentBusiness(db, b)) });
    },
  },
  {
    method: "GET", pattern: "/api/users/:id/businesses", access: "verified", tenant: "optional",
    handler: ({ db, tenant, params }) => {
      const uid = Number(params.id);
      const rows = db.tables.assignments.filter((a) => a.user_id === uid && tenant!.rows.some((r) => r.company_id === a.company_id));
      const ids = new Set<number>();
      rows.forEach((a) => (a.business_id ? ids.add(a.business_id) : db.tables.businesses.filter((b) => b.company_id === a.company_id).forEach((b) => ids.add(b.id))));
      return ok({ businesses: db.tables.businesses.filter((b) => ids.has(b.id)).map((b) => presentBusiness(db, b)) });
    },
  },
  {
    method: "POST", pattern: "/api/businesses/create", access: "verified", tenant: "optional",
    handler: ({ db, tenant, body }) => {
      const name = req(body, "name");
      const companyId = Number(req(body, "company_id", "company"));
      companyFor(tenant!, db, companyId);
      adminIn(db, tenant!, companyId, "branches.manage");
      assertLimit(db, companyId, "branches");
      if (db.tables.businesses.some((b) => b.company_id === companyId && b.name.toLowerCase() === String(name).toLowerCase())) throw invalid("name", "A branch with this name already exists in the company.");
      const b = insert(db, "businesses", { company_id: companyId, name, type: body.type || "branch", address: body.address || null, phone: body.phone || null, status: 1 });
      return ok(presentBusiness(db, b), "Business created successfully", 201);
    },
  },
  { method: "GET", pattern: "/api/businesses/detail/:id", access: "verified", tenant: "optional", handler: ({ db, tenant, params }) => ok(presentBusiness(db, businessFor(tenant!, db, params.id))) },
  {
    method: "PUT", pattern: "/api/businesses/update/:id", access: "verified", tenant: "optional",
    handler: ({ db, tenant, params, body }) => {
      const b = businessFor(tenant!, db, params.id);
      adminIn(db, tenant!, b.company_id, "branches.manage");
      const values: Row = {};
      ["name", "type", "address", "phone", "status"].forEach((k) => body[k] !== undefined && (values[k] = body[k]));
      patch(b, values);
      return ok(presentBusiness(db, b), "Business updated successfully");
    },
  },
  {
    method: "DELETE", pattern: "/api/businesses/delete/:id", access: "verified", tenant: "optional",
    handler: ({ db, tenant, params }) => {
      const b = businessFor(tenant!, db, params.id);
      adminIn(db, tenant!, b.company_id, "branches.manage");
      const used = ["products", "purchases", "sales", "warehouses"].some((tb) => (db.tables as any)[tb].some((r: Row) => r.business_id === b.id));
      if (used) throw conflict("This branch has products, warehouses or documents. Deactivate it instead of deleting.");
      if (db.tables.businesses.filter((x) => x.company_id === b.company_id).length <= 1) throw conflict("A company needs at least one branch.");
      remove(db, "businesses", b.id);
      return ok(null, "Business deleted successfully");
    },
  },

  /* ---------------- business members (existing endpoints) */
  {
    method: "GET", pattern: "/api/business-members/:businessId", access: "verified", tenant: "optional",
    handler: ({ db, tenant, params }) => {
      const b = businessFor(tenant!, db, params.businessId);
      const rows = db.tables.assignments.filter((a) => a.company_id === b.company_id && (a.business_id === b.id || a.business_id === null));
      const byUser = new Map<number, Row>();
      rows.forEach((a) => {
        const u = find(db, "users", a.user_id);
        if (!u) return;
        const m = byUser.get(u.id) ?? { id: u.id, name: u.name, email: u.email, roles: [] as string[], scopes: [] as Row[] };
        const role = find(db, "roles", a.role_id)?.name;
        m.roles.push(role);
        m.scopes.push({ role, role_id: a.role_id, scope: a.business_id ? "branch" : "company-wide" });
        byUser.set(u.id, m);
      });
      return ok({ business: presentBusiness(db, b), total_members: byUser.size, members: Array.from(byUser.values()) });
    },
  },
  {
    method: "POST", pattern: "/api/business-members/add", access: "verified", tenant: "optional",
    handler: ({ db, tenant, body }) => {
      const b = businessFor(tenant!, db, req(body, "business_id", "business"));
      const t = adminIn(db, tenant!, b.company_id, "users.manage");
      const user = find(db, "users", req(body, "user_id", "user"));
      if (!user) throw invalid("user_id", "The selected user is invalid.");
      const role = assertNoEscalation(db, t, Number(req(body, "role_id", "role")), b.id);
      if (db.tables.assignments.some((a) => a.user_id === user.id && a.role_id === role.id && a.company_id === b.company_id && a.business_id === b.id)) throw conflict("User already has this role in the branch.");
      insert(db, "assignments", { user_id: user.id, role_id: role.id, company_id: b.company_id, business_id: b.id });
      return ok({ user: { id: user.id, name: user.name }, role: { id: role.id, name: role.name }, business: { id: b.id, name: b.name } }, "Member added successfully", 201);
    },
  },
  {
    method: "POST", pattern: "/api/business-members/remove", access: "verified", tenant: "optional",
    handler: ({ db, tenant, body }) => {
      const b = businessFor(tenant!, db, req(body, "business_id", "business"));
      adminIn(db, tenant!, b.company_id, "users.manage");
      const uid = Number(req(body, "user_id", "user"));
      if (uid === tenant!.user.id) throw conflict("You cannot remove yourself.");
      db.tables.assignments = db.tables.assignments.filter((a) => !(a.user_id === uid && a.business_id === b.id && (!body.role_id || a.role_id === Number(body.role_id))));
      return ok(null, "Member removed successfully");
    },
  },

  /* ---------------- users (existing endpoints) */
  {
    method: "GET", pattern: "/api/users", access: "verified", tenant: "optional",
    handler: ({ db, tenant }) => {
      requirePerm(tenant!, "users.view");
      const users = companyUsers(db, tenant!).map((u) => presentUser(db, u, tenant!.companyId));
      return ok({ total_users: users.length, users, pagination: { current_page: 1, per_page: users.length, total: users.length, last_page: 1 } });
    },
  },
  {
    method: "POST", pattern: "/api/users/create", access: "verified", tenant: "optional",
    handler: ({ db, tenant, body }) => {
      requirePerm(tenant!, "users.manage");
      const name = req(body, "name");
      const email = String(req(body, "email")).toLowerCase();
      if (db.tables.users.some((u) => u.email.toLowerCase() === email)) throw invalid("email", "The email has already been taken.");
      const pw = req(body, "password");
      if (String(pw).length < 8) throw invalid("password", "The password must be at least 8 characters.");
      if (tenant!.companyId) assertLimit(db, tenant!.companyId, "users");
      const u = insert(db, "users", { name, email, password: pw, email_verified_at: null, is_platform_admin: false, status: "active", phone: body.phone || null, created_by: tenant!.user.id });
      return ok(presentUser(db, u, tenant!.companyId), "User created successfully", 201);
    },
  },
  {
    method: "GET", pattern: "/api/users/detail/:id", access: "verified", tenant: "optional",
    handler: ({ db, tenant, params }) => {
      const u = companyUsers(db, tenant!).find((x) => x.id === Number(params.id));
      if (!u) throw new HttpError(404, "User not found");
      return ok(presentUser(db, u, tenant!.companyId));
    },
  },
  {
    method: "PUT", pattern: "/api/users/update/:id", access: "verified", tenant: "optional",
    handler: ({ db, tenant, params, body }) => {
      requirePerm(tenant!, "users.manage");
      const u = companyUsers(db, tenant!).find((x) => x.id === Number(params.id));
      if (!u) throw new HttpError(404, "User not found");
      const others = db.tables.assignments.filter((a) => a.user_id === u.id && a.company_id !== tenant!.companyId);
      if (others.length && u.id !== tenant!.user.id && (body.email || body.password)) throw new HttpError(403, "This user belongs to other companies; only they can change their email or password.");
      const values: Row = {};
      if (body.name) values.name = body.name;
      if (body.email) values.email = String(body.email).toLowerCase();
      if (body.password) { if (String(body.password).length < 8) throw invalid("password", "The password must be at least 8 characters."); values.password = body.password; }
      if (body.status) values.status = body.status;
      patch(u, values);
      return ok(presentUser(db, u, tenant!.companyId), "User updated successfully");
    },
  },
  {
    method: "DELETE", pattern: "/api/users/delete/:id", access: "verified", tenant: "optional",
    handler: ({ db, tenant, params }) => {
      requirePerm(tenant!, "users.manage");
      const u = companyUsers(db, tenant!).find((x) => x.id === Number(params.id));
      if (!u) throw new HttpError(404, "User not found");
      if (u.id === tenant!.user.id) throw conflict("You cannot delete yourself.");
      // Remove membership in this company; delete the account only if it has no other memberships.
      db.tables.assignments = db.tables.assignments.filter((a) => !(a.user_id === u.id && a.company_id === tenant!.companyId));
      if (!db.tables.assignments.some((a) => a.user_id === u.id)) remove(db, "users", u.id);
      return ok(null, "User removed from company");
    },
  },

  /* ---------------- roles (existing endpoints) */
  { method: "GET", pattern: "/api/roles", access: "verified", tenant: "optional", handler: ({ db, tenant }) => { const roles = rolesFor(db, tenant!).map((r) => presentRole(db, r)); return ok({ total_roles: roles.length, roles }); } },
  { method: "GET", pattern: "/api/roles/permissions", access: "verified", tenant: "optional", handler: () => ok({ permissions: PERMISSIONS }) },
  {
    method: "POST", pattern: "/api/roles/create", access: "verified", tenant: "required",
    handler: ({ db, tenant, body }) => {
      requirePerm(tenant!, "roles.manage");
      const name = req(body, "name");
      if (rolesFor(db, tenant!).some((r) => r.name.toLowerCase() === String(name).toLowerCase())) throw invalid("name", "The name has already been taken.");
      const perms: string[] = Array.isArray(body.permissions) ? body.permissions : [];
      const unknown = perms.filter((p) => !PERMISSIONS.some((x) => x.key === p));
      if (unknown.length) throw invalid("permissions", `Unknown permission ${unknown[0]}.`);
      const r = insert(db, "roles", { name, company_id: tenant!.companyId, is_system: false, permissions: perms });
      return ok(presentRole(db, r), "Role created successfully", 201);
    },
  },
  {
    method: "GET", pattern: "/api/roles/detail/:id", access: "verified", tenant: "optional",
    handler: ({ db, tenant, params }) => {
      const r = rolesFor(db, tenant!).find((x) => x.id === Number(params.id));
      if (!r) throw new HttpError(404, "Role not found");
      return ok(presentRole(db, r));
    },
  },
  {
    method: "PUT", pattern: "/api/roles/update/:id", access: "verified", tenant: "required",
    handler: ({ db, tenant, params, body }) => {
      requirePerm(tenant!, "roles.manage");
      const r = rolesFor(db, tenant!).find((x) => x.id === Number(params.id));
      if (!r) throw new HttpError(404, "Role not found");
      if (r.company_id === null) throw new HttpError(403, "System roles cannot be changed. Create a custom role instead.");
      if (body.name) r.name = body.name;
      if (Array.isArray(body.permissions)) r.permissions = body.permissions;
      patch(r, {});
      return ok(presentRole(db, r), "Role updated successfully");
    },
  },
  {
    method: "DELETE", pattern: "/api/roles/delete/:id", access: "verified", tenant: "required",
    handler: ({ db, tenant, params }) => {
      requirePerm(tenant!, "roles.manage");
      const r = rolesFor(db, tenant!).find((x) => x.id === Number(params.id));
      if (!r) throw new HttpError(404, "Role not found");
      if (r.company_id === null) throw new HttpError(403, "System roles cannot be deleted.");
      if (db.tables.assignments.some((a) => a.role_id === r.id)) throw conflict("This role is assigned to users. Remove the assignments first.");
      remove(db, "roles", r.id);
      return ok(null, "Role deleted successfully");
    },
  },
  {
    method: "POST", pattern: "/api/roles/assign", access: "verified", tenant: "optional",
    handler: ({ db, tenant, body }) => {
      const companyId = Number(req(body, "company_id", "company"));
      const t = adminIn(db, tenant!, companyId, "users.manage");
      const user = find(db, "users", req(body, "user_id", "user"));
      if (!user) throw invalid("user_id", "The selected user is invalid.");
      const businessId = checkBranch(db, t, body.business_id);
      const role = assertNoEscalation(db, t, Number(req(body, "role_id", "role")), businessId);
      if (!db.tables.assignments.some((a) => a.user_id === user.id && a.company_id === companyId)) assertLimit(db, companyId, "users");
      if (db.tables.assignments.some((a) => a.user_id === user.id && a.role_id === role.id && a.company_id === companyId && (a.business_id ?? null) === businessId)) throw conflict("This role is already assigned.");
      insert(db, "assignments", { user_id: user.id, role_id: role.id, company_id: companyId, business_id: businessId });
      return ok({ user: { id: user.id, name: user.name, email: user.email }, role_assignment: { role: { id: role.id, name: role.name }, company: { id: companyId }, business_id: businessId } }, "Role assigned successfully");
    },
  },
  {
    method: "POST", pattern: "/api/roles/remove", access: "verified", tenant: "optional",
    handler: ({ db, tenant, body }) => {
      const companyId = Number(req(body, "company_id", "company"));
      adminIn(db, tenant!, companyId, "users.manage");
      const uid = Number(req(body, "user_id", "user"));
      const rid = Number(req(body, "role_id", "role"));
      const bid = body.business_id ? Number(body.business_id) : null;
      const owner = find(db, "companies", companyId)?.owner_id;
      if (uid === owner && find(db, "roles", rid)?.name === "Company Owner") throw conflict("The company owner role cannot be removed from the owner.");
      const before = db.tables.assignments.length;
      db.tables.assignments = db.tables.assignments.filter((a) => !(a.user_id === uid && a.role_id === rid && a.company_id === companyId && (a.business_id ?? null) === bid));
      if (before === db.tables.assignments.length) throw new HttpError(404, "Assignment not found");
      return ok(null, "Role removed successfully");
    },
  },

  /* ---------------- invitations (existing endpoints) */
  {
    method: "GET", pattern: "/api/invitations", access: "verified", tenant: "required",
    handler: ({ db, tenant }) => {
      requirePerm(tenant!, "users.view");
      const items = db.tables.invitations.filter((i) => i.company_id === tenant!.companyId).map((i) => ({
        ...i,
        status: i.status === "pending" && new Date(i.expires_at) < new Date() ? "expired" : i.status,
        role: find(db, "roles", i.role_id)?.name,
        business: i.business_id ? find(db, "businesses", i.business_id)?.name : "All branches",
        accept_url: `/accept-invite?token=${i.token}&email=${encodeURIComponent(i.email)}`,
      })).reverse();
      return ok({ invitations: items, total_invitations: items.length });
    },
  },
  {
    method: "POST", pattern: "/api/invitations", access: "verified", tenant: "required",
    handler: ({ db, tenant, body }) => {
      const t = tenant!;
      requirePerm(t, "users.manage");
      const email = String(req(body, "email")).toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) throw invalid("email", "The email must be a valid email address.");
      const businessId = checkBranch(db, t, body.business_id);
      const role = assertNoEscalation(db, t, Number(req(body, "role_id", "role")), businessId);
      if (db.tables.invitations.some((i) => i.company_id === t.companyId && i.email === email && i.status === "pending")) throw invalid("email", "A pending invitation already exists for this email.");
      const existing = db.tables.users.find((u) => u.email.toLowerCase() === email);
      if (existing && db.tables.assignments.some((a) => a.user_id === existing.id && a.company_id === t.companyId)) throw invalid("email", "This user is already a member of the company.");
      assertLimit(db, t.companyId!, "users");
      const inv = insert(db, "invitations", { company_id: t.companyId, business_id: businessId, email, role_id: role.id, token: Math.random().toString(36).slice(2) + Date.now().toString(36), status: "pending", invited_by: t.user.id, invited_by_name: t.user.name, expires_at: addDays(nowIso(), 7) });
      return ok({ ...inv, accept_url: `/accept-invite?token=${inv.token}&email=${encodeURIComponent(email)}` }, "Invitation sent", 201);
    },
  },
  {
    method: "POST", pattern: "/api/invitations/:id/resend", access: "verified", tenant: "required",
    handler: ({ db, tenant, params }) => {
      requirePerm(tenant!, "users.manage");
      const inv = find(db, "invitations", params.id);
      if (!inv || inv.company_id !== tenant!.companyId) throw new HttpError(404, "Invitation not found");
      if (inv.status === "accepted") throw conflict("Invitation already accepted.");
      patch(inv, { status: "pending", token: Math.random().toString(36).slice(2) + Date.now().toString(36), expires_at: addDays(nowIso(), 7) });
      return ok({ ...inv, accept_url: `/accept-invite?token=${inv.token}&email=${encodeURIComponent(inv.email)}` }, "Invitation resent");
    },
  },
  {
    method: "DELETE", pattern: "/api/invitations/:id", access: "verified", tenant: "required",
    handler: ({ db, tenant, params }) => {
      requirePerm(tenant!, "users.manage");
      const inv = find(db, "invitations", params.id);
      if (!inv || inv.company_id !== tenant!.companyId) throw new HttpError(404, "Invitation not found");
      patch(inv, { status: "revoked" });
      return ok(null, "Invitation revoked");
    },
  },
];

export { list };
