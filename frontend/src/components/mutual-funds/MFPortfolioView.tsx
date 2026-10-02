"use client";

import { useState, useEffect } from "react";
import {
  mfRadarApi,
  type MFPortfolioSummary,
  type MFPortfolioHolding,
  type MFSmartSwapCard,
  type MFRadarScheme,
} from "@/lib/mfRadarApi";
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Plus,
  Trash2,
  RefreshCw,
  Sparkles,
  Info,
  Clock,
  ArrowLeftRight,
  BarChart2,
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  Unlock,
  FileSpreadsheet,
  Upload,
} from "lucide-react";

interface MFPortfolioViewProps {
  onOpenSchemeChart?: (scheme: MFRadarScheme) => void;
  availableSchemes: MFRadarScheme[];
}

export default function MFPortfolioView({
  onOpenSchemeChart,
  availableSchemes,
}: MFPortfolioViewProps) {
  const [portfolio, setPortfolio] = useState<MFPortfolioSummary | null>(null);
  const [swaps, setSwaps] = useState<MFSmartSwapCard[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Add holding modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedSchemeCode, setSelectedSchemeCode] = useState<string>("");
  const [units, setUnits] = useState<string>("");
  const [purchaseDate, setPurchaseDate] = useState<string>(
    new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0]
  );
  const [purchaseNav, setPurchaseNav] = useState<string>("");
  const [folioNumber, setFolioNumber] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [formError, setFormError] = useState<string>("");

  // Import broker Excel/CSV modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<"file" | "paste">("file");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [selectedSheetName, setSelectedSheetName] = useState<string>("");
  const [importRawText, setImportRawText] = useState<string>("");
  const [replaceExisting, setReplaceExisting] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState<boolean>(false);

  const loadPortfolioData = async () => {
    setLoading(true);
    try {
      const [portRes, swapsRes] = await Promise.allSettled([
        mfRadarApi.getPortfolio(),
        mfRadarApi.getSmartSwaps(),
      ]);

      if (portRes.status === "fulfilled") {
        setPortfolio(portRes.value);
      }
      if (swapsRes.status === "fulfilled") {
        setSwaps(swapsRes.value);
      }
    } catch (e) {
      console.error("Failed to load portfolio:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortfolioData();
  }, []);

  // Update purchase NAV default when scheme is selected
  const handleSchemeSelect = (code: string) => {
    setSelectedSchemeCode(code);
    const found = availableSchemes.find((s) => s.scheme_code === code);
    if (found && found.current_nav && !purchaseNav) {
      setPurchaseNav(String(found.current_nav));
    }
  };

  const handleAddHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!selectedSchemeCode) {
      setFormError("Please select a mutual fund scheme");
      return;
    }
    const parsedUnits = parseFloat(units);
    const parsedNav = parseFloat(purchaseNav);

    if (isNaN(parsedUnits) || parsedUnits <= 0) {
      setFormError("Please enter valid units (> 0)");
      return;
    }
    if (isNaN(parsedNav) || parsedNav <= 0) {
      setFormError("Please enter a valid purchase NAV (> 0)");
      return;
    }

    setActionLoading(true);
    try {
      await mfRadarApi.addPortfolioHolding({
        scheme_code: selectedSchemeCode,
        units: parsedUnits,
        purchase_date: purchaseDate,
        purchase_nav: parsedNav,
        folio_number: folioNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      setIsAddModalOpen(false);
      // Reset form
      setSelectedSchemeCode("");
      setUnits("");
      setPurchaseNav("");
      setFolioNumber("");
      setNotes("");

      await loadPortfolioData();
    } catch (err: any) {
      setFormError(err?.message || "Failed to add holding");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteHolding = async (holdingId: number, schemeName: string) => {
    if (!confirm(`Are you sure you want to remove "${schemeName}" from your portfolio?`)) {
      return;
    }
    setActionLoading(true);
    try {
      await mfRadarApi.deletePortfolioHolding(holdingId);
      await loadPortfolioData();
    } catch (err) {
      console.error("Failed to delete holding:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSeedSample = async () => {
    setActionLoading(true);
    try {
      await mfRadarApi.seedSamplePortfolio();
      await loadPortfolioData();
    } catch (err) {
      console.error("Failed to seed sample portfolio:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);
    setImportResult(null);
    setImporting(true);

    try {
      let res;
      if (importMode === "file") {
        if (!importFile) {
          setImportError("Please select an Excel (.xlsx) or CSV file to upload.");
          setImporting(false);
          return;
        }
        res = await mfRadarApi.importHoldingsFile(
          importFile,
          replaceExisting,
          selectedSheetName.trim() || undefined
        );
      } else {
        if (!importRawText.trim()) {
          setImportError("Please paste your broker CSV or table content.");
          setImporting(false);
          return;
        }
        res = await mfRadarApi.importHoldingsCsvText(importRawText, replaceExisting);
      }

      if (res && res.success) {
        const sheetsNote = res.candidate_sheets && res.candidate_sheets.length > 0
          ? ` from sheet(s): ${res.candidate_sheets.join(", ")}`
          : "";
        setImportResult(
          `Processed statement: ${res.added_count} added, ${res.updated_count} updated, ${res.skipped_count} skipped${sheetsNote}.`
        );
        await loadPortfolioData();
        setTimeout(() => {
          setIsImportModalOpen(false);
          setImportResult(null);
          setImportFile(null);
          setSelectedSheetName("");
          setImportRawText("");
        }, 1800);
      } else {
        setImportError(res.errors?.join(", ") || "Failed to parse broker holdings");
      }
    } catch (err: any) {
      setImportError(err.message || "Failed to import broker file");
    } finally {
      setImporting(false);
    }
  };

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "₹0.00";
    return `₹${Number(val).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="space-y-6">
      {/* ── 1. Portfolio Header Cockpit ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 dark:bg-[#071120] border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-mono flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              Personal Portfolio Tracker & Friction Engine
            </h2>
            <span className="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
              SEBI Tax & Exit Load Aware
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time mark-to-market valuations • Lot-level holding age • Dynamic STCG (20%) / LTCG (12.5%) deduction
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSeedSample}
            disabled={actionLoading}
            className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-slate-950 transition disabled:opacity-50"
            title="Seed 3 sample funds (Kotak Bluechip, Axis Small Cap, Quant Active) for instant demonstration"
          >
            <Sparkles size={13} />
            <span>Seed Sample Portfolio</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-1.5 text-xs font-semibold text-cyan-400 hover:bg-cyan-500 hover:text-slate-950 transition shadow-sm"
            title="Import holdings from Excel (.xlsx/.xls), Zerodha Coin, Groww, Angel One, or CAMS"
          >
            <FileSpreadsheet size={14} />
            <span>Import Excel / Broker File</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-cyan-600 dark:bg-cyan-500 px-3.5 py-1.5 text-xs font-bold text-white dark:text-slate-950 hover:bg-cyan-400 transition shadow-sm shadow-cyan-950/40"
          >
            <Plus size={14} />
            <span>Add Holding</span>
          </button>

          <button
            onClick={loadPortfolioData}
            disabled={loading || actionLoading}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-white transition disabled:opacity-50"
            title="Refresh Portfolio"
          >
            <RefreshCw size={13} className={loading || actionLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* ── 2. KPI Summary Ribbon ── */}
      {portfolio && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Total Invested */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#07101E] p-3.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Invested
            </span>
            <div className="text-base sm:text-lg font-bold font-mono text-slate-900 dark:text-white mt-1">
              {formatCurrency(portfolio.total_invested)}
            </div>
            <span className="text-[10px] text-slate-400">
              Across {portfolio.holdings_count} funds
            </span>
          </div>

          {/* Current Valuation */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#07101E] p-3.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Current Valuation
            </span>
            <div className="text-base sm:text-lg font-bold font-mono text-cyan-400 mt-1">
              {formatCurrency(portfolio.total_current_val)}
            </div>
            <span className="text-[10px] text-slate-400">Live Mark-to-Market</span>
          </div>

          {/* Overall Unrealized P&L */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#07101E] p-3.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Unrealized P&L
            </span>
            <div
              className={`text-base sm:text-lg font-bold font-mono flex items-center gap-1 mt-1 ${
                portfolio.overall_pnl >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {portfolio.overall_pnl >= 0 ? (
                <TrendingUp size={16} />
              ) : (
                <TrendingDown size={16} />
              )}
              <span>
                {portfolio.overall_pnl >= 0 ? "+" : ""}
                {formatCurrency(portfolio.overall_pnl)}
              </span>
            </div>
            <span
              className={`text-[10px] font-bold ${
                portfolio.overall_pnl_pct >= 0 ? "text-emerald-500" : "text-rose-500"
              }`}
            >
              {portfolio.overall_pnl_pct >= 0 ? "+" : ""}
              {portfolio.overall_pnl_pct.toFixed(2)}% Return
            </span>
          </div>

          {/* Exit Load Lock Status */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#07101E] p-3.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Exit Load Status
            </span>
            <div className="text-base sm:text-lg font-bold font-mono text-amber-400 mt-1 flex items-center gap-1.5">
              {portfolio.locked_in_exit_load_count > 0 ? (
                <>
                  <Lock size={15} className="text-amber-400" />
                  <span>{portfolio.locked_in_exit_load_count} Locked</span>
                </>
              ) : (
                <>
                  <Unlock size={15} className="text-emerald-400" />
                  <span className="text-emerald-400">All 0% Exit Load</span>
                </>
              )}
            </div>
            <span className="text-[10px] text-slate-400">
              {portfolio.total_exit_load_amt > 0
                ? `${formatCurrency(portfolio.total_exit_load_amt)} penalty`
                : "100% Free of Load"}
            </span>
          </div>

          {/* Net Liquid Proceeds (After Tax & Exit Load) */}
          <div className="col-span-2 lg:col-span-1 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
              Net Liquidity Proceeds
            </span>
            <div className="text-base sm:text-lg font-bold font-mono text-emerald-400 mt-1">
              {formatCurrency(portfolio.net_portfolio_liquidity)}
            </div>
            <span className="text-[10px] text-slate-400">
              Net post {formatCurrency(portfolio.total_tax_liability)} tax
            </span>
          </div>
        </div>
      )}

      {/* ── 3. Smart Swap Recommender Engine ── */}
      <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/10 p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
              <ArrowLeftRight size={16} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white font-mono flex items-center gap-2">
                Smart Swap Alpha Optimization Radar
                <span className="rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] px-2 py-0.5 border border-cyan-500/40 font-mono">
                  {swaps.length} Actionable Swap{swaps.length === 1 ? "" : "s"}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Identifies peer schemes with superior 6M alpha, automatically deducts 1% Exit Load & STCG/LTCG friction. Proposes swaps when Net Gain &ge; +1.0%.
              </p>
            </div>
          </div>
        </div>

        {swaps.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-[#050B14] p-8 text-center">
            <ShieldCheck className="h-10 w-10 text-emerald-400 mx-auto mb-2 opacity-80" />
            <h4 className="text-sm font-bold text-white">Portfolio is Fully Optimized</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              No holdings have severe category underperformance exceeding the Exit Load and Tax Friction hurdles. All funds are holding their ground or clearing alpha hurdles.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {swaps.map((s, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-800 bg-[#060D1A] overflow-hidden hover:border-cyan-500/50 transition-all flex flex-col justify-between"
              >
                {/* Swap Top Header */}
                <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5 bg-slate-900/60">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider font-mono">
                      Lagging Holding
                    </span>
                    <span className="text-slate-400 text-xs font-mono">
                      Category: <span className="text-white font-bold">{s.current_scheme.category}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-xs font-bold text-emerald-300 font-mono">
                    <span>+{s.alpha_metrics.net_alpha_gain}% Net Alpha Gain</span>
                  </div>
                </div>

                {/* Scheme Switch Flow Card */}
                <div className="p-4 grid grid-cols-1 sm:grid-cols-11 gap-3 items-center">
                  {/* Current Scheme (Sell) */}
                  <div className="sm:col-span-5 rounded-xl border border-rose-500/20 bg-rose-950/10 p-3">
                    <div className="flex items-center justify-between text-[10px] font-mono text-rose-400 mb-1">
                      <span className="font-bold">SWITCH OUT (SELL)</span>
                      <span>Day {s.current_scheme.holding_days}/365</span>
                    </div>
                    <div className="text-xs font-bold text-white line-clamp-1" title={s.current_scheme.name}>
                      {s.current_scheme.name}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{s.current_scheme.amc}</div>

                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-rose-500/20 text-[10px] font-mono">
                      <div>
                        <span className="text-slate-500">Value:</span>{" "}
                        <span className="text-white font-bold">{formatCurrency(s.current_scheme.current_value)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500">6M Ret:</span>{" "}
                        <span className={`font-bold ${s.current_scheme.return_6m_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {s.current_scheme.return_6m_pct > 0 ? "+" : ""}{s.current_scheme.return_6m_pct}%
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">52W Peak:</span>{" "}
                        <span className="text-slate-300">
                          {s.current_scheme.peak_nav ? `₹${s.current_scheme.peak_nav.toFixed(2)}` : "—"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500">From Top:</span>{" "}
                        <span className="text-rose-400 font-bold">
                          {s.current_scheme.drawdown_from_peak_pct !== undefined ? `${s.current_scheme.drawdown_from_peak_pct}%` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Transfer Indicator */}
                  <div className="sm:col-span-1 flex justify-center py-1 sm:py-0">
                    <div className="h-7 w-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400">
                      <ArrowRight size={14} />
                    </div>
                  </div>

                  {/* Target Scheme (Buy) */}
                  <div className="sm:col-span-5 rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-3">
                    <div className="flex items-center justify-between text-[10px] font-mono text-emerald-400 mb-1">
                      <span className="font-bold">SWITCH IN (BUY)</span>
                      <span className="rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 px-1.5 py-0.2 text-[9px] font-bold">
                        {s.target_scheme.dip_label || "ALPHA LEADER"}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-white line-clamp-1" title={s.target_scheme.name}>
                      {s.target_scheme.name}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{s.target_scheme.amc}</div>

                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-emerald-500/20 text-[10px] font-mono">
                      <div>
                        <span className="text-slate-500">6M Ret:</span>{" "}
                        <span className="text-emerald-400 font-bold">
                          +{s.target_scheme.return_6m_pct}%
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500">1Y Alpha:</span>{" "}
                        <span className="text-cyan-400 font-bold">
                          +{s.target_scheme.alpha_1y}%
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">52W Peak:</span>{" "}
                        <span className="text-slate-300">
                          {s.target_scheme.peak_nav ? `₹${s.target_scheme.peak_nav.toFixed(2)}` : "—"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500">From Top:</span>{" "}
                        <span className="text-amber-400 font-bold">
                          {s.target_scheme.drawdown_from_peak_pct !== undefined ? `${s.target_scheme.drawdown_from_peak_pct}%` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Friction Deductions Breakdown */}
                <div className="px-4 py-2 bg-[#040811] border-t border-slate-800/80 text-[11px] font-mono grid grid-cols-2 sm:grid-cols-5 gap-2 text-slate-400">
                  <div>
                    <span className="text-slate-500">Gross Alpha:</span>{" "}
                    <span className="text-cyan-400 font-bold">+{s.alpha_metrics.gross_alpha_spread}%</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Exit Load:</span>{" "}
                    <span className={s.friction_breakdown.exit_load_pct > 0 ? "text-amber-400 font-bold" : "text-emerald-400"}>
                      -{s.friction_breakdown.exit_load_pct}%
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Tax Drag:</span>{" "}
                    <span className="text-rose-400 font-bold">
                      {s.friction_breakdown.tax_bracket === "STCG_20" ? "STCG 20%" : "LTCG 12.5%"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Peak Adv:</span>{" "}
                    <span className="text-amber-400 font-bold">
                      {s.alpha_metrics.drawdown_advantage_pct !== undefined ? `+${s.alpha_metrics.drawdown_advantage_pct}%` : "—"}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500">Net Alpha:</span>{" "}
                    <span className="text-emerald-400 font-bold">+{s.alpha_metrics.net_alpha_gain}%</span>
                  </div>
                </div>

                {/* Execution Route & Rationale */}
                <div className="p-3 bg-slate-900/40 border-t border-slate-800/80 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-bold px-2 py-0.5 font-mono">
                      {s.execution.headline}
                    </span>
                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                      Settlement: {s.execution.settlement_timeline}
                    </span>
                  </div>

                  {onOpenSchemeChart && (
                    <button
                      onClick={() => {
                        const targetObj = availableSchemes.find(
                          (sc) => sc.scheme_code === s.target_scheme.code
                        );
                        if (targetObj) {
                          onOpenSchemeChart(targetObj);
                        }
                      }}
                      className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white hover:border-cyan-500 transition shrink-0"
                    >
                      <BarChart2 size={12} />
                      <span>Inspect Target</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 4. Current Holdings Table ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#050B14] overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white font-mono">
              Current Mutual Fund Holdings ({portfolio?.holdings.length || 0})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Holding period computed as of today. Exit load applies at 1.0% if held under 365 days.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#07101E] text-slate-500 dark:text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Scheme Name & Folio</th>
                <th className="py-3 px-3 text-right">Units</th>
                <th className="py-3 px-3 text-right">Purchase Date</th>
                <th className="py-3 px-3 text-right">Purchase NAV</th>
                <th className="py-3 px-3 text-right">Current NAV</th>
                <th className="py-3 px-3 text-right">Invested</th>
                <th className="py-3 px-3 text-right">Current Value</th>
                <th className="py-3 px-3 text-right">Unrealized P&L</th>
                <th className="py-3 px-3 text-center">Holding Age</th>
                <th className="py-3 px-3 text-center">Exit Load</th>
                <th className="py-3 px-3 text-center">Tax Bracket</th>
                <th className="py-3 px-3 text-right">Net Proceeds</th>
                <th className="py-3 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
              {!portfolio || portfolio.holdings.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="h-6 w-6 text-slate-500" />
                      <span>No mutual fund holdings added yet.</span>
                      <button
                        onClick={handleSeedSample}
                        className="mt-2 text-xs font-semibold text-cyan-400 underline hover:text-cyan-300"
                      >
                        Click here to seed a demo portfolio
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                portfolio.holdings.map((h) => {
                  const isProfitable = (h.unrealized_pnl || 0) >= 0;
                  return (
                    <tr
                      key={h.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-[#071324] transition-colors"
                    >
                      {/* Name & Folio */}
                      <td className="py-3 px-4 font-sans">
                        <div className="font-bold text-slate-900 dark:text-white max-w-[240px] truncate" title={h.scheme_name}>
                          {h.scheme_name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Code: {h.scheme_code} {h.folio_number ? `• Folio: ${h.folio_number}` : ""}
                        </div>
                      </td>

                      {/* Units */}
                      <td className="py-3 px-3 text-right text-slate-300">
                        {h.units.toFixed(3)}
                      </td>

                      {/* Purchase Date */}
                      <td className="py-3 px-3 text-right text-slate-400 text-[11px]">
                        {h.purchase_date}
                      </td>

                      {/* Purchase NAV */}
                      <td className="py-3 px-3 text-right text-slate-400">
                        ₹{h.purchase_nav.toFixed(2)}
                      </td>

                      {/* Current NAV */}
                      <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                        ₹{h.current_nav ? h.current_nav.toFixed(2) : "—"}
                      </td>

                      {/* Invested */}
                      <td className="py-3 px-3 text-right text-slate-300">
                        {formatCurrency(h.invested_amt)}
                      </td>

                      {/* Current Value */}
                      <td className="py-3 px-3 text-right font-bold text-cyan-400">
                        {formatCurrency(h.current_value)}
                      </td>

                      {/* Unrealized P&L */}
                      <td className="py-3 px-3 text-right">
                        <div
                          className={`font-bold flex items-center justify-end gap-1 ${
                            isProfitable ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {isProfitable ? (
                            <TrendingUp size={11} />
                          ) : (
                            <TrendingDown size={11} />
                          )}
                          <span>
                            {isProfitable ? "+" : ""}
                            {formatCurrency(h.unrealized_pnl)}
                          </span>
                        </div>
                        <div
                          className={`text-[10px] ${
                            isProfitable ? "text-emerald-500" : "text-rose-500"
                          }`}
                        >
                          {isProfitable ? "+" : ""}
                          {h.unrealized_pnl_pct ? h.unrealized_pnl_pct.toFixed(2) : "0.00"}%
                        </div>
                      </td>

                      {/* Holding Days */}
                      <td className="py-3 px-3 text-center">
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 font-bold">
                          {h.holding_days}d
                        </span>
                      </td>

                      {/* Exit Load Status */}
                      <td className="py-3 px-3 text-center">
                        {h.exit_load_active ? (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 px-2 py-0.5 text-[10px] font-bold">
                            <Lock size={10} />
                            <span>1.0% Locked</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                            <Unlock size={10} />
                            <span>0.0% Free</span>
                          </span>
                        )}
                      </td>

                      {/* Tax Bracket */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            h.tax_bracket === "STCG_20"
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                              : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                          }`}
                        >
                          {h.tax_bracket === "STCG_20" ? "STCG (20%)" : "LTCG (12.5%)"}
                        </span>
                      </td>

                      {/* Net Proceeds */}
                      <td className="py-3 px-3 text-right font-bold text-emerald-400">
                        {formatCurrency(h.net_redemption_proceeds)}
                      </td>

                      {/* Delete Action */}
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleDeleteHolding(h.id, h.scheme_name)}
                          className="h-7 w-7 rounded-lg border border-slate-700 bg-slate-800/80 inline-flex items-center justify-center text-slate-400 hover:text-rose-400 hover:border-rose-500/50 transition"
                          title="Delete holding"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 5. Add Holding Modal ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#071120] p-6 shadow-2xl relative">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Plus className="h-5 w-5 text-cyan-400" />
              <h3 className="text-base font-bold text-white font-mono">
                Add Mutual Fund Holding
              </h3>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddHolding} className="space-y-4 text-xs font-mono">
              {/* Scheme Select */}
              <div>
                <label className="block text-slate-400 mb-1">Select Scheme</label>
                <select
                  value={selectedSchemeCode}
                  onChange={(e) => handleSchemeSelect(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-hidden focus:border-cyan-500"
                  required
                >
                  <option value="">-- Choose Pure Equity Scheme --</option>
                  {availableSchemes.map((s) => (
                    <option key={s.scheme_code} value={s.scheme_code}>
                      [{s.category}] {s.scheme_name.slice(0, 50)} (NAV: ₹{s.current_nav || "N/A"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Units */}
                <div>
                  <label className="block text-slate-400 mb-1">Units Allotted</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 150.25"
                    value={units}
                    onChange={(e) => setUnits(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-hidden focus:border-cyan-500"
                    required
                  />
                </div>

                {/* Purchase NAV */}
                <div>
                  <label className="block text-slate-400 mb-1">Purchase NAV (₹)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 52.40"
                    value={purchaseNav}
                    onChange={(e) => setPurchaseNav(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-hidden focus:border-cyan-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Purchase Date */}
                <div>
                  <label className="block text-slate-400 mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-hidden focus:border-cyan-500"
                    required
                  />
                </div>

                {/* Folio Number */}
                <div>
                  <label className="block text-slate-400 mb-1">Folio Number (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 9102834/55"
                    value={folioNumber}
                    onChange={(e) => setFolioNumber(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-hidden focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-slate-400 mb-1">Notes / Goal Tag</label>
                <input
                  type="text"
                  placeholder="e.g. Child Education / Retirement Corpus"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-cyan-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition shadow-sm disabled:opacity-50"
                >
                  {actionLoading ? "Adding..." : "Save Holding"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 5. Modal: Import Excel / Broker File (Zerodha, Groww, CAMS, Custom XLSX) ── */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  <FileSpreadsheet size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Import Mutual Fund Holdings
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Supports Excel (.xlsx, .xls), Zerodha Coin, Groww MF, Angel One, and CAMS/CAS
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportError(null);
                  setImportResult(null);
                  setSelectedSheetName("");
                }}
                className="text-slate-400 hover:text-white transition p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Supported Formats Pills */}
            <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono text-slate-400">
              <span className="text-slate-500">Formats:</span>
              <span className="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-emerald-400 font-semibold">Excel (.xlsx / .xls)</span>
              <span className="rounded-md bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 text-blue-400 font-semibold">Zerodha Coin</span>
              <span className="rounded-md bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 text-cyan-400 font-semibold">Groww MF</span>
              <span className="rounded-md bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-amber-400 font-semibold">CAMS / CAS</span>
              <span className="rounded-md bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 text-purple-400 font-semibold">Advisory Sheets</span>
            </div>

            {/* Mode Switcher */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setImportMode("file")}
                className={`flex-1 py-1.5 font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  importMode === "file"
                    ? "bg-cyan-500 text-slate-950 shadow-md font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Upload size={13} />
                Upload Excel / CSV File
              </button>
              <button
                type="button"
                onClick={() => setImportMode("paste")}
                className={`flex-1 py-1.5 font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  importMode === "paste"
                    ? "bg-cyan-500 text-slate-950 shadow-md font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <FileSpreadsheet size={13} />
                Paste CSV / Text
              </button>
            </div>

            {/* Format Guideline Note */}
            <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-300 font-semibold text-[11px]">
                <Info size={12} className="text-cyan-400" />
                <span>Auto-Detected Formats &amp; Columns:</span>
              </div>
              <p className="font-mono text-[10px] text-cyan-300 bg-slate-900/90 p-2 rounded-md border border-slate-800 overflow-x-auto">
                • <strong>Zerodha Console MF P&amp;L (.xlsx, .csv):</strong> &quot;Symbol&quot;, &quot;ISIN&quot;, &quot;Open Quantity&quot;, &quot;Open Value&quot;, &quot;Previous Closing Price&quot;<br />
                • <strong>Advisory / Planning Sheets:</strong> &quot;Fund Name&quot;, &quot;Lump Sum Amt&quot; (or &quot;Units&quot; &amp; &quot;Average NAV&quot;), &quot;Category&quot;
              </p>
              <p className="text-[10px] text-slate-500">
                • Zerodha P&amp;L summary banners and zero trading quantity are automatically bypassed. Real holding units and cost basis are extracted seamlessly.
              </p>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-4 text-xs">
              {importMode === "file" ? (
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-slate-700 hover:border-cyan-500/80 rounded-xl p-6 text-center transition-colors bg-slate-950/40">
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs text-slate-300 font-semibold mb-1">
                      {importFile ? importFile.name : "Select your Zerodha P&L (.xlsx, .csv) or Portfolio sheet"}
                    </p>
                    <p className="text-[11px] text-slate-500 mb-3">
                      Drag and drop or browse from your computer
                    </p>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv,.txt"
                      onChange={(e) => e.target.files?.[0] && setImportFile(e.target.files[0])}
                      className="w-full text-xs text-slate-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-cyan-500 file:text-slate-950 hover:file:bg-cyan-400 cursor-pointer"
                    />
                  </div>

                  {/* Optional Sheet Name selector for Excel files */}
                  {importFile && (importFile.name.endsWith(".xlsx") || importFile.name.endsWith(".xls")) && (
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-300">
                        Target Sheet Tab (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Mutual Funds or Current Portfolio (leave empty for auto-detect all)"
                        value={selectedSheetName}
                        onChange={(e) => setSelectedSheetName(e.target.value)}
                        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 font-mono"
                      />
                      <p className="text-[10px] text-slate-500">
                        Leave blank to automatically extract holdings from all candidate tabs in the workbook.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <textarea
                    rows={8}
                    required
                    placeholder={`Symbol,ISIN,Quantity,Buy Value,Sell Value,Realized P&L,Realized P&L Pct.,Previous Closing Price,Open Quantity,Open Value\nINVESCO INDIA SMALLCAP,INF205K013T3,0,0,0,0,0,53.34,365.679,19998.98\nMOTILAL OSWAL MIDCAP,INF247L01445,0,0,0,0,0,114.88,336.377,39998.08\nPARAG PARIKH FLEXI CAP,INF879O01027,0,0,0,0,0,89.96,2868.967,49997.50\nQUANT SMALL CAP FUND,INF966L01689,0,0,0,0,0,313.14,1880.445,504474.73`}
                    value={importRawText}
                    onChange={(e) => setImportRawText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-100 font-mono text-[11px] focus:outline-hidden focus:border-cyan-500"
                  />
                </div>
              )}

              {/* Replace vs Merge option */}
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 text-[11px] bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0 focus:outline-hidden"
                />
                <span>Replace entire existing mutual fund portfolio (instead of merging/updating)</span>
              </label>

              {/* Status messages */}
              {importError && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-400">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {importResult && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-400 font-semibold">
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span>{importResult}</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportError(null);
                    setImportResult(null);
                    setSelectedSheetName("");
                  }}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importing}
                  className="flex items-center gap-1.5 rounded-xl bg-cyan-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition shadow-sm disabled:opacity-50"
                >
                  {importing ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Processing Statement...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={13} />
                      <span>Import Holdings</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
