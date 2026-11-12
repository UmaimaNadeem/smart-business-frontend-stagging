"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import toast from "react-hot-toast";
import { api, extractList } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { useApi } from "@/hooks/useApi";
import { DataTable } from "@/components/sb/DataTable";
import { dateCol, statusCol, text } from "@/components/sb/cols";
import { Btn, FieldWrap, PageHeader, SbModal, inputCls } from "@/components/sb/ui";

export default function PlatformSubscriptionsPage() {
  const { data, loading, error, reload } = useApi("/platform/subscriptions");
  const { data: plansRaw } = useApi("/platform/plans");
  const [edit, setEdit] = useState<any>(null);
  const [f, setF] = useState({ status: "", plan_code: "", extend_days: "" });
  const save = async () => {
    try { await api.put(`/platform/subscriptions/${edit.id}`, { status: f.status || undefined, plan_code: f.plan_code || undefined, extend_days: f.extend_days ? Number(f.extend_days) : undefined }); toast.success("Subscription updated"); setEdit(null); reload(); }
    catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <div>
      <PageHeader title="Subscriptions" subtitle="Override status, change plan or extend trials/periods for support cases." />
      <DataTable rows={extractList<any>(data)} loading={loading} error={error} onRetry={reload} searchKeys={["company", "plan"]}
        filters={[{ key: "effective_status", label: "Status", options: ["trialing", "active", "past_due", "expired", "cancelled"].map((v) => ({ value: v, label: v })) }]}
        columns={[text("company", "Company"), text("plan", "Plan"), text("billing_cycle", "Cycle"), statusCol("effective_status", "Status"), dateCol("trial_ends_at", "Trial ends"), dateCol("current_period_end", "Period ends"), dateCol("grace_ends_at", "Grace ends"), { key: "cancel_at_period_end", label: "Cancelling", render: (r: any) => (r.cancel_at_period_end ? "Yes" : "") }]}
        actions={(s) => <Btn size="sm" variant="outline" onClick={() => { setF({ status: "", plan_code: "", extend_days: "" }); setEdit(s); }}>Manage</Btn>} />
      <SbModal open={!!edit} onClose={() => setEdit(null)} title={`Manage ${edit?.company ?? ""}`} footer={<><Btn variant="outline" onClick={() => setEdit(null)}>Cancel</Btn><Btn onClick={save}>Save</Btn></>}>
        <div className="grid gap-4 sm:grid-cols-3">
          <FieldWrap label="Status"><select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">No change</option>{["trialing", "active", "past_due", "cancelled", "expired"].map((v) => <option key={v}>{v}</option>)}</select></FieldWrap>
          <FieldWrap label="Plan"><select className={inputCls} value={f.plan_code} onChange={(e) => setF({ ...f, plan_code: e.target.value })}><option value="">No change</option>{extractList<any>(plansRaw).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</select></FieldWrap>
          <FieldWrap label="Extend by (days)"><input type="number" className={inputCls} value={f.extend_days} onChange={(e) => setF({ ...f, extend_days: e.target.value })} /></FieldWrap>
        </div>
      </SbModal>
    </div>
  );
}
