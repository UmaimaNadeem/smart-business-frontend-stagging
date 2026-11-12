"use client";
import React from "react";
import { FieldWrap, inputCls } from "./ui";

export function AuthTitle({ title, subtitle }: { title: string; subtitle?: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">{title}</h1>
      {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
    </div>
  );
}

export function TextField({ label, name, type = "text", value, onChange, error, placeholder, autoComplete, required = true }: {
  label: string; name: string; type?: string; value: string; onChange: (v: string) => void; error?: string; placeholder?: string; autoComplete?: string; required?: boolean;
}) {
  return (
    <FieldWrap label={label} error={error} required={required}>
      <input className={`${inputCls} h-11`} name={name} type={type} value={value} placeholder={placeholder} autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} />
    </FieldWrap>
  );
}
