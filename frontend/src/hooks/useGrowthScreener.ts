"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchGrowthScreener, type GrowthCompany } from "@/lib/api";
import type { GrowthScreenerParams, GrowthScreenerResponse, GrowthCompany as LegacyCompany } from "@/types/growth";

const initialParams: GrowthScreenerParams = {
  search: "",
  sector: "",
  marketCap: "all",
  minScore: 80,
  page: 1,
  limit: 50,
  sortBy: "growthScore",
  sortOrder: "desc",
};

export function useGrowthScreener() {
  const [params, setParams] = useState<GrowthScreenerParams>(initialParams);
  const [data, setData] = useState<GrowthScreenerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(
      () => setParams((current) => ({ ...current, search: searchInput, page: 1 })),
      300
    );
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchGrowthScreener(
        params.page ?? 1,
        params.limit ?? 50,
        params.search ?? "",
        params.sortBy === "growthScore" ? "health_score" : (params.sortBy ?? "market_cap"),
        params.sortOrder ?? "desc",
        {
          sector: params.sector,
          market_cap_category: params.marketCap === "all" ? undefined : params.marketCap?.toUpperCase(),
          health_score_range: params.minScore ? `${params.minScore}-100` : undefined,
        }
      );

      const items: LegacyCompany[] = res.results.map((c: GrowthCompany) => ({
        company: c.company,
        symbol: c.symbol,
        sector: c.sector || "Unknown",
        marketCap: c.market_cap ? `${Math.round(c.market_cap)} Cr` : "--",
        quarter: "Latest",
        resultDate: c.result_date || "",
        revenueGrowth: Number(c.sales_growth_yoy ?? c.revenue_growth ?? 0),
        patGrowth: Number(c.profit_growth_yoy ?? c.pat_growth ?? 0),
        roce: Number(c.roce ?? 0),
        growthScore: Number(c.health_score ?? 0),
      }));

      setData({
        items,
        page: res.page,
        limit: res.limit,
        totalItems: res.total,
        totalPages: res.total_pages,
        sectors: [],
      });
      setError("");
    } catch (requestError) {
      console.error(requestError);
      setError("The live screener is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 5000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [load]);

  const update = (changes: Partial<GrowthScreenerParams>) =>
    setParams((current) => ({ ...current, ...changes, page: changes.page ?? 1 }));

  return {
    data,
    loading,
    error,
    params,
    searchInput,
    setSearchInput,
    setSector: (sector: string) => update({ sector }),
    setMarketCap: (marketCap: "all" | "large" | "mid" | "small") => update({ marketCap }),
    setMinScore: (minScore: number) => update({ minScore }),
    setPage: (page: number) => update({ page }),
    toggleSort: (sortBy: NonNullable<GrowthScreenerParams["sortBy"]>) =>
      update({
        sortBy,
        sortOrder: params.sortBy === sortBy && params.sortOrder === "desc" ? "asc" : "desc",
      }),
  };
}
