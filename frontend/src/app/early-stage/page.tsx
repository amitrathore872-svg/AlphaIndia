"use client";

// =======================================================
// Alpha India — Early Stage Company Discovery
// Sprint 23 — Ranked suggestion table with bulk import
// Bloomberg dark aesthetic · cyan/amber/emerald accents
// =======================================================

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Radar,
  RefreshCw,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  CheckSquare,
  Square,
  EyeOff,
  Zap,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ExternalLink,
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import TerminalSearch from "@/components/common/TerminalSearch";
import {
  fetchCandidates,
  fetchStats,
  triggerDiscoveryRun,
  updateCandidateStatus,
  bulkImportCandidates,
  type EarlyStageCandidate,
  type EarlyStageStats,
} from "@/lib/earlyStageApi";

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------
const SENTIMENT_CONFIG = {
  positive: { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", icon: TrendingUp },
  neutral:  { color: "text-slate-400",   bg: "bg-slate-700/30 border-slate-600/30",     icon: Minus },
  negative: { color: "text-red-400",     bg: "bg-red-500/10 border-red-500/30",          icon: TrendingDown },
};

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(Math.max(score, 0), 100);
  const color = pct >= 70 ? "bg-emerald-400" : pct >= 40 ? "bg-amber-400" : "bg-slate-600";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-slate-300">{pct.toFixed(0)}</span>
    </div>
  );
}

