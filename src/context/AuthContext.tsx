"use client";
import { SYSTEM_ROLE_PERMISSIONS, expandPermissions } from "@/lib/permissions";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, extractList, onApiError, resetLiveCircuit, unwrap } from "@/lib/api/client";
import { errorMessage, isNetworkError } from "@/lib/api/errors";
import { clearToken, clearWorkspace, getToken, getWorkspace, setToken, setWorkspace, Workspace } from "@/lib/api/session";
import { USE_MOCK } from "@/lib/config";
import { setCurrency } from "@/lib/format";

export interface Assignment { role: string; company: string | null; business: string | null; role_id: number; company_id: number; business_id: number | null; permissions: string[] }
export interface Me { id: number; name: string; email: string; phone?: string | null; email_verified: boolean; is_platform_admin: boolean; assignments: Assignment[] }
export interface Branch { id: number; name: string; company_id: number }
export interface Company { id: number; name: string; currency?: string; country?: string | null; timezone?: string | null; onboarding_completed_at?: string | null; subscription_status?: string; plan_name?: string | null; account_status?: string }
export interface SubSummary { status: string; plan: string | null; trial_ends_at?: string | null; current_period_end?: string | null; grace_ends_at?: string | null; cancel_at_period_end?: boolean }

interface Ctx {
  me: Me | null;
  loading: boolean;
  companies: { id: number; name: string }[];
  branches: Branch[];
  company: Company | null;
  workspace: Workspace;
  workspaceKey: string;
  subscription: SubSummary | null;
  currency: string;
  can: (perm: string) => boolean;
  canAny: (...perms: string[]) => boolean;
  hasCompany: boolean;
  selectWorkspace: (ws: Workspace) => void;
  refresh: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  apiError: string | null;
  retryApi: () => Promise<void>;
  login: (token: string, expiresAt?: string | null) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<Ctx | null>(null);

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}

function normalizeMe(raw: unknown): Me {
  const r = raw as Record<string, unknown> | null;
  const data = r && typeof r === "object" && r.data && typeof r.data === "object" ? (r.data as Record<string, unknown>) : r;
  const user = (data && typeof data === "object" && data.user && typeof data.user === "object" && !Array.isArray(data.assignments)
    ? data.user
    : data) as Me;
  return { ...user, assignments: Array.isArray(user?.assignments) ? user.assignments : [] };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspace, setWs] = useState<Workspace>({ companyId: null, businessId: null });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [subscription, setSubscription] = useState<SubSummary | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const companies = useMemo(() => {
    const m = new Map<number, string>();
    me?.assignments.forEach((a) => m.set(a.company_id, a.company ?? `Company ${a.company_id}`));
    return Array.from(m, ([id, name]) => ({ id, name }));
  }, [me]);

  const refreshSubscription = useCallback(async () => {
    try {
      const s = unwrap<{ subscription: SubSummary & { plan_id: number } | null; plan: { name: string } | null }>(await api.get("/subscription"));
      setSubscription(s.subscription ? { ...s.subscription, plan: s.plan?.name ?? null } : null);
    } catch {
      setSubscription(null);
    }
  }, []);

  const loadWorkspace = useCallback(async (user: Me) => {
    const ids = Array.from(new Set((user.assignments ?? []).map((a) => a.company_id)));
    let ws = getWorkspace();
    if (!ws.companyId || !ids.includes(ws.companyId)) ws = { companyId: ids[0] ?? null, businessId: null };
    setWorkspace(ws);
    setWs(ws);
    if (!ws.companyId || !user.email_verified) { setBranches([]); setCompany(null); return; }
    try {
      const [b, c] = await Promise.all([api.get("/businesses"), api.get(`/companies/detail/${ws.companyId}`), refreshSubscription()]);
      const list = extractList<Branch>(b);
      setBranches(list);
      if (ws.businessId && !list.some((x) => x.id === ws.businessId)) { ws = { ...ws, businessId: null }; setWorkspace(ws); setWs(ws); }
      const co = unwrap<Company>(c);
      setCurrency(co.currency);
      setCompany(co);
      setApiError(null);
    } catch (e) {
      if (isNetworkError(e)) setApiError(errorMessage(e));
    }
  }, [refreshSubscription]);

  const refresh = useCallback(async () => {
    if (!getToken()) { setMe(null); setLoading(false); setApiError(null); return; }
    try {
      const raw = await api.get<any>("/user");
      const user = normalizeMe(raw);
      setMe(user);
      setApiError(null);
      await loadWorkspace(user);
    } catch (e) {
      setApiError(errorMessage(e));
      if (!isNetworkError(e)) setMe(null);
    } finally {
      setLoading(false);
    }
  }, [loadWorkspace]);

  const retryApi = useCallback(async () => {
    resetLiveCircuit();
    setLoading(true);
    await refresh();
  }, [refresh]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const off = onApiError((e) => {
      if (e.code === "subscription_expired" || e.code === "payment_failed") refreshSubscription();
    });
    return () => { off(); };
  }, [refreshSubscription]);

  const selectWorkspace = useCallback((ws: Workspace) => {
    setWorkspace(ws);
    setWs(ws);
    if (me) loadWorkspace(me);
  }, [me, loadWorkspace]);

  const perms = useMemo(() => {
    const set = new Set<string>();
    me?.assignments
      .filter((a) => a.company_id === workspace.companyId && (a.business_id === null || !workspace.businessId || a.business_id === workspace.businessId))
      .forEach((a) => {
        (a.permissions ?? []).forEach((p) => set.add(p));
        // Full mock only: the Laravel backend now returns the complete permission catalogue per assignment,
        // so live/hybrid use exactly what /user sends (no UI-only grants that would end in 403s).
        if (USE_MOCK && SYSTEM_ROLE_PERMISSIONS[a.role]) expandPermissions(SYSTEM_ROLE_PERMISSIONS[a.role]).forEach((p) => set.add(p));
      });
    return set;
  }, [me, workspace]);

  const can = useCallback((p: string) => perms.has(p), [perms]);
  const canAny = useCallback((...ps: string[]) => ps.some((p) => perms.has(p)), [perms]);

  const login = useCallback(async (token: string, expiresAt?: string | null) => {
    setToken(token, expiresAt);
    clearWorkspace();
    setLoading(true);
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    // Clear the cookie first so a hanging Laravel call cannot trap the session.
    clearToken();
    clearWorkspace();
    setMe(null);
    window.location.replace("/signin");
  }, []);

  const value: Ctx = {
    me, loading, companies, branches, company, workspace, subscription,
    workspaceKey: `${workspace.companyId}:${workspace.businessId}`,
    currency: company?.currency || "PKR",
    can, canAny, hasCompany: companies.length > 0,
    selectWorkspace, refresh, refreshSubscription, login, logout, apiError, retryApi,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { USE_MOCK };
