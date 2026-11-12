# Smart Business — API contract (frontend ⇄ Laravel)

Base: `{API_URL}/api`. Headers: `Authorization: Bearer {token}`, `Accept: application/json`, `X-Company-ID`, optional `X-Business-ID`.
Envelope: `{success, message, data}`. Errors: `{success:false, message, errors:{field:[msg]}, code}`.
Status codes: 401 unauthenticated · 402 `plan_limit_reached` / `subscription_expired` / `payment_failed` · 403 forbidden or suspended · 404 · 409 invalid state · 422 validation (`company_required`, `insufficient_stock`, `downgrade_blocked`, `credit_limit`).
Lists return `{items, total}` (new endpoints) or the existing keyed shapes (`{products}`, `{purchases}`, `{sales}`, `{users}`…).

## Frontend API modes (`NEXT_PUBLIC_USE_MOCK`)
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

## Original endpoints (routes/api.php, unchanged URLs)
- Auth: `POST /login`, `POST /register` (`name,email,password,password_confirmation,company_name`), `POST /password/forgot`, `POST /password/reset`, `GET /email/verify/{id}/{hash}` → redirect `/signin?verified=1`, `POST /email/resend`, `POST /auth/logout`, `POST /auth/logout-all`, `GET /user` → `{id,name,email,email_verified,is_platform_admin,assignments[{role,role_id,company,company_id,business,business_id,permissions[]}]}`
- Companies `/companies`, `/companies/create|detail/{id}|update/{id}|delete/{id}`, `/companies/{id}/structure`
- Businesses `/businesses`, `/businesses/create|detail|update|delete`, `/users/{id}/businesses`, `/business-members/{businessId}`, `/business-members/add|remove` (`business_id,user_id,role_id`)
- Users `/users`, `/users/create|detail|update|delete`
- Roles `/roles`, `/roles/permissions`, `/roles/create|detail|update|delete` (`name,permissions[],company_id`), `/roles/assign|remove` (`user_id,role_id,company_id,business_id`)
- Invitations `GET|POST /invitations` (`email,role_id,business_id`), `POST /invitations/{id}/resend`, `DELETE /invitations/{id}`, `GET /invitations/token/{token}`, `POST /invitations/accept` (`token,name,password,password_confirmation`)
- Products `/products/all`, `/products/business/{id}`, `/products/business/{id}/low-stock`, `/products/create|update/{id}|delete/{id}` — fields `name, sku, barcode, category, unit, business_id, cost_price, selling_price, opening_stock, warehouse_id, min_stock_alert, status: active|inactive`
- Purchases `/purchases`, `/purchases/create` (`supplier_id, purchase_date, business_id, warehouse_id, expected_date, reference, notes, items[{product_id,quantity,unit_price,discount%,tax_rate%}]`), `PUT|DELETE /purchases/{id}` (draft only), `POST /purchases/{id}/confirmed` → creates inward, `/purchases/inwards/pending`, `/purchases/inwards/{id}`, `POST /purchases/inwards/{id}/tally` (`items[{product_id, received_quantity}]` **cumulative**, optional `complete:true` to close short)
- Sales `/sales`, `/sales/create` (`customer_id, sale_date, business_id, warehouse_id, due_date, delivery_address, items[...]`), `PUT|DELETE /sales/{id}`, `POST /sales/{id}/confirmed` → creates outward, `/sales/outwards/pending`, `/sales/outwards/{id}`, `POST /sales/outwards/{id}/dispatch` (idempotent, honours `Idempotency-Key`, returns `already_processed`), `POST /sales/outwards/{id}/delivered` (`received_by, notes`)

