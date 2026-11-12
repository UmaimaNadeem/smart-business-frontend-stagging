"use client";
import { ResourcePage } from "@/components/sb/ResourcePage";
import { ACTIVE_OPTIONS, statusCol, text } from "@/components/sb/cols";

export default function ExpenseCategoriesPage() {
  return <ResourcePage config={{
    title: "Expense categories", subtitle: "Each category posts to an expense account in the chart of accounts.", singular: "Category",
    listPath: "/expense-categories", createPath: "/expense-categories", updatePath: (r) => `/expense-categories/${r.id}`, deletePath: (r) => `/expense-categories/${r.id}`,
    perms: { create: "expenses.manage", update: "expenses.manage", delete: "expenses.manage" },
    columns: [text("name", "Name"), statusCol()],
    fields: [
      { name: "name", label: "Name", required: true },
      { name: "account_id", label: "Expense account", type: "select", required: true, optionsFrom: { path: "/accounts", label: (a) => `${a.code} · ${a.name}`, filter: (a) => a.type === "expense" } },
      { name: "status", label: "Status", type: "select", options: ACTIVE_OPTIONS },
    ],
    toPayload: (f) => ({ ...f, account_id: Number(f.account_id) || undefined }),
    searchKeys: ["name"], defaults: { status: "active" },
  }} />;
}
