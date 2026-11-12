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
| `NEXT_PUBLIC_USE_MOCK` | `hybrid` | `hybrid` = existing Laravel endpoints live + new modules mocked. `true` = full in-browser mock with demo data. `false` = everything to Laravel. |
| `NEXT_PUBLIC_API_URL` | `http://smart-business-backend-stagging.test` | Laravel base URL (the client adds `/api`). |

All requests go through `src/lib/api/client.ts` (Bearer token, `Accept: application/json`, `X-Company-ID`, `X-Business-ID`). The mock (`src/lib/mock/*`) implements the same paths and payloads, so switching is only the env var. Contract for the backend: **API_CONTRACT.md**.

Reset demo data: user menu → **Reset demo data**.

## API modes (`NEXT_PUBLIC_USE_MOCK`)
| Value | What happens |
|---|---|
| `hybrid` (**default**, also when unset) | Endpoints that already exist in `backend/routes/api.php` call the real Laravel API at `NEXT_PUBLIC_API_URL`, so real login, signup, users, roles, companies, branches, invitations, products, purchases, sales and inwards/outwards all use Laravel. Modules the backend doesn't have yet are served by the in-browser mock. |
| `true` | Full mock with demo data. **The demo accounts below only work in this mode.** |
| `false` | Everything goes to Laravel. Modules without a backend API return 404. |

To switch modes, set the value in `.env.local` and restart `npm run dev`, or rebuild. The value is inlined at build time.

**Live in hybrid**, per `src/lib/api/routing.ts`:
- `/register`, `/login`, `/password/*`, `/email/*`, `/auth/logout*`, `/user`
- `/invitations*`, `/platform/companies`, `/platform/users`
- `/companies*`, `/businesses*`, `/users*`, `/roles*`, `/business-members*`
- `/products/{all, business/:id, create, update/:id, delete/:id, :id/increase-stock, :id/decrease-stock, business/:id/low-stock}`
- `/purchases*`, `/purchases/inwards/{pending, :id, :id/tally}`
- `/sales*`, `/sales/outwards/{pending, :id, :id/dispatch, :id/delivered}`

**Aliases:**
- `/purchases/inwards/all` → `/purchases/inwards/pending`
- `/sales/outwards/all` → `/sales/outwards/pending`
- `/purchases/:id/cancel` → `POST /purchases/status/:id {status:"cancelled"}`

**Mock in hybrid:**
- Inventory: units, warehouses, stock balances/movements/adjustments/transfers, `/products/detail/:id`, `/products/low-stock`
- Parties: suppliers, customers
- Returns: purchase and sales returns
- Finance: supplier payments, customer receipts, expenses, cash/bank, reconciliation, receivables/payables
- Accounting: accounts, journals, ledger, trial balance
- Reports and dashboard summary
- Billing: `/subscription*`, `/onboarding/complete`
- Platform: `/platform/{plans, subscriptions, payments, settings, …}`
- Profile: `/user/profile`, `/user/password`
- Sales: `/sales/:id/cancel`

**How hybrid works:**
- Every live call still sends the Bearer token plus `X-Company-ID` / `X-Business-ID`.
- Mock calls use a separate browser store (`sb_mock_db_hybrid_v1`). On the first mock call, that store copies in the logged-in Laravel user, their companies, branches and roles, using the same IDs. Live product lists are also copied into it, so stock screens can pick real products.
- A 401 from a mock module never logs you out.
- Live responses go through `src/lib/api/adapters.ts`, which does the following:
  - uses the defensive `extractList`/`extractItem` from the old frontend;
  - maps `price` to `selling_price`;
  - turns `supplier`/`business` objects into names;
  - unwraps `{purchase}` on create;
  - fills item product names;
  - maps statuses: `pending` to `draft`, `out_for_delivery` to `dispatched`, `completed` to `delivered`/`received`;
  - loads every page of `/users`.

**Response caveats in hybrid:**
- Finance, returns, receivables/payables and accounting run on mock documents. Live purchases and sales don't post journals or payments.
- Live sales have no `customer_id`; they show as "Walk-in". Live documents have no tax or discount fields.
- A live purchase `supplier_id` must exist in the backend `suppliers` table, which has no API yet. Outside full mock, the purchase form asks for the supplier ID as a number.
- The backend's permission catalogue only covers the existing modules. For system roles (Company Owner, Manager, Staff, Super Admin), the frontend adds its own keys for the mock-only modules.
- Payloads stay correct. Register sends `company_name`. Products send `selling_price`, `cost_price`, `opening_stock`, `min_stock_alert`, `sku`, `status`. Purchases send `supplier_id` and `purchase_date`. `price` is never sent, and there is no `GET /products`.

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
- `src/lib/api/` client, errors, session (token cookie + workspace)
- `src/lib/mock/` mock DB, accounting/stock engine, seed, route handlers
- `src/context/AuthContext.tsx` user, workspace, permissions (`can()`), subscription
- `src/components/sb/` shared list/form/table/document components
- `src/layout/nav.ts` permission-aware navigation

Not in scope: POS, manufacturing, HR/payroll, advanced CRM, AI assistant.