## New endpoints (implemented by the Laravel 12 backend)
| Area | Endpoints |
|---|---|
| Profile | `PUT /user/profile` (`name,email,phone`), `PUT /user/password` (`current_password,password,password_confirmation`) |
| Onboarding | `POST /onboarding/complete` (requires country/currency/timezone + 1 warehouse); companies gain `timezone,address,phone,email,tax_number,onboarding_completed_at,account_status` |
| Products | `GET /products/low-stock`, `GET /products/detail/{id}` (+`balances`, `movements`) |
| Units | `GET|POST /units`, `PUT|DELETE /units/{id}` (`name,short_name,status`) |
| Warehouses | `GET|POST /warehouses`, `GET|PUT|DELETE /warehouses/{id}` (`name,code,business_id,location,manager_name,status`) |
| Stock | `GET /stock/balances`, `GET /stock/movements`, `GET|POST /stock/adjustments` (`warehouse_id,reason,adjustment_date,items[{product_id,quantity_change}]`), `GET|POST /stock/transfers` (`from_warehouse_id,to_warehouse_id,transfer_date,items[{product_id,quantity}]`) |
| Parties | `GET|POST /suppliers`, `GET|PUT|DELETE /suppliers/{id}`; same for `/customers` (`name,contact_person,phone,email,address,tax_number,payment_terms_days,credit_limit,opening_balance,status,notes,contacts[]`). `GET /{id}` returns `documents,payments,returns,statement,balance` |
| Purchasing | `GET /purchases/{id}` (+`inward,payments,returns,journals`), `GET /purchases/inwards/all`, `POST /purchases/{id}/cancel` (`reason`), `GET|POST /purchase-returns` (`purchase_id,return_date,reason,items[{product_id,quantity}]`) |
| Sales | `GET /sales/{id}` (+`outward,payments,returns,journals`), `GET /sales/outwards/all`, `POST /sales/{id}/cancel`, `GET|POST /sales-returns` (`sale_id,...`) |
| Payments | `GET /payments?direction=in|out`, `POST /payments` (`direction,party_id,amount,payment_method_id,cash_bank_account_id,payment_date,reference,notes,allocations[{document_id,amount}]`), `GET /payments/{id}`, `POST /payments/{id}/void` |
| Finance setup | `/payment-methods`, `/expense-categories` (`account_id`), `/accounts` (chart of accounts: `code,name,type: asset|liability|equity|income|expense`) — CRUD; `GET|POST|PUT /cash-bank-accounts` (`name,type: cash|bank,bank_name,account_number,opening_balance`) |
| Expenses | `GET|POST /expenses` (`expense_category_id,amount,payment_method_id,cash_bank_account_id,expense_date,payee,reference,business_id`), `POST /expenses/{id}/void` |
| Reconciliation | `GET /reconciliation?cash_bank_account_id=`, `POST /reconciliation/toggle` (`kind: payment|expense, id, reconciled`) |
| AR/AP | `GET /receivables`, `GET /payables` → `{items, buckets{current,1_30,31_60,61_90,90_plus}, total}` |
| Accounting | `GET|POST /journals` (`date,memo,lines[{account_id,debit,credit,description}]`, must balance), `POST /journals/{id}/reverse`, `GET /ledger?account_id&from&to`, `GET /trial-balance?as_of` |
| Reports | `GET /reports/{profit-loss,cash-flow,sales,purchases,expenses}?from&to`, `/reports/balance-sheet?as_of`, `/reports/stock-valuation`, `/reports/low-stock`, `GET /dashboard/summary` |
| Subscription | `GET /subscription` (`subscription,plan,usage,entitlements,open_invoices`), `/subscription/plans`, `/subscription/invoices`, `/subscription/events`, `POST /subscription/change` (`plan_code,billing_cycle`), `POST /subscription/invoices/{id}/pay` (gateway-agnostic; mock accepts `simulate:"fail"`), `POST /subscription/cancel`, `POST /subscription/resume` |
| Platform (is_platform_admin) | `GET /platform/companies`, `PUT /platform/companies/{id}/status` (`account_status`), `GET /platform/users`, `PUT /platform/users/{id}/status`, `GET|POST|PUT /platform/plans`, `GET /platform/subscriptions`, `PUT /platform/subscriptions/{id}` (`status,plan_code,extend_days`), `GET /platform/payments`, `GET /platform/events`, `GET|PUT /platform/settings` |

## New permissions (add to config/permissions.php)
`warehouses.view, warehouses.manage, stock.adjust, stock.transfer, suppliers.view, suppliers.manage, customers.view, customers.manage, returns.manage, payments.view, payments.manage, expenses.view, expenses.manage, accounting.view, accounting.manage, subscription.manage` (plus existing `inward.view/tally`, `outward.view/dispatch/deliver`, `purchases.confirm`, `sales.confirm`, `users.manage`, `roles.manage`, `branches.manage`, `company.manage`, `reports.view`).

## Backend behaviour changes the frontend relies on
- Purchase status: `draft → confirmed → partially_received → received | cancelled`; inward: `pending → partially_received → completed | cancelled`. Tally is cumulative, cannot exceed ordered or go down.
- Sale status: `draft → confirmed → dispatched → delivered | cancelled`; `sales.customer_id` (FK) replaces free-text customer. Dispatch/deliver idempotent.
- Per-company document numbers: `PO-, IN-, SO-, OUT-, PRN-, SRN-, RCT-, PAY-, EXP-, JV-, ADJ-, TRF-YYYY-0001`.
- Stock per warehouse (`stock_balances`) + `stock_movements` audit (who/when/why/reference); weighted-average cost; low stock uses `min_stock_alert`.
- Every financial event posts a balanced journal (inward → Dr Inventory+Input tax / Cr AP; dispatch → Dr AR / Cr Revenue+Output tax and Dr COGS / Cr Inventory; receipts/payments/expenses/returns/adjustments accordingly). Unbalanced journals → 422.
- Documents carry `billed_amount, paid_amount, returned_amount, payment_status: not_billed|unpaid|partial|paid`.
- Plan limits → 402 `plan_limit_reached`; expired subscription → 402 `subscription_expired` on writes (billing routes exempt); suspended tenant/user → 403.
- Multi-company users without `X-Company-ID` → 422 `company_required`.
