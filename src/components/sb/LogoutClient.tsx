"use client";
import { useEffect } from "react";
import { clearToken, clearWorkspace } from "@/lib/api/session";

/** Clears the session cookie immediately, without waiting on Laravel. */
export default function LogoutClient() {
  useEffect(() => {
    clearToken();
    clearWorkspace();
    window.location.replace("/signin");
  }, []);
  return <p className="flex min-h-screen items-center justify-center text-sm text-gray-500">Signing out…</p>;
}
