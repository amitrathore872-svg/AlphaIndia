# Alpha India API Reference Specification

Base URL: `http://localhost:8000`

All endpoints return JSON responses. Errors follow standard HTTP status codes with `{"detail": "..."}` or `{"success": false, "message": "..."}`.

---

## 1. Growth Screener Endpoints (`/growth-screener`)

### `GET /growth-screener`
Returns paginated, server-side sorted stock universe based on financial performance.

#### Query Parameters:
| Name | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `page` | `int` | `1` | Page number (1-indexed). |
| `limit` | `int` | `25` | Page size. |
| `search` | `str` | `""` | Search query matching symbol or company name. |
| `sector` | `str` | `"ALL"` | Filter by industrial sector. |
| `exchange` | `str` | `"ALL"` | Filter by exchange (`NSE`, `BSE`, or `ALL`). |
| `health_score` | `str` | `"ALL"` | Bucketed health score (`90-100`, `80-89`, `70-79`, `60-69`, `<60`). |
| `sort_by` | `str` | `"revenue_growth"` | Field to sort by (`company`, `symbol`, `sector`, `exchange`, `market_cap`, `revenue_growth`, `pat_growth`, `eps_growth`, `health_score`, `result_date`). |
| `sort_order` | `str` | `"desc"` | Sort direction: `asc` or `desc`. |

#### Sample Response:
```json
{
  "success": true,
  "page": 1,
  "limit": 25,
  "total": 8588,
  "total_pages": 344,
  "sort_by": "revenue_growth",
  "sort_order": "desc",
  "results": [
    {
      "symbol": "TCS",
      "company": "Tata Consultancy Services Limited",
      "sector": "Information Technology",
      "exchange": "NSE",
      "market_cap": "₹14,50,000 Cr",
      "revenue_growth": 14.8,
      "pat_growth": 11.2,
      "eps_growth": 11.0,
      "health_score": 92.5,
      "result_date": "2026-07-12"
    }
  ]
}
```

### `GET /growth-screener/filters`
Returns all unique sectors, active exchanges, and health score buckets.

---

## 2. Mission Control Endpoints (`/mission-control`)

### `GET /mission-control/heartbeat`
High-frequency ping endpoint polled every 5 seconds by the monitoring dashboard.
```json
{
  "status": "RUNNING",
  "server_time": "2026-09-13T20:55:00",
  "version": "2.3.0",
  "environment": "development"
}
```

### `GET /mission-control/queue`
Returns the operational discovery queue with search, status filtering, and pagination.
- **Query Params**: `page` (int), `limit` (int), `search` (str), `status` (`ALL`, `PENDING`, `RUNNING`, `COMPLETED`).
- **Response**: Summary counts (`pending`, `completed`, `running`, `total`) and array of queue items.

### `GET /mission-control/dashboard`
Returns snapshot of telemetry and subsystem statuses.

### `GET /mission-control/engines`
Returns health status cards for all subsystems:
- Discovery Engine
- Warehouse Import Engine
- Financial Audit Engine
- Growth Calculator Engine
- AI Scoring Engine

### `GET /mission-control/events`
Returns real-time filing and financial processing events from the `FilingRegistry`.
- **Query Params**: `limit` (int, default: 50), `event_type` (`ALL`, `DISCOVERY`, `DOWNLOAD`, `IMPORT`, `AUDIT`, `AI`), `symbol` (str).
- **Response**: Array of live filing events with company name, exchange, filing type, period, status, PDF URL, and formatted timestamps.

---

## 3. Financial Warehouse Endpoints (`/financials`)

- `GET /financials/status`: Aggregate count of companies, quarters stored, and latest import timestamp.
- `GET /financials/queue`: Current queue statistics (pending, completed, failed, unavailable, percentage).
- `POST /financials/queue/bootstrap`: Populate queue from master company registry.
- `POST /financials/queue/clear`: Clear current import queue.
- `POST /financials/queue/retry-failed`: Reset failed queue items back to PENDING.
- `POST /financials/import/{symbol}`: Trigger immediate Yahoo Finance import for a company.
- `GET /financials/{symbol}`: Get all historical quarters for a given symbol.
- `POST /financials/audit`: Trigger gap & integrity audit across warehouse.

---

## 4. Historical Discovery Endpoints (`/discovery`)

- `GET /discovery/status`: Current scan status and metrics for the day.
- `POST /discovery/start`: Start autonomous discovery loop.
- `POST /discovery/pause`: Pause discovery engine.
- `POST /discovery/resume`: Resume paused discovery engine.
- `GET /discovery/filings`: Query discovered exchange filings with period and download status.
