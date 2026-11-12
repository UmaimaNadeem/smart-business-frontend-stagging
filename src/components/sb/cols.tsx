"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { Column } from "./DataTable";
import { StatusBadge } from "./ui";
import { date, money, num } from "@/lib/format";

export const text = (key: string, label: string): Column => ({ key, label });
export const moneyCol = (key: string, label: string): Column => ({ key, label, render: (r) => money(r[key]), value: (r) => Number(r[key] ?? 0), className: "text-right" });
export const numCol = (key: string, label: string): Column => ({ key, label, render: (r) => num(r[key]), value: (r) => Number(r[key] ?? 0), className: "text-right" });
export const dateCol = (key: string, label: string): Column => ({ key, label, render: (r) => date(r[key]) });
export const statusCol = (key = "status", label = "Status"): Column => ({ key, label, render: (r) => <StatusBadge status={r[key]} /> });
export const linkCol = (key: string, label: string, href: (r: any) => string): Column => ({ key, label, render: (r) => <Link className="font-medium text-brand-500 hover:underline" href={href(r)} onClick={(e) => e.stopPropagation()}>{r[key] ?? "-"}</Link> });

export const ACTIVE_OPTIONS = [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }];
export const statusFilter = (values: string[], key = "status") => ({ key, label: "Status", options: values.map((v) => ({ value: v, label: v.replace(/_/g, " ") })) });
