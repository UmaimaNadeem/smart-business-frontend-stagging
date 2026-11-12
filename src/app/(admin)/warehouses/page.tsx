"use client";
import { ResourcePage } from "@/components/sb/ResourcePage";
import { ACTIVE_OPTIONS, linkCol, numCol, moneyCol, statusCol, statusFilter, text } from "@/components/sb/cols";

export default function WarehousesPage() {
  return <ResourcePage config={{
    title: "Warehouses", subtitle: "Stock is tracked per warehouse. Each warehouse belongs to a branch.", singular: "Warehouse",
    listPath: "/warehouses", createPath: "/warehouses", updatePath: (r) => `/warehouses/${r.id}`, deletePath: (r) => `/warehouses/${r.id}`,
    perms: { create: "warehouses.manage", update: "warehouses.manage", delete: "warehouses.manage" },
    columns: [linkCol("name", "Name", (r) => `/warehouses/${r.id}`), text("code", "Code"), text("business", "Branch"), text("location", "Location"), numCol("total_quantity", "Units"), moneyCol("stock_value", "Stock value"), statusCol()],
    fields: [
      { name: "name", label: "Name", required: true }, { name: "code", label: "Code" },
      { name: "business_id", label: "Branch", type: "select", required: true, optionsFrom: { path: "/businesses" }, hideOnEdit: true },
      { name: "location", label: "Location" }, { name: "manager_name", label: "Manager" },
      { name: "status", label: "Status", type: "select", options: ACTIVE_OPTIONS },
    ],
    searchKeys: ["name", "code", "location"], filters: [statusFilter(["active", "inactive"])], defaults: { status: "active" },
    detailHref: (r) => `/warehouses/${r.id}`,
  }} />;
}
