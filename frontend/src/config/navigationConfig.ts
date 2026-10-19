import {
  LayoutDashboard,
  TrendingUp,
  GitBranch,
  FileText,
  FileBarChart,
  Star,
  Radar,
  Radio,
  History,
  Building2,
  Settings,
  Telescope,
  ShieldCheck,
  TableProperties,
  Sparkles,
  Zap,
  Layers,
  BookOpen,
  Sliders,
  BellRing,
  Target,
  Flame,
  Award,
  Crosshair,
  Briefcase,
  Trophy,
  Activity,
  Rocket,
  FlaskConical,
  LucideIcon,
} from "lucide-react";

export interface NavItemConfig {
  id: string;
  name: string;
  href: string;
  icon: LucideIcon;
  section: string;
  description: string;
  isProtected?: boolean; // Cannot be hidden (e.g. Company Master itself)
  defaultHidden?: boolean; // Default hidden from primary navigation
  badge?: string;
}

export interface NavSectionConfig {
  title: string;
  items: NavItemConfig[];
}

export const NAVIGATION_CONFIG: NavSectionConfig[] = [
  // =========================================================================
  // 1. MARKET PULSE & REGIME (Macro context & market health)
  // =========================================================================
  {
    title: "MARKET PULSE & REGIME",
    items: [
      {
        id: "home",
        name: "Daily One-Pager",
        href: "/home",
        icon: LayoutDashboard,
        badge: "RADAR",
        section: "MARKET PULSE & REGIME",
        description: "Consolidated daily market pulse, multi-screener radar grid & real-time corporate updates.",
      },
      {
        id: "market-indices",
        name: "Market Indices Radar",
        href: "/market-indices",
        icon: Activity,
        badge: "NEW",
        section: "MARKET PULSE & REGIME",
        description: "12-month performance matrix & monthly green/red heatmap across 40+ listed Indian equity indices (Broad, Sectoral, Thematic).",
      },
      {
        id: "reports",
        name: "Market Reports & Breadth Radar",
        href: "/reports",
        icon: FileBarChart,
        badge: "20/50/200 DMA",
        section: "MARKET PULSE & REGIME",
        description: "Multi-horizon quantitative market breadth radar: 20, 50, and 200 DMA line charts with 50% Green/Red regime zones and sectoral matrix.",
      },
    ],
  },

  // =========================================================================
  // 2. BREAKOUT & SWING ENGINES (Positional multi-day to multi-week momentum)
  // =========================================================================
  {
    title: "BREAKOUT & SWING ENGINES",
    items: [
      {
        id: "apex-confluence",
        name: "Apex Confluence Radar",
        href: "/apex-confluence",
        icon: Award,
        badge: "APEX",
        section: "BREAKOUT & SWING ENGINES",
        description: "Institutional cross-engine confluence scanner: surfaces multi-signal alignment across VCP, Cup & Handle, Chart Patterns, Momentum & Delivery.",
      },
      {
        id: "velocity-burst-elite",
        name: "Velocity Burst Elite",
        href: "/velocity-burst-elite",
        icon: Flame,
        badge: "FLAGSHIP",
        section: "BREAKOUT & SWING ENGINES",
        description: "Institutional 18-stage breakout engine: contraction intelligence, base patterns, smart money, and automated trade management.",
      },
      {
        id: "techno-funda",
        name: "Techno-Funda Radar",
        href: "/techno-funda",
        icon: Target,
        section: "BREAKOUT & SWING ENGINES",
        description: "High-conviction fusion of quarterly growth acceleration with technical momentum.",
      },
      {
        id: "vcp-discovery",
        name: "VCP Volume Breakout",
        href: "/vcp-discovery",
        icon: Sparkles,
        section: "BREAKOUT & SWING ENGINES",
        description: "Automated Mark Minervini Volatility Contraction Pattern scanner.",
      },
      {
        id: "vcp-signals",
        name: "↳ VCP Track Record",
        href: "/vcp-signals",
        icon: Award,
        section: "BREAKOUT & SWING ENGINES",
        description: "Historical hit rate and trade outcome ledger for VCP alerts.",
        defaultHidden: true,
      },
      {
        id: "cup-handle",
        name: "Cup & Handle AI Engine",
        href: "/cup-handle",
        icon: GitBranch,
        badge: "AI",
        section: "BREAKOUT & SWING ENGINES",
        description: "8-stage AI gating: U-shape geometry, handle tightness, volume signature, RS rank, and fundamental overlay.",
      },
      {
        id: "momentum-radar",
        name: "Super Momentum Radar",
        href: "/momentum-radar",
        icon: Zap,
        section: "BREAKOUT & SWING ENGINES",
        description: "Stage-2 breakout leaders trading near 52-week highs with volume expansion.",
      },
      {
        id: "pre-breakout-radar",
        name: "Pre-Breakout Radar",
        href: "/pre-breakout-radar",
        icon: Crosshair,
        section: "BREAKOUT & SWING ENGINES",
        description: "Base contractions, tightness detection, and multi-week volatility squeezes.",
        defaultHidden: true,
      },
      {
        id: "delivery-radar",
        name: "Delivery Breakout",
        href: "/delivery-radar",
        icon: Radar,
        section: "BREAKOUT & SWING ENGINES",
        description: "NSE delivery volume surges signaling institutional cash market absorption.",
      },
      {
        id: "staircase-radar",
        name: "Staircase Momentum Radar",
        href: "/staircase-radar",
        icon: TrendingUp,
        badge: "STEALTH",
        section: "BREAKOUT & SWING ENGINES",
        description: "Institutional low-volatility staircase trend screener: surfaces post-breakout stealth accumulators grinding +1% to +2% daily (Institutional Stealth Accumulation).",
      },
    ],
  },

  // =========================================================================
  // 3. INTRADAY & KINETIC RADAR (0 to 1-day execution, CPR & live VWAP)
  // =========================================================================
  {
    title: "INTRADAY & KINETIC RADAR",
    items: [
      {
        id: "sovereign-cockpit",
        name: "Sovereign Alpha Cockpit",
        href: "/sovereign-cockpit",
        icon: Rocket,
        badge: "APEX",
        section: "INTRADAY & KINETIC RADAR",
        description: "Dual-Chamber kinetic breakout engine, 360° AI forensic auditor, and real-time execution alerts.",
      },
      {
        id: "sovereign-intraday",
        name: "Sovereign Intraday Radar",
        href: "/sovereign-intraday",
        icon: Crosshair,
        badge: "0ms APEX",
        section: "INTRADAY & KINETIC RADAR",
        description: "Zero-latency institutional Intraday Radar: Chamber A/B/C execution windows, automated TOTP 5Paisa feed, +1.0R breakeven lock, and audit ledger.",
      },
      {
        id: "live-intraday",
        name: "Live Intraday Radar",
        href: "/live-intraday",
        icon: Activity,
        section: "INTRADAY & KINETIC RADAR",
        description: "Real-time 15-minute bar VWAP reclaims and high-volume intraday breakouts.",
      },
      {
        id: "intraday-radar",
        name: "Tomorrow 5% Move",
        href: "/intraday-radar",
        icon: Flame,
        section: "INTRADAY & KINETIC RADAR",
        description: "Predictive scanner identifying equities primed for aggressive range expansion.",
      },
      {
        id: "cpr-scanner",
        name: "Narrow CPR Compression",
        href: "/cpr-scanner",
        icon: Layers,
        section: "INTRADAY & KINETIC RADAR",
        description: "Central Pivot Range (CPR) width compression indicating trending session setup.",
      },
      {
        id: "candlestick-radar",
        name: "Candlestick Radar",
        href: "/candlestick-radar",
        icon: Flame,
        badge: "20 PATTERNS",
        section: "INTRADAY & KINETIC RADAR",
        description: "Single, Double & Triple Candlestick Screener (Morning Star, Soldiers, Engulfing, Hammer) with volume confirmation.",
      },
    ],
  },

  // =========================================================================
  // 4. CATALYST & EVENT RADAR (Earnings surprises, concalls, orders & IPOs)
  // =========================================================================
  {
    title: "CATALYST & EVENT RADAR",
    items: [
      {
        id: "pead-drift-screener",
        name: "PEAD Drift Screener",
        href: "/pead-drift-screener",
        icon: Zap,
        badge: "EARNINGS",
        section: "CATALYST & EVENT RADAR",
        description: "AI-driven earnings surprise radar & institutional PEAD drift analyzer.",
      },
      {
        id: "order-wins",
        name: "New Order Win Screener",
        href: "/order-wins",
        icon: Trophy,
        section: "CATALYST & EVENT RADAR",
        description: "Real-time extraction of contract wins, Capex orders, and tenders.",
      },
      {
        id: "investor-intelligence",
        name: "Investor Intelligence & Concalls",
        href: "/investor-intelligence",
        icon: FileText,
        badge: "AI",
        section: "CATALYST & EVENT RADAR",
        description: "Senior Buy-Side Analyst interrogation of Investor PPTs & Concall Transcripts across Operating Leverage, Margins & Q&A Grill.",
      },
      {
        id: "ipo-radar",
        name: "Mainboard IPO Radar",
        href: "/ipo-radar",
        icon: Rocket,
        badge: "HOT",
        section: "CATALYST & EVENT RADAR",
        description: "Institutional Blue-Sky Breakouts, IPO Base Cheats, SEBI 30D/90D Anchor Lock-in Exhaustion & Turnarounds.",
      },
      {
        id: "brokerage-radar",
        name: "Brokerage Radar & Hot Picks",
        href: "/brokerage-radar",
        icon: Target,
        badge: "HOT",
        section: "CATALYST & EVENT RADAR",
        description: "60+ SEBI brokerage recommendations, target revisions, conviction scores, and empirical hit-rate scorecards.",
      },
      {
        id: "announcements",
        name: "Corporate Catalysts",
        href: "/announcements",
        icon: Radio,
        section: "CATALYST & EVENT RADAR",
        description: "Live NSE & BSE corporate announcement feed and regulatory filings.",
      },
    ],
  },

  // =========================================================================
  // 5. FUNDAMENTAL GROWTH & VALUE (Long-term compounders, balance sheet & P&L)
  // =========================================================================
  {
    title: "FUNDAMENTAL GROWTH & VALUE",
    items: [
      {
        id: "growth-screener",
        name: "Growth Screener PRO",
        href: "/growth-screener",
        icon: TrendingUp,
        badge: "INSTITUTIONAL",
        section: "FUNDAMENTAL GROWTH & VALUE",
        description: "Institutional equity scanner with server-side sorting, ROCE, and YoY metrics.",
      },
      {
        id: "screener-growth",
        name: "Screener.in 20-Col Radar",
        href: "/screener-growth",
        icon: TableProperties,
        badge: "20 COL",
        section: "FUNDAMENTAL GROWTH & VALUE",
        description: "Direct Screener.in accounting layout: CMP, P/E, Mar Cap, Ind PE, PAT 12M, B.V., CMP/BV, OPM %, Sales/Profit 3Y Var, Piotroski & Cash Flows.",
      },
      {
        id: "quarterly-results",
        name: "Quarterly Results",
        href: "/quarterly-results",
        icon: FileText,
        section: "FUNDAMENTAL GROWTH & VALUE",
        description: "Historical income statement and balance sheet time-series repository.",
      },
      {
        id: "early-stage",
        name: "Discovery Incubator",
        href: "/early-stage",
        icon: Telescope,
        section: "FUNDAMENTAL GROWTH & VALUE",
        description: "Micro-cap discovery pipeline, provisional listings, and incubator tracker.",
      },
    ],
  },

  // =========================================================================
  // 6. SMART MONEY & MUTUAL FUNDS (Whale footprints, DII flows & scheme analysis)
  // =========================================================================
  {
    title: "SMART MONEY & MUTUAL FUNDS",
    items: [
      {
        id: "institutional-radar",
        name: "Mutual Fund Radar",
        href: "/institutional-radar",
        icon: ShieldCheck,
        section: "SMART MONEY & MUTUAL FUNDS",
        description: "Detailed AMC holding shifts, position increases, and smart money exits.",
      },
      {
        id: "fresh-entries",
        name: "MF Fresh Entries Screener",
        href: "/institutional-radar/fresh-entries",
        icon: Sparkles,
        section: "SMART MONEY & MUTUAL FUNDS",
        description: "Mutual fund fresh buys, portfolio expansions, and block accumulation.",
      },
      {
        id: "amc-matrix",
        name: "AMC Scheme Matrix",
        href: "/institutional-radar/matrix",
        icon: TableProperties,
        section: "SMART MONEY & MUTUAL FUNDS",
        description: "Cross-scheme institutional holding comparisons and sector allocations.",
      },
      {
        id: "mutual-funds-radar",
        name: "MF Alpha Radar",
        href: "/mutual-funds",
        icon: Radar,
        badge: "PRO",
        section: "SMART MONEY & MUTUAL FUNDS",
        description: "Top 100 pure equity mutual fund scanner, pre-2:00 PM cutoff dip buying radar, and dual-tier NAV charts.",
      },
    ],
  },

  // =========================================================================
  // 7. PORTFOLIO & QUANT LAB (Holdings optimization, tactical overlays & backtests)
  // =========================================================================
  {
    title: "PORTFOLIO & QUANT LAB",
    items: [
      {
        id: "portfolio",
        name: "Portfolio Intelligence",
        href: "/portfolio",
        icon: Briefcase,
        section: "PORTFOLIO & QUANT LAB",
        description: "Portfolio risk decomposition, sector exposure, and capital weighting.",
      },
      {
        id: "fx-swing-screener",
        name: "FX Swing Screener",
        href: "/portfolio/fx-swing-screener",
        icon: Sliders,
        badge: "HOT",
        section: "PORTFOLIO & QUANT LAB",
        description: "Institutional 12 FX indicator confluence screener generating tactical Buy / Sell swing signals on portfolio equities.",
      },
      {
        id: "swing-overlay",
        name: "Alpha Swing Overlay",
        href: "/portfolio/swing-overlay",
        icon: Zap,
        section: "PORTFOLIO & QUANT LAB",
        description: "Tactical swing overlay indicators for existing long-term holdings.",
      },
      {
        id: "watchlist",
        name: "Watchlist Builder",
        href: "/watchlist",
        icon: Star,
        section: "PORTFOLIO & QUANT LAB",
        description: "Multi-list high-conviction equity watchlists with custom thesis notes.",
      },
      {
        id: "backtest-lab",
        name: "Backtest Lab",
        href: "/backtest-lab",
        icon: FlaskConical,
        badge: "QUANT LAB",
        section: "PORTFOLIO & QUANT LAB",
        description: "Production-grade intraday backtest engine: exact 9-rule VCB breakout, zero look-ahead bias, Indian cost frictions, and MFE/MAE matrices.",
      },
    ],
  },

  // =========================================================================
  // 8. SYSTEM & MONITORING (Telemetry, crawlers, engine health & admin master)
  // =========================================================================
  {
    title: "SYSTEM & MONITORING",
    items: [
      {
        id: "monitoring",
        name: "Mission Control Overview",
        href: "/monitoring",
        icon: Radar,
        section: "SYSTEM & MONITORING",
        description: "Real-time crawler telemetry, queue depth, and autonomous engine states.",
      },
      {
        id: "screener-monitoring",
        name: "Screener Engine Monitor",
        href: "/screener-monitoring",
        icon: Activity,
        badge: "TELEMETRY",
        section: "SYSTEM & MONITORING",
        description: "Real-time telemetry, sync controls, and crawler throughput for the Screener.in data pipeline.",
      },
      {
        id: "monitoring-control",
        name: "Control & Action Logs",
        href: "/monitoring/control",
        icon: Sliders,
        section: "SYSTEM & MONITORING",
        description: "Manual engine triggers, queue resets, and audit execution logs.",
      },
      {
        id: "activity",
        name: "Activity Timeline",
        href: "/activity",
        icon: History,
        section: "SYSTEM & MONITORING",
        description: "Audit trail of system events, ingestion ticks, and calculation runs.",
      },
      {
        id: "company-master",
        name: "Company Master",
        href: "/company-master",
        icon: Building2,
        section: "SYSTEM & MONITORING",
        description: "Master console for Page Navigation Visibility (Hide/Unhide) & NSE Equities Registry.",
        isProtected: true, // Cannot be hidden to avoid administrative lockout
      },
      {
        id: "settings",
        name: "System Settings",
        href: "/settings",
        icon: Settings,
        section: "SYSTEM & MONITORING",
        description: "Global system thresholds, engine scan intervals, and AI model parameters.",
      },
      {
        id: "knowledge-center",
        name: "Knowledge Center",
        href: "/knowledge-center",
        icon: BookOpen,
        section: "SYSTEM & MONITORING",
        description: "Institutional methodology manuals, formula index, and market playbooks.",
      },
      {
        id: "alerts",
        name: "Alert Center",
        href: "/alerts",
        icon: BellRing,
        section: "SYSTEM & MONITORING",
        description: "Centralized threshold triggers, webhook dispatches, and notification rules.",
      },
    ],
  },
];

// Flat list of all registered pages
export const ALL_PAGES: NavItemConfig[] = NAVIGATION_CONFIG.flatMap(
  (sec) => sec.items
);

// Map by href for O(1) lookup
export const PAGE_MAP: Record<string, NavItemConfig> = Object.fromEntries(
  ALL_PAGES.map((page) => [page.href, page])
);

// Check if a page route is protected
export function isRouteProtected(href: string): boolean {
  return PAGE_MAP[href]?.isProtected === true;
}

// Default hidden routes on initial setup
export const DEFAULT_HIDDEN_ROUTES: string[] = ALL_PAGES.filter(
  (page) => page.defaultHidden === true
).map((page) => page.href);

