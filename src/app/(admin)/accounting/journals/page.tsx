"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { api, extractList } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { DataTable } from "@/components/sb/DataTable";
import { dateCol, moneyCol, statusCol, text } from "@/components/sb/cols";
import { Alert, Btn, FieldWrap, PageHeader, SbModal, SimpleTable, inputCls } from "@/components/sb/ui";
import { money, round2Safe, todayIso } from "@/lib/format";

type JL = { account_id: string; debit: string; credit: string; description: string };
const blank = (): JL => ({ account_id: "", debit: "", credit: "", description: "" });

function Journals() {
  const { can } = useAuth();
  const focus = useSearchParams().get("focus");
  const { data, loading, error, reload } = useApi("/journals");
  const { data: accRaw } = useApi("/accounts");
  const accounts = extractList<any>(accRaw).filter((a) => a.status === "active");
  const rows = extractList<any>(data).slice().reverse();
  const [view, setView] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [head, setHead] = useState({ date: todayIso(), memo: "" });
  const [lines, setLines] = useState<JL[]>([blank(), blank()]);
  const [errors, setErrors] = useState<Record<string, string[]> | null>(null);
  const [busy, setBusy] = useState(false);
  const dr = round2Safe(lines.reduce((s, l) => s + Number(l.debit || 0), 0));
  const cr = round2Safe(lines.reduce((s, l) => s + Number(l.credit || 0), 0));
  const setL = (i: number, p: Partial<JL>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...p } : l)));

  const save = async () => {
    setBusy(true); setErrors(null);
    try {
      await api.post("/journals", { ...head, lines: lines.filter((l) => l.account_id).map((l) => ({ account_id: Number(l.account_id), debit: Number(l.debit || 0), credit: Number(l.credit || 0), description: l.description })) });
      toast.success("Journal posted"); setOpen(false); reload();
    } catch (e) { if (e instanceof ApiError && e.errors) setErrors(e.errors); toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  const reverse = async (j: any) => {
    if (!window.confirm(`Reverse ${j.journal_no}?`)) return;
    try { await api.post(`/journals/${j.id}/reverse`); toast.success("Reversal posted"); reload(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const focused = focus ? rows.find((r) => String(r.id) === focus) : null;

  return (
    <div>
      <PageHeader title="Journal entries" subtitle="Every financial event posts a balanced double-entry journal. Add manual journals for adjustments."
        actions={can("accounting.manage") && <Btn onClick={() => { setHead({ date: todayIso(), memo: "" }); setLines([blank(), blank()]); setErrors(null); setOpen(true); }}>+ Manual journal</Btn>} />
      <DataTable rows={rows} loading={loading} error={error} onRetry={reload} pageSize={15} searchKeys={["journal_no", "memo", "source_no"]} onRowClick={setView}
        filters={[{ key: "source_type", label: "Source", options: Array.from(new Set(rows.map((r) => r.source_type))).map((s) => ({ value: s, label: String(s).replace(/_/g, " ") })) }]}
        columns={[text("journal_no", "Number"), dateCol("date", "Date"), text("memo", "Memo"), { key: "source_type", label: "Source", render: (r: any) => String(r.source_type).replace(/_/g, " ") }, text("source_no", "Doc"), moneyCol("total", "Amount"), statusCol()]}
        actions={(j) => j.source_type === "manual" && j.status !== "reversed" && can("accounting.manage") ? <Btn size="sm" variant="outline" onClick={() => reverse(j)}>Reverse</Btn> : null} />
      <SbModal open={!!(view ?? focused)} onClose={() => { setView(null); if (focus) history.replaceState(null, "", "/accounting/journals"); }} title={`Journal ${(view ?? focused)?.journal_no ?? ""}`} wide>
        {(view ?? focused) && <><p className="mb-3 text-sm text-gray-500">{(view ?? focused).memo}</p>
          <SimpleTable head={["Code", "Account", "Description", "Debit", "Credit"]} rows={(view ?? focused).lines.map((l: any) => [l.code, l.account, l.description ?? "", l.debit ? money(l.debit) : "", l.credit ? money(l.credit) : ""])} foot={["", "", "Total", money((view ?? focused).total), money((view ?? focused).total)]} /></>}
      </SbModal>
      <SbModal open={open} onClose={() => setOpen(false)} title="Manual journal" wide footer={<><Btn variant="outline" onClick={() => setOpen(false)}>Cancel</Btn><Btn loading={busy} disabled={dr !== cr || dr === 0} onClick={save}>Post journal</Btn></>}>
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <FieldWrap label="Date" required><input type="date" className={inputCls} value={head.date} onChange={(e) => setHead({ ...head, date: e.target.value })} /></FieldWrap>
          <FieldWrap label="Memo" required className="sm:col-span-2" error={errors?.memo?.[0]}><input className={inputCls} value={head.memo} onChange={(e) => setHead({ ...head, memo: e.target.value })} /></FieldWrap>
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1.5fr_1fr_1fr_24px]">
              <select className={inputCls} value={l.account_id} onChange={(e) => setL(i, { account_id: e.target.value })}><option value="">Account…</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select>
              <input className={inputCls} placeholder="Description" value={l.description} onChange={(e) => setL(i, { description: e.target.value })} />
              <input className={inputCls} type="number" placeholder="Debit" value={l.debit} onChange={(e) => setL(i, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} />
              <input className={inputCls} type="number" placeholder="Credit" value={l.credit} onChange={(e) => setL(i, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} />
              <button className="text-error-500" onClick={() => setLines(lines.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <Btn size="sm" variant="outline" onClick={() => setLines([...lines, blank()])}>+ Add line</Btn>
        </div>
        <div className="mt-4">{dr === cr && dr > 0 ? <Alert kind="success">Balanced: debits {money(dr)} = credits {money(cr)}</Alert> : <Alert kind="warning">Debits {money(dr)} vs credits {money(cr)} — difference {money(Math.abs(dr - cr))}. Journals must balance.</Alert>}</div>
        {errors && Object.entries(errors).filter(([k]) => k !== "memo").map(([k, v]) => <p key={k} className="mt-1 text-xs text-error-500">{v[0]}</p>)}
      </SbModal>
    </div>
  );
}
export default function JournalsPage() { return <Suspense><Journals /></Suspense>; }
