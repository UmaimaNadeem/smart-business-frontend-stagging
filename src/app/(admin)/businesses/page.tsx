"use client";
import { ResourcePage } from "@/components/sb/ResourcePage";
import { statusCol, text, numCol } from "@/components/sb/cols";
import { useAuth } from "@/context/AuthContext";

export default function BranchesPage() {
  const { workspace, refresh } = useAuth();
  return <ResourcePage config={{
    title: "Branches", subtitle: "Branches (businesses) belong to the selected company. Plan limits apply.", singular: "Branch",
    listPath: "/businesses", createPath: "/businesses/create", updatePath: (r) => `/businesses/update/${r.id}`, deletePath: (r) => `/businesses/delete/${r.id}`,
    perms: { create: "branches.manage", update: "branches.manage", delete: "branches.manage" },
    columns: [text("name", "Name"), text("type", "Type"), text("address", "Address"), text("phone", "Phone"), numCol("members_count", "Members"), numCol("warehouses_count", "Warehouses"), statusCol()],
    fields: [
      { name: "name", label: "Name", required: true },
      { name: "type", label: "Type", type: "select", options: [{ value: "branch", label: "Branch" }, { value: "head_office", label: "Head office" }, { value: "outlet", label: "Outlet" }] },
      { name: "phone", label: "Phone" }, { name: "address", label: "Address", span: 2 },
      { name: "status", label: "Status", type: "select", options: [{ value: 1, label: "Active" }, { value: 0, label: "Inactive" }], hideOnCreate: true },
    ],
    toPayload: (f) => { setTimeout(refresh, 200); return { ...f, company_id: workspace.companyId, status: f.status === "" || f.status === undefined ? undefined : Number(f.status) }; },
    searchKeys: ["name", "address"], defaults: { type: "branch" },
  }} />;
}
