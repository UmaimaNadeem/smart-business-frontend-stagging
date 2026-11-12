"use client";
import { useAuth } from "@/context/AuthContext";
import { API_MODE, API_URL } from "@/lib/config";
import { Btn } from "@/components/sb/ui";

export default function ApiStatusBanner() {
  const { apiError, retryApi, me } = useAuth();
  if (!apiError || !me || API_MODE === "mock") return null;
  return (
    <div className="mb-4 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
      <p className="font-medium">The API at {API_URL} isn’t responding.</p>
      <p className="mt-1">{apiError}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn onClick={() => void retryApi()}>Retry</Btn>
      </div>
    </div>
  );
}

/** Full-page state when a token exists but the session could not be loaded. */
export function ApiUnreachable({ onRetry, onSignOut }: { onRetry: () => void; onSignOut: () => void }) {
  const { apiError } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-white/[0.03]">
        <h1 className="text-lg font-semibold text-gray-800 dark:text-white">Couldn’t load your account</h1>
        <p className="mt-2 text-sm text-gray-500">
          {apiError || `The app couldn’t load your session from ${API_URL}. This can happen after a role or permission change. Sign out and sign in again, or retry.`}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Btn onClick={onRetry}>Retry</Btn>
          <Btn variant="outline" onClick={onSignOut}>Sign out</Btn>
        </div>
      </div>
    </div>
  );
}
