"use client";
import React, { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { AuthTitle, TextField } from "@/components/sb/AuthBits";
import { Alert, Btn } from "@/components/sb/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ text: string; url?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const r = await api.post<{ message: string; mock_reset_url?: string }>("/password/forgot", { email }, { auth: false, tenant: false });
      setMsg({ text: r.message, url: r.mock_reset_url });
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <>
      <AuthTitle title="Forgot password" subtitle="We'll email you a link to reset it." />
      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      {msg ? (
        <Alert kind="success">{msg.text}{msg.url && <> Demo link: <Link className="font-semibold underline" href={msg.url}>reset password</Link></>}</Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <TextField label="Email" name="email" type="email" value={email} onChange={setEmail} />
          <Btn type="submit" loading={busy} className="w-full">Send reset link</Btn>
        </form>
      )}
      <p className="mt-5 text-center text-sm"><Link href="/signin" className="text-brand-500">Back to sign in</Link></p>
    </>
  );
}
