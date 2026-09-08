"use client";

import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import TopHeader from "./TopHeader";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <div className="flex flex-1 flex-col lg:ml-72">
          {/* Top Header */}
          <TopHeader />

          {/* Page Content */}
          <main className="flex-1 bg-slate-950 px-6 py-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl space-y-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}