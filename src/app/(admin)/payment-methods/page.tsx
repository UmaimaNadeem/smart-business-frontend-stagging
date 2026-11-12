"use client";
import { ResourcePage } from "@/components/sb/ResourcePage";
import { ACTIVE_OPTIONS, statusCol, text } from "@/components/sb/cols";
import { StatusBadge } from "@/components/sb/ui";

export default function PaymentMethodsPage() {
  return <ResourcePage config={{
    title: "Payment methods", singular: "Payment method", listPath: "/payment-methods", createPath: "/payment-methods",
    updatePath: (r) => `/payment-methods/${r.id}`, deletePath: (r) => `/payment-methods/${r.id}`,
    perms: { create: "payments.manage", update: "payments.manage", delete: "payments.manage" },
    columns: [text("name", "Name"), text("type", "Type"), { key: "requires_reference", label: "Reference required", render: (r) => (r.requires_reference ? "Yes" : "No") }, statusCol()],
    fields: [
      { name: "name", label: "Name", required: true },
      { name: "type", label: "Type", type: "select", options: ["cash", "bank_transfer", "cheque", "card", "mobile_wallet"].map((v) => ({ value: v, label: v.replace("_", " ") })) },
      { name: "default_cash_bank_account_id", label: "Default cash/bank account", type: "select", optionsFrom: { path: "/cash-bank-accounts" } },
      { name: "requires_reference", label: "Requires reference", type: "checkbox", placeholder: "Require a reference / cheque number" },
      { name: "status", label: "Status", type: "select", options: ACTIVE_OPTIONS },
    ],
    toPayload: (f) => ({ ...f, default_cash_bank_account_id: f.default_cash_bank_account_id ? Number(f.default_cash_bank_account_id) : null }),
    searchKeys: ["name"], defaults: { status: "active", type: "cash" },
  }} />;
}
void StatusBadge;
