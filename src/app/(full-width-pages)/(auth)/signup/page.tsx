"use client";
import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { useAuth } from "@/context/AuthContext";
import { AuthTitle, TextField } from "@/components/sb/AuthBits";
import { Alert, Btn } from "@/components/sb/ui";

export default function SignUpPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [f, setF] = useState({ name: "", company_name: "", email: "", password: "", password_confirmation: "" });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setErrors({});
    try {
      const res = await api.post<{ access_token: string; expires_at: string }>("/register", f, { auth: false, tenant: false });
      await login(res.access_token, res.expires_at);
      router.replace("/verify-email");
    } catch (err) {
      if (err instanceof ApiError && err.errors) setErrors(err.errors);
      setError(errorMessage(err));
    } finally { setBusy(false); }
  };

  return (
    <>
      <AuthTitle title="Create your company" subtitle="Start a free 14-day trial. No card required." />
      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      <form onSubmit={submit} className="space-y-4">
        <TextField label="Your name" name="name" value={f.name} onChange={set("name")} error={errors.name?.[0]} autoComplete="name" />
        <TextField label="Company name" name="company_name" value={f.company_name} onChange={set("company_name")} error={errors.company_name?.[0]} autoComplete="organization" />
        <TextField label="Work email" name="email" type="email" value={f.email} onChange={set("email")} error={errors.email?.[0]} autoComplete="email" />
        <TextField label="Password" name="password" type="password" value={f.password} onChange={set("password")} error={errors.password?.[0]} autoComplete="new-password" />
        <TextField label="Confirm password" name="password_confirmation" type="password" value={f.password_confirmation} onChange={set("password_confirmation")} autoComplete="new-password" />
        <Btn type="submit" loading={busy} className="w-full">Create account</Btn>
      </form>
      <p className="mt-5 text-center text-sm text-gray-700 dark:text-gray-400">Already registered? <Link href="/signin" className="text-brand-500">Sign in</Link></p>
    </>
  );
}
