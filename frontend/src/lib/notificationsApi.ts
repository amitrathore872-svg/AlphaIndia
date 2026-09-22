// =======================================================
// Alpha India Notification & Alert Center API Client
// Sprint 34 — Institutional Alerts & Multi-Channel Dispatch
// =======================================================

import { API_BASE, fetchJson } from "./apiConfig";

export interface SystemNotificationItem {
  id: number;
  title: string;
  message: string;
  category: "ATHENA_PEAD" | "GROWTH_BREAKOUT" | "VCP_BREAKOUT" | "CATALYST_ORDER" | "SMART_MONEY" | "SYSTEM_ALERT" | string;
  severity: "critical" | "warning" | "info" | "success";
  action_url?: string | null;
  metadata?: Record<string, unknown>;
  is_read: boolean;
  is_archived: boolean;
  created_at: string;
}

export interface NotificationStats {
  unread_count: number;
  total_count: number;
  critical_count: number;
  has_unread: boolean;
}

export interface ChannelConfig {
  id?: number;
  channel: "TELEGRAM" | "WHATSAPP";
  is_enabled: boolean;
  bot_token?: string | null;
  chat_id?: string | null;
  api_key?: string | null;
  phone_number_id?: string | null;
  target_recipient?: string | null;
  auto_rules?: Record<string, unknown>;
  updated_at?: string | null;
}

export interface AlertDispatchLogItem {
  id: number;
  channel: string;
  recipient?: string | null;
  symbol?: string | null;
  payload_preview: string;
  status: "SUCCESS" | "FAILED" | "SENT" | "SIMULATED";
  error_message?: string | null;
  dispatched_at: string;
}

export interface BriefGenerationResult {
  symbol: string;
  memo_text: string;
  whatsapp_url: string;
}

