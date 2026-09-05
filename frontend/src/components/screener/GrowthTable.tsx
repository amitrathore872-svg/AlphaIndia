"use client";

export interface Company {
  id: number;
  symbol: string;
  company: string;
  sector: string;
  market_cap: string;
  revenue_growth: number;
  pat_growth: number;
  roce: number;
  ai_score: number;
}

interface Props {
  companies: Company[];
}

export default function GrowthTable({ companies }: Props) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-slate-200">
          <thead className="bg-slate-950 text-slate-400 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-left">Company</th>
              <th className="px-4 py-3 text-left">Symbol</th>
              <th className="px-4 py-3 text-left">Sector</th>
              <th className="px-4 py-3 text-right">Revenue %</th>
              <th className="px-4 py-3 text-right">PAT %</th>
              <th className="px-4 py-3 text-right">ROCE</th>
              <th className="px-4 py-3 text-right">AI Score</th>
            </tr>
          </thead>

          <tbody>
            {companies.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  No companies found.
                </td>
              </tr>
            ) : (
              companies.map((company) => (
                <tr
                  key={company.id}
                  className="border-t border-slate-800 hover:bg-slate-800/40"
                >
                  <td className="px-4 py-3 font-medium text-white">
                    {company.company}
                  </td>

                  <td className="px-4 py-3 text-cyan-400">
                    {company.symbol}
                  </td>

                  <td className="px-4 py-3">
                    {company.sector || "Unknown"}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {Number(company.revenue_growth).toFixed(1)}%
                  </td>

                  <td className="px-4 py-3 text-right">
                    {Number(company.pat_growth).toFixed(1)}%
                  </td>

                  <td className="px-4 py-3 text-right">
                    {Number(company.roce).toFixed(1)}%
                  </td>

                  <td className="px-4 py-3 text-right">
                    <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-300">
                      {Number(company.ai_score).toFixed(1)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}