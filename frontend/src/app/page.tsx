"use client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import KPICards from "@/components/layout/KPICards";
import GrowthTable from "@/components/screener/GrowthTable";
import { useGrowthScreener } from "@/hooks/useGrowthScreener";
export default function HomePage() { const screener = useGrowthScreener(); return <DashboardLayout search={screener.searchInput} onSearch={screener.setSearchInput}><div className="mx-auto max-w-7xl space-y-6"><KPICards /><GrowthTable screener={screener} /></div></DashboardLayout>; }
