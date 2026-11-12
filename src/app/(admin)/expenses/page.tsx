"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ResourcePage } from "@/components/sb/ResourcePage";
import { dateCol, moneyCol, statusCol, text } from "@/components/sb/cols";
import { Btn } from "@/components/sb/ui";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { todayIso } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

export default function ExpensesPage() {
  const { can } = useAuth();
  return <ResourcePage config={{
    title: "Expenses", subtitle: "Each expense posts Dr expense account / Cr cash or bank.", singular: "Expense",
    listPath: "/expenses", createPath: "/expenses", perms: { create: "expenses.manage" },
    columns: [text("expense_no", "Number"), dateCol("expense_date", "Date"), text("category_name", "Category"), text("payee", "Payee"), text("payment_method_name", "Method"), text("cash_bank_account_name", "Paid from"), moneyCol("amount", "Amount"), statusCol()],
    fields: [
      { name: "expense_category_id", label: "Category", type: "select", required: true, optionsFrom: { path: "/expense-categories", filter: (c: any) => c.status === "active" } },
      { name: "amount", label: "Amount", type: "number", required: true },
      { name: "expense_date", label: "Date", type: "date", required: true },
      { name: "payment_method_id", label: "Payment method", type: "select", required: true, optionsFrom: { path: "/payment-methods" } },
      { name: "cash_bank_account_id", label: "Paid from", type: "select", optionsFrom: { path: "/cash-bank-accounts" }, placeholder: "Method default" },
      { name: "business_id", label: "Branch", type: "select", optionsFrom: { path: "/businesses" }, placeholder: "Company-wide" },
      { name: "payee", label: "Payee" }, { name: "reference", label: "Reference" },
      { name: "notes", label: "Notes", type: "textarea", span: 2 },
    ],
    toPayload: (f) => ({ ...f, amount: Number(f.amount), expense_category_id: Number(f.expense_category_id) || null, payment_method_id: Number(f.payment_method_id) || null, cash_bank_account_id: Number(f.cash_bank_account_id) || null, business_id: Number(f.business_id) || null }),
    searchKeys: ["expense_no", "category_name", "payee", "reference"],
    filters: [{ key: "status", label: "Status", options: [{ value: "posted", label: "Posted" }, { value: "void", label: "Void" }] }],
    defaults: { expense_date: todayIso() },
    rowActions: (r, reload) => r.status !== "void" && can("expenses.manage") ? <Btn size="sm" variant="ghost" className="text-error-500" onClick={async () => { if (!window.confirm("Void this expense?")) return; try { await api.post(`/expenses/${r.id}/void`); toast.success("Expense voided"); reload(); } catch (e) { toast.error(errorMessage(e)); } }}>Void</Btn> : null,
  }} />;
}
