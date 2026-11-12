/* eslint-disable @typescript-eslint/no-explicit-any */
import { DB, Row, find, insert, patch, remove, round2 } from "../db";
import { HttpError, conflict, createAdjustment, createProduct, createTransfer, invalid, num, req } from "../engine";
import { Route, branchFor, filterList, getScoped, list, ok, requirePerm, scoped } from "../router";
import { assertLimit } from "./billing-helpers";

export function presentProduct(db: DB, p: Row) {
  const balances = db.tables.stock_balances.filter((b) => b.product_id === p.id).map((b) => ({ warehouse_id: b.warehouse_id, warehouse: find(db, "warehouses", b.warehouse_id)?.name, quantity: b.quantity }));
  return {
    ...p,
    business: find(db, "businesses", p.business_id)?.name ?? null,
    stock_value: round2(p.current_stock * p.cost_price),
    is_low_stock: p.status === "active" && p.current_stock <= (p.min_stock_alert ?? 0),
    balances,
  };
}

function isLow(p: Row) {
  return p.status === "active" && p.current_stock <= (p.min_stock_alert ?? 0) && (p.min_stock_alert ?? 0) > 0;
}

function warehousePresent(db: DB, w: Row) {
  const bals = db.tables.stock_balances.filter((b) => b.warehouse_id === w.id);
  const value = bals.reduce((s, b) => s + b.quantity * (find(db, "products", b.product_id)?.cost_price ?? 0), 0);
  return { ...w, business: find(db, "businesses", w.business_id)?.name ?? null, products_in_stock: bals.filter((b) => b.quantity > 0).length, total_quantity: round2(bals.reduce((s, b) => s + b.quantity, 0)), stock_value: round2(value) };
}

