/**
 * Endpoints implemented by the Laravel 12 backend (smart-business-backend/routes/api.php,
 * every route under /api). In hybrid mode these go to the real API; only a path that is NOT
 * listed here falls back to the in-browser mock store. In live mode (NEXT_PUBLIC_USE_MOCK=false)
 * everything goes to Laravel and this list only decides which response adapter runs.
 *
 * Keep this list in sync with `php artisan route:list --path=api`.
 */
import type { HttpMethod } from "./client";

const LIVE: [HttpMethod, string][] = [
  // login
  ["POST", "/login"],
  // register
  ["POST", "/register"],
  // password
  ["POST", "/password/forgot"], ["POST", "/password/reset"],
  // email
  ["POST", "/email/resend"], ["GET", "/email/verify/:id/:hash"],
  // auth
  ["POST", "/auth/logout"], ["POST", "/auth/logout-all"],
  // user
  ["GET", "/user"], ["PUT", "/user/password"], ["PUT", "/user/profile"],
  // invitations
  ["GET", "/invitations"], ["POST", "/invitations"], ["DELETE", "/invitations/:id"], ["POST", "/invitations/:id/resend"],
  ["POST", "/invitations/accept"], ["GET", "/invitations/token/:token"],
  // platform
  ["GET", "/platform/companies"], ["PUT", "/platform/companies/:id/status"], ["GET", "/platform/events"],
  ["GET", "/platform/payments"], ["GET", "/platform/plans"], ["POST", "/platform/plans"], ["PUT", "/platform/plans/:id"],
  ["GET", "/platform/settings"], ["PUT", "/platform/settings"], ["GET", "/platform/subscriptions"],
  ["PUT", "/platform/subscriptions/:id"], ["GET", "/platform/users"], ["PUT", "/platform/users/:id/status"],
  // companies
  ["GET", "/companies"], ["GET", "/companies/:id/structure"], ["POST", "/companies/create"],
  ["DELETE", "/companies/delete/:id"], ["GET", "/companies/detail/:id"], ["PUT", "/companies/update/:id"],
  // businesses
  ["GET", "/businesses"], ["POST", "/businesses/create"], ["DELETE", "/businesses/delete/:id"],
  ["GET", "/businesses/detail/:id"], ["PUT", "/businesses/update/:id"],
  // business-members
  ["GET", "/business-members/:businessId"], ["POST", "/business-members/add"], ["POST", "/business-members/remove"],
  // users
  ["GET", "/users"], ["GET", "/users/:id/businesses"], ["POST", "/users/create"], ["DELETE", "/users/delete/:id"],
  ["GET", "/users/detail/:id"], ["PUT", "/users/update/:id"],
  // roles
  ["GET", "/roles"], ["POST", "/roles/assign"], ["POST", "/roles/create"], ["DELETE", "/roles/delete/:id"],
  ["GET", "/roles/detail/:id"], ["GET", "/roles/permissions"], ["POST", "/roles/remove"], ["PUT", "/roles/update/:id"],
  // subscription
  ["GET", "/subscription"], ["POST", "/subscription/cancel"], ["POST", "/subscription/change"],
  ["GET", "/subscription/events"], ["GET", "/subscription/invoices"], ["POST", "/subscription/invoices/:id/pay"],
  ["GET", "/subscription/plans"], ["POST", "/subscription/resume"],
  // onboarding
  ["POST", "/onboarding/complete"],
  // products
  ["POST", "/products/:id/decrease-stock"], ["POST", "/products/:id/increase-stock"], ["GET", "/products/all"],
  ["GET", "/products/business/:businessId"], ["GET", "/products/business/:businessId/low-stock"],
  ["POST", "/products/create"], ["DELETE", "/products/delete/:id"], ["GET", "/products/detail/:id"],
  ["GET", "/products/low-stock"], ["PUT", "/products/update/:id"],
  // units
  ["GET", "/units"], ["POST", "/units"], ["DELETE", "/units/:id"], ["PUT", "/units/:id"],
  // warehouses
  ["GET", "/warehouses"], ["POST", "/warehouses"], ["DELETE", "/warehouses/:id"], ["GET", "/warehouses/:id"],
  ["PUT", "/warehouses/:id"],
  // stock
  ["GET", "/stock/adjustments"], ["POST", "/stock/adjustments"], ["GET", "/stock/balances"], ["GET", "/stock/movements"],
  ["GET", "/stock/transfers"], ["POST", "/stock/transfers"],
  // suppliers
  ["GET", "/suppliers"], ["POST", "/suppliers"], ["DELETE", "/suppliers/:id"], ["GET", "/suppliers/:id"],
  ["PUT", "/suppliers/:id"],
  // customers
  ["GET", "/customers"], ["POST", "/customers"], ["DELETE", "/customers/:id"], ["GET", "/customers/:id"],
  ["PUT", "/customers/:id"],
  // purchases
  ["GET", "/purchases"], ["DELETE", "/purchases/:id"], ["GET", "/purchases/:id"], ["PUT", "/purchases/:id"],
  ["POST", "/purchases/:id/cancel"], ["POST", "/purchases/:id/confirmed"], ["GET", "/purchases/business/:id"],
  ["POST", "/purchases/create"], ["GET", "/purchases/inwards/:id"], ["POST", "/purchases/inwards/:id/tally"],
  ["GET", "/purchases/inwards/all"], ["GET", "/purchases/inwards/pending"], ["POST", "/purchases/status/:id"],
  // purchase-returns
  ["GET", "/purchase-returns"], ["POST", "/purchase-returns"], ["GET", "/purchase-returns/:id"],
  // sales
  ["GET", "/sales"], ["DELETE", "/sales/:id"], ["GET", "/sales/:id"], ["PUT", "/sales/:id"],
  ["POST", "/sales/:id/cancel"], ["POST", "/sales/:id/confirmed"], ["GET", "/sales/business/:id"],
  ["POST", "/sales/create"], ["GET", "/sales/outwards/:id"], ["POST", "/sales/outwards/:id/delivered"],
  ["POST", "/sales/outwards/:id/dispatch"], ["GET", "/sales/outwards/all"], ["GET", "/sales/outwards/pending"],
  // sales-returns
  ["GET", "/sales-returns"], ["POST", "/sales-returns"], ["GET", "/sales-returns/:id"],
  // payment-methods
  ["GET", "/payment-methods"], ["POST", "/payment-methods"], ["DELETE", "/payment-methods/:id"],
  ["PUT", "/payment-methods/:id"],
  // expense-categories
  ["GET", "/expense-categories"], ["POST", "/expense-categories"], ["DELETE", "/expense-categories/:id"],
  ["PUT", "/expense-categories/:id"],
  // accounts
  ["GET", "/accounts"], ["POST", "/accounts"], ["DELETE", "/accounts/:id"], ["PUT", "/accounts/:id"],
  // cash-bank-accounts
  ["GET", "/cash-bank-accounts"], ["POST", "/cash-bank-accounts"], ["PUT", "/cash-bank-accounts/:id"],
  // reconciliation
  ["GET", "/reconciliation"], ["POST", "/reconciliation/toggle"],
  // payments
  ["GET", "/payments"], ["POST", "/payments"], ["GET", "/payments/:id"], ["POST", "/payments/:id/void"],
  // receivables
  ["GET", "/receivables"],
  // payables
  ["GET", "/payables"],
  // expenses
  ["GET", "/expenses"], ["POST", "/expenses"], ["POST", "/expenses/:id/void"],
  // journals
  ["GET", "/journals"], ["POST", "/journals"], ["GET", "/journals/:id"], ["POST", "/journals/:id/reverse"],
  // ledger
  ["GET", "/ledger"],
  // trial-balance
  ["GET", "/trial-balance"],
  // reports
  ["GET", "/reports/balance-sheet"], ["GET", "/reports/cash-flow"], ["GET", "/reports/expenses"],
  ["GET", "/reports/low-stock"], ["GET", "/reports/profit-loss"], ["GET", "/reports/purchases"],
  ["GET", "/reports/sales"], ["GET", "/reports/stock-valuation"],
  // dashboard
  ["GET", "/dashboard/summary"],
];

// Static segments must win over :params (e.g. /sales/outwards/all before /sales/outwards/:id).
const compiled = LIVE
  .map(([m, p], i) => ({ m, p, i, params: (p.match(/:/g) ?? []).length, re: new RegExp("^" + p.replace(/:[a-zA-Z]+/g, "[^/]+") + "/?$") }))
  .sort((a, b) => a.params - b.params || a.i - b.i);

/** Path is the part after /api, without the query string. */
export function liveRoute(method: HttpMethod, path: string): string | null {
  const hit = compiled.find((r) => r.m === method && r.re.test(path));
  return hit ? hit.p : null;
}

/**
 * Aliases for a contract path the live backend does not have, rewritten to an existing route.
 * Only consulted when `liveRoute` finds no match, so it never rewrites a real backend endpoint.
 * The new backend implements /purchases/inwards/all, /sales/outwards/all and
 * /purchases/:id/cancel natively, so the old pending/status rewrites were removed.
 */
export function liveAlias(method: HttpMethod, path: string, body: unknown): { method: HttpMethod; path: string; body: unknown } | null {
  void method; void path; void body;
  return null;
}
