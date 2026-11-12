"use client";
import { ResourcePage } from "@/components/sb/ResourcePage";
import { ACTIVE_OPTIONS, moneyCol, numCol, statusCol, text } from "@/components/sb/cols";

export default function CashBankPage() {
  return <ResourcePage config={{
    title: "Cash & bank accounts", subtitle: "Balances come from the general ledger.", singular: "Account",
    listPath: "/cash-bank-accounts", createPath: "/cash-bank-accounts", updatePath: (r) => `/cash-bank-accounts/${r.id}`,
    perms: { create: "accounting.manage", update: "accounting.manage" },
    columns: [text("name", "Name"), text("type", "Type"), text("bank_name", "Bank"), text("account_number", "Account #"), moneyCol("balance", "Balance"), numCol("unreconciled", "Unreconciled"), statusCol()],
    fields: [
      { name: "name", label: "Name", required: true },
      { name: "type", label: "Type", type: "select", options: [{ value: "cash", label: "Cash" }, { value: "bank", label: "Bank" }], required: true, hideOnEdit: true },
      { name: "bank_name", label: "Bank name" }, { name: "account_number", label: "Account number" },
      { name: "opening_balance", label: "Opening balance", type: "number", hideOnEdit: true },
      { name: "status", label: "Status", type: "select", options: ACTIVE_OPTIONS, hideOnCreate: true },
    ],
    defaults: { type: "bank" },
  }} />;
}
