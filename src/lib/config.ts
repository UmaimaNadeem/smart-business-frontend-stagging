/**
 * Runtime configuration (public, inlined at build time).
 *
 * NEXT_PUBLIC_USE_MOCK
 *   "false" (default)   everything goes to the Laravel 12 backend (all MVP modules are implemented there).
 *   "hybrid"            every endpoint the backend implements (src/lib/api/routing.ts) goes to Laravel;
 *                       only an unknown path falls back to the in-browser mock. Same result as "false"
 *                       with the current backend.
 *   "true"              everything is mocked offline (demo accounts like owner@demo.test / Demo@1234).
 * NEXT_PUBLIC_API_URL   Laravel base URL, without /api.
 */
export type ApiMode = "hybrid" | "mock" | "live";

const raw = (process.env.NEXT_PUBLIC_USE_MOCK ?? "false").toLowerCase().trim();
export const API_MODE: ApiMode = raw === "true" || raw === "mock" ? "mock" : raw === "false" || raw === "live" ? "live" : "hybrid";

/** Full demo mode: demo accounts, simulated email links, demo seed data. */
export const USE_MOCK = API_MODE === "mock";
/** The mock store may serve calls (full mock, or hybrid fallback for paths the backend lacks). */
export const MOCK_ENABLED = API_MODE !== "live";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://smart-business-backend-stagging.test").replace(/\/+$/, "");

export const APP_NAME = "Smart Business";
export const TOKEN_COOKIE = "token";
export const WORKSPACE_KEY = "sb_workspace";
