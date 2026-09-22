"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Download,
  Terminal,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  validateFormula,
  getFormulaPresets,
  getFormulaMetrics,
  runFormulaQuery,
  FormulaPreset,
  MetricCategory,
  FormulaRunResult,
  FormulaRunResponse,
} from "@/lib/screenerFormulaApi";

interface FormulaScreenerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFormula?: string;
}

export function FormulaScreenerModal({
  isOpen,
  onClose,
  initialFormula = "ROCE > 20 AND Debt to Equity < 0.5 AND Sales Growth > 15",
}: FormulaScreenerModalProps) {
  const [formula, setFormula] = useState(initialFormula);
  const [validation, setValidation] = useState<{
    valid: boolean;
    error?: string;
    metrics?: string[];
  }>({ valid: true });
  const [isValidating, setIsValidating] = useState(false);
  const [presets, setPresets] = useState<FormulaPreset[]>([]);
  const [categories, setCategories] = useState<MetricCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("Growth & Acceleration");

  // Query Execution State
  const [isRunning, setIsRunning] = useState(false);
  const [queryResponse, setQueryResponse] = useState<FormulaRunResponse | null>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>("market_cap");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Textarea ref for inserting tokens at cursor
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load presets and metrics on open
  useEffect(() => {
    if (!isOpen) return;
    getFormulaPresets()
      .then((res) => {
        if (res.success) setPresets(res.presets);
      })
      .catch((err) => console.error("Failed to load presets", err));

    getFormulaMetrics()
      .then((res) => {
        if (res.success) {
          setCategories(res.categories);
          if (res.categories.length > 0) {
            setActiveCategory(res.categories[0].category);
          }
        }
      })
      .catch((err) => console.error("Failed to load metrics", err));
  }, [isOpen]);

  // Debounced syntax validation
  useEffect(() => {
    if (!formula.trim()) {
      setValidation({ valid: false, error: "Formula cannot be empty" });
      return;
    }
    const timer = setTimeout(async () => {
      setIsValidating(true);
      try {
        const res = await validateFormula(formula);
        setValidation({
          valid: res.valid,
          error: res.error,
          metrics: res.metrics_detected,
        });
      } catch (err: any) {
        setValidation({ valid: false, error: err.message });
      } finally {
        setIsValidating(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [formula]);

  // Execute query
  const executeQuery = async (targetPage = 1) => {
    if (!formula.trim() || !validation.valid) return;
    setIsRunning(true);
    try {
      const res = await runFormulaQuery({
        formula,
        page: targetPage,
        limit: 20,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setQueryResponse(res);
      setPage(targetPage);
    } catch (err: any) {
      alert(`Query Error: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Run on first open with initial formula
  useEffect(() => {
    if (isOpen && !queryResponse && validation.valid) {
      executeQuery(1);
    }
  }, [isOpen, validation.valid]);

  // Insert token chip into textarea
  const insertToken = (tokenText: string) => {
    if (!textareaRef.current) {
      setFormula((prev) => (prev.trim() ? `${prev.trim()} AND ${tokenText}` : tokenText));
      return;
    }
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = formula;

    let insertion = tokenText;
    // If not starting fresh and not already preceded by AND / OR / (, insert ' AND '
    const beforeCursor = current.substring(0, start).trim();
    if (beforeCursor && !beforeCursor.endsWith("AND") && !beforeCursor.endsWith("OR") && !beforeCursor.endsWith("(")) {
      insertion = ` AND ${tokenText}`;
    }

    const updated = current.substring(0, start) + insertion + current.substring(end);
    setFormula(updated);

    // Reposition cursor
    setTimeout(() => {
      el.focus();
      const nextPos = start + insertion.length;
      el.setSelectionRange(nextPos, nextPos);
    }, 0);
  };

  const applyPreset = (preset: FormulaPreset) => {
    setFormula(preset.formula);
    setTimeout(() => {
      executeQuery(1);
    }, 100);
  };

  const exportCSV = () => {
    if (!queryResponse || !queryResponse.results.length) return;
    const headers = [
      "Symbol",
      "Company",
      "Sector",
      "CMP",
      "Market Cap (Cr)",
      "FCF Yield (%)",
      "RSI(14)",
      "Beta",
      "52W Dist (%)",
      "ROCE (%)",
      "ROE (%)",
      "P/E",
      "P/B",
      "Sales YoY (%)",
      "PAT YoY (%)",
      "Debt/Eq",
      "Piotroski",
      "CFO/PAT",
    ];
    const rows = queryResponse.results.map((r) => [
      r.symbol,
      `"${r.company_name.replace(/"/g, '""')}"`,
      `"${r.sector.replace(/"/g, '""')}"`,
      r.current_price ?? "",
      r.market_cap ?? "",
      r.fcf_yield ?? "",
      r.rsi_14 ?? "",
      r.beta ?? "",
      r.distance_52w_high ?? "",
      r.roce ?? "",
      r.roe ?? "",
      r.stock_pe ?? "",
      r.price_to_book ?? "",
      r.quarterly_sales_yoy ?? "",
      r.quarterly_pat_yoy ?? "",
      r.debt_to_equity ?? "",
      r.piotroski_score ?? "",
      r.cfo_to_pat ?? "",
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `alpha_india_formula_screen_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-6xl bg-[#081225] border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#050B14]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white font-mono tracking-wide">
                  QUANTITATIVE FORMULA BUILDER
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  AST Engine v2.3
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Construct multi-factor mathematical screener queries with sub-50ms execution.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm font-mono">
          {/* Preset Strategies */}
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Institutional Strategy Presets
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p)}
                  className="text-left p-2.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 hover:border-cyan-500/40 transition group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-200 group-hover:text-cyan-400">
                      {p.title}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {p.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1 leading-snug">
                    {p.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Formula Textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs uppercase tracking-wider text-slate-300 font-semibold">
                Screening Expression
              </label>
              {/* Validation Badge */}
              <div className="flex items-center gap-2">
                {isValidating ? (
                  <span className="text-xs text-slate-400 animate-pulse">Validating AST...</span>
                ) : validation.valid ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Syntax Valid ({validation.metrics?.length || 0} Factors Recognized)
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {validation.error}
                  </span>
                )}
              </div>
            </div>

            <textarea
              ref={textareaRef}
              rows={3}
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder="e.g. ROCE > 20 AND Debt to Equity < 0.5 AND (Sales Growth > 20 OR Profit Growth > 25)"
              className="w-full bg-[#050B14] border border-slate-700 rounded-lg p-3 font-mono text-sm text-cyan-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40"
            />
          </div>

          {/* Metric Inserter Chips */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                Metric Insert Toolbar (Click to append)
              </span>
              {/* Category tabs */}
              <div className="flex items-center gap-1 overflow-x-auto">
                {categories.map((c) => (
                  <button
                    key={c.category}
                    onClick={() => setActiveCategory(c.category)}
                    className={`text-[11px] px-2.5 py-1 rounded transition whitespace-nowrap ${
                      activeCategory === c.category
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
                        : "text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800"
                    }`}
                  >
                    {c.category}
                  </button>
                ))}
              </div>
            </div>

            {/* Chips for active category */}
            <div className="flex flex-wrap gap-1.5 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
              {categories
                .find((c) => c.category === activeCategory)
                ?.items.map((m) => (
                  <button
                    key={m.name}
                    onClick={() => insertToken(m.token)}
                    title={m.desc}
                    className="text-xs px-2.5 py-1 rounded bg-slate-800/80 hover:bg-cyan-950 hover:text-cyan-300 hover:border-cyan-500/40 text-slate-300 border border-slate-700/60 transition flex items-center gap-1"
                  >
                    <span>{m.name}</span>
                    <span className="text-[10px] text-slate-500">({m.token.split(" ")[1]} {m.token.split(" ")[2]})</span>
                  </button>
                ))}

              {/* Logical operators quick tokens */}
              <div className="border-l border-slate-700 pl-2 ml-2 flex items-center gap-1">
                <button
                  onClick={() => insertToken("AND")}
                  className="text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition"
                >
                  AND
                </button>
                <button
                  onClick={() => insertToken("OR")}
                  className="text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 transition"
                >
                  OR
                </button>
                <button
                  onClick={() => insertToken("NOT")}
                  className="text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition"
                >
                  NOT
                </button>
                <button
                  onClick={() => insertToken("(")}
                  className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition"
                >
                  (
                </button>
                <button
                  onClick={() => insertToken(")")}
                  className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition"
                >
                  )
                </button>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <div className="flex items-center gap-3">
              <button
                onClick={() => executeQuery(1)}
                disabled={isRunning || !validation.valid}
                className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                {isRunning ? "Executing..." : "Run Quantitative Screen"}
              </button>

              <button
                onClick={() => setFormula("")}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                Clear
              </button>
            </div>

            {queryResponse && (
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span>
                  Found <strong className="text-white">{queryResponse.total}</strong> companies
                </span>
                <span>•</span>
                <span>
                  Speed: <strong className="text-emerald-400">{queryResponse.execution_time_ms} ms</strong>
                </span>
                <button
                  onClick={exportCSV}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>
              </div>
            )}
          </div>

          {/* Results Table */}
          {queryResponse && (
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-[#050B14]">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider">
                      <th className="p-3">Symbol</th>
                      <th className="p-3">Company</th>
                      <th className="p-3">Sector</th>
                      <th className="p-3 text-right">CMP (₹)</th>
                      <th className="p-3 text-right">MCAP (₹ Cr)</th>
                      <th className="p-3 text-right">FCF Yield</th>
                      <th className="p-3 text-right">RSI(14)</th>
                      <th className="p-3 text-right">Beta</th>
                      <th className="p-3 text-right">52W Dist</th>
                      <th className="p-3 text-right">ROCE (%)</th>
                      <th className="p-3 text-right">Sales YoY (%)</th>
                      <th className="p-3 text-right">PAT YoY (%)</th>
                      <th className="p-3 text-right">P/E</th>
                      <th className="p-3 text-right">Debt/Eq</th>
                      <th className="p-3 text-right">Piotroski</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {queryResponse.results.length === 0 ? (
                      <tr>
                        <td colSpan={16} className="p-8 text-center text-slate-500">
                          No companies match this quantitative formula. Try easing your constraints.
                        </td>
                      </tr>
                    ) : (
                      queryResponse.results.map((r) => (
                        <tr key={r.symbol} className="hover:bg-slate-900/60 transition group">
                          <td className="p-3 font-bold text-cyan-400">{r.symbol}</td>
                          <td className="p-3 text-slate-200 max-w-[200px] truncate">
                            {r.company_name}
                          </td>
                          <td className="p-3 text-slate-400">{r.sector}</td>
                          <td className="p-3 text-right font-medium text-white">
                            {r.current_price ? `₹${r.current_price.toLocaleString("en-IN")}` : "--"}
                          </td>
                          <td className="p-3 text-right text-slate-300">
                            {r.market_cap ? r.market_cap.toLocaleString("en-IN") : "--"}
                          </td>
                          <td className="p-3 text-right">
                            {r.fcf_yield !== null && r.fcf_yield !== undefined ? (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  r.fcf_yield >= 3.0
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : "text-slate-300"
                                }`}
                              >
                                {r.fcf_yield}%
                              </span>
                            ) : (
                              "--"
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {r.rsi_14 !== null && r.rsi_14 !== undefined ? (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  r.rsi_14 >= 70
                                    ? "bg-amber-500/20 text-amber-300"
                                    : r.rsi_14 >= 50
                                    ? "bg-cyan-500/20 text-cyan-300"
                                    : "bg-slate-800 text-slate-400"
                                }`}
                              >
                                {r.rsi_14}
                              </span>
                            ) : (
                              "--"
                            )}
                          </td>
                          <td className="p-3 text-right">
                            {r.beta !== null && r.beta !== undefined ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-500/15 text-purple-300 border border-purple-500/20">
                                {r.beta}
                              </span>
                            ) : (
                              "--"
                            )}
                          </td>
                          <td className="p-3 text-right text-slate-300">
                            {r.distance_52w_high !== null && r.distance_52w_high !== undefined ? (
                              <span
                                className={
                                  r.distance_52w_high <= 10
                                    ? "text-emerald-400 font-bold"
                                    : "text-slate-400"
                                }
                              >
                                -{r.distance_52w_high}%
                              </span>
                            ) : (
                              "--"
                            )}
                          </td>
                          <td className="p-3 text-right text-emerald-400 font-bold">
                            {r.roce ? `${r.roce}%` : "--"}
                          </td>
                          <td className="p-3 text-right text-slate-200">
                            {r.quarterly_sales_yoy ? `${r.quarterly_sales_yoy}%` : "--"}
                          </td>
                          <td className="p-3 text-right text-slate-200">
                            {r.quarterly_pat_yoy ? `${r.quarterly_pat_yoy}%` : "--"}
                          </td>
                          <td className="p-3 text-right text-slate-400">
                            {r.stock_pe ? r.stock_pe.toFixed(1) : "--"}
                          </td>
                          <td className="p-3 text-right text-slate-400">
                            {r.debt_to_equity !== null ? r.debt_to_equity.toFixed(2) : "--"}
                          </td>
                          <td className="p-3 text-right">
                            {r.piotroski_score !== null ? (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  r.piotroski_score >= 7
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : r.piotroski_score >= 5
                                    ? "bg-amber-500/20 text-amber-300"
                                    : "bg-rose-500/20 text-rose-300"
                                }`}
                              >
                                {r.piotroski_score}/9
                              </span>
                            ) : (
                              "--"
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <a
                              href={r.techno_funda_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition inline-block"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {queryResponse.total_pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-[#050B14]">
                  <span className="text-xs text-slate-400">
                    Page {queryResponse.page} of {queryResponse.total_pages} ({queryResponse.total} total)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => executeQuery(page - 1)}
                      disabled={page <= 1 || isRunning}
                      className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => executeQuery(page + 1)}
                      disabled={page >= queryResponse.total_pages || isRunning}
                      className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
