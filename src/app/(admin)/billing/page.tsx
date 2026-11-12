"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { api, extractList, unwrap } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { Alert, Btn, Card, ErrorState, KV, Loading, PageHeader, SbModal, SimpleTable, StatusBadge, Tabs } from "@/components/sb/ui";
import { date, dateTime, money } from "@/lib/format";

const LIMITS = ["users", "branches", "warehouses", "products"] as const;

export default function BillingPage() {
  const { can, refreshSubscription } = useAuth();
  const { data, loading, error, reload } = useApi<any>("/subscription");
  const { data: plansRaw } = useApi("/subscription/plans");
  const { data: eventsRaw, reload: reloadEvents } = useApi("/subscription/events");
  const plans = extractList<any>(plansRaw);
  const [cycle, setCycle] = useState("monthly");
  const [checkout, setCheckout] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const manage = can("subscription.manage");

  if (loading && !data) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const s = unwrap<any>(data);
  const sub = s.subscription;
  const after = () => { reload(); reloadEvents(); refreshSubscription(); };

  const change = async (code: string) => {
    setBusy(code);
    try { const r = await api.post<any>("/subscription/change", { plan_code: code, billing_cycle: cycle }); toast.success(r.message); setCheckout(unwrap<any>(r).invoice); after(); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusy(null); }
  };
  const pay = async (inv: any, simulate?: "fail") => {
    setBusy("pay");
    try { const r = await api.post<any>(`/subscription/invoices/${inv.id}/pay`, simulate ? { simulate } : {}); toast.success(r.message); setCheckout(null); }
    catch (e) { toast.error(errorMessage(e)); setCheckout(null); } finally { setBusy(null); after(); }
  };
  const cancel = async () => {
    const reason = window.prompt("Why are you cancelling? (optional)"); if (reason === null) return;
    try { const r = await api.post<any>("/subscription/cancel", { reason }); toast.success(r.message); after(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const resume = async () => { try { const r = await api.post<any>("/subscription/resume"); toast.success(r.message); after(); } catch (e) { toast.error(errorMessage(e)); } };

  return (
    <div className="space-y-6">
      <PageHeader title="Subscription" subtitle="Your plan, usage and billing." actions={<Link href="/billing/invoices"><Btn variant="outline">Invoices</Btn></Link>} />
      {!manage && <Alert kind="info">Only the company owner can change the plan or pay invoices.</Alert>}
      {sub && (
        <Card title={<span className="flex items-center gap-2">Current plan: {s.plan?.name} <StatusBadge status={sub.status} /></span>}
          actions={manage && (sub.cancel_at_period_end ? <Btn size="sm" onClick={resume}>Resume subscription</Btn> : sub.status !== "expired" && <Btn size="sm" variant="ghost" className="text-error-500" onClick={cancel}>Cancel subscription</Btn>)}>
          <KV items={[["Billing cycle", sub.billing_cycle], ["Price", money(sub.billing_cycle === "yearly" ? s.plan?.price_yearly : s.plan?.price_monthly)], ["Trial ends", date(sub.trial_ends_at)], ["Current period ends", date(sub.current_period_end)], ["Grace period ends", date(sub.grace_ends_at)], ["Cancels at period end", sub.cancel_at_period_end ? "Yes" : "No"]]} />
        </Card>
      )}
      {s.open_invoices.length > 0 && (
        <Card title="Unpaid invoices">
          <SimpleTable head={["Invoice", "Plan", "Amount", "Status", ""]} rows={s.open_invoices.map((i: any) => [i.invoice_no, `${i.plan_name} (${i.billing_cycle})`, money(i.amount, i.currency), <StatusBadge key="s" status={i.status} />, manage ? <Btn key="p" size="sm" onClick={() => setCheckout(i)}>Pay now</Btn> : null])} />
        </Card>
      )}
      <Card title="Usage vs plan limits">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LIMITS.map((k) => {
            const used = s.usage[k]; const lim = s.entitlements[k];
            const pct = lim ? Math.min(100, (used / lim) * 100) : 0;
            return (
              <div key={k}>
                <div className="mb-1 flex justify-between text-sm"><span className="capitalize text-gray-600 dark:text-gray-400">{k}</span><span className="font-medium">{used} / {lim ?? "∞"}</span></div>
                <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800"><div className={`h-2 rounded-full ${pct >= 100 ? "bg-error-500" : pct >= 80 ? "bg-warning-500" : "bg-brand-500"}`} style={{ width: `${lim ? pct : 5}%` }} /></div>
              </div>
            );
          })}
        </div>
      </Card>
      <div>
        <div className="mb-3 flex items-center justify-between"><h3 className="text-base font-medium text-gray-800 dark:text-white/90">Plans</h3><Tabs value={cycle} onChange={setCycle} tabs={[{ key: "monthly", label: "Monthly" }, { key: "yearly", label: "Yearly" }]} /></div>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((p) => {
            const current = s.plan?.code === p.code;
            return (
              <div key={p.id} className={`rounded-2xl border p-5 ${current ? "border-brand-500 ring-1 ring-brand-500" : "border-gray-200 dark:border-gray-800"} bg-white dark:bg-white/[0.03]`}>
                <h4 className="text-lg font-semibold text-gray-800 dark:text-white">{p.name}</h4>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{money(cycle === "yearly" ? p.price_yearly : p.price_monthly, p.currency)}<span className="text-sm font-normal text-gray-500">/{cycle === "yearly" ? "yr" : "mo"}</span></p>
                <ul className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  {LIMITS.map((k) => <li key={k}>✓ {p.limits[k] ?? "Unlimited"} {k}</li>)}
                  {(p.features ?? []).map((f: string) => <li key={f}>✓ {f}</li>)}
                </ul>
                {manage && <Btn className="mt-4 w-full" variant={current ? "outline" : "primary"} loading={busy === p.code} onClick={() => change(p.code)}>{current ? (sub?.status === "expired" || sub?.status === "trialing" ? "Activate / renew" : "Renew / switch cycle") : "Switch to " + p.name}</Btn>}
              </div>
            );
          })}
        </div>
      </div>
      <Card title="Subscription history">
        <SimpleTable head={["When", "Event", "Details"]} rows={extractList<any>(eventsRaw).map((e) => [dateTime(e.created_at), e.type, JSON.stringify(e.payload ?? {}).slice(0, 80)])} />
      </Card>
      <SbModal open={!!checkout} onClose={() => setCheckout(null)} title="Checkout"
        footer={<><Btn variant="outline" onClick={() => setCheckout(null)}>Later</Btn><Btn variant="danger" loading={busy === "pay"} onClick={() => pay(checkout, "fail")}>Simulate declined card</Btn><Btn loading={busy === "pay"} onClick={() => pay(checkout)}>Pay {checkout && money(checkout.amount, checkout.currency)}</Btn></>}>
        {checkout && <><p className="text-sm text-gray-600 dark:text-gray-400">Invoice <b>{checkout.invoice_no}</b> · {checkout.plan_name} ({checkout.billing_cycle}) · {money(checkout.amount, checkout.currency)}</p>
          <div className="mt-4"><Alert kind="info">Demo payment gateway. In production this redirects to the configured provider (Stripe, PayFast, JazzCash…) and a webhook marks the invoice paid.</Alert></div></>}
      </SbModal>
    </div>
  );
}
