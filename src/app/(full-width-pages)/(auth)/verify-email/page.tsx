"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { useAuth } from "@/context/AuthContext";
import { USE_MOCK } from "@/lib/config";
import { AuthTitle } from "@/components/sb/AuthBits";
import { Alert, Btn, Loading } from "@/components/sb/ui";

export default function VerifyEmailPage() {
  const { me, loading, logout, refresh } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;
  if (!me) return <><AuthTitle title="Verify your email" subtitle="Open the link we emailed you, then sign in." /><Link href="/signin" className="text-brand-500">Go to sign in</Link></>;
  if (me.email_verified) return <><AuthTitle title="Email verified" /><Btn onClick={() => router.replace("/")}>Continue</Btn></>;

  const resend = async () => {
    setBusy(true);
    try { const r = await api.post<{ message: string }>("/email/resend"); toast.success(r.message ?? "Verification link sent"); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  const simulate = async () => {
    try { await api.get(`/email/verify/${me.id}/mock-hash`, undefined, { auth: false, tenant: false }); await refresh(); router.replace("/onboarding"); } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <>
      <AuthTitle title="Verify your email" subtitle={<>We sent a verification link to <b>{me.email}</b>. Click it to activate your account.</>} />
      <div className="flex flex-wrap gap-2">
        <Btn loading={busy} onClick={resend}>Resend link</Btn>
        <Btn variant="outline" onClick={logout}>Sign out</Btn>
      </div>
      {USE_MOCK && <div className="mt-6"><Alert kind="info">Demo mode: no real email is sent. <button onClick={simulate} className="font-semibold underline">Simulate clicking the email link</button></Alert></div>}
    </>
  );
}
