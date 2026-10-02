// =============================================================================
// Alpha India — Shared UI Design Tokens
// Sprint 33.4 — UI Consistency Pass
//
// Central source of truth for recurring class patterns.
// Import these constants into page components for consistent styling.
// =============================================================================

/** Outer container on every page that sits inside DashboardLayout */
export const PAGE_CONTAINER = "space-y-5";

// ── Page Header ──────────────────────────────────────────────────────────────

/** Full-width header section divider — border-b underline style */
export const PAGE_HEADER_SECTION =
  "flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-5";

/** Icon badge wrapper next to h1 */
export const PAGE_ICON_WRAP =
  "flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex-shrink-0";

/** Main page title — h1 */
export const PAGE_TITLE =
  "text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white";

/** Engine / version badge inline with h1 */
export const PAGE_H1_BADGE =
  "text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300";

/** Subtitle below h1 */
export const PAGE_SUBTITLE = "mt-0.5 text-xs md:text-sm text-slate-600 dark:text-slate-400 max-w-3xl";

// ── KPI Cards ─────────────────────────────────────────────────────────────────

/** Standard KPI stat card surface */
export const KPI_CARD =
  "rounded-xl border border-slate-200/90 dark:border-indigo-500/20 bg-white dark:bg-[#111a30] p-3.5 flex flex-col justify-between shadow-xs dark:shadow-md";

/** KPI label text */
export const KPI_LABEL =
  "text-[10px] uppercase font-mono font-bold text-slate-500 dark:text-slate-400 tracking-wider";

/** KPI number value */
export const KPI_VALUE = "text-xl font-bold font-mono text-slate-900 dark:text-slate-50";

// ── Action Buttons ────────────────────────────────────────────────────────────

/** Primary scan / refresh action button */
export const ACTION_BTN_PRIMARY =
  "flex items-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-50 dark:bg-indigo-950/60 px-3.5 py-2 text-xs font-mono font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs";

/** Secondary / ghost action button */
export const ACTION_BTN_SECONDARY =
  "flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-800/60 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer disabled:opacity-50 shadow-xs";

// ── Tabs / Filter Pills ───────────────────────────────────────────────────────

/** Tab strip wrapper */
export const TAB_STRIP =
  "flex items-center gap-1 bg-slate-100 dark:bg-[#0f172a] p-1 rounded-lg border border-slate-200 dark:border-slate-800";

/** Individual tab item — use with active/inactive variants */
export const TAB_ITEM_BASE =
  "px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer";
export const TAB_ITEM_ACTIVE = "bg-indigo-600 dark:bg-indigo-500 text-white shadow-xs font-bold";
export const TAB_ITEM_INACTIVE = "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200";

// ── Tables ────────────────────────────────────────────────────────────────────

/** Table wrapper card */
export const TABLE_CARD =
  "overflow-x-auto rounded-xl border border-slate-200/90 dark:border-indigo-500/20 bg-white dark:bg-[#111a30] shadow-xs dark:shadow-xl";

/** Table thead */
export const TABLE_THEAD =
  "border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0f172a] text-[11px] font-mono uppercase text-slate-600 dark:text-slate-400 tracking-wider";

/** Table row hover */
export const TABLE_ROW =
  "border-b border-slate-100 dark:border-slate-800/60 transition-colors hover:bg-slate-50 dark:hover:bg-[#1e1b4b]/60 cursor-pointer";

// ── Loading ───────────────────────────────────────────────────────────────────

/** Inline spinner div — 16×16 */
export const SPINNER_SM =
  "h-4 w-4 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent";

/** Inline spinner div — 20×20 */
export const SPINNER_MD =
  "h-5 w-5 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent";

/** Full-page centered spinner — 32×32 */
export const SPINNER_LG =
  "h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent";
