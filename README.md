# Smart Business — Frontend

Next.js 16 / React 19 / Tailwind 4 (TailAdmin UI components). Multi-tenant ERP: inventory, purchasing, sales, finance, accounting, reports, subscriptions, platform admin.

## Run
```bash
npm install
cp .env.example .env.local   # optional
npm run dev                  # http://localhost:3000
npm run build && npm start
```

## Demo data vs live API
| Variable | Default | Meaning |
|---|---|---|
| `NEXT_PUBLIC_USE_MOCK` | `false` | `false` = everything to Laravel (default). `hybrid` = every backend-implemented endpoint live, mock only for unknown paths. `true` = full in-browser mock with demo data. |
| `NEXT_PUBLIC_API_URL` | `http://smart-business-backend-stagging.test` | Laravel base URL (the client adds `/api`). |

All requests go through `src/lib/api/client.ts` (Bearer token, `Accept: application/json`, `X-Company-ID`, `X-Business-ID`). The mock (`src/lib/mock/*`) implements the same paths and payloads, so switching is only the env var. Contract for the backend: **API_CONTRACT.md**.

Reset demo data (full mock only): user menu → **Reset demo data**.

## API modes (`NEXT_PUBLIC_USE_MOCK`)
| Value | What happens |
|---|---|
| `false` (**default**, also when unset) | Everything goes to the Laravel 12 backend at `NEXT_PUBLIC_API_URL`. The backend now implements every MVP module, so this is the normal setting. |
| `hybrid` | Every endpoint the backend implements (the full list in `src/lib/api/routing.ts`, generated from `php artisan route:list --path=api`) goes to Laravel. Only a path that is not in that list falls back to the in-browser mock. With the current backend this behaves the same as `false`. |
| `true` | Full offline mock with demo data. **The `Demo@1234` demo accounts only work in this mode.** |

To switch modes, set the value in `.env.local` and restart `npm run dev`, or rebuild. The value is inlined at build time.

**Logins against the new backend** (`false` or `hybrid`, after `php artisan migrate:fresh --seed`), password `Password123!`:
- `admin@smartbusiness.test` (platform admin)
- `owner@metrotraders.test` (company owner, about six months of demo data; start here)
- `manager@metrotraders.test`, `sales@metrotraders.test` (Lahore branch only), `warehouse@metrotraders.test`
- `owner@northwind.test` (second company, for the isolation check)

The mock-only `…@demo.test / Demo@1234` accounts do not exist in Laravel.

**Live modules** (all in `routing.ts`):
- Auth and profile: `/register`, `/login`, `/password/*`, `/email/*`, `/auth/logout*`, `/user`, `/user/profile`, `/user/password`, `/onboarding/complete`
- Organisation: `/companies*`, `/businesses*`, `/users*`, `/roles*`, `/business-members*`, `/invitations*`
- Inventory: `/products/*` (including `/products/detail/:id` and `/products/low-stock`), `/units`, `/warehouses`, `/stock/{balances, movements, adjustments, transfers}`
- Parties: `/suppliers`, `/customers`
- Purchasing: `/purchases*` (including `/purchases/:id/cancel`), `/purchases/inwards/{all, pending, :id, :id/tally}`, `/purchase-returns`
- Sales: `/sales*` (including `/sales/:id/cancel`), `/sales/outwards/{all, pending, :id, :id/dispatch, :id/delivered}`, `/sales-returns`
- Finance: `/payment-methods`, `/expense-categories`, `/cash-bank-accounts`, `/reconciliation*`, `/payments*`, `/receivables`, `/payables`, `/expenses*`
- Accounting: `/accounts`, `/journals*`, `/ledger`, `/trial-balance`
- Reports: `/reports/*`, `/dashboard/summary`
- Billing: `/subscription*`
- Platform admin: `/platform/{companies, users, plans, subscriptions, payments, events, settings}`

There are no path aliases any more. `/purchases/inwards/all` and `/sales/outwards/all` go to the real `all` endpoints (full history), and purchase cancel uses `POST /purchases/:id/cancel`.

