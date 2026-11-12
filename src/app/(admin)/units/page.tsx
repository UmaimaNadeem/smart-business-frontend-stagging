"use client";
import { ResourcePage } from "@/components/sb/ResourcePage";
import { ACTIVE_OPTIONS, statusCol, text } from "@/components/sb/cols";

export default function UnitsPage() {
  return <ResourcePage config={{
    title: "Units of measure", singular: "Unit", listPath: "/units", createPath: "/units",
    updatePath: (r) => `/units/${r.id}`, deletePath: (r) => `/units/${r.id}`,
    perms: { create: "warehouses.manage", update: "warehouses.manage", delete: "warehouses.manage" },
    columns: [text("name", "Name"), text("short_name", "Short name"), statusCol()],
    fields: [{ name: "name", label: "Name", required: true }, { name: "short_name", label: "Short name", required: true, placeholder: "pcs" }, { name: "status", label: "Status", type: "select", options: ACTIVE_OPTIONS }],
    searchKeys: ["name", "short_name"], defaults: { status: "active" },
  }} />;
}
