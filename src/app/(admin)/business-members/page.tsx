"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api, extractList, unwrap } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { DataTable } from "@/components/sb/DataTable";
import { text } from "@/components/sb/cols";
import { Btn, FieldWrap, PageHeader, SbModal, inputCls } from "@/components/sb/ui";

export default function BusinessMembersPage() {
  const { can } = useAuth();
  const { data: bRaw } = useApi("/businesses");
  const { data: uRaw } = useApi("/users");
  const { data: rRaw } = useApi("/roles");
  const branches = extractList<any>(bRaw);
  const [bid, setBid] = useState("");
  useEffect(() => { if (!bid && branches.length) setBid(String(branches[0].id)); }, [branches, bid]);
  const { data, loading, error, reload } = useApi<any>(bid ? `/business-members/${bid}` : null);
  const members = data ? unwrap<any>(data).members : [];
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ user_id: "", role_id: "" });

  const add = async () => { try { await api.post("/business-members/add", { business_id: Number(bid), user_id: Number(f.user_id), role_id: Number(f.role_id) }); toast.success("Member added"); setOpen(false); reload(); } catch (e) { toast.error(errorMessage(e)); } };
  const remove = async (m: any) => {
    const branchScope = m.scopes.find((s: any) => s.scope === "branch");
    if (!branchScope) { toast.error("This user has company-wide access. Change it from Users → Roles."); return; }
    if (!window.confirm(`Remove ${m.name} from this branch?`)) return;
    try { await api.post("/business-members/remove", { business_id: Number(bid), user_id: m.id, role_id: branchScope.role_id }); toast.success("Member removed"); reload(); } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <div>
      <PageHeader title="Business members" subtitle="Who can work in each branch. Company-wide roles apply to every branch."
        actions={<>
          <select className={`${inputCls} w-56`} value={bid} onChange={(e) => setBid(e.target.value)}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          {can("users.manage") && <Btn onClick={() => { setF({ user_id: "", role_id: "" }); setOpen(true); }}>+ Add member</Btn>}
        </>} />
      <DataTable rows={members} loading={loading} error={error} onRetry={reload} searchKeys={["name", "email"]}
        columns={[text("name", "Name"), text("email", "Email"), { key: "scopes", label: "Access", render: (m: any) => m.scopes.map((s: any) => `${s.role} (${s.scope})`).join(", ") }]}
        actions={can("users.manage") ? (m) => <Btn size="sm" variant="ghost" className="text-error-500" onClick={() => remove(m)}>Remove</Btn> : undefined} />
      <SbModal open={open} onClose={() => setOpen(false)} title="Add member to branch" footer={<><Btn variant="outline" onClick={() => setOpen(false)}>Cancel</Btn><Btn disabled={!f.user_id || !f.role_id} onClick={add}>Add</Btn></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldWrap label="User"><select className={inputCls} value={f.user_id} onChange={(e) => setF({ ...f, user_id: e.target.value })}><option value="">Select…</option>{extractList<any>(uRaw).map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}</select></FieldWrap>
          <FieldWrap label="Role"><select className={inputCls} value={f.role_id} onChange={(e) => setF({ ...f, role_id: e.target.value })}><option value="">Select…</option>{extractList<any>(rRaw).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></FieldWrap>
        </div>
      </SbModal>
    </div>
  );
}
