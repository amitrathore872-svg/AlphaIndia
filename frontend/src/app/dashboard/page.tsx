export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-[#050B14] text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">

        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">
            ALPHA INDIA • MISSION CONTROL
          </p>

          <h1 className="mt-3 text-4xl font-bold">
            Historical Import Dashboard
          </h1>

          <p className="mt-2 text-slate-400">
            Monitor the progress of importing 5 years of financial history
            for all NSE & BSE listed companies.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">

          <KPI title="Companies Imported" value="0 / 8588" color="emerald" />

          <KPI title="Filings Discovered" value="3" color="cyan" />

          <KPI title="PDFs Downloaded" value="0" color="amber" />

          <KPI title="AI Scores Generated" value="1" color="violet" />

        </div>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Historical Bootstrap Progress
            </h2>

            <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300">
              Bootstrap Pending
            </span>
          </div>

          <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full w-0 rounded-full bg-emerald-500"></div>
          </div>

          <div className="mt-3 flex justify-between text-sm text-slate-400">
            <span>0 Companies Imported</span>
            <span>8588 Remaining</span>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="mb-5 text-xl font-semibold">
            Import Queue
          </h2>

          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 text-slate-400">
              <tr>
                <th className="pb-3">Company</th>
                <th className="pb-3">Period</th>
                <th className="pb-3">Download</th>
                <th className="pb-3">Parser</th>
              </tr>
            </thead>

            <tbody>
              {[
                ["The Karnataka Bank Limited", "Q1 FY27"],
                ["The Karnataka Bank Limited", "Q4 FY26"],
                ["The Karnataka Bank Limited", "FY26 Annual"],
              ].map(([company, period]) => (
                <tr key={period} className="border-b border-slate-900">
                  <td className="py-4">{company}</td>

                  <td className="py-4 text-slate-300">{period}</td>

                  <td className="py-4">
                    <span className="rounded-full bg-yellow-500/20 px-2 py-1 text-xs text-yellow-300">
                      PENDING
                    </span>
                  </td>

                  <td className="py-4">
                    <span className="rounded-full bg-slate-700 px-2 py-1 text-xs text-slate-300">
                      WAITING
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="mb-5 text-xl font-semibold">
            Import Controls
          </h2>

          <div className="flex flex-wrap gap-4">
            <button className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold hover:bg-emerald-700">
              ▶ Start Historical Import
            </button>

            <button className="rounded-xl border border-slate-700 px-5 py-3 hover:bg-slate-800">
              ⏸ Pause Import
            </button>

            <button className="rounded-xl border border-slate-700 px-5 py-3 hover:bg-slate-800">
              🔄 Resume Import
            </button>
          </div>
        </section>

      </div>
    </main>
  );
}

type KPIProps = {
  title: string;
  value: string;
  color: "emerald" | "cyan" | "amber" | "violet";
};

function KPI({ title, value, color }: KPIProps) {
  const colors = {
    emerald: "text-emerald-400 border-emerald-900/50",
    cyan: "text-cyan-400 border-cyan-900/50",
    amber: "text-yellow-400 border-yellow-900/50",
    violet: "text-violet-400 border-violet-900/50",
  };

  return (
    <div className={`rounded-2xl border bg-slate-900/60 p-5 ${colors[color]}`}>
      <p className="text-sm text-slate-400">{title}</p>

      <h3 className={`mt-3 text-3xl font-bold ${colors[color].split(" ")[0]}`}>
        {value}
      </h3>
    </div>
  );
}