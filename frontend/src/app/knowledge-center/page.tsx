"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import KnowledgeCenter from "@/components/knowledge/KnowledgeCenter";

export default function KnowledgeCenterPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <KnowledgeCenter />
      </div>
    </DashboardLayout>
  );
}