export const notificationsApi = {
  // ---------------- In-App Notifications ----------------
  async getNotifications(params?: {
    category?: string;
    severity?: string;
    unread_only?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    total: number;
    page: number;
    limit: number;
    notifications: SystemNotificationItem[];
  }> {
    const query = new URLSearchParams();
    if (params?.category && params.category !== "ALL") query.append("category", params.category);
    if (params?.severity) query.append("severity", params.severity);
    if (params?.unread_only) query.append("unread_only", "true");
    if (params?.page) query.append("page", String(params.page));
    if (params?.limit) query.append("limit", String(params.limit));

    const qs = query.toString() ? `?${query.toString()}` : "";
    return fetchJson(`${API_BASE}/notifications${qs}`);
  },

  async getStats(): Promise<NotificationStats> {
    return fetchJson(`${API_BASE}/notifications/stats`);
  },

  async markAsRead(id: number): Promise<{ status: string; id: number }> {
    return fetchJson(`${API_BASE}/notifications/${id}/read`, {
      method: "PATCH",
    });
  },

  async markAllAsRead(): Promise<{ status: string; message: string }> {
    return fetchJson(`${API_BASE}/notifications/read-all`, {
      method: "POST",
    });
  },

  async archiveNotification(id: number): Promise<{ status: string; id: number }> {
    return fetchJson(`${API_BASE}/notifications/${id}`, {
      method: "DELETE",
    });
  },

  async seedTestNotifications(): Promise<{
    status: string;
    count: number;
    notifications: SystemNotificationItem[];
  }> {
    return fetchJson(`${API_BASE}/notifications/seed-test`, {
      method: "POST",
    });
  },

  // ---------------- External Channels (Telegram & WhatsApp) ----------------
  async getChannelConfigs(): Promise<Record<string, ChannelConfig>> {
    return fetchJson(`${API_BASE}/alerts/channels`);
  },

  async saveTelegramConfig(data: {
    bot_token: string;
    chat_id: string;
    is_enabled: boolean;
    auto_rules?: Record<string, unknown>;
  }): Promise<{ status: string; config: ChannelConfig }> {
    return fetchJson(`${API_BASE}/alerts/channels/telegram`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async saveWhatsAppConfig(data: {
    api_key?: string;
    phone_number_id?: string;
    target_recipient?: string;
    is_enabled: boolean;
    auto_rules?: Record<string, unknown>;
  }): Promise<{ status: string; config: ChannelConfig }> {
    return fetchJson(`${API_BASE}/alerts/channels/whatsapp`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async testTelegram(params?: {
    bot_token?: string;
    chat_id?: string;
  }): Promise<{
    status: string;
    bot_info?: {
      valid: boolean;
      bot_name?: string;
      bot_username?: string;
      bot_id?: number;
      error?: string;
    };
    dispatch_result?: {
      success: boolean;
      message_id?: number;
      error?: string;
    };
    error?: string;
  }> {
    const query = new URLSearchParams();
    if (params?.bot_token) query.append("bot_token", params.bot_token);
    if (params?.chat_id) query.append("chat_id", params.chat_id);
    const qs = query.toString() ? `?${query.toString()}` : "";

    return fetchJson(`${API_BASE}/alerts/test/telegram${qs}`, {
      method: "POST",
    });
  },

  async detectTelegramChats(bot_token?: string): Promise<{
    ok: boolean;
    count: number;
    chats: Array<{
      id: string;
      type: string;
      title: string;
      username?: string;
    }>;
    error?: string;
    instructions?: string;
  }> {
    const query = new URLSearchParams();
    if (bot_token) query.append("bot_token", bot_token);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return fetchJson(`${API_BASE}/alerts/test/telegram/detect-chats${qs}`);
  },

  async broadcast(data: {
    channels: ("TELEGRAM" | "WHATSAPP")[];
    symbol?: string;
    title: string;
    message: string;
    recipient_override?: string;
  }): Promise<{
    status: string;
    symbol?: string;
    results: Record<string, Record<string, unknown>>;
  }> {
    return fetchJson(`${API_BASE}/alerts/dispatch/broadcast`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getDispatchLogs(params?: {
    channel?: string;
    limit?: number;
  }): Promise<{
    count: number;
    logs: AlertDispatchLogItem[];
  }> {
    const query = new URLSearchParams();
    if (params?.channel) query.append("channel", params.channel);
    if (params?.limit) query.append("limit", String(params.limit));
    const qs = query.toString() ? `?${query.toString()}` : "";

    return fetchJson(`${API_BASE}/alerts/logs${qs}`);
  },

  async generateBrief(data: {
    alert_type: "PEAD" | "CATALYST" | "GROWTH" | "VCP" | "VCP_BREAKOUT" | "CUSTOM";
    symbol: string;
    company_name?: string;
    data: Record<string, unknown>;
    target_phone?: string;
  }): Promise<BriefGenerationResult> {
    return fetchJson(`${API_BASE}/alerts/generate-brief`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async triggerVCPScanAlerts(forceBroadcast: boolean = true): Promise<{
    status: string;
    count: number;
    notifications: SystemNotificationItem[];
  }> {
    return fetchJson(`${API_BASE}/alerts/trigger-vcp-scan-alerts?force_broadcast=${forceBroadcast}`, {
      method: "POST",
    });
  },

  async triggerStockVCPAlert(symbol: string, autoBroadcast: boolean = true): Promise<{
    status: string;
    symbol: string;
    notification?: SystemNotificationItem | null;
    memo_text: string;
    whatsapp_url: string;
  }> {
    return fetchJson(`${API_BASE}/api/vcp/alert/${encodeURIComponent(symbol)}?auto_broadcast=${autoBroadcast}`, {
      method: "POST",
    });
  },

  // ---------------- Opportunity Radar Alerts Engine ----------------
  async scanOpportunityAlerts(forceScan: boolean = false): Promise<OpportunityScanResult> {
    return fetchJson(`${API_BASE}/alerts/scan-opportunities?force_scan=${forceScan}`, {
      method: "POST",
    });
  },

  async getOpportunityThresholds(): Promise<OpportunityThresholds> {
    return fetchJson(`${API_BASE}/alerts/rules/opportunity-thresholds`);
  },

  async updateOpportunityThresholds(data: Partial<OpportunityThresholds>): Promise<OpportunityThresholds> {
    return fetchJson(`${API_BASE}/alerts/rules/opportunity-thresholds`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async getRecentOpportunities(limit: number = 30): Promise<SystemNotificationItem[]> {
    return fetchJson(`${API_BASE}/alerts/recent-opportunities?limit=${limit}`);
  },
};

export interface OpportunityThresholds {
  vcp_signals_enabled: boolean;
  vcp_min_score: number;
  prebreakout_a_plus_enabled: boolean;
  prebreakout_min_conviction: number;
  momentum_match_9_enabled: boolean;
  momentum_min_matches: number;
  momentum_conviction_79_enabled: boolean;
  momentum_min_conviction: number;
  auto_broadcast_telegram: boolean;
  auto_broadcast_whatsapp: boolean;
}

export interface OpportunityScanResult {
  status: string;
  timestamp: string;
  new_alerts_count: number;
  skipped_duplicates_count: number;
  dispatched_alerts: Array<{ engine: string; symbol: string; title: string; notif_id: number }>;
  skipped_duplicates: Array<{ engine: string; symbol: string; reason: string }>;
}

