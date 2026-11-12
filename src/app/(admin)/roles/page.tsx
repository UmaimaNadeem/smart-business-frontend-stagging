"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import toast from "react-hot-toast";
import { api, extractList, unwrap } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { DataTable } from "@/components/sb/DataTable";
import { numCol, text } from "@/components/sb/cols";
import { Alert, Btn, FieldWrap, PageHeader, SbModal, inputCls } from "@/components/sb/ui";

export default function RolesPage() {
  const { can, workspace } = useAuth();
  const { data, loading, error, reload } = useApi("/roles");
  const { data: permRaw } = useApi<any>("/roles/permissions");
  const perms: { key: string; label: string; group: string }[] = permRaw ? unwrap<any>(permRaw).permissions : [];
  const groups = Array.from(new Set(perms.map((p) => p.group)));
  const [edit, setEdit] = useState<any>(null);
  const [name, setName] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string[]> | null>(null);
  const manage = can("roles.manage");

  const open = (r: any | null) => { setEdit(r ?? {}); setName(r?.name ?? ""); setSel(new Set(r?.permissions ?? [])); setErrors(null); };
  const toggle = (k: string) => { const s = new Set(sel); if (s.has(k)) s.delete(k); else s.add(k); setSel(s); };
  const toggleGroup = (g: string) => { const keys = perms.filter((p) => p.group === g).map((p) => p.key); const all = keys.every((k) => sel.has(k)); const s = new Set(sel); keys.forEach((k) => (all ? s.delete(k) : s.add(k))); setSel(s); };
  const save = async () => {
    try {
      const body = { name, permissions: Array.from(sel), company_id: workspace.companyId };
      if (edit.id) await api.put(`/roles/update/${edit.id}`, body); else await api.post("/roles/create", body);
      toast.success("Role saved"); setEdit(null); reload();
    } catch (e) { if (e instanceof ApiError && e.errors) setErrors(e.errors); toast.error(errorMessage(e)); }
  };
  const del = async (r: any) => { if (!window.confirm(`Delete role ${r.name}?`)) return; try { await api.del(`/roles/delete/${r.id}`); toast.success("Role deleted"); reload(); } catch (e) { toast.error(errorMessage(e)); } };
  const readOnly = edit && edit.company_id === null && edit.id;

  return (
    <div>
      <PageHeader title="Roles & permissions" subtitle="System roles are shared by all companies. Create custom roles for your team." actions={manage && <Btn onClick={() => open(null)}>+ New role</Btn>} />
      <DataTable rows={extractList<any>(data)} loading={loading} error={error} onRetry={reload} searchKeys={["name"]}
        columns={[text("name", "Role"), { key: "company_id", label: "Type", render: (r: any) => (r.company_id === null ? "System" : "Custom") }, { key: "permissions", label: "Permissions", value: (r: any) => r.permissions.length, render: (r: any) => `${r.permissions.length} of ${perms.length}` }, numCol("users_count", "Assignments")]}
        actions={(r) => <>
          <Btn size="sm" variant="outline" onClick={() => open(r)}>{r.company_id === null || !manage ? "View" : "Edit"}</Btn>
          {manage && r.company_id !== null && <Btn size="sm" variant="ghost" className="text-error-500" onClick={() => del(r)}>Delete</Btn>}
        </>} />
      <SbModal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? `Role: ${edit.name}` : "New role"} wide
        footer={!readOnly && manage ? <><Btn variant="outline" onClick={() => setEdit(null)}>Cancel</Btn><Btn onClick={save}>Save role</Btn></> : undefined}>
        {readOnly && <div className="mb-4"><Alert kind="info">System roles cannot be changed. Create a custom role instead.</Alert></div>}
        <FieldWrap label="Role name" required error={errors?.name?.[0]}><input className={inputCls} value={name} disabled={!!readOnly || !manage} onChange={(e) => setName(e.target.value)} /></FieldWrap>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {groups.map((g) => (
            <div key={g} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              <div className="mb-2 flex items-center justify-between"><h5 className="font-medium text-gray-800 dark:text-white/90">{g}</h5>{!readOnly && manage && <button className="text-xs text-brand-500" onClick={() => toggleGroup(g)}>Toggle all</button>}</div>
              {perms.filter((p) => p.group === g).map((p) => (
                <label key={p.key} className="flex items-center gap-2 py-0.5 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" disabled={!!readOnly || !manage} checked={sel.has(p.key)} onChange={() => toggle(p.key)} /> {p.label} <code className="text-[10px] text-gray-400">{p.key}</code>
                </label>
              ))}
            </div>
          ))}
        </div>
        {errors?.permissions && <p className="mt-2 text-xs text-error-500">{errors.permissions[0]}</p>}
      </SbModal>
    </div>
  );
}
