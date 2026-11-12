# Smart Business frontend: aligned with the Laravel 12 backend

Zip: `smart-business-frontend-live.zip` (top folder `smart-business-frontend/`). It has no `node_modules`, `.next`, `.git` or `.env*`, apart from `.env.example`.

## Short answer
The backend routes and payloads already matched the frontend's contract. Every path the screens call exists in `routes/api.php`, with the same methods, payload fields, list keys and status names. The problem was the frontend's API layer. Hybrid mode, the old default, still sent every new module to the in-browser mock. It also rewrote two endpoints to the wrong backend route, and one adapter changed a real inward status. Those are fixed. The default mode is now `false`, so every call goes to Laravel.

## What was wrong
1. **`src/lib/api/routing.ts`**: the live list had only the original routes (auth, organisation, products, purchases, sales). In hybrid mode, everything else went to the mock: units, warehouses, stock, suppliers, customers, returns, payments, expenses, accounting, reports, dashboard, billing, onboarding, profile/password, platform plans/subscriptions/payments/settings/events, `/products/detail`, `/products/low-stock`, and `/sales/:id/cancel`.
2. **Aliases**: these rewrote real backend endpoints.
   - `/purchases/inwards/all` went to `/pending`, and `/sales/outwards/all` went to `/pending`, so finished history was hidden.
   - `/purchases/:id/cancel` went to `/purchases/status/:id`.
3. **`src/lib/api/adapters.ts`**:
   - It mapped inward `completed` to `received`. The backend uses `pending → partially_received → completed` for inwards, and the inward screens filter and badge by `completed`.
   - It ran *every* path starting with `/sales` through the sale normalizer, which included `/sales-returns`. Return status `completed` would have shown as `delivered`.
   - `/purchases/inwards/all` went through the purchase-document normalizer, which added an empty `items` array. `extractList` would then have returned an empty list.
   - On outward lists, it replaced the flat `total_amount`, `sale_date` and `purchase_date` from the backend with values from a nested legacy object that the new backend doesn't send. Value showed 0 and dates were blank.
   - Product detail went through the list mapper and was not normalised. DELETE responses went through document normalizers.
4. **`src/lib/api/client.ts`**: in hybrid mode, every `/products/*` GET was copied into the mock store, including the detail page's `balances` and `movements` arrays.
5. **`src/components/sb/Docs.tsx`**: outside full mock, the purchase form asked you to type a raw supplier ID because the old backend had no `/suppliers` API.
6. **Onboarding**: errors from `/warehouses` and `/onboarding/complete` were hidden outside mock mode, because those endpoints were mock-only.
7. **`AuthContext`**: in hybrid mode, the UI granted system-role permissions the backend doesn't grant, such as Staff tally or dispatch. Those clicks ended in 403.
8. **Default mode** was `hybrid`. The header badge and the reset button said that new modules used demo data.

## What changed (by file)
- `src/lib/api/routing.ts`: rewritten. It lists all 175 backend routes, generated from `php artisan route:list --path=api`. Static segments match before `:params`. `liveAlias` now returns nothing, and the client only consults it when no live route matches.
- `src/lib/api/client.ts`:
  - It checks the live route first and only uses an alias for unknown paths.
  - The hybrid product copy only runs for product *lists*.
  - The 5s timeout, 15s circuit breaker, GET cache/dedupe, 401 handling and headers are unchanged.
- `src/lib/api/adapters.ts`:
  - Status maps are split per flow: inward keeps `completed`, and outward maps legacy `out_for_delivery` to `dispatched`.
  - `/purchases/inwards/{all,pending,:id,:id/tally}` and `/sales/outwards/{all,pending,:id,dispatch,delivered}` now use the flow normalizer.
  - The purchase and sale normalizers only run for exact `/purchases` and `/sales` paths, not `/purchase-returns` or `/sales-returns`.
  - Flat backend fields (`total_amount`, `sale_date`, `purchase_date`) are preferred.
  - Product detail is normalised as an item. DELETE responses pass through untouched.
  - The inward detail page no longer refetches the purchase when the backend already sends `ordered_quantity`.
