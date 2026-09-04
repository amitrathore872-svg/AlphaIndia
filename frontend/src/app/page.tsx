export default function Home() {
  const stats = [
    { title: "Companies Today", value: "0" },
    { title: "Results Today", value: "0" },
    { title: "High Growth Alerts", value: "0" },
    { title: "Watchlist", value: "0" },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-8 py-8">

        <div className="mb-10">
          <h1 className="text-4xl font-bold">Alpha India</h1>
          <p className="text-slate-400 mt-2">
            Growth Stock Research Terminal for NSE & BSE
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          {stats.map((card) => (
            <div
              key={card.title}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5"
            >
              <p className="text-sm text-slate-400">{card.title}</p>

              <h2 className="text-3xl font-bold mt-3 text-emerald-400">
                {card.value}
              </h2>
            </div>
          ))}
        </div>

        <div className="mt-10 bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-xl font-semibold mb-3">
            Latest Quarterly Results
          </h3>

          <p className="text-slate-400">
            Live NSE quarterly results will appear here in the next step.
          </p>
        </div>

      </div>
    </main>
  );
}