function SentimentBadge({ sentiment }: { sentiment: EarlyStageCandidate["sentiment"] }) {
  const cfg = SENTIMENT_CONFIG[sentiment] ?? SENTIMENT_CONFIG.neutral;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cfg.bg} ${cfg.color}`}>
      <Icon size={10} />
      {sentiment}
    </span>
  );
}

function SourceTag({ source, sourceUrl }: { source: string; sourceUrl?: string | null }) {
  const short = source.replace(/Reddit_r\//, "r/").slice(0, 18);
  if (sourceUrl) {
    return (
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-cyan-400 hover:text-cyan-300 hover:bg-slate-700/80 transition-colors group/source"
        title={`Open source article: ${sourceUrl}`}
      >
        <span>{short}</span>
        <ExternalLink size={9} className="opacity-70 group-hover/source:opacity-100" />
      </a>
    );
  }
  return (
    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-cyan-400">
      {short}
    </span>
  );
}

// -------------------------------------------------------
// Main Page
// -------------------------------------------------------
export default function EarlyStagePage() {
  const [candidates, setCandidates]   = useState<EarlyStageCandidate[]>([]);
  const [stats, setStats]             = useState<EarlyStageStats | null>(null);
  const [loading, setLoading]         = useState(true);
  const [running, setRunning]         = useState(false);
  const [importing, setImporting]     = useState(false);
  const [toast, setToast]             = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Filters
  const [statusFilter, setStatusFilter]       = useState("suggested");
  const [sentimentFilter, setSentimentFilter] = useState("");
  const [listedOnly, setListedOnly]           = useState(false);
  const [search, setSearch]                   = useState("");
  const [sortBy, setSortBy]                   = useState("trend_score");
  const [sortOrder, setSortOrder]             = useState<"asc" | "desc">("desc");
  const [page, setPage]                       = useState(1);
  const PAGE_SIZE = 25;

  // Selection
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // ─── Toast ────────────────────────────────────────────
  const showToast = useCallback((msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // ─── Load ─────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([
        fetchCandidates({
          page,
          limit: PAGE_SIZE,
          status: statusFilter || undefined,
          sentiment: sentimentFilter || undefined,
          listed_only: listedOnly || undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
        }),
        fetchStats(),
      ]);
      setCandidates(c);
      setStats(s);
      setSelected(new Set());
    } catch {
      showToast("Failed to load candidates", "err");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, sentimentFilter, listedOnly, sortBy, sortOrder, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Filter candidates client-side by search ──────────
  const filtered = search
    ? candidates.filter(c =>
        c.company_name.toLowerCase().includes(search.toLowerCase()) ||
        (c.tentative_ticker ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : candidates;

  // ─── Sort toggle ──────────────────────────────────────
  const toggleSort = (col: string) => {
    if (sortBy === col) setSortOrder(o => o === "desc" ? "asc" : "desc");
    else { setSortBy(col); setSortOrder("desc"); }
    setPage(1);
  };

  // ─── Selection ────────────────────────────────────────
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(c => c.id)));
  };
  const toggleOne = (id: number) =>
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
      } else {
        n.add(id);
      }
      return n;
    });

  // ─── Actions ──────────────────────────────────────────
  const handleRun = async () => {
    setRunning(true);
    try {
      const r = await triggerDiscoveryRun();
      showToast(r.message || "Discovery pipeline triggered");
    } catch {
      showToast("Failed to trigger pipeline", "err");
    } finally {
      setRunning(false);
    }
  };

  const handleIgnore = async (id: number) => {
    await updateCandidateStatus(id, "ignored").catch(() => {});
    loadData();
  };

  const handleRestore = async (id: number) => {
    await updateCandidateStatus(id, "suggested").catch(() => {});
    loadData();
  };

  const handleBulkImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    try {
      const result = await bulkImportCandidates([...selected]);
      showToast(`Imported ${result.created} new · ${result.reused} matched · ${result.errors} errors`);
      loadData();
    } catch {
      showToast("Bulk import failed", "err");
    } finally {
      setImporting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 p-6">

        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-900/30">
                <Radar size={20} className="text-black" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight font-mono">Discovery Incubator & Triage</h1>
                <p className="text-xs text-slate-400 mt-0.5">Pre-listing discovery radar & NLP news entity triage · Approve candidates to import into Master Universe</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Run pipeline */}
            <button
              id="btn-run-discovery"
              onClick={handleRun}
              disabled={running}
              className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-400 transition-all hover:bg-amber-500/20 disabled:opacity-50"
            >
              {running ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
              {running ? "Running…" : "Run Discovery"}
            </button>

            {/* Refresh */}
            <button
              id="btn-refresh-discovery"
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 transition-all hover:border-cyan-500/40 hover:text-cyan-400 disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>

            {/* Bulk import */}
            <button
              id="btn-bulk-import"
              onClick={handleBulkImport}
              disabled={selected.size === 0 || importing}
              className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-400 transition-all hover:bg-emerald-500/20 disabled:opacity-40"
            >
              {importing ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              {importing ? "Importing…" : `Import Selected (${selected.size})`}
            </button>
          </div>
        </div>

        {/* ── Stats Cards ────────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total Candidates",  value: stats.total_candidates,              color: "text-cyan-400"    },
              { label: "Suggested",         value: stats.by_status["suggested"] ?? 0,   color: "text-amber-400"   },
              { label: "Imported",          value: stats.by_status["imported"] ?? 0,    color: "text-emerald-400" },
              { label: "Cache Queue",       value: stats.cache_rows_pending,             color: "text-slate-400"   },
            ].map(card => (
              <div key={card.label} className="rounded-2xl border border-slate-800 bg-[#0A1628] p-4">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">{card.label}</p>
                <p className={`mt-1.5 text-2xl font-bold ${card.color}`}>{card.value.toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

        {/* Feature flag warning */}
        {stats && !stats.feature_enabled && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            <AlertCircle size={16} />
            Discovery module is <strong>disabled</strong>. Enable it by setting
            <code className="mx-1 rounded bg-amber-900/40 px-1.5 py-0.5 font-mono text-xs">early_stage_enabled = true</code>
            in System Settings.
          </div>
        )}

        {/* ── Triage Tabs & Filters Bar ─────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#0A1628] px-4 py-3">
          {/* Triage Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => { setStatusFilter("suggested"); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === "suggested"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>Pending Triage</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300">
                {stats?.by_status["suggested"] ?? 0}
              </span>
            </button>

            <button
              onClick={() => { setStatusFilter("imported"); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === "imported"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>In Master Universe</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300">
                {stats?.by_status["imported"] ?? 0}
              </span>
            </button>

            <button
              onClick={() => { setStatusFilter("ignored"); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === "ignored"
                  ? "bg-slate-700/40 text-slate-300 border border-slate-600/40"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <span>Dismissed</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-400">
                {stats?.by_status["ignored"] ?? 0}
              </span>
            </button>
          </div>

          {/* Search & Extra Filters */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1 justify-end">
            <TerminalSearch
              value={search}
              onChange={setSearch}
              placeholder="Search candidate company, ticker, or sector..."
              className="w-full sm:w-64"
            />

            {/* Listed on NSE/BSE Toggle Filter */}
            <button
              id="filter-listed-only"
              type="button"
              onClick={() => { setListedOnly(v => !v); setPage(1); }}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                listedOnly
                  ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300 shadow-sm shadow-emerald-950"
                  : "border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-600"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${listedOnly ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
              Listed Only
            </button>

            {/* Sentiment */}
            <select
              id="filter-sentiment"
              value={sentimentFilter}
              onChange={e => { setSentimentFilter(e.target.value); setPage(1); }}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 focus:border-cyan-500/50 focus:outline-none"
            >
              <option value="">All Sentiments</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </div>
        </div>

        {/* ── Table ──────────────────────────────────────── */}
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#07111F]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {/* Select All */}
                  <th className="px-4 py-3 text-left">
                    <button onClick={toggleAll} className="text-slate-400 hover:text-cyan-400">
                      {selected.size > 0 && selected.size === filtered.length
                        ? <CheckSquare size={15} />
                        : <Square size={15} />}
                    </button>
                  </th>
                  {[
                    { label: "Company",       col: "company_name",  w: "" },
                    { label: "Source",        col: "source",        w: "" },
                    { label: "Trend Score",   col: "trend_score",   w: "" },
                    { label: "Mentions",      col: "mention_count", w: "" },
                    { label: "Sentiment",     col: "sentiment",     w: "" },
                    { label: "First Seen",    col: "first_seen",    w: "" },
                    { label: "Status",        col: "status",        w: "" },
                  ].map(({ label, col }) => (
                    <th
                      key={col}
                      onClick={() => toggleSort(col)}
                      className="cursor-pointer whitespace-nowrap px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:text-cyan-400 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        {label}
                        {sortBy === col
                          ? <ArrowUpDown size={10} className="text-cyan-400" />
                          : <ArrowUpDown size={10} className="opacity-30" />}
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading && (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <Loader2 size={24} className="mx-auto animate-spin text-cyan-500" />
                      <p className="mt-3 text-xs text-slate-500">Loading candidates…</p>
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <Radar size={32} className="mx-auto text-slate-700" />
                      <p className="mt-3 text-sm text-slate-500">No candidates found.</p>
                      <p className="mt-1 text-xs text-slate-600">Run the discovery pipeline to populate this table.</p>
                    </td>
                  </tr>
                )}
                {!loading && filtered.map((c, i) => {
                  const isSelected = selected.has(c.id);
                  const screenerUrl = `https://www.screener.in/company/${c.tentative_ticker ? c.tentative_ticker : encodeURIComponent(c.company_name)}/consolidated/`;
                  return (
                    <tr
                      key={c.id}
                      className={`group transition-colors duration-150 ${
                        isSelected
                          ? "bg-emerald-500/5"
                          : i % 2 === 0 ? "bg-transparent" : "bg-slate-900/20"
                      } hover:bg-slate-800/40`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3">
                        <button onClick={() => toggleOne(c.id)} className="text-slate-500 hover:text-emerald-400">
                          {isSelected ? <CheckSquare size={15} className="text-emerald-400" /> : <Square size={15} />}
                        </button>
                      </td>

                      {/* Company */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <a
                            href={screenerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-white hover:text-cyan-400 transition-colors inline-flex items-center gap-1.5 group/screener"
                            title="View financials on Screener.in"
                          >
                            <span>{c.company_name}</span>
                            <ExternalLink size={11} className="opacity-0 group-hover/screener:opacity-100 text-cyan-400 transition-opacity" />
                          </a>
                          {c.is_listed && (
                            <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-mono font-medium text-emerald-400">
                              NSE/BSE
                            </span>
                          )}
                        </div>
                        {c.tentative_ticker && (
                          <div className="mt-0.5 font-mono text-[10px] text-slate-500">{c.tentative_ticker}</div>
                        )}
                      </td>

                      {/* Source */}
                      <td className="px-4 py-3"><SourceTag source={c.source} sourceUrl={c.source_url} /></td>

                      {/* Trend Score */}
                      <td className="px-4 py-3"><ScoreBar score={c.trend_score} /></td>

                      {/* Mentions */}
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-amber-400">{c.mention_count}</span>
                      </td>

                      {/* Sentiment */}
                      <td className="px-4 py-3"><SentimentBadge sentiment={c.sentiment} /></td>

                      {/* First Seen */}
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(c.first_seen).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          c.status === "imported" ? "bg-emerald-500/20 text-emerald-400" :
                          c.status === "ignored"  ? "bg-slate-700/50 text-slate-500" :
                                                    "bg-cyan-500/10 text-cyan-400"
                        }`}>
                          {c.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {c.status === "suggested" && (
                            <>
                              <button
                                id={`btn-import-${c.id}`}
                                onClick={async () => {
                                  const ids = [c.id];
                                  setImporting(true);
                                  try {
                                    const result = await bulkImportCandidates(ids);
                                    showToast(`Imported ${result.created} new · ${result.reused} matched`);
                                    loadData();
                                  } catch {
                                    showToast("Import failed", "err");
                                  } finally {
                                    setImporting(false);
                                  }
                                }}
                                title="Approve & Import to Master Universe"
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 transition-all shadow-xs"
                              >
                                <CheckCircle2 size={11} className="text-emerald-400" />
                                Approve
                              </button>
                              <button
                                id={`btn-ignore-${c.id}`}
                                onClick={() => handleIgnore(c.id)}
                                title="Dismiss this candidate"
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-1 text-xs font-medium text-slate-400 hover:text-rose-300 hover:border-rose-500/40 hover:bg-rose-950/20 transition-all"
                              >
                                <EyeOff size={11} />
                                Dismiss
                              </button>
                            </>
                          )}

                          {c.status === "imported" && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30">
                              <CheckCircle2 size={11} />
                              In Universe
                            </span>
                          )}

                          {c.status === "ignored" && (
                            <button
                              onClick={() => handleRestore(c.id)}
                              className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:text-white hover:border-cyan-500/40 transition-all"
                            >
                              Restore
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3">
            <p className="text-xs text-slate-500">Page {page}</p>
            <div className="flex items-center gap-2">
              <button
                id="btn-page-prev"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-40 hover:border-cyan-500/40 hover:text-cyan-400"
              >
                <ChevronLeft size={12} /> Prev
              </button>
              <button
                id="btn-page-next"
                onClick={() => setPage(p => p + 1)}
                disabled={filtered.length < PAGE_SIZE}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-40 hover:border-cyan-500/40 hover:text-cyan-400"
              >
                Next <ChevronRight size={12} />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* ── Toast ────────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border px-5 py-3 shadow-2xl backdrop-blur-sm text-sm font-medium transition-all animate-in slide-in-from-bottom-4 ${
          toast.type === "ok"
            ? "border-emerald-500/40 bg-emerald-950/90 text-emerald-300"
            : "border-red-500/40 bg-red-950/90 text-red-300"
        }`}>
          {toast.type === "ok"
            ? <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            : <AlertCircle  size={16} className="text-red-400 shrink-0" />}
          {toast.msg}
        </div>
      )}
    </DashboardLayout>
  );
}
