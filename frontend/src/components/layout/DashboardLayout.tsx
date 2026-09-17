"use client";

import { ReactNode, useState, useEffect } from "react";
import AppSidebar from "./AppSidebar";
import TopHeader from "./TopHeader";
import ControlCenterDrawer from "./control/ControlCenterDrawer";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [controlCenterOpen, setControlCenterOpen] = useState(false);

  // Restore collapsed preference from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("alpha_india_sidebar_collapsed");
      if (saved !== null) {
        setIsCollapsed(saved === "true");
      }
    } catch {
      // Ignore storage error
    }
  }, []);

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("alpha_india_sidebar_collapsed", String(next));
      } catch {
        // Ignore storage error
      }
      return next;
    });
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-[#081225] dark:text-white">
      {/* Sidebar with mobile drawer and desktop collapse support */}
      <AppSidebar
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopHeader
          onOpenSidebar={() => setMobileSidebarOpen(true)}
          isSidebarCollapsed={isCollapsed}
          onToggleSidebarCollapse={handleToggleCollapse}
          onOpenControlCenter={() => setControlCenterOpen(true)}
        />

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-5">
          <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-3 sm:gap-4">
            {children}
          </div>
        </main>
      </div>

      {/* Omnipresent Universal Control Center & Action Logs Drawer */}
      <ControlCenterDrawer
        isOpen={controlCenterOpen}
        onClose={() => setControlCenterOpen(false)}
      />
    </div>
  );
}