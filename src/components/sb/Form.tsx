"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { extractList } from "@/lib/api/client";
import { useApi } from "@/hooks/useApi";
import { FieldWrap, inputCls } from "./ui";

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "number" | "email" | "password" | "date" | "select" | "textarea" | "checkbox";
  required?: boolean;
  options?: { value: string | number; label: string }[];
  /** load select options from an API list endpoint */
  optionsFrom?: { path: string; value?: string; label?: string | ((r: any) => string); filter?: (r: any) => boolean };
  placeholder?: string;
  hint?: string;
  span?: 1 | 2;
  hideOnEdit?: boolean;
  hideOnCreate?: boolean;
  step?: string;
}

export function useOptions(def?: FieldDef["optionsFrom"]) {
  const { data } = useApi(def ? def.path : null);
  if (!def) return [];
  return extractList<any>(data).filter(def.filter ?? (() => true)).map((r) => ({ value: r[def.value ?? "id"], label: typeof def.label === "function" ? def.label(r) : r[def.label ?? "name"] }));
}

export function Field({ def, value, onChange, error }: { def: FieldDef; value: any; onChange: (v: any) => void; error?: string }) {
  const loaded = useOptions(def.optionsFrom);
  const options = def.options ?? loaded;
  let control: React.ReactNode;
  if (def.type === "select") {
    control = (
      <select className={inputCls} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">{def.placeholder ?? "Select…"}</option>
        {options.map((o) => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
      </select>
    );
  } else if (def.type === "textarea") {
    control = <textarea className={`${inputCls} h-24 py-2`} value={value ?? ""} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />;
  } else if (def.type === "checkbox") {
    control = <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {def.placeholder ?? def.label}</label>;
  } else {
    control = <input className={inputCls} type={def.type ?? "text"} step={def.step ?? (def.type === "number" ? "any" : undefined)} value={value ?? ""} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />;
  }
  return <FieldWrap label={def.type === "checkbox" ? undefined : def.label} required={def.required} error={error} hint={def.hint} className={def.span === 2 ? "sm:col-span-2" : ""}>{control}</FieldWrap>;
}

export function FormGrid({ fields, values, setValues, errors, mode }: { fields: FieldDef[]; values: Record<string, any>; setValues: (v: Record<string, any>) => void; errors?: Record<string, string[]> | null; mode?: "create" | "edit" }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.filter((f) => !(mode === "edit" && f.hideOnEdit) && !(mode === "create" && f.hideOnCreate)).map((f) => (
        <Field key={f.name} def={f} value={values[f.name]} error={errors?.[f.name]?.[0]} onChange={(v) => setValues({ ...values, [f.name]: v })} />
      ))}
    </div>
  );
}