export const inventoryRoutes: Route[] = [
  /* ---------------- products (existing paths) */
  { method: "GET", pattern: "/api/products/all", access: "verified", tenant: "required", perm: "products.view",
    handler: ({ db, tenant, query }) => { const items = filterList(scoped(db, tenant!, "products"), query, { search: ["name", "sku", "barcode", "category"] }).map((p) => presentProduct(db, p)); return ok({ total_products: items.length, products: items }); } },
  { method: "GET", pattern: "/api/products/business/:businessId", access: "verified", tenant: "required", perm: "products.view",
    handler: ({ db, tenant, params }) => { const bid = Number(params.businessId); if (!tenant!.branchIds.includes(bid)) throw new HttpError(403, "You do not have access to this branch."); const items = scoped(db, tenant!, "products").filter((p) => p.business_id === bid).map((p) => presentProduct(db, p)); return ok({ business_id: bid, total_products: items.length, products: items }); } },
  { method: "GET", pattern: "/api/products/business/:businessId/low-stock", access: "verified", tenant: "required", perm: "products.view",
    handler: ({ db, tenant, params }) => { const bid = Number(params.businessId); const items = scoped(db, tenant!, "products").filter((p) => p.business_id === bid && isLow(p)).map((p) => presentProduct(db, p)); return ok({ business_id: bid, total_low_stock_products: items.length, products: items }); } },
  { method: "GET", pattern: "/api/products/low-stock", access: "verified", tenant: "required", perm: "products.view",
    handler: ({ db, tenant }) => { const items = scoped(db, tenant!, "products").filter(isLow).map((p) => presentProduct(db, p)); return ok({ total_low_stock_products: items.length, products: items }); } },
  { method: "GET", pattern: "/api/products/detail/:id", access: "verified", tenant: "required", perm: "products.view",
    handler: ({ db, tenant, params }) => {
      const p = getScoped(db, tenant!, "products", params.id, "Product");
      const movements = db.tables.stock_movements.filter((m) => m.product_id === p.id).slice(-25).reverse().map((m) => ({ ...m, warehouse: find(db, "warehouses", m.warehouse_id)?.name }));
      return ok({ ...presentProduct(db, p), movements });
    } },
  { method: "POST", pattern: "/api/products/create", access: "verified", tenant: "required",
    handler: ({ db, tenant, body, ctx }) => {
      const bid = branchFor(tenant!, body);
      requirePerm(tenant!, "products.create", bid);
      assertLimit(db, tenant!.companyId!, "products");
      return ok(presentProduct(db, createProduct(ctx(), body, bid)), "Product created successfully", 201);
    } },
  { method: "PUT", pattern: "/api/products/update/:id", access: "verified", tenant: "required",
    handler: ({ db, tenant, params, body }) => {
      const p = getScoped(db, tenant!, "products", params.id, "Product");
      requirePerm(tenant!, "products.update", p.business_id);
      const values: Row = {};
      if (body.sku !== undefined) {
        const sku = String(req(body, "sku"));
        if (db.tables.products.some((x) => x.id !== p.id && x.company_id === p.company_id && String(x.sku).toLowerCase() === sku.toLowerCase())) throw invalid("sku", "The sku has already been taken.");
        values.sku = sku;
      }
      if (body.name !== undefined) values.name = req(body, "name");
      ["selling_price", "cost_price", "min_stock_alert"].forEach((k) => body[k] !== undefined && body[k] !== "" && (values[k] = num(body, k, { min: 0 })));
      ["unit", "barcode", "category", "description"].forEach((k) => body[k] !== undefined && (values[k] = body[k] || null));
      if (body.status !== undefined) { if (!["active", "inactive"].includes(body.status)) throw invalid("status", "The selected status is invalid."); values.status = body.status; }
      if (body.business_id !== undefined && Number(body.business_id) !== p.business_id) values.business_id = branchFor(tenant!, body);
      patch(p, values);
      return ok(presentProduct(db, p), "Product updated successfully");
    } },
  { method: "DELETE", pattern: "/api/products/delete/:id", access: "verified", tenant: "required",
    handler: ({ db, tenant, params }) => {
      const p = getScoped(db, tenant!, "products", params.id, "Product");
      requirePerm(tenant!, "products.delete", p.business_id);
      const used = db.tables.purchases.some((d) => d.items.some((l: Row) => l.product_id === p.id)) || db.tables.sales.some((d) => d.items.some((l: Row) => l.product_id === p.id)) || p.current_stock !== 0;
      if (used) throw conflict("This product has stock or documents. Set it to inactive instead of deleting (keeps history).");
      remove(db, "products", p.id);
      db.tables.stock_balances = db.tables.stock_balances.filter((b) => b.product_id !== p.id);
      return ok(null, "Product deleted successfully");
    } },

  /* ---------------- units (NEW) */
  { method: "GET", pattern: "/api/units", access: "verified", tenant: "required", handler: ({ db, tenant }) => list(scoped(db, tenant!, "units")) },
  { method: "POST", pattern: "/api/units", access: "verified", tenant: "required", perm: "warehouses.manage",
    handler: ({ db, tenant, body }) => {
      const name = req(body, "name"); const short_name = req(body, "short_name", "short name");
      if (scoped(db, tenant!, "units").some((u) => u.short_name.toLowerCase() === String(short_name).toLowerCase())) throw invalid("short_name", "This unit already exists.");
      return ok(insert(db, "units", { company_id: tenant!.companyId, name, short_name, status: body.status || "active" }), "Unit created", 201);
    } },
  { method: "PUT", pattern: "/api/units/:id", access: "verified", tenant: "required", perm: "warehouses.manage",
    handler: ({ db, tenant, params, body }) => { const u = getScoped(db, tenant!, "units", params.id, "Unit"); patch(u, { name: body.name ?? u.name, short_name: body.short_name ?? u.short_name, status: body.status ?? u.status }); return ok(u, "Unit updated"); } },
  { method: "DELETE", pattern: "/api/units/:id", access: "verified", tenant: "required", perm: "warehouses.manage",
    handler: ({ db, tenant, params }) => { const u = getScoped(db, tenant!, "units", params.id, "Unit"); if (db.tables.products.some((p) => p.company_id === u.company_id && p.unit === u.short_name)) throw conflict("Unit is used by products."); remove(db, "units", u.id); return ok(null, "Unit deleted"); } },

  /* ---------------- warehouses (NEW) */
  { method: "GET", pattern: "/api/warehouses", access: "verified", tenant: "required", perm: "warehouses.view",
    handler: ({ db, tenant, query }) => list(filterList(scoped(db, tenant!, "warehouses"), query, { search: ["name", "code", "location"] }).map((w) => warehousePresent(db, w))) },
  { method: "GET", pattern: "/api/warehouses/:id", access: "verified", tenant: "required", perm: "warehouses.view",
    handler: ({ db, tenant, params }) => {
      const w = getScoped(db, tenant!, "warehouses", params.id, "Warehouse");
      const balances = db.tables.stock_balances.filter((b) => b.warehouse_id === w.id).map((b) => { const p = find(db, "products", b.product_id)!; return { product_id: p.id, product: p.name, sku: p.sku, unit: p.unit, quantity: b.quantity, unit_cost: p.cost_price, value: round2(b.quantity * p.cost_price) }; });
      return ok({ ...warehousePresent(db, w), balances });
    } },
  { method: "POST", pattern: "/api/warehouses", access: "verified", tenant: "required",
    handler: ({ db, tenant, body }) => {
      const bid = branchFor(tenant!, body);
      requirePerm(tenant!, "warehouses.manage", bid);
      assertLimit(db, tenant!.companyId!, "warehouses");
      const name = req(body, "name");
      if (scoped(db, tenant!, "warehouses").some((w) => w.name.toLowerCase() === String(name).toLowerCase())) throw invalid("name", "A warehouse with this name already exists.");
      const w = insert(db, "warehouses", { company_id: tenant!.companyId, business_id: bid, name, code: body.code || null, location: body.location || null, manager_name: body.manager_name || null, status: body.status || "active" });
      return ok(warehousePresent(db, w), "Warehouse created", 201);
    } },
  { method: "PUT", pattern: "/api/warehouses/:id", access: "verified", tenant: "required",
    handler: ({ db, tenant, params, body }) => {
      const w = getScoped(db, tenant!, "warehouses", params.id, "Warehouse");
      requirePerm(tenant!, "warehouses.manage", w.business_id);
      const values: Row = {};
      ["name", "code", "location", "manager_name", "status"].forEach((k) => body[k] !== undefined && (values[k] = body[k]));
      patch(w, values);
      return ok(warehousePresent(db, w), "Warehouse updated");
    } },
  { method: "DELETE", pattern: "/api/warehouses/:id", access: "verified", tenant: "required",
    handler: ({ db, tenant, params }) => {
      const w = getScoped(db, tenant!, "warehouses", params.id, "Warehouse");
      requirePerm(tenant!, "warehouses.manage", w.business_id);
      if (db.tables.stock_movements.some((m) => m.warehouse_id === w.id)) throw conflict("This warehouse has stock history. Set it to inactive instead.");
      remove(db, "warehouses", w.id);
      return ok(null, "Warehouse deleted");
    } },

  /* ---------------- stock (NEW) */
  { method: "GET", pattern: "/api/stock/balances", access: "verified", tenant: "required", perm: "warehouses.view",
    handler: ({ db, tenant, query }) => {
      const whs = scoped(db, tenant!, "warehouses");
      let rows: Row[] = db.tables.stock_balances.filter((b) => whs.some((w) => w.id === b.warehouse_id)).map((b) => {
        const p = find(db, "products", b.product_id)!; const w = whs.find((x) => x.id === b.warehouse_id)!;
        return { id: b.id, warehouse_id: w.id, warehouse: w.name, business_id: w.business_id, product_id: p.id, product: p.name, sku: p.sku, unit: p.unit, quantity: b.quantity, min_stock_alert: p.min_stock_alert, unit_cost: p.cost_price, value: round2(b.quantity * p.cost_price), updated_at: b.updated_at };
      });
      rows = filterList(rows, query, { search: ["product", "sku", "warehouse"] });
      if (query.get("hide_zero") === "1") rows = rows.filter((r) => r.quantity !== 0);
      return list(rows);
    } },
  { method: "GET", pattern: "/api/stock/movements", access: "verified", tenant: "required", perm: "warehouses.view",
    handler: ({ db, tenant, query }) => {
      let rows: Row[] = scoped(db, tenant!, "stock_movements").map((m) => ({ ...m, product: find(db, "products", m.product_id)?.name, sku: find(db, "products", m.product_id)?.sku, warehouse: find(db, "warehouses", m.warehouse_id)?.name }));
      rows = filterList(rows, query, { search: ["product", "sku", "reference_no", "reason", "actor_name"], date: "movement_date" });
      const rt = query.get("reference_type"); if (rt && rt !== "all") rows = rows.filter((r) => r.reference_type === rt);
      return list(rows.reverse());
    } },
  { method: "GET", pattern: "/api/stock/adjustments", access: "verified", tenant: "required", perm: "warehouses.view",
    handler: ({ db, tenant, query }) => list(filterList(scoped(db, tenant!, "stock_adjustments"), query, { search: ["adjustment_no", "reason", "warehouse_name"], date: "adjustment_date" }).reverse()) },
  { method: "POST", pattern: "/api/stock/adjustments", access: "verified", tenant: "required",
    handler: ({ db, tenant, body, ctx }) => {
      const w = getScoped(db, tenant!, "warehouses", req(body, "warehouse_id", "warehouse"), "Warehouse");
      requirePerm(tenant!, "stock.adjust", w.business_id);
      return ok(createAdjustment(ctx(), body), "Stock adjustment posted", 201);
    } },
  { method: "GET", pattern: "/api/stock/transfers", access: "verified", tenant: "required", perm: "warehouses.view",
    handler: ({ db, tenant, query }) => list(filterList(scoped(db, tenant!, "stock_transfers"), query, { search: ["transfer_no", "from_warehouse_name", "to_warehouse_name"], date: "transfer_date" }).reverse()) },
  { method: "POST", pattern: "/api/stock/transfers", access: "verified", tenant: "required",
    handler: ({ db, tenant, body, ctx }) => {
      const from = getScoped(db, tenant!, "warehouses", req(body, "from_warehouse_id", "from warehouse"), "Warehouse");
      getScoped(db, tenant!, "warehouses", req(body, "to_warehouse_id", "to warehouse"), "Warehouse");
      requirePerm(tenant!, "stock.transfer", from.business_id);
      return ok(createTransfer(ctx(), body), "Stock transferred", 201);
    } },
];
