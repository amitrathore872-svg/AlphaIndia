"use client";

import { ReactNode, useState } from "react";
import AppSidebar from "./AppSidebar";
import TopHeader from "./TopHeader";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-[#081225] dark:text-white">
      {/* Sidebar with mobile drawer support */}
      <AppSidebar
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopHeader onOpenSidebar={() => setMobileSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-5">
          <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-3 sm:gap-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}