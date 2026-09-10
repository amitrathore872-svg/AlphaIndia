{"use client";

import { ImportDashboardSummary } from "@/lib/importDashboardApi";

type Props = {
  summary: ImportDashboardSummary | null;
  loading: boolean;
};

export default function ImportKPICards({
  summary,
  loading,
}: Props) {
  const cards = [
    {
      title: "Companies Imported",
      value: summary
        ? `${summary.imported_companies} / ${summary.total_companies}`
        : "--",
      color: "emerald",
      subtitle: summary
        ? `${summary.progress_percent}% Complete`
        : "Waiting...",
    },
    {
      title: "Filings Discovered",
      value: summary?.filings_discovered ?? "--",
      color: "cyan",
      subtitle: "Historical Bootstrap Queue",
    },
    {
      title: "PDFs Downloaded",
      value: summary?.pdf_downloaded ?? "--",
      color: "amber",
      subtitle: `${summary?.pending_downloads ?? 0} Pending`,
    },
    {
      title: "AI Scores Generated",
      value: summary?.ai_scores_generated ?? "--",
      color: "violet",
      subtitle: "Growth Intelligence Ready",
    },
  ];

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <KPICard key={card.title} {...card} loading={loading} />
      ))}
    </div>
  );
}

type CardProps = {
  title: string;
  value: string | number;
  subtitle: string;
  color: "emerald" | "cyan" | "amber" | "violet";
  loading: boolean;
};

function KPICard({
  title,
  value,
  subtitle,
  color,
  loading,
}: CardProps) {
  const theme = {
    emerald: {
      border: "border-emerald-800/50",
      text: "text-emerald-400",
      bg: "from-emerald-500/10",
    },
    cyan: {
      border: "border-cyan-800/50",
      text: "text-cyan-400",
      bg: "from-cyan-500/10",
    },
    amber: {
      border: "border-yellow-800/50",
      text: "text-yellow-400",
      bg: "from-yellow-500/10",
    },
    violet: {
      border: "border-violet-800/50",
      text: "text-violet-400",
      bg: "from-violet-500/10",
    },
  };

  return (
    <div
      className={`rounded-2xl border ${theme[color].border}
      bg-gradient-to-br ${theme[color].bg} to-slate-900/70
      p-5 shadow-lg`}
    >
      <p className="text-sm uppercase tracking-wide text-slate-400">
        {title}
      </p>

      <h2 className={`mt-4 text-3xl font-bold ${theme[color].text}`}>
        {loading ? "Loading..." : value}
      </h2>

      <p className="mt-2 text-xs text-slate-500">
        {loading ? "Fetching latest data..." : subtitle}
      </p>
    </div>
  );
}