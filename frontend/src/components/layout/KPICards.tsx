"use client";
import { useEffect, useState } from "react";
import StatCard from "@/components/cards/StatCard";
import { fetchDashboardSummary } from "@/lib/api";
import type { DashboardSummary } from "@/types/growth";
export default function KPICards() { const [summary, setSummary] = useState<DashboardSummary | null>(null); useEffect(() => { const load = () => fetchDashboardSummary().then(setSummary).catch(() => undefined); load(); const timer = window.setInterval(load, 30000); return () => window.clearInterval(timer); }, []); return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"><StatCard title="Companies tracked" value={summary?.companiesTracked.toLocaleString() ?? "—"} /><StatCard title="Results today" value={String(summary?.resultsToday ?? "—")} /><StatCard title="Average score" value={summary ? String(summary.averageGrowthScore) : "—"} /><StatCard title="Current leader" value={summary?.currentLeader ? `${summary.currentLeader.name} · ${summary.currentLeader.score}` : "—"} /><StatCard title="High-growth stocks" value={String(summary?.highGrowthStocks ?? "—")} /></div>; }
