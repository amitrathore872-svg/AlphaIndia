"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getWebSocketUrl } from "@/lib/apiConfig";

export interface LiveCatalystEvent {
  type: string;
  symbol: string;
  company_name: string;
  exchange: string;
  headline: string;
  catalyst_type: string;
  impact_level: string;
  impact_score: number;
  deal_value_cr?: number | null;
  price?: number;
  target_price?: number;
  upside_pct?: number;
  stop_loss?: number;
  trend_regime?: string;
  recommendation?: string;
  conviction_score?: number;
  ai_insight?: string;
  pdf_url?: string;
  timestamp: string;
}

export function useLiveWireStream(onCatalyst?: (event: LiveCatalystEvent) => void) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [latestCatalyst, setLatestCatalyst] = useState<LiveCatalystEvent | null>(null);
  const [catalysts, setCatalysts] = useState<LiveCatalystEvent[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const backoffRef = useRef(1000);

  useEffect(() => {
    let unmounted = false;

    function connect() {
      if (unmounted) return;

      try {
        const url = getWebSocketUrl("/ws/live-wire");
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          if (unmounted) {
            ws.close();
            return;
          }
          setIsConnected(true);
          backoffRef.current = 1000;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "CATALYST_DISCOVERED") {
              const catalyst = data as LiveCatalystEvent;
              setLatestCatalyst(catalyst);
              setCatalysts((prev) => [catalyst, ...prev.slice(0, 49)]);

              if (onCatalyst) {
                onCatalyst(catalyst);
              }

              // Invalidate related React Query caches
              queryClient.invalidateQueries({ queryKey: ["announcements"] });
              queryClient.invalidateQueries({ queryKey: ["mission-control-status"] });
            }
          } catch {
            // Ignore non-JSON or ping/pong messages
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          wsRef.current = null;
          if (!unmounted) {
            const nextDelay = Math.min(backoffRef.current * 1.5, 10000);
            backoffRef.current = nextDelay;
            reconnectTimeoutRef.current = setTimeout(connect, nextDelay);
          }
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        if (!unmounted) {
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      }
    }

    connect();

    // Periodic heartbeat ping to keep connection alive through NAT
    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send("ping");
      }
    }, 15000);

    return () => {
      unmounted = true;
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [queryClient, onCatalyst]);

  return {
    isConnected,
    latestCatalyst,
    catalysts,
  };
}
