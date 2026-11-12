"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { api, extractList, RequestOptions } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { Column, DataTable, Filter } from "./DataTable";
import { FieldDef, FormGrid } from "./Form";
import { Btn, PageHeader, SbModal } from "./ui";

export interface ResourceConfig {
  title: string;
  subtitle?: string;
  singular: string;
  listPath: string;
  listQuery?: RequestOptions["query"];
  createPath?: string;
  updatePath?: (row: any) => string;
  updateMethod?: "PUT" | "POST";
  deletePath?: (row: any) => string;
  perms: { view?: string; create?: string; update?: string; delete?: string };
  columns: Column[];
  fields: FieldDef[];
  searchKeys?: string[];
  filters?: Filter[];
  defaults?: Record<string, any>;
  toPayload?: (form: Record<string, any>, mode: "create" | "edit") => any;
  fromRow?: (row: any) => Record<string, any>;
  detailHref?: (row: any) => string;
  rowActions?: (row: any, reload: () => void) => React.ReactNode;
  headerExtra?: React.ReactNode;
  canEdit?: (row: any) => boolean;
}

export function ResourcePage({ config }: { config: ResourceConfig }) {
  const { can } = useAuth();
  const router = useRouter();
  const { data, loading, error, reload } = useApi(config.listPath, config.listQuery);
  const rows = extractList<any>(data);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string[]> | null>(null);
  const [saving, setSaving] = useState(false);

  const allowed = (p?: string) => !p || can(p);

  const openCreate = () => { setMode("create"); setEditing(null); setForm({ ...(config.defaults ?? {}) }); setErrors(null); setOpen(true); };
  const openEdit = (row: any) => {
    setMode("edit"); setEditing(row);
    const base: Record<string, any> = {};
    config.fields.forEach((f) => (base[f.name] = row[f.name] ?? ""));
    setForm(config.fromRow ? config.fromRow(row) : base); setErrors(null); setOpen(true);
  };

  const save = async () => {
    setSaving(true); setErrors(null);
    try {
      const payload = config.toPayload ? config.toPayload(form, mode) : form;
      if (mode === "create") await api.post(config.createPath!, payload);
      else if (config.updateMethod === "POST") await api.post(config.updatePath!(editing), payload);
      else await api.put(config.updatePath!(editing), payload);
      toast.success(`${config.singular} ${mode === "create" ? "created" : "updated"}`);
      setOpen(false); reload();
    } catch (e) {
      if (e instanceof ApiError && e.errors) setErrors(e.errors);
      toast.error(errorMessage(e));
    } finally { setSaving(false); }
  };

  const del = async (row: any) => {
    if (!window.confirm(`Delete this ${config.singular.toLowerCase()}?`)) return;
    try { await api.del(config.deletePath!(row)); toast.success(`${config.singular} deleted`); reload(); } catch (e) { toast.error(errorMessage(e)); }
  };

  const hasActions = (config.updatePath && allowed(config.perms.update)) || (config.deletePath && allowed(config.perms.delete)) || config.rowActions;

  return (
    <div>
      <PageHeader title={config.title} subtitle={config.subtitle} actions={<>{config.headerExtra}{config.createPath && allowed(config.perms.create) && <Btn onClick={openCreate}>+ New {config.singular.toLowerCase()}</Btn>}</>} />
      <DataTable
        columns={config.columns} rows={rows} loading={loading} error={error} onRetry={reload}
        searchKeys={config.searchKeys} filters={config.filters}
        onRowClick={config.detailHref ? (r) => router.push(config.detailHref!(r)) : undefined}
        actions={hasActions ? (r) => (
          <>
            {config.rowActions?.(r, reload)}
            {config.updatePath && allowed(config.perms.update) && (config.canEdit?.(r) ?? true) && <Btn size="sm" variant="outline" onClick={() => openEdit(r)}>Edit</Btn>}
            {config.deletePath && allowed(config.perms.delete) && <Btn size="sm" variant="ghost" className="text-error-500" onClick={() => del(r)}>Delete</Btn>}
          </>
        ) : undefined}
      />
      <SbModal open={open} onClose={() => setOpen(false)} title={`${mode === "create" ? "New" : "Edit"} ${config.singular.toLowerCase()}`}
        footer={<><Btn variant="outline" onClick={() => setOpen(false)}>Cancel</Btn><Btn loading={saving} onClick={save}>Save</Btn></>}>
        <FormGrid fields={config.fields} values={form} setValues={setForm} errors={errors} mode={mode} />
      </SbModal>
    </div>
  );
}
