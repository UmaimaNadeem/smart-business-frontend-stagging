"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import toast from "react-hot-toast";
import { api, extractList } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { useApi } from "@/hooks/useApi";
import { DataTable } from "@/components/sb/DataTable";
import { dateCol, numCol, statusCol, text } from "@/components/sb/cols";
import { Btn, PageHeader, Stat } from "@/components/sb/ui";

export default function TenantsPage() {
  const { data, loading, error, reload } = useApi("/platform/companies");
  const rows = extractList<any>(data);
  const setStatus = async (c: any, account_status: string) => {
    if (!window.confirm(`${account_status === "suspended" ? "Suspend" : "Reactivate"} ${c.name}?`)) return;
    try { await api.put(`/platform/companies/${c.id}/status`, { account_status }); toast.success("Tenant updated"); reload(); } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <div>
      <PageHeader title="Tenants" subtitle="All companies on the platform." />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat title="Tenants" value={rows.length} />
        <Stat title="Active subscriptions" value={rows.filter((r) => r.subscription_status === "active").length} />
        <Stat title="In trial" value={rows.filter((r) => r.subscription_status === "trialing").length} />
        <Stat title="Past due / expired" value={rows.filter((r) => ["past_due", "expired"].includes(r.subscription_status)).length} />
      </div>
      <DataTable rows={rows} loading={loading} error={error} onRetry={reload} searchKeys={["name"]}
        filters={[{ key: "subscription_status", label: "Subscription", options: ["trialing", "active", "past_due", "expired", "cancelled"].map((v) => ({ value: v, label: v })) }]}
        columns={[text("name", "Company"), { key: "owner", label: "Owner", render: (r: any) => r.owner?.email ?? "-" }, text("plan_name", "Plan"), statusCol("subscription_status", "Subscription"), numCol("users_count", "Users"), numCol("total_businesses", "Branches"), { key: "products", label: "Products", render: (r: any) => r.usage?.products }, dateCol("created_at", "Created"), statusCol("account_status", "Account")]}
        actions={(c) => c.account_status === "suspended" ? <Btn size="sm" variant="success" onClick={() => setStatus(c, "active")}>Reactivate</Btn> : <Btn size="sm" variant="ghost" className="text-error-500" onClick={() => setStatus(c, "suspended")}>Suspend</Btn>} />
    </div>
  );
}
