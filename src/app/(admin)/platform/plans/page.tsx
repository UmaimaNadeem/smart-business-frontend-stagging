"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ResourcePage } from "@/components/sb/ResourcePage";
import { moneyCol, numCol, text } from "@/components/sb/cols";

const lim = (v: any) => (v === "" || v === null || v === undefined ? null : Number(v));

export default function PlansPage() {
  return <ResourcePage config={{
    title: "Plans", subtitle: "Pricing and entitlements. Leave a limit empty for unlimited.", singular: "Plan",
    listPath: "/platform/plans", createPath: "/platform/plans", updatePath: (r) => `/platform/plans/${r.id}`, perms: {},
    columns: [text("code", "Code"), text("name", "Name"), moneyCol("price_monthly", "Monthly"), moneyCol("price_yearly", "Yearly"), numCol("trial_days", "Trial days"),
      { key: "limits", label: "Limits (U/B/W/P)", render: (r: any) => ["users", "branches", "warehouses", "products"].map((k) => r.limits?.[k] ?? "∞").join(" / ") },
      numCol("subscribers", "Subscribers"), { key: "is_active", label: "Active", render: (r: any) => (r.is_active ? "Yes" : "No") }],
    fields: [
      { name: "code", label: "Code", required: true, hideOnEdit: true }, { name: "name", label: "Name", required: true },
      { name: "price_monthly", label: "Monthly price", type: "number" }, { name: "price_yearly", label: "Yearly price", type: "number" },
      { name: "currency", label: "Currency" }, { name: "trial_days", label: "Trial days", type: "number" },
      { name: "l_users", label: "Max users", type: "number" }, { name: "l_branches", label: "Max branches", type: "number" },
      { name: "l_warehouses", label: "Max warehouses", type: "number" }, { name: "l_products", label: "Max products", type: "number" },
      { name: "features", label: "Features (comma separated)", span: 2 },
      { name: "is_active", label: "Active", type: "checkbox", placeholder: "Available for new subscriptions" },
    ],
    fromRow: (r) => ({ ...r, l_users: r.limits?.users ?? "", l_branches: r.limits?.branches ?? "", l_warehouses: r.limits?.warehouses ?? "", l_products: r.limits?.products ?? "", features: (r.features ?? []).join(", ") }),
    toPayload: (f) => ({ code: f.code, name: f.name, price_monthly: Number(f.price_monthly || 0), price_yearly: Number(f.price_yearly || 0), currency: f.currency || "PKR", trial_days: Number(f.trial_days || 14), is_active: !!f.is_active,
      limits: { users: lim(f.l_users), branches: lim(f.l_branches), warehouses: lim(f.l_warehouses), products: lim(f.l_products) }, features: String(f.features ?? "").split(",").map((s) => s.trim()).filter(Boolean) }),
    defaults: { currency: "PKR", trial_days: 14, is_active: true },
  }} />;
}