- `src/lib/config.ts`: `NEXT_PUBLIC_USE_MOCK` now defaults to `false` (live). `hybrid` and `true` still work.
- `src/components/sb/Docs.tsx`: the supplier is picked from a dropdown in every mode.
- `src/app/(full-width-pages)/(auth)/onboarding/page.tsx`: warehouse and onboarding-complete errors now show in every mode.
- `src/context/AuthContext.tsx`: system-role permission defaults only apply in full mock. Live and hybrid use exactly the permissions `/user` returns. The backend catalogue covers every module, and the keys match.
- `src/app/(admin)/outwards/page.tsx`: "Delivered" now sends an `Idempotency-Key` too. Dispatch already did.
- `src/layout/AppHeader.tsx`: the "Demo data" badge and "Reset demo data" only appear in full mock.
- `.env.example`, `README.md`, `API_CONTRACT.md`: these now describe the new default, the full live module list, that there are no aliases, the backend seed logins, and that `Demo@1234` is mock-only.

## Already fine (unchanged)
- URL shapes for auth, products, purchases and sales.
- The `/logout`, `/auth/logout` and `/api/auth/logout` pages. Logout clears the cookie first.
- Headers: `Authorization: Bearer`, `Accept`, `X-Company-ID`, `X-Business-ID`, and `Idempotency-Key` on dispatch.
- Payload field names: `selling_price`, `cost_price`, `supplier_id`, `customer_id`, `purchase_date`/`sale_date`, `items[{product_id,quantity,unit_price,discount,tax_rate}]`, the tally `items[{product_id,received_quantity}]` plus `complete`, `quantity_change` on adjustments, and payments `allocations[{document_id,amount}]`.
- List and item unwrapping. The backend returns `{items,total}` or keyed lists (`products`, `purchases`, `sales`, `inwards`, `outwards`, `users`…), and pending inwards/outwards come back as a plain array. `extractList`/`extractItem` handle all of these.
- Error handling. `code` is read from the top level of the error body: 402 `plan_limit_reached`, `subscription_expired` or `payment_failed`, and 422 `downgrade_blocked` or `company_required`. The subscription banner refreshes on `subscription_expired` and `payment_failed`.
- Purchase and sale status names match the backend exactly.

## How I checked it
- `tsc --noEmit` passes. ESLint on the changed files reports no new problems; the existing `any` in AuthContext and two warnings were already there.
- `next build` succeeded. All routes compiled, including `/logout`, `/auth/logout` and `/api/auth/logout`.
- I ran a throwaway copy of the backend locally (SQLite, `migrate:fresh --seed`) and called the API with the frontend's exact paths, headers and payloads. Your backend work copy was not touched.
  - All 48 list/report GETs that the screens use returned 200 with the expected keys. So did 10 detail GETs.
  - These flows worked: purchase create → confirm → partial tally → complete tally; sale create → confirm → dispatch twice with the same key (`already_processed:true`, no double stock) → delivered; receipt with allocation; sale cancel; purchase cancel; profile update; stock adjustment and transfer; sales and purchase returns; expense; manual journal; supplier create.
  - `downgrade_blocked` returned 422 with the top-level code as expected.
- I did not click through the UI in a browser against your Herd `.test` host.

## How to run it against the new backend
```bash
unzip smart-business-frontend-live.zip && cd smart-business-frontend
npm install
cp .env.example .env.local
# edit .env.local:
#   NEXT_PUBLIC_API_URL=http://smart-business-backend-stagging.test   (your Laravel host, no /api)
#   NEXT_PUBLIC_USE_MOCK=false                                        (default; hybrid also works)
npm run dev
```
Restart `npm run dev` or rebuild after changing env values; they are inlined at build time. Log in with `owner@metrotraders.test` / `Password123!` (after `php artisan migrate:fresh --seed` on the backend). Other seeded users: `manager@`, `sales@` (Lahore only), `warehouse@metrotraders.test`, `owner@northwind.test`, and `admin@smartbusiness.test` (platform admin). The `…@demo.test / Demo@1234` accounts only exist in `NEXT_PUBLIC_USE_MOCK=true`.

## Remaining gaps (not in scope, not changed)
- **Pagination**: list screens fetch the full list and filter on the client. Only `/users` pages through Laravel's pagination. Large tenants would need server-side `?page/per_page/search`.
- **Token storage**: the token is in a JS-readable cookie, not an httpOnly cookie or Sanctum SPA session.
- **Hybrid mode** still exists. With this backend it behaves the same as `false`. Its mock fallback only matters for a path that isn't in `routing.ts`. If backend routes change, update `routing.ts` (regenerate it from `route:list`).
- **CORS**: the backend uses Laravel's default CORS (all origins and headers on `api/*`). Restrict it for production.
- **Postponed modules**: POS, manufacturing, HR/payroll, advanced CRM, AI and e-commerce were not built.
- **Existing lint items** in files I didn't otherwise touch were left as they were.
