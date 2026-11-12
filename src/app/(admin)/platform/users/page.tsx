"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import toast from "react-hot-toast";
import { api, extractList } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { useApi } from "@/hooks/useApi";
import { DataTable } from "@/components/sb/DataTable";
import { dateCol, statusCol, text } from "@/components/sb/cols";
import { Btn, PageHeader } from "@/components/sb/ui";

export default function PlatformUsersPage() {
  const { data, loading, error, reload } = useApi("/platform/users");
  const setStatus = async (u: any, status: string) => {
    try { await api.put(`/platform/users/${u.id}/status`, { status }); toast.success("User updated"); reload(); } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <div>
      <PageHeader title="All users" subtitle="Every user account across tenants." />
      <DataTable rows={extractList<any>(data)} loading={loading} error={error} onRetry={reload} searchKeys={["name", "email"]}
        filters={[{ key: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }] }]}
        columns={[text("name", "Name"), text("email", "Email"), { key: "companies", label: "Companies", render: (r: any) => r.companies.join(", ") || "-" }, { key: "is_platform_admin", label: "Platform admin", render: (r: any) => (r.is_platform_admin ? "Yes" : "") }, { key: "email_verified", label: "Verified", render: (r: any) => (r.email_verified ? "Yes" : "No") }, dateCol("created_at", "Joined"), statusCol()]}
        actions={(u) => u.status === "suspended" ? <Btn size="sm" variant="success" onClick={() => setStatus(u, "active")}>Activate</Btn> : <Btn size="sm" variant="ghost" className="text-error-500" onClick={() => setStatus(u, "suspended")}>Suspend</Btn>} />
    </div>
  );
}
