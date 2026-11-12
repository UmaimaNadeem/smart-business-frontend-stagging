"use client";
import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { getToken } from "@/lib/api/session";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
import SubscriptionBanner from "@/components/sb/SubscriptionBanner";
import ApiStatusBanner, { ApiUnreachable } from "@/components/sb/ApiStatusBanner";
import { Loading } from "@/components/sb/ui";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const { me, loading, hasCompany, company, can, apiError, retryApi, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const redirect = loading ? null
    : !me && !getToken() ? "/signin"
    : me && !me.email_verified ? "/verify-email"
    : me && company && company.onboarding_completed_at === null && can("company.manage") ? "/onboarding"
    : me && !hasCompany && me.is_platform_admin && !pathname.startsWith("/platform") && pathname !== "/profile" ? "/platform/tenants"
    : null;

  useEffect(() => { if (redirect) router.replace(redirect); }, [redirect, router]);

  if (loading || redirect) return <div className="flex min-h-screen items-center justify-center"><Loading /></div>;
  if (!me) return <ApiUnreachable onRetry={() => void retryApi()} onSignOut={() => void logout()} />;

  const margin = isMobileOpen ? "ml-0" : isExpanded || isHovered ? "lg:ml-[290px]" : "lg:ml-[90px]";
  return (
    <div className="min-h-screen xl:flex">
      <AppSidebar />
      <Backdrop />
      <div className={`flex-1 transition-all duration-300 ease-in-out ${margin}`}>
        <AppHeader />
        <div className="mx-auto max-w-(--breakpoint-2xl) p-4 md:p-6">
          {!hasCompany && !me?.is_platform_admin ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-white/[0.03]">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">No workspace yet</h3>
              <p className="mt-2 text-sm text-gray-500">You are not assigned to any company. Ask your administrator for an invitation.</p>
            </div>
          ) : (
            <>{hasCompany && <SubscriptionBanner />}<ApiStatusBanner />{children}</>
          )}
        </div>
      </div>
    </div>
  );
}
