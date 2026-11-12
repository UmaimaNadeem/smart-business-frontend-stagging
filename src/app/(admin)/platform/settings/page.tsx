"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { api, unwrap } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { useApi } from "@/hooks/useApi";
import { Btn, Card, FieldWrap, Loading, PageHeader, inputCls } from "@/components/sb/ui";

export default function PlatformSettingsPage() {
  const { data, loading } = useApi<any>("/platform/settings");
  const [s, setS] = useState<Record<string, any>>({});
  useEffect(() => { if (data) setS(unwrap<any>(data)); }, [data]);
  if (loading && !data) return <Loading />;
  const save = async () => { try { await api.put("/platform/settings", s); toast.success("Settings saved"); } catch (e) { toast.error(errorMessage(e)); } };
  return (
    <div>
      <PageHeader title="Platform settings" />
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(s).map(([k, v]) => (
            <FieldWrap key={k} label={k.replace(/_/g, " ")}>
              {typeof v === "boolean"
                ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v} onChange={(e) => setS({ ...s, [k]: e.target.checked })} /> Enabled</label>
                : <input className={inputCls} type={typeof v === "number" ? "number" : "text"} value={v ?? ""} onChange={(e) => setS({ ...s, [k]: typeof v === "number" ? Number(e.target.value) : e.target.value })} />}
            </FieldWrap>
          ))}
        </div>
        <div className="mt-6 flex justify-end"><Btn onClick={save}>Save settings</Btn></div>
      </Card>
    </div>
  );
}
