import GrowthTable from "@/components/screener/GrowthTable";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        <div>
          <h1 className="text-4xl font-bold text-blue-400">
            Alpha India Growth Radar
          </h1>

          <p className="text-gray-400 mt-2">
            Live NSE Quarterly Growth Screener • Refreshes Every 5 Seconds
          </p>
        </div>

        <GrowthTable />
      </div>
    </main>
  );
}