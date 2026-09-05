"use client";
import { useCallback, useEffect, useState } from "react";
import { fetchGrowthCompanies } from "@/lib/api";
import type { GrowthScreenerParams, GrowthScreenerResponse } from "@/types/growth";
const initialParams = { search: "", sector: "", marketCap: "all" as const, minScore: 80, page: 1, limit: 50, sortBy: "growthScore" as const, sortOrder: "desc" as const };
export function useGrowthScreener() {
  const [params, setParams] = useState(initialParams); const [data, setData] = useState<GrowthScreenerResponse | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [searchInput, setSearchInput] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => setParams((current) => ({ ...current, search: searchInput, page: 1 })), 300); return () => window.clearTimeout(timer); }, [searchInput]);
  const load = useCallback(async () => { try { setLoading(true); setData(await fetchGrowthCompanies(params)); setError(""); } catch (requestError) { console.error(requestError); setError("The live screener is temporarily unavailable."); } finally { setLoading(false); } }, [params]);
  useEffect(() => { const initial = window.setTimeout(() => void load(), 0); const timer = window.setInterval(() => void load(), 5000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, [load]);
  const update = (changes: Partial<typeof initialParams>) => setParams((current) => ({ ...current, ...changes, page: changes.page ?? 1 }));
  return { data, loading, error, params, searchInput, setSearchInput, setSector: (sector: string) => update({ sector }), setMarketCap: (marketCap: "all" | "large" | "mid" | "small") => update({ marketCap }), setMinScore: (minScore: number) => update({ minScore }), setPage: (page: number) => update({ page }), toggleSort: (sortBy: NonNullable<GrowthScreenerParams["sortBy"]>) => update({ sortBy, sortOrder: params.sortBy === sortBy && params.sortOrder === "desc" ? "asc" : "desc" }) };
}
