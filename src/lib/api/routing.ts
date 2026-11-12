/**
 * Which endpoints already exist in the Laravel backend (backend/routes/api.php).
 * In hybrid mode these go to the real API; everything else is served by the mock store.
 */
import type { HttpMethod } from "./client";

const LIVE: [HttpMethod, string][] = [
  // auth
  ["POST", "/register"], ["POST", "/login"], ["POST", "/password/forgot"], ["POST", "/password/reset"],
  ["GET", "/email/verify/:id/:hash"], ["POST", "/email/resend"], ["POST", "/auth/logout"], ["POST", "/auth/logout-all"], ["GET", "/user"],
  // invitations
  ["GET", "/invitations/token/:token"], ["POST", "/invitations/accept"], ["GET", "/invitations"], ["POST", "/invitations"],
  ["POST", "/invitations/:id/resend"], ["DELETE", "/invitations/:id"],
  // platform (existing only)
  ["GET", "/platform/companies"], ["GET", "/platform/users"],
  // companies / businesses / users / roles / members
  ["GET", "/companies"], ["POST", "/companies/create"], ["GET", "/companies/detail/:id"], ["PUT", "/companies/update/:id"],
  ["DELETE", "/companies/delete/:id"], ["GET", "/companies/:id/structure"],
  ["GET", "/businesses"], ["GET", "/users/:id/businesses"], ["POST", "/businesses/create"], ["GET", "/businesses/detail/:id"],
  ["PUT", "/businesses/update/:id"], ["DELETE", "/businesses/delete/:id"],
  ["POST", "/business-members/add"], ["GET", "/business-members/:businessId"], ["POST", "/business-members/remove"],
  ["GET", "/users"], ["POST", "/users/create"], ["GET", "/users/detail/:id"], ["PUT", "/users/update/:id"], ["DELETE", "/users/delete/:id"],
  ["GET", "/roles"], ["GET", "/roles/permissions"], ["POST", "/roles/create"], ["GET", "/roles/detail/:id"], ["PUT", "/roles/update/:id"],
  ["DELETE", "/roles/delete/:id"], ["POST", "/roles/assign"], ["POST", "/roles/remove"],
  // products
  ["GET", "/products/all"], ["GET", "/products/business/:businessId"], ["POST", "/products/create"], ["PUT", "/products/update/:id"],
  ["DELETE", "/products/delete/:id"], ["POST", "/products/:id/increase-stock"], ["POST", "/products/:id/decrease-stock"],
  ["GET", "/products/business/:businessId/low-stock"],
  // purchases + inwards
  ["GET", "/purchases/inwards/pending"], ["GET", "/purchases/inwards/:id"], ["POST", "/purchases/inwards/:id/tally"],
  ["GET", "/purchases"], ["GET", "/purchases/business/:id"], ["POST", "/purchases/create"], ["GET", "/purchases/:id"],
  ["PUT", "/purchases/:id"], ["DELETE", "/purchases/:id"], ["POST", "/purchases/status/:id"], ["POST", "/purchases/:id/confirmed"],
  // sales + outwards
  ["GET", "/sales/outwards/pending"], ["GET", "/sales/outwards/:id"], ["POST", "/sales/outwards/:id/dispatch"], ["POST", "/sales/outwards/:id/delivered"],
  ["GET", "/sales"], ["GET", "/sales/business/:id"], ["POST", "/sales/create"], ["GET", "/sales/:id"], ["PUT", "/sales/:id"],
  ["DELETE", "/sales/:id"], ["POST", "/sales/:id/confirmed"],
];

const compiled = LIVE.map(([m, p]) => ({ m, p, re: new RegExp("^" + p.replace(/:[a-zA-Z]+/g, "[^/]+") + "/?$") }));

/** Path is the part after /api, without the query string. */
export function liveRoute(method: HttpMethod, path: string): string | null {
  const hit = compiled.find((r) => r.m === method && r.re.test(path));
  return hit ? hit.p : null;
}

/**
 * Aliases used when the screen asks for a contract-only path that the live backend
 * covers with a different existing route. Returns the rewritten request or null.
 */
export function liveAlias(method: HttpMethod, path: string, body: unknown): { method: HttpMethod; path: string; body: unknown } | null {
  if (method === "GET" && path === "/purchases/inwards/all") return { method, path: "/purchases/inwards/pending", body };
  if (method === "GET" && path === "/sales/outwards/all") return { method, path: "/sales/outwards/pending", body };
  const cancel = path.match(/^\/purchases\/([^/]+)\/cancel$/);
  if (method === "POST" && cancel) return { method, path: `/purchases/status/${cancel[1]}`, body: { status: "cancelled", ...(body as object) } };
  return null;
}