**Response adapters** (`src/lib/api/adapters.ts`) still run on live responses. The new backend already returns the flat shapes the screens use, so they mostly pass data through. They are kept as a fallback for older payloads:
- defensive `extractList`/`extractItem`;
- `price` → `selling_price`; `supplier`/`business` objects → names; `{purchase}` unwrapped;
- legacy statuses only: purchase/sale `pending` → `draft`, outward `out_for_delivery` → `dispatched`. Inward `completed` is kept as `completed` (the inward screens use it), and returns are not touched;
- all pages of `/users` are loaded.

**Headers and errors:** every call sends `Authorization: Bearer`, `Accept: application/json`, `X-Company-ID` and `X-Business-ID`. Dispatch and delivery send an `Idempotency-Key`. The error `code` is read from the top level (`plan_limit_reached`, `subscription_expired`, `payment_failed` → 402; `company_required`, `downgrade_blocked` → 422). Live calls time out after 5 seconds, and a circuit breaker pauses live calls for 15 seconds after a timeout.

**Permissions:** in `false`/`hybrid` the UI uses exactly the permissions `/user` returns (the backend catalogue now covers every module). Only full mock adds the frontend's system-role defaults.

## Demo accounts (password `Demo@1234`, only with `NEXT_PUBLIC_USE_MOCK=true`)
| Email | Scenario |
|---|---|
| owner@demo.test | Company Owner, Al-Noor Traders (Growth plan, 2 branches, 3 warehouses) |
| manager@demo.test | Manager, Karachi Branch only |
| staff@demo.test | Warehouse staff (view + tally inwards + dispatch) |
| accountant@demo.test | Custom "Accountant" role in two companies (company switcher) |
| owner@greenvalley.test | Second tenant, payment failed → grace period |
| owner@expiredmart.test | Expired trial → read-only |
| admin@smartbusiness.test | Platform admin |

Pending invitation link: `/accept-invite?token=demo-invite-token-123`.

## Routes
- Auth: `/signin` (`?verified=1`), `/signup`, `/verify-email`, `/forgot-password`, `/reset-password`, `/accept-invite`, `/onboarding`
- Dashboard: `/`
- Inventory: `/products`, `/products/[id]`, `/units`, `/warehouses`, `/warehouses/[id]`, `/stock/balances`, `/stock/movements`, `/stock/adjustments`, `/stock/transfers`
- Purchasing: `/suppliers`, `/suppliers/[id]`, `/purchases`, `/purchases/new`, `/purchases/[id]`, `/purchases/[id]/edit`, `/inwards`, `/inwards/[id]`, `/purchase-returns`, `/supplier-payments`
- Sales: `/customers`, `/customers/[id]`, `/sales`, `/sales/new`, `/sales/[id]`, `/sales/[id]/edit`, `/outwards`, `/sales-returns`, `/customer-receipts`
- Finance: `/expenses`, `/expense-categories`, `/cash-bank`, `/payment-methods`, `/reconciliation`, `/receivables`, `/payables`
- Accounting: `/accounting/accounts`, `/accounting/journals`, `/accounting/ledger`, `/accounting/trial-balance`
- Reports: `/reports/{profit-loss,balance-sheet,cash-flow,sales,purchases,expenses,stock-valuation,low-stock}`
- Organization: `/companies`, `/businesses`, `/business-members`, `/users`, `/roles`, `/invitations`, `/profile`
- Subscription: `/billing`, `/billing/invoices`
- Platform admin: `/platform/{tenants,users,plans,subscriptions,payments,settings}`

## Code map
- `src/lib/api/` client, errors, session (token cookie + workspace), `routing.ts` (backend route list), `adapters.ts` (response normalizers)
- `src/lib/mock/` mock DB, accounting/stock engine, seed, route handlers
- `src/context/AuthContext.tsx` user, workspace, permissions (`can()`), subscription
- `src/components/sb/` shared list/form/table/document components
- `src/layout/nav.ts` permission-aware navigation

Not in scope: POS, manufacturing, HR/payroll, advanced CRM, AI assistant.
