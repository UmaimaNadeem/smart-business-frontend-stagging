"use client";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { date } from "@/lib/format";

export default function SubscriptionBanner() {
  const { subscription: s, company } = useAuth();
  if (company?.account_status === "suspended") return <Bar kind="error">This account is suspended by the platform administrator. Contact support.</Bar>;
  if (!s) return null;
  const daysLeft = (d?: string | null) => (d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86400000) : null);
  if (s.status === "expired") return <Bar kind="error">Your subscription has expired. The workspace is read-only until you renew. <Link href="/billing" className="font-semibold underline">Renew now</Link></Bar>;
  if (s.status === "past_due") return <Bar kind="warning">Payment failed — you are in a grace period until {date(s.grace_ends_at)}. <Link href="/billing" className="font-semibold underline">Update payment</Link></Bar>;
  if (s.status === "trialing") {
    const d = daysLeft(s.trial_ends_at);
    return <Bar kind="info">Trial of {s.plan} — {d !== null && d >= 0 ? `${d} day(s) left` : "ending"}. <Link href="/billing" className="font-semibold underline">Choose a plan</Link></Bar>;
  }
  if (s.cancel_at_period_end) return <Bar kind="warning">Subscription will cancel on {date(s.current_period_end)}. <Link href="/billing" className="font-semibold underline">Resume</Link></Bar>;
  return null;
}

function Bar({ kind, children }: { kind: "error" | "warning" | "info"; children: React.ReactNode }) {
  const c = { error: "bg-error-50 text-error-700 border-error-200", warning: "bg-warning-50 text-warning-700 border-warning-200", info: "bg-blue-light-50 text-blue-light-700 border-blue-light-200" }[kind];
  return <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${c}`}>{children}</div>;
}
