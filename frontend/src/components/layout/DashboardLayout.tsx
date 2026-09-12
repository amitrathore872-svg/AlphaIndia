"use client";

import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import TopHeader from "./TopHeader";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen bg-[#081225] text-white">
      <AppSidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopHeader />

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}