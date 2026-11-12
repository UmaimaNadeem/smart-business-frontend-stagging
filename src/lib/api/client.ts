/* eslint-disable @typescript-eslint/no-explicit-any */
import { API_MODE, API_URL } from "@/lib/config";
import { adaptLive, extractListDeep } from "./adapters";
import { liveAlias, liveRoute } from "./routing";
import { ApiError } from "./errors";
import { clearToken, getToken, getWorkspace } from "./session";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  /** Query string parameters (undefined/null/"" are skipped). */
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Extra headers, e.g. Idempotency-Key. */
  headers?: Record<string, string>;
  /** Send Authorization header (default true). */
  auth?: boolean;
  /** Send X-Company-ID / X-Business-ID (default true). */
  tenant?: boolean;
}

export interface RawResponse {
  status: number;
  body: unknown;
}

/** Global listeners (e.g. subscription expired banner, forced logout). */
type Listener = (err: ApiError) => void;
const listeners = new Set<Listener>();
export function onApiError(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function buildQuery(query?: RequestOptions["query"]) {
  if (!query) return "";
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    params.set(k, String(v));
  });
  const s = params.toString();
  return s ? `?${s}` : "";
}

/**
 * The single entry point for every backend call.
 * `path` is the Laravel route WITHOUT the `/api` prefix, e.g. `/products/create`.
 */
export async function request<T = unknown>(method: HttpMethod, path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
  const { auth = true, tenant = true } = opts;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(opts.headers ?? {}),
  };

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (tenant) {
    const ws = getWorkspace();
    if (ws.companyId) headers["X-Company-ID"] = String(ws.companyId);
    if (ws.businessId) headers["X-Business-ID"] = String(ws.businessId);
  }

  // Decide per call: full mock, live Laravel, or (hybrid) live only for routes the backend has.
  let m = method, p = path, reqBody = body;
  let pattern: string | null = null;
  let target: "mock" | "live" = "mock";
  if (API_MODE !== "mock") {
    const alias = liveAlias(m, p.split("?")[0], reqBody);
    if (alias) ({ method: m, path: p, body: reqBody } = alias);
    pattern = liveRoute(m, p.split("?")[0]);
    target = API_MODE === "live" || pattern ? "live" : "mock";
  }
  const url = `/api${p}${buildQuery(opts.query)}`;
  let res: RawResponse;

  if (target === "mock") {
    const mock = await import("@/lib/mock/server");
    if (API_MODE === "hybrid" && auth) {
      delete headers.Authorization;
      const token = await hybridMockToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    res = await mock.mockFetch(m, url, headers, reqBody);
  } else {
    let response: Response;
    try {
      response = await fetch(`${API_URL}${url}`, { method: m, headers, body: reqBody !== undefined ? JSON.stringify(reqBody) : undefined });
    } catch {
      throw new ApiError(0, "Cannot reach the server. Check your connection or NEXT_PUBLIC_API_URL.");
    }
    const json = await response.json().catch(() => ({}));
    res = { status: response.status, body: json };
    if (res.status >= 200 && res.status < 300 && pattern) {
      res.body = await adaptLive(m, pattern, res.body, (lp, q) => request("GET", lp, undefined, { ...opts, query: q }));
      if (API_MODE === "hybrid" && m === "GET" && pattern.startsWith("/products/")) {
        const { mirrorProducts } = await import("@/lib/mock/server");
        mirrorProducts(getWorkspace().companyId ?? null, extractList(res.body));
      }
    }
  }

  if (res.status >= 200 && res.status < 300) return res.body as T;

  const b = (res.body ?? {}) as { message?: string; errors?: Record<string, string[]> | { code?: string } | null; code?: string };
  const errs = b.errors && typeof b.errors === "object" && !("code" in b.errors) ? (b.errors as Record<string, string[]>) : null;
  const code = b.code ?? (b.errors && typeof b.errors === "object" && "code" in b.errors ? (b.errors as { code?: string }).code ?? null : null);
  const err = new ApiError(res.status, b.message || defaultMessage(res.status), errs, code, res.body);

  // In hybrid, a 401 from a mock-served module must not log the (valid) live session out.
  if (res.status === 401 && auth && (target === "live" || API_MODE === "mock") && typeof window !== "undefined") {
    clearToken();
    const here = window.location.pathname;
    if (!["/signin", "/signup"].includes(here)) window.location.href = "/signin?expired=1";
  }
  listeners.forEach((fn) => fn(err));
  throw err;
}

function defaultMessage(status: number) {
  switch (status) {
    case 401: return "Your session has expired. Please sign in again.";
    case 402: return "Your subscription does not allow this action.";
    case 403: return "You do not have permission to do this.";
    case 404: return "Not found.";
    case 409: return "This record changed. Please reload.";
    case 422: return "Validation failed";
    case 429: return "Too many attempts. Please wait a minute.";
    default: return "Server error. Please try again.";
  }
}

export const api = {
  get: <T = unknown>(path: string, query?: RequestOptions["query"], opts?: RequestOptions) => request<T>("GET", path, undefined, { ...opts, query }),
  post: <T = unknown>(path: string, body: unknown = {}, opts?: RequestOptions) => request<T>("POST", path, body, opts),
  put: <T = unknown>(path: string, body: unknown = {}, opts?: RequestOptions) => request<T>("PUT", path, body, opts),
  del: <T = unknown>(path: string, opts?: RequestOptions) => request<T>("DELETE", path, undefined, opts),
};

/* ------------------------------------------------------------------ response helpers */

/** Laravel envelope `{ success, message, data }` -> data (or the body itself for top-level shapes). */
export function unwrap<T>(response: unknown): T {
  if (response && typeof response === "object" && "data" in (response as Record<string, unknown>)) {
    return (response as { data: T }).data;
  }
  return response as T;
}

const LIST_KEYS = [
  "items", "products", "purchases", "inwards", "outwards", "sales", "companies", "businesses", "roles",
  "users", "invitations", "members", "permissions", "records", "results", "list",
];

/** Extracts an array from the many list shapes the Laravel controllers return. */
export function extractList<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response as T[];
  if (!response || typeof response !== "object") return [];
  const obj = response as Record<string, unknown>;
  for (const key of LIST_KEYS) if (Array.isArray(obj[key])) return obj[key] as T[];
  if (obj.data !== undefined) return extractList<T>(obj.data);
  return extractListDeep<T>(obj);
}

/* ------------------------------------------------------------------ hybrid identity bridge */
let bridge: { token: string; promise: Promise<string | null> } | null = null;

/** Mirrors the live user/companies/branches into the hybrid mock store once per session token. */
async function hybridMockToken(): Promise<string | null> {
  const live = getToken();
  if (!live) return null;
  if (bridge?.token === live) return bridge.promise;
  const promise = (async () => {
    try {
      const me = await request<any>("GET", "/user", undefined, { tenant: false });
      const branches = extractList<any>(await request<any>("GET", "/businesses").catch(() => []));
      const { bridgeIdentity } = await import("@/lib/mock/server");
      return bridgeIdentity({ me: (me?.data && me.data.assignments ? me.data : me), branches });
    } catch {
      bridge = null;
      return null;
    }
  })();
  bridge = { token: live, promise };
  return promise;
}

export function newIdempotencyKey() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
