export interface SystemSetting {
  id: number;
  setting_key: string;
  setting_value: string;
  setting_type: "boolean" | "integer" | "time" | "string";
  description?: string;
  updated_at: string;
}

export interface SystemStatus {
  project: string;
  version: string;
  status: string;
  database: string;
  collector: string;
  monitoring_enabled: boolean;
  current_session: "MARKET" | "POST_MARKET" | "NON_MARKET" | "STOPPED";
  market_interval_minutes: number;
  post_market_interval_minutes: number;
  timestamp: string;
}