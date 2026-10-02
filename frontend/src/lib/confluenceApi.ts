import { fetchJson } from "./apiConfig";

export interface EngineSignalBreakdown {
  name: string;
  score: number;
  setup: string;
  pivot: number;
  stop_loss: number;
  target: number;
  conviction: string;
  verdict: string;
}

export interface ConfluenceCandidate {
  symbol: string;
  company_name: string;
  sector: string;
  cmp: number;
  concurrence_count: number;
  concurring_engines: string[];
  confluence_score: number;
  confluence_tier: string;
  consensus_pivot: number;
  consensus_stop_loss: number;
  consensus_target: number;
  risk_reward: number;
  confluence_rationale: string;
  engine_breakdown: Record<string, EngineSignalBreakdown>;
}

export interface ConfluenceResponse {
  status: string;
  metadata: {
    total_equities_evaluated: number;
    apex_triple_count: number;
    high_dual_count: number;
    solitary_alpha_count: number;
    computation_latency_ms: number;
    timestamp: number;
    filtered_total: number;
    apex_count: number;
    dual_count: number;
    solitary_count: number;
  };
  apex_candidates: ConfluenceCandidate[];
  dual_candidates: ConfluenceCandidate[];
  solitary_alpha: ConfluenceCandidate[];
  items: ConfluenceCandidate[];
}

export async function fetchConfluenceRadar(params?: {
  tier?: string;
  min_score?: number;
  search?: string;
  sector?: string;
  force_refresh?: boolean;
}): Promise<ConfluenceResponse> {
  const query = new URLSearchParams();
  if (params?.tier) query.set("tier", params.tier);
  if (params?.min_score && params.min_score > 0) query.set("min_score", String(params.min_score));
  if (params?.search) query.set("search", params.search);
  if (params?.sector && params.sector !== "All") query.set("sector", params.sector);
  if (params?.force_refresh) query.set("force_refresh", "true");

  const qs = query.toString();
  const url = `/api/v1/confluence${qs ? `?${qs}` : ""}`;
  return fetchJson<ConfluenceResponse>(url, { timeoutMs: 15000 });
}
