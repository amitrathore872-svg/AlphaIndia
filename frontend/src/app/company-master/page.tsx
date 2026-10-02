"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import Link from "next/link";
import {
  Building2,
  Eye,
  EyeOff,
  Search,
  RotateCcw,
  ExternalLink,
  Shield,
  Layers,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Filter,
  Check,
  ChevronRight,
  TrendingUp,
  Database,
  RefreshCw,
  List,
  LayoutGrid,
  Flame,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { NAVIGATION_CONFIG, ALL_PAGES, isRouteProtected, NavItemConfig } from "@/config/navigationConfig";
import { usePageVisibility } from "@/context/PageVisibilityContext";
import { API_BASE } from "@/lib/apiConfig";
import DhanFeedWidget from "@/components/common/DhanFeedWidget";
import CompanyVelocityTab from "@/components/company/CompanyVelocityTab";

interface CompanyItem {
  id: number;
  symbol: string;
  company_name: string;
  isin: string;
  exchange: string;
  listing_status: string;
  is_growth_eligible: boolean;
  sector: string;
  industry: string;
  market_cap: string;
  ai_score: number;
}

export default function CompanyMasterPage() {
  const {
    hiddenPages,
    isPageHidden,
    togglePageVisibility,
    unhideAll,
    hideSection,
    unhideSection,
    totalCount,
    hiddenCount,
    visibleCount,
    isLoaded,
  } = usePageVisibility();

  const [activeTab, setActiveTab] = useState<"pages" | "companies" | "velocity">("pages");

  // Page Master Filters
  const [pageSearch, setPageSearch] = useState("");
  const [selectedSection, setSelectedSection] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<"ALL" | "VISIBLE" | "HIDDEN">("ALL");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: "success" | "info" } | null>(null);

  // Company Master Directory State
  const [companySearch, setCompanySearch] = useState("");
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [companyPage, setCompanyPage] = useState(1);
  const [companyTotal, setCompanyTotal] = useState(0);
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [togglingCompanyId, setTogglingCompanyId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  // Toast auto-dismiss
  useEffect(() => {
    if (feedbackToast) {
      const timer = setTimeout(() => setFeedbackToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [feedbackToast]);

  const showToast = (message: string, type: "success" | "info" = "success") => {
    setFeedbackToast({ message, type });
  };

  // Filtered Pages
  const filteredPages = useMemo(() => {
    return ALL_PAGES.filter((page) => {
      // Section match
      if (selectedSection !== "ALL" && page.section !== selectedSection) {
        return false;
      }
      // Status match
      const hidden = isPageHidden(page.href);
      if (selectedStatus === "VISIBLE" && hidden) return false;
      if (selectedStatus === "HIDDEN" && !hidden) return false;

      // Search match
      if (pageSearch.trim()) {
        const query = pageSearch.toLowerCase();
        const nameMatch = page.name.toLowerCase().includes(query);
        const hrefMatch = page.href.toLowerCase().includes(query);
        const secMatch = page.section.toLowerCase().includes(query);
        const descMatch = page.description.toLowerCase().includes(query);
        return nameMatch || hrefMatch || secMatch || descMatch;
      }

      return true;
    });
  }, [selectedSection, selectedStatus, pageSearch, isPageHidden]);

  // Handle page toggle
  const handleTogglePage = async (page: NavItemConfig) => {
    if (isRouteProtected(page.href)) {
      showToast(`"${page.name}" is a protected core system module and cannot be hidden.`, "info");
      return;
    }
    const currentlyHidden = isPageHidden(page.href);
    await togglePageVisibility(page.href);
    if (currentlyHidden) {
      showToast(`Unhid "${page.name}". Restored to sidebar navigation.`, "success");
    } else {
      showToast(`Hidden "${page.name}". Removed from sidebar navigation.`, "info");
    }
  };

  // Handle Section Hide / Unhide
  const handleSectionAction = async (sectionTitle: string, action: "hide" | "unhide") => {
    if (action === "hide") {
      await hideSection(sectionTitle);
      showToast(`Hidden all available pages in "${sectionTitle}".`, "info");
    } else {
      await unhideSection(sectionTitle);
      showToast(`Unhid all pages in "${sectionTitle}".`, "success");
    }
  };

  // Handle Unhide All
  const handleUnhideAll = async () => {
    await unhideAll();
    showToast("All pages unhidden and restored to sidebar navigation.", "success");
  };

  // Fetch Companies Directory
  const fetchCompanies = async (query = "", page = 1, eligible = eligibleOnly) => {
    setLoadingCompanies(true);
    try {
      const params = new URLSearchParams({
        search: query,
        page: String(page),
        limit: "20",
        eligible_only: eligible ? "true" : "false",
      });
      const res = await fetch(`${API_BASE}/api/companies?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCompanies(data.companies || []);
        setCompanyTotal(data.total || 0);
      }
    } catch {
      // Fallback
    } finally {
      setLoadingCompanies(false);
    }
  };

  useEffect(() => {
    if (activeTab === "companies") {
      fetchCompanies(companySearch, companyPage, eligibleOnly);
    }
  }, [activeTab, companyPage, eligibleOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCompanyPage(1);
    fetchCompanies(companySearch, 1, eligibleOnly);
  };

  const handleToggleCompanyEligibility = async (company: CompanyItem) => {
    setTogglingCompanyId(company.id);
    const newEligible = !company.is_growth_eligible;
    try {
      const res = await fetch(`${API_BASE}/api/companies/${company.id}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_growth_eligible: newEligible }),
      });
      if (res.ok) {
        setCompanies((prev) =>
          prev.map((c) => (c.id === company.id ? { ...c, is_growth_eligible: newEligible } : c))
        );
        showToast(
          `${company.symbol} is now ${newEligible ? "Unhidden (Eligible in Screener)" : "Hidden from Screener"}.`,
          newEligible ? "success" : "info"
        );
      }
    } catch {
      showToast(`Failed to update ${company.symbol} visibility status.`, "info");
    } finally {
      setTogglingCompanyId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ========================================================= */}
        {/* Toast Feedback Notification */}
        {/* ========================================================= */}
        {feedbackToast && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-cyan-500/30 bg-[#091527]/95 px-4 py-3 text-sm shadow-2xl backdrop-blur-md transition-all duration-300">
            {feedbackToast.type === "success" ? (
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle size={18} className="text-amber-400 shrink-0" />
            )}
            <span className="text-slate-200 font-medium">{feedbackToast.message}</span>
            <button
              onClick={() => setFeedbackToast(null)}
              className="ml-2 text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* Institutional Header Banner */}
        {/* ========================================================= */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-cyan-500/20 bg-gradient-to-r from-slate-100 via-white to-slate-100 dark:from-[#05101E] dark:via-[#09182C] dark:to-[#05101E] p-5 sm:p-6 shadow-xl backdrop-blur-md">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase text-cyan-700 dark:text-cyan-300">
                  <Shield size={12} />
                  ADMINISTRATION
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase text-emerald-700 dark:text-emerald-300">
                  <Database size={12} />
                  COMPANY MASTER
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-slate-700 bg-slate-200/60 dark:bg-slate-800/80 px-2.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                  NSE & BSE REGISTRY
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
                <Building2 className="text-cyan-600 dark:text-cyan-400" size={26} />
                Company Master & System Administration
              </h1>

              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-3xl">
                Configure platform navigation visibility (<span className="text-cyan-700 dark:text-cyan-300 font-semibold">Hide / Unhide pages</span> in the sidebar menu) and manage the master repository of listed equities.
              </p>
            </div>

            {/* Quick Summary Pill Badges */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 px-3.5 py-2 text-center shadow-xs">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">Total Pages</p>
                <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">{totalCount}</p>
              </div>

              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-center shadow-xs">
                <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 dark:text-emerald-400">Visible</p>
                <p className="text-base sm:text-lg font-bold text-emerald-800 dark:text-emerald-300">{visibleCount}</p>
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-center shadow-xs">
                <p className="text-[10px] uppercase font-bold tracking-wider text-amber-700 dark:text-amber-400">Hidden</p>
                <p className="text-base sm:text-lg font-bold text-amber-800 dark:text-amber-300">{hiddenCount}</p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-6 flex border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setActiveTab("pages")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs sm:text-sm font-semibold transition ${
                activeTab === "pages"
                  ? "border-cyan-500 text-cyan-600 dark:text-cyan-400"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <Eye size={16} />
              Page Visibility Master (Hide / Unhide Pages)
              {hiddenCount > 0 && (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 border border-amber-500/30">
                  {hiddenCount} hidden
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("companies")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs sm:text-sm font-semibold transition ${
                activeTab === "companies"
                  ? "border-cyan-500 text-cyan-600 dark:text-cyan-400"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <Database size={16} />
              Listed Equities Master (2,100+ Equities)
            </button>

            <button
              onClick={() => setActiveTab("velocity")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs sm:text-sm font-semibold transition ${
                activeTab === "velocity"
                  ? "border-amber-500 text-amber-600 dark:text-amber-400 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <Flame size={16} className="text-amber-400" />
              Velocity Burst Elite (VBE Intelligence)
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 border border-amber-500/30">
                Stage 16
              </span>
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* DHANHQ 0-DELAY REAL-TIME LIVE MARKET FEED CONSOLE */}
        {/* ========================================================= */}
        <DhanFeedWidget />

        {/* ========================================================= */}
        {/* TAB 1: PAGE VISIBILITY MASTER (HIDE / UNHIDE PAGES) */}
        {/* ========================================================= */}
        {activeTab === "pages" && (
          <div className="space-y-5">
            {/* Control & Filter Toolbar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070E1A] p-4 shadow-sm">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={pageSearch}
                  onChange={(e) => setPageSearch(e.target.value)}
                  placeholder="Search pages by name, route, or category..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
                {pageSearch && (
                  <button
                    onClick={() => setPageSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Status Filter Toggle */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 p-1">
                  <button
                    onClick={() => setSelectedStatus("ALL")}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                      selectedStatus === "ALL"
                        ? "bg-cyan-500 text-black shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    All ({totalCount})
                  </button>
                  <button
                    onClick={() => setSelectedStatus("VISIBLE")}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                      selectedStatus === "VISIBLE"
                        ? "bg-emerald-500 text-black shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Visible ({visibleCount})
                  </button>
                  <button
                    onClick={() => setSelectedStatus("HIDDEN")}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                      selectedStatus === "HIDDEN"
                        ? "bg-amber-500 text-black shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Hidden ({hiddenCount})
                  </button>
                </div>

                {/* View Switcher: List (Default) vs Grid */}
                <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 p-1">
                  <button
                    onClick={() => setViewMode("list")}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      viewMode === "list"
                        ? "bg-cyan-500 text-black shadow-xs font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="List View (Default)"
                  >
                    <List size={13} />
                    <span>List</span>
                  </button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      viewMode === "grid"
                        ? "bg-cyan-500 text-black shadow-xs font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                    title="Grid View"
                  >
                    <LayoutGrid size={13} />
                    <span>Grid</span>
                  </button>
                </div>

                {/* Unhide All Button */}
                {hiddenCount > 0 && (
                  <button
                    onClick={handleUnhideAll}
                    className="flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-1.5 text-xs font-semibold text-cyan-600 dark:text-cyan-300 hover:bg-cyan-500/20 transition shadow-xs"
                    title="Unhide all pages and restore full sidebar navigation"
                  >
                    <RotateCcw size={14} />
                    Unhide All ({hiddenCount})
                  </button>
                )}
              </div>
            </div>

            {/* Section Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedSection("ALL")}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                  selectedSection === "ALL"
                    ? "border border-cyan-500 bg-cyan-500/20 text-cyan-600 dark:text-cyan-300"
                    : "border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:text-white"
                }`}
              >
                ALL SECTIONS
              </button>
              {NAVIGATION_CONFIG.map((sec) => (
                <button
                  key={sec.title}
                  onClick={() => setSelectedSection(sec.title)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                    selectedSection === sec.title
                      ? "border border-cyan-500 bg-cyan-500/20 text-cyan-600 dark:text-cyan-300"
                      : "border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:text-white"
                  }`}
                >
                  {sec.title}
                </button>
              ))}
            </div>

            {/* Sections and Cards */}
            <div className="space-y-6">
              {NAVIGATION_CONFIG.filter(
                (sec) => selectedSection === "ALL" || sec.title === selectedSection
              ).map((sec) => {
                const sectionItems = sec.items.filter((item) =>
                  filteredPages.some((p) => p.href === item.href)
                );

                if (sectionItems.length === 0) return null;

                const secHiddenCount = sec.items.filter((i) => isPageHidden(i.href)).length;
                const canHideAllInSec = sec.items.some((i) => !i.isProtected && !isPageHidden(i.href));

                return (
                  <div
                    key={sec.title}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#060D19] p-4 sm:p-5 shadow-md"
                  >
                    {/* Section Header */}
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-xs font-bold">
                          {sectionItems.length}
                        </span>
                        <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                          {sec.title}
                        </h2>
                        {secHiddenCount > 0 && (
                          <span className="rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                            {secHiddenCount} hidden
                          </span>
                        )}
                      </div>

                      {/* Section Quick Actions */}
                      <div className="flex items-center gap-2">
                        {canHideAllInSec && (
                          <button
                            onClick={() => handleSectionAction(sec.title, "hide")}
                            className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-500/40 transition"
                            title="Hide all available pages in this section from sidebar"
                          >
                            <EyeOff size={12} />
                            Hide Section
                          </button>
                        )}
                        {secHiddenCount > 0 && (
                          <button
                            onClick={() => handleSectionAction(sec.title, "unhide")}
                            className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition"
                            title="Unhide all pages in this section"
                          >
                            <Eye size={12} />
                            Unhide All in Section
                          </button>
                        )}
                      </div>
                    </div>

                    {/* View Switch: List View (Default) vs Grid View */}
                    {viewMode === "list" ? (
                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#050B14]">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 uppercase tracking-wider text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                            <tr>
                              <th className="py-2.5 px-4">Page / Tool</th>
                              <th className="py-2.5 px-4">Route Path</th>
                              <th className="py-2.5 px-4 hidden md:table-cell">Function & Purpose</th>
                              <th className="py-2.5 px-4 text-center">Sidebar Status</th>
                              <th className="py-2.5 px-4 text-right">Visibility Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                            {sectionItems.map((page) => {
                              const Icon = page.icon;
                              const isHidden = isPageHidden(page.href);
                              const isProtected = isRouteProtected(page.href);

                              return (
                                <tr
                                  key={page.href}
                                  className={`hover:bg-slate-50 dark:hover:bg-slate-900/40 transition ${
                                    isHidden ? "bg-amber-500/5 dark:bg-amber-500/5" : ""
                                  }`}
                                >
                                  <td className="py-2.5 px-4">
                                    <div className="flex items-center gap-2.5">
                                      <div
                                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                          isHidden
                                            ? "border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                            : "border border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                                        }`}
                                      >
                                        <Icon size={16} />
                                      </div>
                                      <span className="font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                        {page.name}
                                      </span>
                                    </div>
                                  </td>

                                  <td className="py-2.5 px-4 font-mono text-[11px] whitespace-nowrap">
                                    <Link
                                      href={page.href}
                                      className="inline-flex items-center gap-1 text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 font-medium transition"
                                      title="Open this page"
                                    >
                                      <span>{page.href}</span>
                                      <ExternalLink size={11} />
                                    </Link>
                                  </td>

                                  <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300 hidden md:table-cell max-w-sm lg:max-w-md">
                                    <p className="line-clamp-1">{page.description}</p>
                                  </td>

                                  <td className="py-2.5 px-4 text-center whitespace-nowrap">
                                    {isProtected ? (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                        CORE
                                      </span>
                                    ) : isHidden ? (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">
                                        <EyeOff size={10} />
                                        HIDDEN
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
                                        <Check size={10} />
                                        VISIBLE
                                      </span>
                                    )}
                                  </td>

                                  <td className="py-2.5 px-4 text-right whitespace-nowrap">
                                    {isProtected ? (
                                      <span className="text-[11px] text-slate-400 italic">Always visible</span>
                                    ) : (
                                      <button
                                        onClick={() => handleTogglePage(page)}
                                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-bold transition shadow-xs ${
                                          isHidden
                                            ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25"
                                            : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
                                        }`}
                                      >
                                        {isHidden ? (
                                          <>
                                            <Eye size={12} />
                                            Unhide Page
                                          </>
                                        ) : (
                                          <>
                                            <EyeOff size={12} />
                                            Hide Page
                                          </>
                                        )}
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      /* Cards Grid */
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                        {sectionItems.map((page) => {
                          const Icon = page.icon;
                          const isHidden = isPageHidden(page.href);
                          const isProtected = isRouteProtected(page.href);

                          return (
                            <div
                              key={page.href}
                              className={`group relative flex flex-col justify-between rounded-xl border p-4 transition-all duration-200 ${
                                isHidden
                                  ? "border-amber-500/30 bg-amber-500/5 dark:bg-[#0f1722]/80 opacity-90"
                                  : "border-slate-200 dark:border-slate-800/80 bg-slate-50/60 dark:bg-[#07111F]/60 hover:border-cyan-500/40 hover:bg-white dark:hover:bg-[#081527]"
                              }`}
                            >
                              <div>
                                {/* Card Header */}
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    <div
                                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 ${
                                        isHidden
                                          ? "border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                          : "border border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                                      }`}
                                    >
                                      <Icon size={19} />
                                    </div>

                                    <div>
                                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                        {page.name}
                                      </h3>
                                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                        {page.href}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Status Badge */}
                                  {isProtected ? (
                                    <span className="shrink-0 rounded-full border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                      CORE
                                    </span>
                                  ) : isHidden ? (
                                    <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                      <EyeOff size={10} />
                                      HIDDEN
                                    </span>
                                  ) : (
                                    <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                      <Check size={10} />
                                      VISIBLE
                                    </span>
                                  )}
                                </div>

                                {/* Description */}
                                <p className="mt-3 text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                                  {page.description}
                                </p>
                              </div>

                              {/* Card Action Footer */}
                              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                                <Link
                                  href={page.href}
                                  className="flex items-center gap-1 text-xs font-semibold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 transition"
                                >
                                  <span>Open Page</span>
                                  <ExternalLink size={12} />
                                </Link>

                                {isProtected ? (
                                  <span className="text-[11px] text-slate-400 italic">
                                    Always visible
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleTogglePage(page)}
                                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition shadow-xs ${
                                      isHidden
                                        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25"
                                        : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
                                    }`}
                                    title={
                                      isHidden
                                        ? `Unhide ${page.name} and restore to sidebar menu`
                                        : `Hide ${page.name} from sidebar menu`
                                    }
                                  >
                                    {isHidden ? (
                                      <>
                                        <Eye size={13} />
                                        Unhide Page
                                      </>
                                    ) : (
                                      <>
                                        <EyeOff size={13} />
                                        Hide Page
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredPages.length === 0 && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#060D19] p-12 text-center">
                <Sliders size={32} className="mx-auto text-slate-400 mb-3" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">No pages match your search</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Try adjusting your search terms or filter criteria.
                </p>
                <button
                  onClick={() => {
                    setPageSearch("");
                    setSelectedSection("ALL");
                    setSelectedStatus("ALL");
                  }}
                  className="mt-4 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-600 dark:text-cyan-300"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: LISTED EQUITIES MASTER (2,100+ EQUITIES DIRECTORY) */}
        {/* ========================================================= */}
        {activeTab === "companies" && (
          <div className="space-y-5">
            {/* Equities Search & Action Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070E1A] p-4 shadow-sm">
              <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-lg flex items-center gap-2">
                <div className="relative flex-1">
                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    placeholder="Search by Symbol (e.g. RELIANCE, TATACHEM), Name, or ISIN..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-4 py-2 text-xs font-bold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/25 transition"
                >
                  Search
                </button>
              </form>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={eligibleOnly}
                    onChange={(e) => {
                      setEligibleOnly(e.target.checked);
                      setCompanyPage(1);
                    }}
                    className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>Active Screener Only</span>
                </label>

                <button
                  onClick={() => fetchCompanies(companySearch, companyPage, eligibleOnly)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-white transition"
                  title="Refresh company master list"
                >
                  <RefreshCw size={14} className={loadingCompanies ? "animate-spin" : ""} />
                  Refresh
                </button>
              </div>
            </div>

            {/* Total Companies Count Ribbon */}
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
              <span>
                Found <strong className="text-slate-900 dark:text-white">{companyTotal}</strong> registered equities in Master Database
              </span>
              <span>Showing Page {companyPage}</span>
            </div>

            {/* Equities Table */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-[#060D19] overflow-hidden shadow-md">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/80 uppercase tracking-wider text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                    <tr>
                      <th className="py-3 px-4">Symbol</th>
                      <th className="py-3 px-4">Company Name</th>
                      <th className="py-3 px-4">ISIN</th>
                      <th className="py-3 px-4">Exchange</th>
                      <th className="py-3 px-4">Sector / Industry</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-center">Screener Visibility</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {loadingCompanies ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-cyan-400" />
                          Loading company master records...
                        </td>
                      </tr>
                    ) : companies.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          No companies found matching query.
                        </td>
                      </tr>
                    ) : (
                      companies.map((c) => (
                        <tr
                          key={c.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition"
                        >
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                            <span className="font-mono text-cyan-600 dark:text-cyan-400">{c.symbol}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-800 dark:text-slate-200">
                            {c.company_name}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                            {c.isin || "N/A"}
                          </td>
                          <td className="py-3 px-4">
                            <span className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:text-slate-300">
                              {c.exchange || "NSE"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{c.sector || "Unknown"}</p>
                            <p className="text-[10px] text-slate-500">{c.industry || "General"}</p>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                c.listing_status === "Active"
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                                  : "bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30"
                              }`}
                            >
                              {c.listing_status || "Active"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {c.is_growth_eligible ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                                <Check size={11} />
                                ELIGIBLE
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                                <EyeOff size={11} />
                                HIDDEN
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleToggleCompanyEligibility(c)}
                              disabled={togglingCompanyId === c.id}
                              className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition shadow-xs ${
                                c.is_growth_eligible
                                  ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
                                  : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                              }`}
                            >
                              {togglingCompanyId === c.id
                                ? "Updating..."
                                : c.is_growth_eligible
                                ? "Hide from Screener"
                                : "Unhide / Restore"}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 p-4">
                <button
                  onClick={() => setCompanyPage((p) => Math.max(1, p - 1))}
                  disabled={companyPage <= 1}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs text-slate-500">
                  Page {companyPage} of {Math.max(1, Math.ceil(companyTotal / 20))}
                </span>
                <button
                  onClick={() => setCompanyPage((p) => p + 1)}
                  disabled={companyPage * 20 >= companyTotal}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: VELOCITY BURST ELITE (STAGE 16 DOSSIER)            */}
        {/* ========================================================= */}
        {activeTab === "velocity" && <CompanyVelocityTab />}
      </div>
    </DashboardLayout>
  );
}
