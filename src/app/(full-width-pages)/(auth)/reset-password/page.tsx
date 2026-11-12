"use client";
import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { AuthTitle, TextField } from "@/components/sb/AuthBits";
import { Alert, Btn } from "@/components/sb/ui";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null); setErrors({});
    try {
      await api.post("/password/reset", { token: params.get("token") ?? "", email, password, password_confirmation: confirm }, { auth: false, tenant: false });
      router.replace("/signin?reset=1");
    } catch (err) {
      if (err instanceof ApiError && err.errors) setErrors(err.errors);
      setError(errorMessage(err));
    } finally { setBusy(false); }
  };

  return (
    <>
      <AuthTitle title="Choose a new password" />
      {!params.get("token") && <div className="mb-4"><Alert kind="warning">This page needs the token from your reset email.</Alert></div>}
      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      <form onSubmit={submit} className="space-y-4">
        <TextField label="Email" name="email" type="email" value={email} onChange={setEmail} error={errors.email?.[0]} />
        <TextField label="New password" name="password" type="password" value={password} onChange={setPassword} error={errors.password?.[0]} />
        <TextField label="Confirm password" name="password_confirmation" type="password" value={confirm} onChange={setConfirm} />
        <Btn type="submit" loading={busy} className="w-full">Reset password</Btn>
      </form>
    </>
  );
}
export default function ResetPasswordPage() { return <Suspense><ResetForm /></Suspense>; }
