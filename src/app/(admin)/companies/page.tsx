"use client";
import { ResourcePage } from "@/components/sb/ResourcePage";
import { ACTIVE_OPTIONS, numCol, statusCol, text } from "@/components/sb/cols";
import { useAuth } from "@/context/AuthContext";

export default function CompaniesPage() {
  const { refresh } = useAuth();
  return <ResourcePage config={{
    title: "Companies", subtitle: "A company is your tenant. Create a second company to keep its data completely separate.", singular: "Company",
    listPath: "/companies", createPath: "/companies/create", updatePath: (r) => `/companies/update/${r.id}`, deletePath: (r) => `/companies/delete/${r.id}`,
    perms: { update: "company.manage", delete: "company.manage" },
    columns: [text("name", "Name"), text("currency", "Currency"), text("country", "Country"), numCol("total_businesses", "Branches"), text("plan_name", "Plan"), { key: "subscription_status", label: "Subscription", render: (r) => r.subscription_status?.replace("_", " ") }, statusCol("account_status", "Account")],
    fields: [
      { name: "name", label: "Company name", required: true, span: 2 },
      { name: "currency", label: "Currency", type: "select", options: ["PKR", "AED", "SAR", "USD", "GBP"].map((v) => ({ value: v, label: v })) },
      { name: "country", label: "Country" }, { name: "timezone", label: "Timezone" }, { name: "tax_number", label: "Tax number" },
      { name: "phone", label: "Phone" }, { name: "email", label: "Email", type: "email" }, { name: "address", label: "Address", span: 2 },
      { name: "status", label: "Status", type: "select", options: ACTIVE_OPTIONS.map((o) => ({ value: o.value === "active" ? 1 : 0, label: o.label })), hideOnCreate: true },
    ],
    toPayload: (f) => { setTimeout(refresh, 200); return { ...f, status: f.status === "" || f.status === undefined ? undefined : Number(f.status) }; },
    searchKeys: ["name", "country"], defaults: { currency: "PKR", country: "Pakistan", timezone: "Asia/Karachi" },
  }} />;
}
