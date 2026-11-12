/* eslint-disable @typescript-eslint/no-explicit-any */
import { DB, Row, addDays, find, insert, nowIso, patch } from "../db";
import { HttpError, bootstrapCompany, invalid, req } from "../engine";
import { Route, loadAssignments, ok, raw } from "../router";

function token(db: DB, userId: number) {
  const t = `mock_${userId}_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  db.tokens[t] = userId;
  return t;
}

export function tokenPayload(db: DB, user: Row) {
  return {
    access_token: token(db, user.id),
    token_type: "Bearer",
    expires_at: addDays(nowIso(), 7),
    email_verified: !!user.email_verified_at,
  };
}

export function presentMe(db: DB, user: Row) {
  const assignments = loadAssignments(db, user.id).map((r) => ({
    role: r.role,
    company: find(db, "companies", r.company_id)?.name ?? null,
    business: r.business_id ? find(db, "businesses", r.business_id)?.name ?? null : null,
    role_id: r.role_id,
    company_id: r.company_id,
    business_id: r.business_id,
    permissions: r.permissions,
  }));
  return { id: user.id, name: user.name, email: user.email, phone: user.phone ?? null, email_verified: !!user.email_verified_at, is_platform_admin: !!user.is_platform_admin, assignments };
}

function password(body: Row, field = "password") {
  const p = req(body, field);
  if (String(p).length < 8) throw invalid(field, "The password must be at least 8 characters.");
  if (body.password_confirmation !== undefined && body.password_confirmation !== p) throw invalid(field, "The password confirmation does not match.");
  return String(p);
}

export const authRoutes: Route[] = [
  {
    method: "POST", pattern: "/api/login", access: "public",
    handler: ({ db, body }) => {
      req(body, "email"); req(body, "password");
      const user = db.tables.users.find((u) => u.email.toLowerCase() === String(body.email).toLowerCase());
      if (!user || user.password !== body.password) return raw({ success: false, message: "Invalid credentials" }, 401);
      if (user.status === "suspended") return raw({ success: false, message: "This account is suspended." }, 403);
      return raw(tokenPayload(db, user));
    },
  },
  {
    method: "POST", pattern: "/api/register", access: "public",
    handler: ({ db, body }) => {
      if (db.settings.allow_public_registration === false) throw new HttpError(403, "Registration is currently closed.");
      const name = req(body, "name");
      const email = String(req(body, "email")).toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) throw invalid("email", "The email must be a valid email address.");
      if (db.tables.users.some((u) => u.email.toLowerCase() === email)) throw invalid("email", "The email has already been taken.");
      const pw = password(body);
      const companyName = req(body, "company_name", "company name");
      const user = insert(db, "users", { name, email, password: pw, email_verified_at: null, is_platform_admin: false, status: "active", phone: null, created_by: null });
      const company = insert(db, "companies", { name: companyName, owner_id: user.id, currency: "PKR", country: null, timezone: null, address: null, phone: null, email: null, tax_number: null, status: 1, account_status: "active", onboarding_completed_at: null });
      insert(db, "businesses", { company_id: company.id, name: "Main Branch", type: "branch", address: null, status: 1 });
      const ownerRole = db.tables.roles.find((r) => r.name === "Company Owner" && r.company_id === null)!;
      insert(db, "assignments", { user_id: user.id, role_id: ownerRole.id, company_id: company.id, business_id: null });
      bootstrapCompany(db, company.id, { planCode: "growth", trial: true });
      return raw({ ...tokenPayload(db, user), message: "Registered. Please verify your email address." }, 201);
    },
  },
  {
    method: "POST", pattern: "/api/password/forgot", access: "public",
    handler: ({ db, body }) => {
      const email = String(req(body, "email")).toLowerCase();
      const user = db.tables.users.find((u) => u.email.toLowerCase() === email);
      const resp: Row = { success: true, message: "If that email exists, a reset link has been sent." };
      if (user) {
        const t = Math.random().toString(36).slice(2, 12);
        db.resetTokens[t] = email;
        resp.mock_reset_url = `/reset-password?token=${t}&email=${encodeURIComponent(email)}`;
      }
      return raw(resp);
    },
  },
  {
    method: "POST", pattern: "/api/password/reset", access: "public",
    handler: ({ db, body }) => {
      const t = req(body, "token");
      const email = String(req(body, "email")).toLowerCase();
      const pw = password(body);
      if (db.resetTokens[t] !== email) throw invalid("email", "This password reset token is invalid.");
      const user = db.tables.users.find((u) => u.email.toLowerCase() === email)!;
      patch(user, { password: pw });
      delete db.resetTokens[t];
      Object.keys(db.tokens).forEach((k) => db.tokens[k] === user.id && delete db.tokens[k]);
      return raw({ success: true, message: "Your password has been reset." });
    },
  },
  {
    // Real backend: signed link from the email, then redirect to FRONTEND_URL/signin?verified=1.
    method: "GET", pattern: "/api/email/verify/:id/:hash", access: "public",
    handler: ({ db, params }) => {
      const user = find(db, "users", params.id);
      if (!user) throw new HttpError(404, "User not found");
      if (!user.email_verified_at) patch(user, { email_verified_at: nowIso() });
      return raw({ success: true, message: "Email verified.", redirect: "/signin?verified=1" });
    },
  },
  {
    method: "POST", pattern: "/api/email/resend", access: "auth",
    handler: ({ user }) => raw({ success: true, message: user!.email_verified_at ? "Email already verified." : "Verification link sent." }),
  },
  {
    method: "POST", pattern: "/api/auth/logout", access: "auth",
    handler: ({ db, token: t }) => { if (t) delete db.tokens[t]; return raw({ message: "Logged out" }); },
  },
  {
    method: "POST", pattern: "/api/auth/logout-all", access: "auth",
    handler: ({ db, user }) => { Object.keys(db.tokens).forEach((k) => db.tokens[k] === user!.id && delete db.tokens[k]); return raw({ message: "Logged out from all devices" }); },
  },
  { method: "GET", pattern: "/api/user", access: "auth", tenant: "optional", handler: ({ db, user }) => raw(presentMe(db, user!)) },
  {
    // NEW: profile update for the signed-in user.
    method: "PUT", pattern: "/api/user/profile", access: "auth",
    handler: ({ db, user, body }) => {
      const values: Row = {};
      if (body.name !== undefined) values.name = req(body, "name");
      if (body.phone !== undefined) values.phone = body.phone || null;
      if (body.email !== undefined) {
        const email = String(req(body, "email")).toLowerCase();
        if (db.tables.users.some((u) => u.id !== user!.id && u.email.toLowerCase() === email)) throw invalid("email", "The email has already been taken.");
        if (email !== user!.email.toLowerCase()) values.email_verified_at = null;
        values.email = email;
      }
      patch(user!, values);
      return ok(presentMe(db, user!), "Profile updated");
    },
  },
  {
    // NEW: change password (revokes other tokens).
    method: "PUT", pattern: "/api/user/password", access: "auth",
    handler: ({ db, user, body, token: t }) => {
      if (user!.password !== body.current_password) throw invalid("current_password", "The current password is incorrect.");
      const pw = password(body);
      patch(user!, { password: pw });
      Object.keys(db.tokens).forEach((k) => db.tokens[k] === user!.id && k !== t && delete db.tokens[k]);
      return ok(null, "Password changed. Other devices were signed out.");
    },
  },
  {
    method: "GET", pattern: "/api/invitations/token/:token", access: "public",
    handler: ({ db, params }) => {
      const inv = db.tables.invitations.find((i) => i.token === params.token);
      if (!inv) throw new HttpError(404, "Invitation not found");
      const expired = inv.status === "expired" || new Date(inv.expires_at) < new Date();
      if (inv.status !== "pending" || expired) throw new HttpError(410, expired ? "This invitation has expired." : `This invitation was ${inv.status}.`);
      const existing = db.tables.users.find((u) => u.email.toLowerCase() === inv.email.toLowerCase());
      return ok({
        email: inv.email,
        company: find(db, "companies", inv.company_id)?.name,
        business: inv.business_id ? find(db, "businesses", inv.business_id)?.name : null,
        role: find(db, "roles", inv.role_id)?.name,
        expires_at: inv.expires_at,
        existing_user: !!existing,
      });
    },
  },
  {
    method: "POST", pattern: "/api/invitations/accept", access: "public",
    handler: ({ db, body }) => {
      const inv = db.tables.invitations.find((i) => i.token === req(body, "token"));
      if (!inv || inv.status !== "pending" || new Date(inv.expires_at) < new Date()) throw new HttpError(410, "This invitation is no longer valid.");
      let user = db.tables.users.find((u) => u.email.toLowerCase() === inv.email.toLowerCase());
      if (user) {
        if (user.password !== body.password) throw invalid("password", "The password is incorrect.");
      } else {
        const name = req(body, "name");
        const pw = password(body);
        user = insert(db, "users", { name, email: inv.email, password: pw, email_verified_at: nowIso(), is_platform_admin: false, status: "active", phone: null, created_by: inv.invited_by });
      }
      if (!db.tables.assignments.some((a) => a.user_id === user!.id && a.company_id === inv.company_id && a.business_id === inv.business_id && a.role_id === inv.role_id)) {
        insert(db, "assignments", { user_id: user.id, role_id: inv.role_id, company_id: inv.company_id, business_id: inv.business_id });
      }
      patch(inv, { status: "accepted", accepted_at: nowIso(), accepted_user_id: user.id });
      return raw({ success: true, message: "Invitation accepted", ...tokenPayload(db, user) });
    },
  },
];
