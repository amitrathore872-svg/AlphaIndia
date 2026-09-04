import DashboardLayout from "@/components/layout/DashboardLayout";
import StatCard from "@/components/cards/StatCard";
import ResultsTable from "@/components/screener/ResultsTable";

export default function Home() {
  const stats = [
    { title: "Results Today", value: "127" },
    { title: "High Growth Stocks", value: "23" },
    { title: "Watchlist", value: "14" },
    { title: "AI Growth Alerts", value: "08" },
  ];

  return (
    <DashboardLayout>
      {/* KPI Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {stats.map((item) => (
          <StatCard
            key={item.title}
            title={item.title}
            value={item.value}
          />
        ))}
      </section>

      {/* Quarterly Results Table */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h3 className="text-xl font-semibold text-white">
              Latest Quarterly Results
            </h3>
            <p className="text-slate-400 text-sm mt-1">
              Live quarterly results from Alpha India API.
            </p>
          </div>

          <span className="text-emerald-400 text-sm font-medium">
            ● Live (Refresh every 5 sec)
          </span>
        </div>

        <ResultsTable />
      </section>
    </DashboardLayout>
  );
}