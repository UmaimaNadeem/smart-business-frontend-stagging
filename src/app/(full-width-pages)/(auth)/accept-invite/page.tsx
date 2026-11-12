"use client";
import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, unwrap } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { useAuth } from "@/context/AuthContext";
import { AuthTitle, TextField } from "@/components/sb/AuthBits";
import { Alert, Btn, Loading } from "@/components/sb/ui";

interface Preview { email: string; company: string; business: string | null; role: string; existing_user: boolean }

function AcceptForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const router = useRouter();
  const { login } = useAuth();
  const [inv, setInv] = useState<Preview | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setLoadErr("Missing invitation token."); return; }
    api.get(`/invitations/token/${token}`, undefined, { auth: false, tenant: false }).then((r) => setInv(unwrap<Preview>(r))).catch((e) => setLoadErr(errorMessage(e)));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null); setErrors({});
    try {
      const r = await api.post<{ access_token: string; expires_at: string }>("/invitations/accept", { token, name, password, password_confirmation: confirm }, { auth: false, tenant: false });
      await login(r.access_token, r.expires_at);
      router.replace("/");
    } catch (err) {
      if (err instanceof ApiError && err.errors) setErrors(err.errors);
      setError(errorMessage(err));
    } finally { setBusy(false); }
  };

  if (loadErr) return <><AuthTitle title="Invitation" /><Alert kind="error">{loadErr}</Alert></>;
  if (!inv) return <Loading />;
  return (
    <>
      <AuthTitle title={`Join ${inv.company}`} subtitle={<>You were invited as <b>{inv.role}</b>{inv.business ? <> at <b>{inv.business}</b></> : null} using <b>{inv.email}</b>.</>} />
      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      <form onSubmit={submit} className="space-y-4">
        {!inv.existing_user && <TextField label="Your name" name="name" value={name} onChange={setName} error={errors.name?.[0]} />}
        <TextField label={inv.existing_user ? "Your existing password" : "Choose a password"} name="password" type="password" value={password} onChange={setPassword} error={errors.password?.[0]} />
        {!inv.existing_user && <TextField label="Confirm password" name="password_confirmation" type="password" value={confirm} onChange={setConfirm} />}
        <Btn type="submit" loading={busy} className="w-full">Accept invitation</Btn>
      </form>
    </>
  );
}
export default function AcceptInvitePage() { return <Suspense><AcceptForm /></Suspense>; }
