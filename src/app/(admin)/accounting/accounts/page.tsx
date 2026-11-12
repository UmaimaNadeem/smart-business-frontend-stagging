"use client";
import { ResourcePage } from "@/components/sb/ResourcePage";
import { ACTIVE_OPTIONS, statusCol, text } from "@/components/sb/cols";

const TYPES = ["asset", "liability", "equity", "income", "expense"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));

export default function AccountsPage() {
  return <ResourcePage config={{
    title: "Chart of accounts", subtitle: "System accounts are used by automatic postings and cannot be deleted.", singular: "Account",
    listPath: "/accounts", createPath: "/accounts", updatePath: (r) => `/accounts/${r.id}`, deletePath: (r) => `/accounts/${r.id}`,
    perms: { create: "accounting.manage", update: "accounting.manage", delete: "accounting.manage" },
    columns: [text("code", "Code"), text("name", "Name"), text("type", "Type"), { key: "is_system", label: "System", render: (r) => (r.is_system ? "Yes" : "") }, statusCol()],
    fields: [
      { name: "code", label: "Code", required: true }, { name: "name", label: "Name", required: true },
      { name: "type", label: "Type", type: "select", options: TYPES, required: true, hideOnEdit: true },
      { name: "status", label: "Status", type: "select", options: ACTIVE_OPTIONS },
      { name: "description", label: "Description", type: "textarea", span: 2 },
    ],
    searchKeys: ["code", "name"], filters: [{ key: "type", label: "Type", options: TYPES }], defaults: { status: "active", type: "expense" },
  }} />;
}
