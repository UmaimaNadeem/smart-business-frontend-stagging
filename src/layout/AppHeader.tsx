"use client";
import React, { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import { Dropdown } from "@/components/ui/dropdown/Dropdown";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { USE_MOCK } from "@/lib/config";
import Logo from "@/components/sb/Logo";

const sel = "h-10 rounded-lg border border-gray-300 bg-transparent px-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300";

export default function AppHeader() {
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const { me, companies, branches, workspace, selectWorkspace, logout, subscription } = useAuth();
  const [menu, setMenu] = useState(false);

  const toggle = () => (window.innerWidth >= 1024 ? toggleSidebar() : toggleMobileSidebar());

  const resetDemo = async () => {
    if (!window.confirm("Reset all demo data to the original seed? Your changes will be lost.")) return;
    const { resetMockData } = await import("@/lib/mock/server");
    resetMockData();
    toast.success("Demo data reset");
    setTimeout(() => window.location.reload(), 300);
  };

  return (
    <header className="sticky top-0 z-40 flex w-full border-gray-200 bg-white lg:border-b dark:border-gray-800 dark:bg-gray-900">
      <div className="flex grow flex-col items-center justify-between lg:flex-row lg:px-6">
        <div className="flex w-full items-center gap-3 border-b border-gray-200 px-3 py-3 lg:border-b-0 lg:px-0 lg:py-4 dark:border-gray-800">
          <button onClick={toggle} aria-label="Toggle sidebar" className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-500 lg:h-11 lg:w-11 dark:border-gray-800 dark:text-gray-400">
            {isMobileOpen ? "✕" : "☰"}
          </button>
          <Link href="/" className="lg:hidden"><Logo compact /></Link>
          {companies.length > 0 && (
            <div className="flex flex-1 flex-wrap items-center gap-2">
              {companies.length > 1 ? (
                <select aria-label="Company" className={sel} value={workspace.companyId ?? ""} onChange={(e) => selectWorkspace({ companyId: Number(e.target.value), businessId: null })}>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              ) : (
                <span className="hidden text-sm font-medium text-gray-700 sm:inline dark:text-gray-300">{companies[0].name}</span>
              )}
              <select aria-label="Branch" className={sel} value={workspace.businessId ?? ""} onChange={(e) => selectWorkspace({ companyId: workspace.companyId, businessId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">All branches</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              {subscription && <Link href="/billing" className="hidden rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600 md:inline dark:bg-white/5 dark:text-gray-300">{subscription.plan ?? "No plan"} · {subscription.status.replace("_", " ")}</Link>}
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {USE_MOCK && <span className="hidden rounded-full bg-warning-50 px-2.5 py-1 text-xs font-medium text-warning-700 sm:inline">Demo data</span>}
            <ThemeToggleButton />
            <div className="relative">
              <button onClick={() => setMenu(!menu)} className="dropdown-toggle flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600">{me?.name?.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
                <span className="hidden text-sm font-medium md:block">{me?.name}</span>
              </button>
              <Dropdown isOpen={menu} onClose={() => setMenu(false)} className="absolute right-0 mt-3 w-64 rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark">
                <div className="border-b border-gray-200 pb-3 dark:border-gray-800">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{me?.name}</p>
                  <p className="text-xs text-gray-500">{me?.email}</p>
                  {me?.is_platform_admin && <p className="mt-1 text-xs text-brand-500">Platform administrator</p>}
                </div>
                <ul className="flex flex-col gap-1 pt-3 text-sm">
                  <li><Link onClick={() => setMenu(false)} href="/profile" className="block rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5">Profile & password</Link></li>
                  <li><Link onClick={() => setMenu(false)} href="/billing" className="block rounded-lg px-3 py-2 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5">Subscription</Link></li>
                  {USE_MOCK && <li><button onClick={resetDemo} className="w-full rounded-lg px-3 py-2 text-left text-warning-600 hover:bg-gray-100 dark:hover:bg-white/5">Reset demo data</button></li>}
                  <li><button onClick={logout} className="w-full rounded-lg px-3 py-2 text-left text-error-600 hover:bg-gray-100 dark:hover:bg-white/5">Sign out</button></li>
                </ul>
              </Dropdown>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
