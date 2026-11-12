"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import toast from "react-hot-toast";
import { api, extractList, unwrap } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { DataTable } from "@/components/sb/DataTable";
import { dateCol, statusCol, text } from "@/components/sb/cols";
import { FormGrid } from "@/components/sb/Form";
import { Alert, Btn, PageHeader, SbModal } from "@/components/sb/ui";
import { USE_MOCK } from "@/lib/config";

export default function InvitationsPage() {
  const { can } = useAuth();
  const { data, loading, error, reload } = useApi("/invitations");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string[]> | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const manage = can("users.manage");

  const send = async () => {
    setErrors(null);
    try {
      const inv = unwrap<any>(await api.post("/invitations", { email: form.email, role_id: Number(form.role_id) || null, business_id: form.business_id ? Number(form.business_id) : null }));
      toast.success(`Invitation sent to ${inv.email}`); setOpen(false); setLink(inv.accept_url); reload();
    } catch (e) { if (e instanceof ApiError && e.errors) setErrors(e.errors); toast.error(errorMessage(e)); }
  };
  const resend = async (i: any) => { try { const r = unwrap<any>(await api.post(`/invitations/${i.id}/resend`)); toast.success("Invitation resent"); setLink(r.accept_url); reload(); } catch (e) { toast.error(errorMessage(e)); } };
  const revoke = async (i: any) => { if (!window.confirm(`Revoke invitation for ${i.email}?`)) return; try { await api.del(`/invitations/${i.id}`); toast.success("Invitation revoked"); reload(); } catch (e) { toast.error(errorMessage(e)); } };

  return (
    <div>
      <PageHeader title="Invitations" subtitle="Invite teammates by email. They choose their own password when accepting." actions={manage && <Btn onClick={() => { setForm({}); setErrors(null); setOpen(true); }}>+ Invite user</Btn>} />
      {link && USE_MOCK && <div className="mb-4"><Alert kind="success">Demo mode — no email is sent. Accept link: <a className="font-semibold underline" href={link} target="_blank" rel="noreferrer">{link}</a> (open in a private window)</Alert></div>}
      <DataTable rows={extractList<any>(data)} loading={loading} error={error} onRetry={reload} searchKeys={["email", "role"]}
        filters={[{ key: "status", label: "Status", options: ["pending", "accepted", "expired", "revoked"].map((v) => ({ value: v, label: v })) }]}
        columns={[text("email", "Email"), text("role", "Role"), text("business", "Branch"), text("invited_by_name", "Invited by"), dateCol("created_at", "Sent"), dateCol("expires_at", "Expires"), statusCol()]}
        actions={manage ? (i) => ["pending", "expired"].includes(i.status) ? <>
          <Btn size="sm" variant="outline" onClick={() => resend(i)}>Resend</Btn>
          {USE_MOCK && i.status === "pending" && <Btn size="sm" variant="ghost" onClick={() => setLink(i.accept_url)}>Link</Btn>}
          <Btn size="sm" variant="ghost" className="text-error-500" onClick={() => revoke(i)}>Revoke</Btn>
        </> : null : undefined} />
      <SbModal open={open} onClose={() => setOpen(false)} title="Invite user" footer={<><Btn variant="outline" onClick={() => setOpen(false)}>Cancel</Btn><Btn onClick={send}>Send invitation</Btn></>}>
        <FormGrid values={form} setValues={setForm} errors={errors} fields={[
          { name: "email", label: "Email", type: "email", required: true, span: 2 },
          { name: "role_id", label: "Role", type: "select", required: true, optionsFrom: { path: "/roles" } },
          { name: "business_id", label: "Branch", type: "select", placeholder: "All branches", optionsFrom: { path: "/businesses" } },
        ]} />
      </SbModal>
    </div>
  );
}
