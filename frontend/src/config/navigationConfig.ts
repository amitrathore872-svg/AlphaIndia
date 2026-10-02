import {
  LayoutDashboard,
  TrendingUp,
  GitBranch,
  FileText,
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
  badge?: string;
}

export interface NavSectionConfig {
  title: string;
  items: NavItemConfig[];
}

export const NAVIGATION_CONFIG: NavSectionConfig[] = [
  {
    title: "RADARS & ENGINES",
    items: [
      {
        id: "velocity-burst-elite",
        name: "Velocity Burst Elite",
        href: "/velocity-burst-elite",
        icon: Flame,
        badge: "FLAGSHIP",
        section: "RADARS & ENGINES",
        description: "Institutional 18-stage breakout engine: contraction intelligence, base patterns, smart money, and automated trade management.",
      },
      {
        id: "fx-swing-screener",
        name: "FX Swing Screener",
        href: "/portfolio/fx-swing-screener",
        icon: Target,
        section: "RADARS & ENGINES",
        description: "12 FX Swing Confluence Screener & empirical Nifty 500 backtest radar.",
      },
      {
        id: "home",
        name: "Executive Terminal",
        href: "/home",
        icon: LayoutDashboard,
        section: "RADARS & ENGINES",
        description: "Macro cockpit, market breath indicators, and executive summaries.",
      },
      {
        id: "athena-omega",
        name: "Athena Omega AI",
        href: "/athena-omega",
        icon: Zap,
        section: "RADARS & ENGINES",
        description: "AI-driven earnings surprise radar & institutional PEAD drift analyzer.",
      },
      {
        id: "growth-screener",
        name: "Growth Screener",
        href: "/growth-screener",
        icon: TrendingUp,
        section: "RADARS & ENGINES",
        description: "Institutional equity scanner with server-side sorting and YoY metrics.",
      },
      {
        id: "quarterly-results",
        name: "Quarterly Results",
        href: "/quarterly-results",
        icon: FileText,
        section: "RADARS & ENGINES",
        description: "Historical income statement and balance sheet time-series repository.",
      },
      {
        id: "fresh-entries",
        name: "MF Fresh Entries Screener",
        href: "/institutional-radar/fresh-entries",
        icon: Sparkles,
        section: "RADARS & ENGINES",
        description: "Mutual fund fresh buys, portfolio expansions, and block accumulation.",
      },
      {
        id: "mutual-funds-radar",
        name: "MF Alpha Radar",
        href: "/mutual-funds",
        icon: Radar,
        badge: "PRO",
        section: "RADARS & ENGINES",
        description: "Top 100 pure equity mutual fund scanner, pre-2:00 PM cutoff dip buying radar, and dual-tier NAV charts.",
      },
      {
        id: "announcements",
        name: "Corporate Catalysts",
        href: "/announcements",
        icon: Radio,
        section: "RADARS & ENGINES",
        description: "Live NSE & BSE corporate announcement feed and regulatory filings.",
      },
      {
        id: "order-wins",
        name: "New Order Win Screener",
        href: "/order-wins",
        icon: Trophy,
        section: "RADARS & ENGINES",
        description: "Real-time extraction of contract wins, Capex orders, and tenders.",
      },
    ],
  },
  {
    title: "FAST OPPORTUNITY SCREENER",
    items: [
      {
        id: "apex-confluence",
        name: "Apex Confluence Radar",
        href: "/apex-confluence",
        icon: Award,
        badge: "APEX",
        section: "FAST OPPORTUNITY SCREENER",
        description: "Institutional cross-engine confluence scanner: surfaces multi-signal alignment across VCP, Cup & Handle, Chart Patterns, Momentum & Delivery.",
      },
      {
        id: "techno-funda",
        name: "Techno-Funda Radar",
        href: "/techno-funda",
        icon: Target,
        section: "FAST OPPORTUNITY SCREENER",
        description: "High-conviction fusion of quarterly growth acceleration with technical momentum.",
      },
      {
        id: "momentum-radar",
        name: "Super Momentum Radar",
        href: "/momentum-radar",
        icon: Zap,
        section: "FAST OPPORTUNITY SCREENER",
        description: "Stage-2 breakout leaders trading near 52-week highs with volume expansion.",
      },
      {
        id: "cup-handle",
        name: "Cup & Handle AI Engine",
        href: "/cup-handle",
        icon: GitBranch,
        badge: "AI",
        section: "FAST OPPORTUNITY SCREENER",
        description: "8-stage AI gating: U-shape geometry, handle tightness, volume signature, RS rank, and fundamental overlay. Only high-conviction breakouts surfaced.",
      },
      {
        id: "chart-patterns",
        name: "Multi-Pattern Radar",
        href: "/chart-patterns",
        icon: Layers,
        badge: "NEW",
        section: "FAST OPPORTUNITY SCREENER",
        description: "Institutional 5-pattern scanner: Flat Base, Double Bottom, Ascending Triangle, Bull Flag & High Tight Flag across 4000+ stocks.",
      },
      {
        id: "candlestick-radar",
        name: "Candlestick Radar",
        href: "/candlestick-radar",
        icon: Flame,
        badge: "20 PATTERNS",
        section: "FAST OPPORTUNITY SCREENER",
        description: "Single, Double & Triple Candlestick Screener (Morning Star, Soldiers, Engulfing, Hammer) with volume confirmation.",
      },
      {
        id: "ipo-radar",
        name: "Mainboard IPO Radar",
        href: "/ipo-radar",
        icon: Rocket,
        badge: "HOT",
        section: "FAST OPPORTUNITY SCREENER",
        description: "Institutional Blue-Sky Breakouts, IPO Base Cheats, SEBI 30D/90D Anchor Lock-in Exhaustion & Turnarounds.",
      },
      {
        id: "pre-breakout-radar",
        name: "Pre-Breakout Radar",
        href: "/pre-breakout-radar",
        icon: Crosshair,
        section: "FAST OPPORTUNITY SCREENER",
        description: "Base contractions, tightness detection, and multi-week volatility squeezes.",
      },
      {
        id: "trend-genesis",
        name: "Trend Genesis (Ignition)",
        href: "/trend-genesis",
        icon: Flame,
        section: "FAST OPPORTUNITY SCREENER",
        description: "Early-stage institutional ignition signals and volume anomaly spikes.",
      },
      {
        id: "delivery-radar",
        name: "Delivery Breakout",
        href: "/delivery-radar",
        icon: Radar,
        section: "FAST OPPORTUNITY SCREENER",
        description: "NSE delivery volume surges signaling institutional cash market absorption.",
      },
      {
        id: "vcp-discovery",
        name: "VCP Volume Breakout",
        href: "/vcp-discovery",
        icon: Sparkles,
        section: "FAST OPPORTUNITY SCREENER",
        description: "Automated Mark Minervini Volatility Contraction Pattern scanner.",
      },
      {
        id: "vcp-signals",
        name: "↳ VCP Track Record",
        href: "/vcp-signals",
        icon: Award,
        section: "FAST OPPORTUNITY SCREENER",
        description: "Historical hit rate and trade outcome ledger for VCP alerts.",
      },
      {
        id: "live-intraday",
        name: "Live Intraday Radar",
        href: "/live-intraday",
        icon: Activity,
        section: "FAST OPPORTUNITY SCREENER",
        description: "Real-time 15-minute bar VWAP reclaims and high-volume intraday breakouts.",
      },
      {
        id: "intraday-radar",
        name: "Tomorrow 5% Move",
        href: "/intraday-radar",
        icon: Flame,
        section: "FAST OPPORTUNITY SCREENER",
        description: "Predictive scanner identifying equities primed for aggressive range expansion.",
      },
      {
        id: "cpr-scanner",
        name: "Narrow CPR Compression",
        href: "/cpr-scanner",
        icon: Layers,
        section: "FAST OPPORTUNITY SCREENER",
        description: "Central Pivot Range (CPR) width compression indicating trending session setup.",
      },
    ],
  },
  {
    title: "INSTITUTIONAL RESEARCH",
    items: [
      {
        id: "institutional-radar",
        name: "Mutual Fund Radar",
        href: "/institutional-radar",
        icon: ShieldCheck,
        section: "INSTITUTIONAL RESEARCH",
        description: "Detailed AMC holding shifts, position increases, and smart money exits.",
      },
      {
        id: "amc-matrix",
        name: "AMC Scheme Matrix",
        href: "/institutional-radar/matrix",
        icon: TableProperties,
        section: "INSTITUTIONAL RESEARCH",
        description: "Cross-scheme institutional holding comparisons and sector allocations.",
      },
    ],
  },
  {
    title: "PIPELINE & TRIAGE",
    items: [
      {
        id: "early-stage",
        name: "Discovery Incubator",
        href: "/early-stage",
        icon: Telescope,
        section: "PIPELINE & TRIAGE",
        description: "Micro-cap discovery pipeline, provisional listings, and incubator tracker.",
      },
    ],
  },
  {
    title: "PORTFOLIO",
    items: [
      {
        id: "portfolio",
        name: "Portfolio Intelligence",
        href: "/portfolio",
        icon: Briefcase,
        section: "PORTFOLIO",
        description: "Portfolio risk decomposition, sector exposure, and capital weighting.",
      },
      {
        id: "fx-swing-screener",
        name: "FX Swing Screener",
        href: "/portfolio/fx-swing-screener",
        icon: Sliders,
        badge: "HOT",
        section: "PORTFOLIO",
        description: "Institutional 12 FX indicator confluence screener generating tactical Buy / Sell swing signals on portfolio equities.",
      },
      {
        id: "swing-overlay",
        name: "Alpha Swing Overlay",
        href: "/portfolio/swing-overlay",
        icon: Zap,
        section: "PORTFOLIO",
        description: "Tactical swing overlay indicators for existing long-term holdings.",
      },
      {
        id: "watchlist",
        name: "Watchlist Builder",
        href: "/watchlist",
        icon: Star,
        section: "PORTFOLIO",
        description: "Multi-list high-conviction equity watchlists with custom thesis notes.",
      },
    ],
  },
  {
    title: "MONITORING",
    items: [
      {
        id: "monitoring",
        name: "Mission Control Overview",
        href: "/monitoring",
        icon: Radar,
        section: "MONITORING",
        description: "Real-time crawler telemetry, queue depth, and autonomous engine states.",
      },
      {
        id: "monitoring-control",
        name: "Control & Action Logs",
        href: "/monitoring/control",
        icon: Sliders,
        section: "MONITORING",
        description: "Manual engine triggers, queue resets, and audit execution logs.",
      },
      {
        id: "activity",
        name: "Activity Timeline",
        href: "/activity",
        icon: History,
        section: "MONITORING",
        description: "Audit trail of system events, ingestion ticks, and calculation runs.",
      },
    ],
  },
  {
    title: "ADMINISTRATION",
    items: [
      {
        id: "company-master",
        name: "Company Master",
        href: "/company-master",
        icon: Building2,
        section: "ADMINISTRATION",
        description: "Master console for Page Navigation Visibility (Hide/Unhide) & NSE Equities Registry.",
        isProtected: true, // Cannot be hidden to avoid administrative lockout
      },
      {
        id: "settings",
        name: "System Settings",
        href: "/settings",
        icon: Settings,
        section: "ADMINISTRATION",
        description: "Global system thresholds, engine scan intervals, and AI model parameters.",
      },
      {
        id: "knowledge-center",
        name: "Knowledge Center",
        href: "/knowledge-center",
        icon: BookOpen,
        section: "ADMINISTRATION",
        description: "Institutional methodology manuals, formula index, and market playbooks.",
      },
      {
        id: "alerts",
        name: "Alert Center",
        href: "/alerts",
        icon: BellRing,
        section: "ADMINISTRATION",
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
