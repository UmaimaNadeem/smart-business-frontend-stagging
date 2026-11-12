"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import Logo from "@/components/sb/Logo";
import { ChevronDownIcon, GridIcon, BoxCubeIcon, DollarLineIcon, PieChartIcon, GroupIcon, PageIcon, TableIcon, LockIcon, TaskIcon, ListIcon } from "@/icons";
import { NAV } from "./nav";

const ICONS: Record<string, React.ReactNode> = {
  grid: <GridIcon />, box: <BoxCubeIcon />, cart: <TaskIcon />, dollar: <DollarLineIcon />, wallet: <TableIcon />,
  book: <ListIcon />, chart: <PieChartIcon />, users: <GroupIcon />, card: <PageIcon />, shield: <LockIcon />,
};

const isActive = (pathname: string, path: string) => (path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/"));

export default function AppSidebar() {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const { me, canAny, hasCompany } = useAuth();
  const pathname = usePathname();
  const show = isExpanded || isHovered || isMobileOpen;

  const sections = useMemo(() => NAV
    .filter((s) => (s.platform ? me?.is_platform_admin : hasCompany))
    .map((s) => ({ ...s, items: s.items.filter((i) => !i.perm || canAny(...(Array.isArray(i.perm) ? i.perm : [i.perm]))) }))
    .filter((s) => s.items.length > 0), [me, canAny, hasCompany]);

  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const best = sections.flatMap((s) => s.items.filter((i) => isActive(pathname, i.path)).map((i) => ({ s: s.key, len: i.path.length }))).sort((a, b) => b.len - a.len)[0];
    if (best) setOpen(best.s);
  }, [pathname, sections]);

  return (
    <aside
      className={`fixed top-0 left-0 z-50 mt-16 flex h-screen flex-col border-r border-gray-200 bg-white px-5 text-gray-900 transition-all duration-300 ease-in-out lg:mt-0 dark:border-gray-800 dark:bg-gray-900
        ${show ? "w-[290px]" : "w-[90px]"} ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`flex py-8 ${!show ? "lg:justify-center" : "justify-start"}`}>
        <Link href="/"><Logo compact={!show} /></Link>
      </div>
      <div className="no-scrollbar flex flex-col overflow-y-auto pb-24 duration-300 ease-linear">
        <nav>
          <ul className="flex flex-col gap-2">
            {sections.map((s) => {
              const single = s.items.length === 1 && s.key === "dashboard";
              const activeSection = s.items.some((i) => isActive(pathname, i.path));
              if (single) {
                const i = s.items[0];
                return (
                  <li key={s.key}>
                    <Link href={i.path} className={`menu-item group ${isActive(pathname, i.path) ? "menu-item-active" : "menu-item-inactive"}`}>
                      <span className={isActive(pathname, i.path) ? "menu-item-icon-active" : "menu-item-icon-inactive"}>{ICONS[s.icon]}</span>
                      {show && <span className="menu-item-text">{s.name}</span>}
                    </Link>
                  </li>
                );
              }
              const expanded = open === s.key;
              return (
                <li key={s.key}>
                  <button onClick={() => setOpen(expanded ? null : s.key)} className={`menu-item group w-full cursor-pointer ${activeSection ? "menu-item-active" : "menu-item-inactive"} ${!show ? "lg:justify-center" : "lg:justify-start"}`}>
                    <span className={activeSection ? "menu-item-icon-active" : "menu-item-icon-inactive"}>{ICONS[s.icon]}</span>
                    {show && <span className="menu-item-text">{s.name}</span>}
                    {show && <ChevronDownIcon className={`ml-auto h-5 w-5 transition-transform duration-200 ${expanded ? "rotate-180 text-brand-500" : ""}`} />}
                  </button>
                  {show && expanded && (
                    <ul className="mt-2 ml-9 space-y-1">
                      {s.items.map((i) => (
                        <li key={i.path}>
                          <Link href={i.path} className={`menu-dropdown-item ${isActive(pathname, i.path) && !s.items.some((o) => o.path !== i.path && o.path.length > i.path.length && isActive(pathname, o.path)) ? "menu-dropdown-item-active" : "menu-dropdown-item-inactive"}`}>{i.name}</Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
