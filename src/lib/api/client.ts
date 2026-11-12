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

/* ------------------------------------------------------------------ live reachability */

/** Fail fast instead of hanging when Laravel/DNS does not respond. */
const LIVE_TIMEOUT_MS = 5000;
/** After a timeout, skip live calls for this long so every click is not another 5s wait. */
const CIRCUIT_COOLDOWN_MS = 15000;
/** Reuse identical GET responses briefly (auth bootstrap hits /user and /businesses more than once). */
const GET_CACHE_MS = 8000;

let circuitOpenUntil = 0;
const getCache = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

export type LiveStatus = { ok: boolean; url: string; message: string | null };
let liveStatus: LiveStatus = { ok: true, url: API_URL, message: null };
const liveListeners = new Set<(s: LiveStatus) => void>();

export function getLiveStatus() {
  return liveStatus;
}
export function onLiveStatus(fn: (s: LiveStatus) => void) {
  liveListeners.add(fn);
  fn(liveStatus);
  return () => liveListeners.delete(fn);
}
function setLiveStatus(ok: boolean, message: string | null = null) {
  liveStatus = { ok, url: API_URL, message };
  liveListeners.forEach((fn) => fn(liveStatus));
}

/** Call before a manual retry so the next request hits Laravel immediately. */
export function resetLiveCircuit() {
  circuitOpenUntil = 0;
  getCache.clear();
  setLiveStatus(true, null);
}

function cacheKey(method: string, path: string, query?: RequestOptions["query"], tenant?: boolean) {
  const ws = tenant === false ? "" : `${getWorkspace().companyId}:${getWorkspace().businessId}`;
  return `${method} ${path}${buildQuery(query)}|${ws}`;
}

function networkError() {
  return new ApiError(
    0,
    `Cannot reach the API at ${API_URL}. Check that Laravel is running, or set NEXT_PUBLIC_USE_MOCK=true for a full demo.`,
  );
}

async function liveFetch(method: HttpMethod, url: string, headers: Record<string, string>, reqBody: unknown): Promise<Response> {
  if (Date.now() < circuitOpenUntil) throw networkError();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LIVE_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_URL}${url}`, {
      method,
      headers,
      body: reqBody !== undefined ? JSON.stringify(reqBody) : undefined,
      signal: ctrl.signal,
    });
    circuitOpenUntil = 0;
    if (!liveStatus.ok) setLiveStatus(true, null);
    return response;
  } catch (err) {
    circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
    setLiveStatus(false, networkError().message);
    if (err instanceof ApiError) throw err;
    throw networkError();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The single entry point for every backend call.
 * `path` is the Laravel route WITHOUT the `/api` prefix, e.g. `/products/create`.
 */
export async function request<T = unknown>(method: HttpMethod, path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
  const { auth = true, tenant = true } = opts;
  if (method === "GET") {
    const key = cacheKey(method, path, opts.query, tenant);
    const cached = getCache.get(key);
    if (cached && Date.now() - cached.at < GET_CACHE_MS) return cached.value as T;
    const pending = inflight.get(key);
    if (pending) return pending as Promise<T>;
    const promise = requestInner<T>(method, path, body, opts).then((value) => {
      getCache.set(key, { at: Date.now(), value });
      return value;
    }).finally(() => inflight.delete(key));
    inflight.set(key, promise);
    return promise;
  }
  getCache.clear();
  return requestInner<T>(method, path, body, opts);
}

async function requestInner<T = unknown>(method: HttpMethod, path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
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

  // Decide per call: full mock, live Laravel, or (hybrid) live for every route the backend has (routing.ts).
  let m = method, p = path, reqBody = body;
  let pattern: string | null = null;
  let target: "mock" | "live" = "mock";
  if (API_MODE !== "mock") {
    pattern = liveRoute(m, p.split("?")[0]);
    if (!pattern) {
      // Only rewrite paths the backend does not implement; never touch a real Laravel route.
      const alias = liveAlias(m, p.split("?")[0], reqBody);
      if (alias) ({ method: m, path: p, body: reqBody } = alias);
      pattern = alias ? liveRoute(m, p.split("?")[0]) : null;
    }
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
      response = await liveFetch(m, url, headers, reqBody);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      throw networkError();
    }
    const json = await response.json().catch(() => ({}));
    res = { status: response.status, body: json };
    if (res.status >= 200 && res.status < 300 && pattern) {
      res.body = await adaptLive(m, pattern, res.body, (lp, q) => request("GET", lp, undefined, { ...opts, query: q }));
      // Keep the hybrid mock's product copy current for any module still served by the mock (lists only).
      if (API_MODE === "hybrid" && m === "GET" && (pattern === "/products/all" || pattern === "/products/business/:businessId")) {
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
