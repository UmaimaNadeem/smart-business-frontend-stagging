"use client";
import React from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/modal";
import Badge from "@/components/ui/badge/Badge";
import { label } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";

export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {back && <Link href={back.href} className="mb-1 inline-block text-sm text-brand-500 hover:underline">← {back.label}</Link>}
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = "" }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h3 className="text-base font-medium text-gray-800 dark:text-white/90">{title}</h3>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "danger" | "ghost" | "success"; size?: "sm" | "md"; loading?: boolean };
export function Btn({ variant = "primary", size = "md", loading, className = "", children, disabled, type = "button", ...rest }: BtnProps) {
  const v = {
    primary: "bg-brand-500 text-white hover:bg-brand-600 shadow-theme-xs",
    success: "bg-success-500 text-white hover:bg-success-600 shadow-theme-xs",
    danger: "bg-error-500 text-white hover:bg-error-600 shadow-theme-xs",
    outline: "bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-white/[0.03]",
    ghost: "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5",
  }[variant];
  const s = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm";
  return (
    <button type={type} disabled={disabled || loading} className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${v} ${s} ${className}`} {...rest}>
      {loading && <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

const STATUS_COLORS: Record<string, "success" | "warning" | "error" | "info" | "light" | "primary"> = {
  active: "success", completed: "success", received: "success", delivered: "success", paid: "success", posted: "success", accepted: "success", reconciled: "success",
  draft: "light", inactive: "light", not_billed: "light", void: "light", reversed: "light", revoked: "light", cancelled: "error", expired: "error", failed: "error", suspended: "error",
  pending: "warning", partial: "warning", partially_received: "warning", unpaid: "warning", past_due: "warning", open: "warning", trialing: "info",
  confirmed: "info", dispatched: "primary",
};
export function StatusBadge({ status }: { status?: string | number | boolean | null }) {
  const s = status === 1 || status === true ? "active" : status === 0 || status === false ? "inactive" : String(status ?? "-");
  return <Badge size="sm" color={STATUS_COLORS[s] ?? "light"}>{label(s)}</Badge>;
}

export function Loading({ text = "Loading…" }: { text?: string }) {
  return <div className="flex items-center gap-2 py-10 text-sm text-gray-500"><span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />{text}</div>;
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
      {message} {onRetry && <button onClick={onRetry} className="ml-2 underline">Retry</button>}
    </div>
  );
}
export function Empty({ text = "Nothing here yet." }: { text?: string }) {
  return <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">{text}</div>;
}
export function Alert({ kind = "info", children }: { kind?: "info" | "warning" | "error" | "success"; children: React.ReactNode }) {
  const c = { info: "border-blue-light-200 bg-blue-light-50 text-blue-light-700", warning: "border-warning-200 bg-warning-50 text-warning-700", error: "border-error-200 bg-error-50 text-error-700", success: "border-success-200 bg-success-50 text-success-700" }[kind];
  return <div className={`rounded-xl border p-3 text-sm ${c} dark:bg-white/5 dark:text-gray-200`}>{children}</div>;
}

export function Stat({ title, value, hint, href }: { title: string; value: React.ReactNode; hint?: React.ReactNode; href?: string }) {
  const body = (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      <p className="mt-2 text-xl font-semibold text-gray-800 dark:text-white/90">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function SbModal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  return (
    <Modal isOpen={open} onClose={onClose} className={`m-4 ${wide ? "max-w-[980px]" : "max-w-[640px]"}`}>
      <div className="max-h-[90vh] overflow-y-auto p-5 sm:p-7">
        <h4 className="mb-5 pr-10 text-lg font-semibold text-gray-800 dark:text-white/90">{title}</h4>
        {children}
        {footer && <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </Modal>
  );
}

export const inputCls = "h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 disabled:opacity-60";

export function FieldWrap({ label: l, error, hint, children, required, className = "" }: { label?: string; error?: string; hint?: string; children: React.ReactNode; required?: boolean; className?: string }) {
  return (
    <div className={className}>
      {l && <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">{l}{required && <span className="text-error-500"> *</span>}</label>}
      {children}
      {error ? <p className="mt-1 text-xs text-error-500">{error}</p> : hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

export function KV({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs uppercase tracking-wide text-gray-400">{k}</dt>
          <dd className="text-sm text-gray-800 dark:text-white/90">{v ?? "-"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Simple static table for detail views and reports. */
export function SimpleTable({ head, rows, foot }: { head: React.ReactNode[]; rows: React.ReactNode[][]; foot?: React.ReactNode[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead><tr className="border-b border-gray-100 dark:border-gray-800">{head.map((h, i) => <th key={i} className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">{h}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={head.length}><Empty /></td></tr>}
          {rows.map((r, i) => <tr key={i} className="border-b border-gray-100 dark:border-gray-800">{r.map((c, j) => <td key={j} className="px-3 py-2 text-gray-700 dark:text-gray-300">{c}</td>)}</tr>)}
        </tbody>
        {foot && <tfoot><tr className="font-semibold">{foot.map((c, i) => <td key={i} className="px-3 py-2 text-gray-800 dark:text-white/90">{c}</td>)}</tr></tfoot>}
      </table>
    </div>
  );
}

/** Hide children unless the user has the permission. */
export function Can({ perm, children, fallback = null }: { perm: string | string[]; children: React.ReactNode; fallback?: React.ReactNode }) {
  const { canAny } = useAuth();
  const list = Array.isArray(perm) ? perm : [perm];
  return <>{canAny(...list) ? children : fallback}</>;
}

export function Tabs({ tabs, value, onChange }: { tabs: { key: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  return (
    <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-900">
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${value === t.key ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}>{t.label}</button>
      ))}
    </div>
  );
}
