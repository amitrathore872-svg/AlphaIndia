"""
Alpha India — Telemetry & Prometheus Metrics Core
Institutional telemetry collector for HTTP requests, execution latency histograms,
WebSocket connection counts, and database pool utilization.
"""

from __future__ import annotations

import os
import time
from collections import defaultdict
from typing import Any, Dict, List, Optional
import threading


class TelemetryCollector:
    _instance: Optional[TelemetryCollector] = None
    _lock = threading.Lock()

    def __new__(cls) -> TelemetryCollector:
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(TelemetryCollector, cls).__new__(cls)
                cls._instance._init_collector()
            return cls._instance

    def _init_collector(self) -> None:
        self.start_time = time.time()
        self.request_counts: Dict[str, int] = defaultdict(int)
        self.request_durations: Dict[str, List[float]] = defaultdict(list)
        self.catalysts_discovered = 0
        self.max_duration_samples = 500  # Cap rolling samples per endpoint to bound memory
        self._metric_lock = threading.Lock()

    def record_request(self, method: str, path: str, status_code: int, duration_seconds: float) -> None:
        clean_path = path.split("?")[0]
        parts = clean_path.strip("/").split("/")
        if len(parts) >= 2 and parts[0] in ("techno-funda", "stocks", "companies") and len(parts[1]) <= 15:
            normalized_path = f"/{parts[0]}/:symbol"
        elif len(parts) >= 3 and parts[0] == "api" and parts[1] == "v1" and parts[2] in ("portfolios", "watchlists") and len(parts) > 3 and parts[3].isdigit():
            normalized_path = f"/api/v1/{parts[2]}/:id"
        else:
            normalized_path = clean_path

        key = f"{method}:{normalized_path}:{status_code}"
        with self._metric_lock:
            self.request_counts[key] += 1
            dur_list = self.request_durations[normalized_path]
            dur_list.append(duration_seconds)
            if len(dur_list) > self.max_duration_samples:
                del dur_list[0 : len(dur_list) - self.max_duration_samples]

    def increment_catalyst(self, count: int = 1) -> None:
        with self._metric_lock:
            self.catalysts_discovered += count

    def get_summary(self) -> Dict[str, Any]:
        with self._metric_lock:
            uptime = round(time.time() - self.start_time, 1)
            total_requests = sum(self.request_counts.values())
            
            endpoint_stats = {}
            for path, durations in self.request_durations.items():
                if durations:
                    sorted_dur = sorted(durations)
                    n = len(sorted_dur)
                    p95_idx = int(n * 0.95)
                    endpoint_stats[path] = {
                        "count": n,
                        "avg_ms": round(sum(durations) / n * 1000.0, 2),
                        "p95_ms": round(sorted_dur[p95_idx] * 1000.0, 2),
                        "max_ms": round(sorted_dur[-1] * 1000.0, 2),
                    }

            return {
                "uptime_seconds": uptime,
                "total_requests": total_requests,
                "catalysts_discovered": self.catalysts_discovered,
                "endpoints": endpoint_stats,
            }

    def generate_prometheus_exposition(self) -> str:
        """Renders standard Prometheus text-based metrics exposition format."""
        with self._metric_lock:
            lines = [
                "# HELP alpha_india_uptime_seconds Total runtime of the application server in seconds.",
                "# TYPE alpha_india_uptime_seconds counter",
                f"alpha_india_uptime_seconds {time.time() - self.start_time:.2f}",
                "",
                "# HELP alpha_india_http_requests_total Total number of HTTP requests processed.",
                "# TYPE alpha_india_http_requests_total counter",
            ]

            for key, count in self.request_counts.items():
                method, path, status = key.split(":")
                lines.append(f'alpha_india_http_requests_total{{method="{method}",endpoint="{path}",status="{status}"}} {count}')

            lines.extend([
                "",
                "# HELP alpha_india_http_request_duration_seconds HTTP request execution latency in seconds.",
                "# TYPE alpha_india_http_request_duration_seconds summary",
            ])

            for path, durations in self.request_durations.items():
                if durations:
                    sorted_dur = sorted(durations)
                    n = len(sorted_dur)
                    sum_dur = sum(durations)
                    p50 = sorted_dur[int(n * 0.50)]
                    p90 = sorted_dur[int(n * 0.90)]
                    p95 = sorted_dur[int(n * 0.95)]
                    lines.append(f'alpha_india_http_request_duration_seconds{{endpoint="{path}",quantile="0.5"}} {p50:.4f}')
                    lines.append(f'alpha_india_http_request_duration_seconds{{endpoint="{path}",quantile="0.9"}} {p90:.4f}')
                    lines.append(f'alpha_india_http_request_duration_seconds{{endpoint="{path}",quantile="0.95"}} {p95:.4f}')
                    lines.append(f'alpha_india_http_request_duration_seconds_sum{{endpoint="{path}"}} {sum_dur:.4f}')
                    lines.append(f'alpha_india_http_request_duration_seconds_count{{endpoint="{path}"}} {n}')

            # WebSocket connections
            try:
                from app.core.websocket_manager import ws_manager
                ws_counts = ws_manager.get_active_counts()
                lines.extend([
                    "",
                    "# HELP alpha_india_websocket_active_connections Number of active client WebSocket connections.",
                    "# TYPE alpha_india_websocket_active_connections gauge",
                ])
                for ch, cnt in ws_counts.items():
                    lines.append(f'alpha_india_websocket_active_connections{{channel="{ch}"}} {cnt}')
            except Exception:
                pass

            # Database connection pool metrics
            try:
                from app.db.database import engine
                pool = engine.pool
                lines.extend([
                    "",
                    "# HELP alpha_india_database_pool_size Total configured connection pool capacity.",
                    "# TYPE alpha_india_database_pool_size gauge",
                    f"alpha_india_database_pool_size {pool.size()}",
                    "# HELP alpha_india_database_pool_checked_out Number of currently checked-out database connections.",
                    "# TYPE alpha_india_database_pool_checked_out gauge",
                    f"alpha_india_database_pool_checked_out {pool.checkedout()}",
                    "# HELP alpha_india_database_pool_overflow Current connection pool overflow.",
                    "# TYPE alpha_india_database_pool_overflow gauge",
                    f"alpha_india_database_pool_overflow {pool.overflow()}",
                ])
            except Exception:
                pass

            lines.extend([
                "",
                "# HELP alpha_india_catalysts_discovered_total Total institutional corporate catalysts discovered.",
                "# TYPE alpha_india_catalysts_discovered_total counter",
                f"alpha_india_catalysts_discovered_total {self.catalysts_discovered}",
                "",
            ])

            return "\n".join(lines)


telemetry = TelemetryCollector()
