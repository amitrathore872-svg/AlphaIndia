"use client";

// =======================================================
// Alpha India Mission Control
// Sprint 33.4 Phase 4C.5
// Live Filing Registry Event Stream & Scanner Timeline
// =======================================================

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Radar,
  FileDown,
  Database,
  ShieldCheck,
  BrainCircuit,
  ExternalLink,
  FileText,
  RefreshCw,
  Search,
  Activity,
} from "lucide-react";

import { fetchScannerEvents } from "@/lib/monitoringApi";
import type {
  MissionControlStatus,
  TimelineFilingEvent,
  ScannerEventType,
} from "@/types/monitoring";

interface Props {
  status?: MissionControlStatus;
}

const FILTER_TABS: { label: string; value: ScannerEventType }[] = [
  { label: "All Events", value: "ALL" },
  { label: "Discovered", value: "DISCOVERY" },
  { label: "Archived PDFs", value: "DOWNLOAD" },
  { label: "Financials", value: "IMPORT" },
  { label: "Corporate", value: "AUDIT" },
  { label: "AI Processed", value: "AI" },
];

export default function ScannerTimeline({}: Props) {
  const [events, setEvents] = useState<TimelineFilingEvent[]>([]);
  const [totalFilings, setTotalFilings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<ScannerEventType>("ALL");
  const [searchFilter, setSearchFilter] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadEvents = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      const data = await fetchScannerEvents(50, activeType);
      if (data.success && Array.isArray(data.events)) {
        setEvents(data.events);
        setTotalFilings(data.total_filings || data.events.length);
      }
    } catch (err) {
      console.error("Failed to load filing registry events:", err);
    } finally {
      setLoading(false);
      if (showSpinner) setIsRefreshing(false);
    }
  }, [activeType]);

  // Load on mount and when filter type changes
  useEffect(() => {
    loadEvents();

    // 5-second polling interval for real-time filing updates
    const timer = setInterval(() => {
      loadEvents();
    }, 5000);

    return () => clearInterval(timer);
  }, [loadEvents]);

  // Client-side quick filter by symbol or company
  const filteredEvents = useMemo(() => {
    if (!searchFilter.trim()) return events;
    const term = searchFilter.toLowerCase().trim();
    return events.filter(
      (e) =>
        e.symbol.toLowerCase().includes(term) ||
        e.company.toLowerCase().includes(term) ||
        (e.filing_type && e.filing_type.toLowerCase().includes(term)) ||
        (e.period && e.period.toLowerCase().includes(term))
    );
  }, [events, searchFilter]);

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500"></span>
            </span>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-400 font-semibold">
              Live Event Stream • Filing Registry
            </p>
          </div>

          <h2 className="mt-2 text-2xl font-bold text-white tracking-tight">
            Scanner Timeline
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Real-time corporate disclosures and financial filings streaming from the NSE/BSE registry.
          </p>
        </div>

        {/* Live Counters & Refresh */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-cyan-800/40 bg-cyan-950/30 px-3.5 py-1.5 text-xs font-semibold text-cyan-300">
            <Activity className="h-3.5 w-3.5 text-cyan-400" />
            <span>{totalFilings.toLocaleString("en-IN")} Real Filings</span>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-green-800/40 bg-green-950/30 px-3.5 py-1.5 text-xs font-semibold text-green-400">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
            <span>STREAM ACTIVE</span>
          </div>

          <button
            onClick={() => loadEvents(true)}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:text-white disabled:opacity-50"
            title="Refresh Live Events"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`}
            />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="mt-6 flex flex-col gap-3 border-y border-slate-800/80 py-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveType(tab.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeType === tab.value
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-semibold"
                  : "bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Filter Input */}
        <div className="relative min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter by symbol or type..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950 py-1.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 transition focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Events Timeline List */}
      <div className="mt-4 max-h-[560px] space-y-3 overflow-y-auto pr-2 custom-scrollbar">
        {loading && events.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800/80 bg-slate-950/60 py-16 text-center">
            <RefreshCw className="h-7 w-7 animate-spin text-cyan-400" />
            <p className="mt-3 text-sm text-slate-400">
              Streaming live filings from registry...
            </p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-10 text-center">
            <p className="text-sm font-medium text-slate-400">
              No filing events match your filter criteria.
            </p>
            <button
              onClick={() => {
                setActiveType("ALL");
                setSearchFilter("");
              }}
              className="mt-3 text-xs font-semibold text-cyan-400 hover:underline"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredEvents.map((event) => (
            <TimelineCard key={event.id} event={event} />
          ))
        )}
      </div>
    </div>
  );
}

function TimelineCard({ event }: { event: TimelineFilingEvent }) {
  const styles = {
    DISCOVERY: {
      icon: <Radar className="h-4 w-4 text-emerald-400" />,
      badge: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    },
    DOWNLOAD: {
      icon: <FileDown className="h-4 w-4 text-sky-400" />,
      badge: "bg-sky-500/10 text-sky-400 border border-sky-500/20",
    },
    IMPORT: {
      icon: <Database className="h-4 w-4 text-violet-400" />,
      badge: "bg-violet-500/10 text-violet-400 border border-violet-500/20",
    },
    AUDIT: {
      icon: <ShieldCheck className="h-4 w-4 text-amber-400" />,
      badge: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    },
    AI: {
      icon: <BrainCircuit className="h-4 w-4 text-pink-400" />,
      badge: "bg-pink-500/10 text-pink-400 border border-pink-500/20",
    },
  };

  const style = styles[event.type] || styles.DISCOVERY;

  return (
    <div className="group rounded-2xl border border-slate-800/80 bg-slate-950/70 p-4 transition-all duration-200 hover:border-slate-700 hover:bg-slate-950/95 hover:shadow-lg hover:shadow-cyan-950/20">
      {/* Top Bar: Icon + Category Badge + Timestamp */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-slate-900 p-1.5 border border-slate-800">
            {style.icon}
          </div>

          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style.badge}`}
          >
            {event.type}
          </span>

          <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
            {event.exchange}
          </span>

          {event.period && event.period !== "Unknown" && (
            <span className="rounded bg-slate-800/60 px-2 py-0.5 text-[10px] text-cyan-300/80 font-medium">
              {event.period}
            </span>
          )}
        </div>

        <div className="text-right">
          <span className="text-xs font-medium text-slate-400">
            {event.time_display}
          </span>
          {event.date_display && (
            <span className="ml-2 text-[10px] text-slate-600 hidden sm:inline">
              {event.date_display}
            </span>
          )}
        </div>
      </div>

      {/* Main Body: Symbol & Company + Action Message */}
      <div className="mt-2.5 flex flex-col justify-between gap-2 sm:flex-row sm:items-baseline">
        <div className="flex items-baseline gap-2">
          <p className="font-mono text-base font-bold text-white group-hover:text-cyan-400 transition-colors">
            {event.symbol}
          </p>
          <span className="text-xs text-slate-400 line-clamp-1">
            {event.company}
          </span>
        </div>

        {/* PDF Link Button */}
        {event.pdf_url && (
          <a
            href={event.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:border-cyan-500 hover:text-cyan-300"
          >
            <FileText className="h-3 w-3 text-cyan-400" />
            <span>Filing PDF</span>
            <ExternalLink className="h-2.5 w-2.5 opacity-60" />
          </a>
        )}
      </div>

      <p className="mt-1 text-xs text-slate-300/90 leading-relaxed">
        {event.message}
      </p>
    </div>
  );
}