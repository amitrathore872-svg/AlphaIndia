"use client";

import { useEffect, useState } from "react";
import { fetchGrowthCompanies, GrowthCompany } from "@/lib/api";

export default function GrowthTable() {
  const [companies, setCompanies] = useState<GrowthCompany[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const data = await fetchGrowthCompanies();
      setCompanies(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();

    const timer = setInterval(loadData, 5000);

    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return <p className="text-gray-400">Loading Alpha India Growth Radar...</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-700 bg-gray-900">
      <table className="w-full text-sm text-white">
        <thead className="bg-gray-800 text-blue-400 uppercase text-xs">
          <tr>
            <th className="p-3 text-left">Company</th>
            <th className="p-3">Sector</th>
            <th className="p-3">Revenue %</th>
            <th className="p-3">PAT %</th>
            <th className="p-3">ROCE</th>
            <th className="p-3">Growth Score</th>
          </tr>
        </thead>

        <tbody>
          {companies.map((company) => (
            <tr
              key={company.symbol}
              className="border-t border-gray-800 hover:bg-gray-800"
            >
              <td className="p-3 font-medium">{company.company}</td>
              <td className="p-3 text-center">{company.sector}</td>
              <td className="p-3 text-center text-green-400">
                {company.revenueGrowth}%
              </td>
              <td className="p-3 text-center text-green-400">
                {company.patGrowth}%
              </td>
              <td className="p-3 text-center">{company.roce}%</td>
              <td className="p-3 text-center font-bold text-yellow-300">
                {company.growthScore}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}