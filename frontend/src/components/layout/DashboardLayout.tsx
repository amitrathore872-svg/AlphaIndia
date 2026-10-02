"use client";

import { ReactNode, useState, useEffect } from "react";
import AppSidebar from "./AppSidebar";
import TopHeader from "./TopHeader";
import ControlCenterDrawer from "./control/ControlCenterDrawer";

interface DashboardLayoutProps {
  children: ReactNode;
  fullWidth?: boolean;
}

export default function DashboardLayout({ children, fullWidth = false }: DashboardLayoutProps) {
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
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-[#07111F] dark:text-white">
      {/* Sidebar mobile drawer only on small screens */}
      <AppSidebar
        isOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        isMobileDrawerOnly={true}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopHeader
          onOpenSidebar={() => setMobileSidebarOpen(true)}
          onOpenControlCenter={() => setControlCenterOpen(true)}
        />

        <main className={`flex-1 overflow-y-auto overflow-x-hidden ${fullWidth ? "p-1 sm:p-2 h-[calc(100vh-62px)] flex flex-col" : "p-3 sm:p-4 lg:p-5"}`}>
          <div className={fullWidth ? "flex w-full h-full flex-col flex-1 min-h-0" : "mx-auto flex w-full max-w-[1700px] flex-col gap-3 sm:gap-4"}>
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