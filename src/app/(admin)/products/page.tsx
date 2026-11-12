"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ResourcePage } from "@/components/sb/ResourcePage";
import { ACTIVE_OPTIONS, linkCol, moneyCol, numCol, statusCol, statusFilter, text } from "@/components/sb/cols";
import { Badge } from "@/components/sb/Tiny";

export default function ProductsPage() {
  return <ResourcePage config={{
    title: "Products", singular: "Product", listPath: "/products/all", createPath: "/products/create",
    updatePath: (r) => `/products/update/${r.id}`, deletePath: (r) => `/products/delete/${r.id}`,
    perms: { create: "products.create", update: "products.update", delete: "products.delete" },
    columns: [
      linkCol("name", "Name", (r) => `/products/${r.id}`), text("sku", "SKU"), text("category", "Category"), text("unit", "Unit"),
      moneyCol("cost_price", "Cost"), moneyCol("selling_price", "Price"),
      { key: "current_stock", label: "Stock", value: (r: any) => r.current_stock, render: (r: any) => <span className="flex items-center gap-1">{r.current_stock}{r.is_low_stock && <Badge>Low</Badge>}</span> },
      numCol("min_stock_alert", "Min alert"), statusCol(),
    ],
    fields: [
      { name: "name", label: "Name", required: true }, { name: "sku", label: "SKU", required: true },
      { name: "barcode", label: "Barcode" }, { name: "category", label: "Category" },
      { name: "unit", label: "Unit", type: "select", optionsFrom: { path: "/units", value: "short_name", label: (u: any) => `${u.name} (${u.short_name})` } },
      { name: "business_id", label: "Branch", type: "select", required: true, optionsFrom: { path: "/businesses" }, hideOnEdit: true },
      { name: "cost_price", label: "Cost price", type: "number", required: true }, { name: "selling_price", label: "Selling price", type: "number", required: true },
      { name: "opening_stock", label: "Opening stock", type: "number", hideOnEdit: true, hint: "Posted to the branch's default warehouse" },
      { name: "warehouse_id", label: "Opening stock warehouse", type: "select", optionsFrom: { path: "/warehouses" }, hideOnEdit: true },
      { name: "min_stock_alert", label: "Low-stock alert at", type: "number" },
      { name: "status", label: "Status", type: "select", options: ACTIVE_OPTIONS },
      { name: "description", label: "Description", type: "textarea", span: 2 },
    ],
    toPayload: (f, mode) => {
      const n = (v: any) => (v === "" || v === undefined || v === null ? undefined : Number(v));
      const out: any = { ...f, cost_price: n(f.cost_price), selling_price: n(f.selling_price), min_stock_alert: n(f.min_stock_alert) ?? 0 };
      if (mode === "create") { out.opening_stock = n(f.opening_stock) ?? 0; out.business_id = n(f.business_id); out.warehouse_id = n(f.warehouse_id); }
      else { delete out.opening_stock; delete out.business_id; delete out.warehouse_id; delete out.current_stock; }
      return out;
    },
    searchKeys: ["name", "sku", "barcode", "category"],
    filters: [statusFilter(["active", "inactive"]), { key: "is_low_stock", label: "Low stock", options: [{ value: "true", label: "Low stock only" }] }],
    defaults: { status: "active", unit: "pcs", opening_stock: 0, min_stock_alert: 0 },
    detailHref: (r) => `/products/${r.id}`,
  }} />;
}
