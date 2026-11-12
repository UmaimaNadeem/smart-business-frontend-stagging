"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { unwrap } from "@/lib/api/client";
import { useApi } from "@/hooks/useApi";
import { Alert, Card, ErrorState, FieldWrap, Loading, PageHeader, SimpleTable, inputCls } from "@/components/sb/ui";
import { money, todayIso } from "@/lib/format";

export default function TrialBalancePage() {
  const [asOf, setAsOf] = useState(todayIso());
  const { data, loading, error, reload } = useApi<any>("/trial-balance", { as_of: asOf });
  const t = data ? unwrap<any>(data) : null;
  return (
    <div>
      <PageHeader title="Trial balance" actions={<FieldWrap label="As of"><input type="date" className={inputCls} value={asOf} onChange={(e) => setAsOf(e.target.value)} /></FieldWrap>} />
      {error ? <ErrorState message={error} onRetry={reload} /> : !t ? <Loading /> : (
        <Card>
          <div className="mb-4">{t.balanced ? <Alert kind="success">Balanced — total debits equal total credits.</Alert> : <Alert kind="error">Out of balance by {money(Math.abs(t.total_debit - t.total_credit))}</Alert>}</div>
          <SimpleTable head={["Code", "Account", "Type", "Debit", "Credit"]} rows={t.items.map((r: any) => [r.code, r.name, r.type, r.debit ? money(r.debit) : "", r.credit ? money(r.credit) : ""])} foot={["", "Total", "", money(t.total_debit), money(t.total_credit)]} />
        </Card>
      )}
      {loading && t && <p className="mt-2 text-xs text-gray-400">Refreshing…</p>}
    </div>
  );
}
