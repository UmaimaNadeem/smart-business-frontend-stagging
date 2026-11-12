"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import toast from "react-hot-toast";
import { api, extractList, unwrap } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { DataTable } from "@/components/sb/DataTable";
import { statusCol, text } from "@/components/sb/cols";
import { FormGrid } from "@/components/sb/Form";
import { Btn, FieldWrap, PageHeader, SbModal, SimpleTable, inputCls } from "@/components/sb/ui";

export default function UsersPage() {
  const { can, workspace, me } = useAuth();
  const { data, loading, error, reload } = useApi("/users");
  const { data: rolesRaw } = useApi("/roles");
  const { data: branchesRaw } = useApi("/businesses");
  const roles = extractList<any>(rolesRaw);
  const branches = extractList<any>(branchesRaw);
  const [create, setCreate] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string[]> | null>(null);
  const [manage, setManage] = useState<any>(null);
  const [assign, setAssign] = useState({ role_id: "", business_id: "" });
  const manageOk = can("users.manage");

  const doCreate = async () => {
    setErrors(null);
    try {
      const u = unwrap<any>(await api.post("/users/create", { name: form.name, email: form.email, password: form.password, phone: form.phone }));
      if (form.role_id) await api.post("/roles/assign", { user_id: u.id, role_id: Number(form.role_id), company_id: workspace.companyId, business_id: form.business_id ? Number(form.business_id) : null });
      toast.success("User created"); setCreate(false); reload();
    } catch (e) { if (e instanceof ApiError && e.errors) setErrors(e.errors); toast.error(errorMessage(e)); }
  };
  const refreshManage = async (id: number) => { reload(); setManage(unwrap<any>(await api.get(`/users/detail/${id}`))); };
  const doAssign = async () => {
    try { await api.post("/roles/assign", { user_id: manage.id, role_id: Number(assign.role_id), company_id: workspace.companyId, business_id: assign.business_id ? Number(assign.business_id) : null }); toast.success("Role assigned"); refreshManage(manage.id); }
    catch (e) { toast.error(errorMessage(e)); }
  };
  const doRemove = async (a: any) => {
    try { await api.post("/roles/remove", { user_id: manage.id, role_id: a.role_id, company_id: a.company_id, business_id: a.business_id }); toast.success("Role removed"); refreshManage(manage.id); }
    catch (e) { toast.error(errorMessage(e)); }
  };
  const setStatus = async (u: any, status: string) => { try { await api.put(`/users/update/${u.id}`, { status }); toast.success("User updated"); reload(); } catch (e) { toast.error(errorMessage(e)); } };
  const removeUser = async (u: any) => { if (!window.confirm(`Remove ${u.name} from this company?`)) return; try { await api.del(`/users/delete/${u.id}`); toast.success("User removed"); reload(); } catch (e) { toast.error(errorMessage(e)); } };

  return (
    <div>
      <PageHeader title="Users" subtitle="People with access to this company. Prefer invitations so users set their own password." actions={manageOk && <Btn onClick={() => { setForm({}); setErrors(null); setCreate(true); }}>+ Create user</Btn>} />
      <DataTable rows={extractList<any>(data)} loading={loading} error={error} onRetry={reload} searchKeys={["name", "email"]}
        filters={[{ key: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }] }]}
        columns={[text("name", "Name"), text("email", "Email"), { key: "roles", label: "Roles", render: (r: any) => r.roles.join(", ") }, { key: "businesses", label: "Branches", render: (r: any) => r.businesses.join(", ") }, { key: "email_verified", label: "Verified", render: (r: any) => (r.email_verified ? "Yes" : "No") }, statusCol()]}
        actions={manageOk ? (u) => u.id === me?.id ? <span className="text-xs text-gray-400">You</span> : <>
          <Btn size="sm" variant="outline" onClick={() => { setAssign({ role_id: "", business_id: "" }); setManage(u); }}>Roles</Btn>
          {u.status === "suspended" ? <Btn size="sm" variant="ghost" onClick={() => setStatus(u, "active")}>Activate</Btn> : <Btn size="sm" variant="ghost" onClick={() => setStatus(u, "suspended")}>Suspend</Btn>}
          <Btn size="sm" variant="ghost" className="text-error-500" onClick={() => removeUser(u)}>Remove</Btn>
        </> : undefined} />
      <SbModal open={create} onClose={() => setCreate(false)} title="Create user" footer={<><Btn variant="outline" onClick={() => setCreate(false)}>Cancel</Btn><Btn onClick={doCreate}>Create</Btn></>}>
        <FormGrid values={form} setValues={setForm} errors={errors} fields={[
          { name: "name", label: "Name", required: true }, { name: "email", label: "Email", type: "email", required: true },
          { name: "password", label: "Temporary password", type: "password", required: true }, { name: "phone", label: "Phone" },
          { name: "role_id", label: "Role", type: "select", options: roles.map((r) => ({ value: r.id, label: r.name })) },
          { name: "business_id", label: "Branch", type: "select", placeholder: "All branches", options: branches.map((b) => ({ value: b.id, label: b.name })) },
        ]} />
      </SbModal>
      <SbModal open={!!manage} onClose={() => setManage(null)} title={`Roles for ${manage?.name ?? ""}`} wide>
        {manage && <>
          <SimpleTable head={["Role", "Scope", ""]} rows={manage.assignments.map((a: any) => [a.role, a.business ?? "All branches", <Btn key="r" size="sm" variant="ghost" className="text-error-500" onClick={() => doRemove(a)}>Remove</Btn>])} />
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <FieldWrap label="Role"><select className={inputCls} value={assign.role_id} onChange={(e) => setAssign({ ...assign, role_id: e.target.value })}><option value="">Select…</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></FieldWrap>
            <FieldWrap label="Scope"><select className={inputCls} value={assign.business_id} onChange={(e) => setAssign({ ...assign, business_id: e.target.value })}><option value="">All branches</option>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></FieldWrap>
            <Btn disabled={!assign.role_id} onClick={doAssign}>Assign</Btn>
          </div>
        </>}
      </SbModal>
    </div>
  );
}
