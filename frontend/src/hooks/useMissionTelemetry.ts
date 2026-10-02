"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getWebSocketUrl } from "@/lib/apiConfig";
import { fetchMissionControlTelemetry, MissionControlTelemetryResponse } from "@/lib/monitoringApi";

export interface TelemetryData extends Partial<MissionControlTelemetryResponse> {
  server_time?: string;
  [key: string]: any;
}

/**
 * useMissionTelemetry Hook
 * Replaces high-frequency HTTP 5-second polling with real-time /ws/telemetry streaming.
 * Includes graceful HTTP fallback (relaxed 20s interval) only when WebSocket is disconnected.
 */
export function useMissionTelemetry() {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const backoffRef = useRef<number>(1000);

  // Fallback HTTP fetcher (called when WS is cold or disconnected)
  const fetchHttpFallback = useCallback(async () => {
    try {
      const data = await fetchMissionControlTelemetry();
      if (data) {
        setTelemetry((prev) => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.debug("[useMissionTelemetry] Fallback HTTP fetch error:", err);
    }
  }, []);

  useEffect(() => {
    let unmounted = false;

    function connect() {
      if (unmounted) return;

      try {
        const url = getWebSocketUrl("/ws/telemetry");
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
            const msg = JSON.parse(event.data);
            if (msg.type === "TELEMETRY_SNAPSHOT" || msg.type === "TELEMETRY_UPDATE") {
              if (msg.data) {
                setTelemetry(msg.data);
              }
            }
          } catch {
            // Ignore non-JSON or ping/pong text frames
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

    // Connect immediately
    connect();

    // Initial fallback load to guarantee instant render
    fetchHttpFallback();

    // Heartbeat ping loop to keep socket open through proxies
    const pingTimer = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send("ping");
      }
    }, 15000);

    return () => {
      unmounted = true;
      clearInterval(pingTimer);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [fetchHttpFallback]);

  // Relaxed background fallback polling only if WebSocket remains disconnected
  useEffect(() => {
    if (isConnected) return; // When WebSocket is streaming, zero HTTP polling!

    const fallbackInterval = setInterval(() => {
      fetchHttpFallback();
    }, 20000); // Relaxed 20s interval instead of aggressive 5s

    return () => clearInterval(fallbackInterval);
  }, [isConnected, fetchHttpFallback]);

  return {
    telemetry,
    isConnected,
    refetch: fetchHttpFallback,
  };
}
