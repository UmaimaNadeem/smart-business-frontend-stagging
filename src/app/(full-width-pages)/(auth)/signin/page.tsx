"use client";
import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { ApiError, errorMessage } from "@/lib/api/errors";
import { useAuth } from "@/context/AuthContext";
import { USE_MOCK } from "@/lib/config";
import { AuthTitle, TextField } from "@/components/sb/AuthBits";
import { Alert, Btn } from "@/components/sb/ui";

const DEMO = [
  ["owner@demo.test", "Company owner (Al-Noor Traders)"],
  ["manager@demo.test", "Branch manager (Karachi only)"],
  ["staff@demo.test", "Warehouse staff"],
  ["accountant@demo.test", "Accountant (2 companies)"],
  ["owner@greenvalley.test", "Owner, payment past due"],
  ["owner@expiredmart.test", "Owner, expired trial"],
  ["admin@smartbusiness.test", "Platform admin"],
];

function SignInForm() {
  const params = useSearchParams();
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e?: React.FormEvent, creds?: { email: string; password: string }) => {
    e?.preventDefault();
    setBusy(true); setError(null); setErrors({});
    try {
      const res = await api.post<{ access_token: string; expires_at: string; email_verified: boolean }>("/login", creds ?? { email, password }, { auth: false, tenant: false });
      await login(res.access_token, res.expires_at);
      router.replace(res.email_verified ? "/" : "/verify-email");
    } catch (err) {
      if (err instanceof ApiError && err.errors) setErrors(err.errors);
      setError(errorMessage(err));
    } finally { setBusy(false); }
  };

  return (
    <>
      <AuthTitle title="Sign in" subtitle="Enter your email and password to access your workspace." />
      {params.get("verified") && <div className="mb-4"><Alert kind="success">Your email is verified. Please sign in.</Alert></div>}
      {params.get("expired") && <div className="mb-4"><Alert kind="warning">Your session expired. Please sign in again.</Alert></div>}
      {params.get("reset") && <div className="mb-4"><Alert kind="success">Password updated. Sign in with your new password.</Alert></div>}
      {error && <div className="mb-4"><Alert kind="error">{error}</Alert></div>}
      <form onSubmit={submit} className="space-y-5">
        <TextField label="Email" name="email" type="email" autoComplete="email" value={email} onChange={setEmail} error={errors.email?.[0]} />
        <TextField label="Password" name="password" type="password" autoComplete="current-password" value={password} onChange={setPassword} error={errors.password?.[0]} />
        <div className="flex justify-end"><Link href="/forgot-password" className="text-sm text-brand-500 hover:text-brand-600">Forgot password?</Link></div>
        <Btn type="submit" loading={busy} className="w-full">Sign in</Btn>
      </form>
      <p className="mt-5 text-center text-sm text-gray-700 dark:text-gray-400">No account? <Link href="/signup" className="text-brand-500">Create your company</Link></p>
      {USE_MOCK && (
        <div className="mt-8 rounded-xl border border-dashed border-gray-300 p-4 dark:border-gray-700">
          <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Demo accounts (password Demo@1234)</p>
          <div className="space-y-1">
            {DEMO.map(([e, d]) => (
              <button key={e} type="button" onClick={() => submit(undefined, { email: e, password: "Demo@1234" })} className="block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-white/5">
                <span className="font-medium text-gray-800 dark:text-white/90">{e}</span> <span className="text-gray-500">— {d}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default function SignInPage() {
  return <Suspense><SignInForm /></Suspense>;
}
