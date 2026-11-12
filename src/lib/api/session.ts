import { TOKEN_COOKIE, WORKSPACE_KEY } from "@/lib/config";

export interface Workspace {
  companyId: number | null;
  businessId: number | null;
}

export function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${TOKEN_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

/**
 * NOTE: the cookie is readable by JS so the client can send it as a Bearer token.
 * Before production, move to an httpOnly cookie set by a Next.js route handler / proxy
 * (see backend docs/TECHNICAL_ISSUES.md).
 */
export function setToken(token: string, expiresAt?: string | null) {
  const expires = expiresAt ? `; expires=${new Date(expiresAt).toUTCString()}` : "";
  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; SameSite=Lax${expires}`;
}

export function clearToken() {
  document.cookie = `${TOKEN_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function getWorkspace(): Workspace {
  if (typeof window === "undefined") return { companyId: null, businessId: null };
  try {
    const raw = window.localStorage.getItem(WORKSPACE_KEY);
    if (!raw) return { companyId: null, businessId: null };
    const ws = JSON.parse(raw) as Workspace;
    return { companyId: ws.companyId ?? null, businessId: ws.businessId ?? null };
  } catch {
    return { companyId: null, businessId: null };
  }
}

export function setWorkspace(ws: Workspace) {
  window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(ws));
}

export function clearWorkspace() {
  window.localStorage.removeItem(WORKSPACE_KEY);
}
