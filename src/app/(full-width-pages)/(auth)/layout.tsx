import GridShape from "@/components/common/GridShape";
import ThemeTogglerTwo from "@/components/common/ThemeTogglerTwo";
import Logo from "@/components/sb/Logo";
import React from "react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-1 bg-white p-6 sm:p-0 dark:bg-gray-900">
      <div className="relative flex min-h-screen w-full flex-col justify-center sm:p-0 lg:flex-row dark:bg-gray-900">
        <div className="flex w-full flex-1 flex-col lg:w-1/2">
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
        </div>
        <div className="hidden h-auto w-full items-center bg-brand-950 lg:grid lg:w-1/2 dark:bg-white/5">
          <div className="relative z-1 flex items-center justify-center">
            <GridShape />
            <div className="flex max-w-xs flex-col items-center">
              <div className="mb-4"><Logo light /></div>
              <p className="text-center text-gray-400 dark:text-white/60">Inventory, purchasing, sales and accounting for growing businesses — in one place.</p>
            </div>
          </div>
        </div>
        <div className="fixed right-6 bottom-6 z-50 hidden sm:block"><ThemeTogglerTwo /></div>
      </div>
    </div>
  );
}
