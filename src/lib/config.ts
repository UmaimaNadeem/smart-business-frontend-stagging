/**
 * Runtime configuration (public, inlined at build time).
 *
 * NEXT_PUBLIC_USE_MOCK
 *   "hybrid" (default)  endpoints that exist in the Laravel routes/api.php go to the real API;
 *                       modules the backend does not have yet are served by the in-browser mock.
 *   "true"              everything is mocked (full demo data + demo accounts).
 *   "false"             everything goes to Laravel (new modules 404 until their APIs exist).
 * NEXT_PUBLIC_API_URL   Laravel base URL, without /api.
 */
export type ApiMode = "hybrid" | "mock" | "live";

const raw = (process.env.NEXT_PUBLIC_USE_MOCK ?? "hybrid").toLowerCase().trim();
export const API_MODE: ApiMode = raw === "true" || raw === "mock" ? "mock" : raw === "false" || raw === "live" ? "live" : "hybrid";

/** Full demo mode: demo accounts, simulated email links, demo seed data. */
export const USE_MOCK = API_MODE === "mock";
/** Some calls are served by the mock store (mock or hybrid). */
export const MOCK_ENABLED = API_MODE !== "live";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://smart-business-backend-stagging.test").replace(/\/+$/, "");

export const APP_NAME = "Smart Business";
export const TOKEN_COOKIE = "token";
export const WORKSPACE_KEY = "sb_workspace";
