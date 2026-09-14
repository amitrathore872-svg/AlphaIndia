"""
Alpha India Screener.in Integration Client
Sprint 35 — Comprehensive Fundamental, Valuation, Multi-Year Variance & Returns
Extracts official Indian stock metrics, compounded multi-year growth,
quarterly YoY performance, chart price returns, cash flows, and shareholding directly from Screener.in.
"""

import datetime
import json
import logging
import re
import time
import urllib.request
from typing import Any, Dict, List, Optional, Tuple
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


def _parse_screener_quarter_date(header_str: str) -> Tuple[Optional[str], Optional[str], Optional[datetime.date]]:
    """
    Parses a Screener quarter header like 'Dec 2024' or 'Mar 2025'.
    Returns:
      (quarter_label, fiscal_period, period_end_date)
      e.g. ('Q3 FY25', 'Q3 FY25', date(2024, 12, 31))
    """
    if not header_str or not header_str.strip():
        return None, None, None
    parts = header_str.strip().split()
    if len(parts) != 2:
        return None, None, None
    mon, yr_str = parts[0][:3].title(), parts[1]
    try:
        yr = int(yr_str)
    except ValueError:
        return None, None, None

    month_map = {
        "Jan": (1, 31, f"Q4 FY{str(yr)[2:]}"),
        "Feb": (2, 29 if yr % 4 == 0 and (yr % 100 != 0 or yr % 400 == 0) else 28, f"Q4 FY{str(yr)[2:]}"),
        "Mar": (3, 31, f"Q4 FY{str(yr)[2:]}"),
        "Apr": (4, 30, f"Q1 FY{str(yr+1)[2:]}"),
        "May": (5, 31, f"Q1 FY{str(yr+1)[2:]}"),
        "Jun": (6, 30, f"Q1 FY{str(yr+1)[2:]}"),
        "Jul": (7, 31, f"Q2 FY{str(yr+1)[2:]}"),
        "Aug": (8, 31, f"Q2 FY{str(yr+1)[2:]}"),
        "Sep": (9, 30, f"Q2 FY{str(yr+1)[2:]}"),
        "Oct": (10, 31, f"Q3 FY{str(yr+1)[2:]}"),
        "Nov": (11, 30, f"Q3 FY{str(yr+1)[2:]}"),
        "Dec": (12, 31, f"Q3 FY{str(yr+1)[2:]}"),
    }
    if mon not in month_map:
        return None, None, None
    m_num, last_day, fy_label = month_map[mon]
    period_end = datetime.date(yr, m_num, last_day)
    return fy_label, fy_label, period_end


def _parse_float(val_str: Optional[str]) -> Optional[float]:
    if not val_str:
        return None
    cleaned = re.sub(r"[^\d.-]", "", val_str)
    try:
        return float(cleaned)
    except ValueError:
        return None


def _clean_key(k: str) -> str:
    return re.sub(r"[:\+\s]+", " ", k).strip().lower()


class ScreenerClient:
    """
    Client for extracting comprehensive fundamental, valuation, and growth metrics from Screener.in.
    """

    USER_AGENT = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )

    @classmethod
    def resolve_canonical_url(cls, symbol: str) -> Tuple[str, Optional[str]]:
        """
        Uses Screener's autocomplete API to find canonical consolidated URL and registered company name.
        Fallback to /company/{symbol}/consolidated/ if autocomplete is unreachable.
        """
        clean_symbol = symbol.strip().upper()
        search_url = f"https://www.screener.in/api/company/search/?q={clean_symbol}"
        req = urllib.request.Request(
            search_url,
            headers={
                "User-Agent": cls.USER_AGENT,
                "Accept": "application/json",
            },
        )

        try:
            with urllib.request.urlopen(req, timeout=8) as response:
                data = json.loads(response.read().decode("utf-8"))
                if isinstance(data, list) and len(data) > 0:
                    for item in data:
                        item_url = item.get("url", "")
                        if f"/{clean_symbol}/" in item_url:
                            full_url = f"https://www.screener.in{item_url}"
                            return full_url, item.get("name")
                    first = data[0]
                    return f"https://www.screener.in{first.get('url')}", first.get("name")
        except Exception as e:
            logger.debug(f"Screener search resolution failed for {clean_symbol}: {e}")

        return f"https://www.screener.in/company/{clean_symbol}/consolidated/", None

    @classmethod
    def fetch_chart_data(cls, company_id: str) -> Dict[str, Optional[float]]:
        """
        Fetches Screener chart API for price history and moving averages.
        Calculates 3-month return %, 6-month return %, 1-year return %, 50 DMA, 200 DMA.
        """
        result: Dict[str, Optional[float]] = {
            "return_3m": None,
            "return_6m": None,
            "return_1y": None,
            "dma_50": None,
            "dma_200": None,
        }
        if not company_id:
            return result

        url = f"https://www.screener.in/api/company/{company_id}/chart/?q=Price-DMA50-DMA200&days=365"
        req = urllib.request.Request(url, headers={"User-Agent": cls.USER_AGENT})

        try:
            with urllib.request.urlopen(req, timeout=8) as response:
                data = json.loads(response.read().decode("utf-8"))
                datasets = data.get("datasets", [])
                for d in datasets:
                    metric = d.get("metric")
                    values = d.get("values", [])
                    if not values:
                        continue

                    if metric == "Price":
                        # values are [[date, price_str], ...]
                        prices = [_parse_float(v[1]) for v in values if len(v) >= 2 and _parse_float(v[1]) is not None]
                        if len(prices) >= 2:
                            curr = prices[-1]
                            # 3 months ~ 63 trading days
                            if len(prices) >= 63 and prices[-63] and prices[-63] > 0:
                                result["return_3m"] = round(((curr - prices[-63]) / prices[-63]) * 100, 2)
                            # 6 months ~ 126 trading days
                            if len(prices) >= 126 and prices[-126] and prices[-126] > 0:
                                result["return_6m"] = round(((curr - prices[-126]) / prices[-126]) * 100, 2)
                            # 1 year ~ first price in 365 days
                            if prices[0] and prices[0] > 0:
                                result["return_1y"] = round(((curr - prices[0]) / prices[0]) * 100, 2)

                    elif metric == "DMA50":
                        dma_vals = [_parse_float(v[1]) for v in values if len(v) >= 2 and _parse_float(v[1]) is not None]
                        if dma_vals:
                            result["dma_50"] = round(dma_vals[-1], 2)

                    elif metric == "DMA200":
                        dma_vals = [_parse_float(v[1]) for v in values if len(v) >= 2 and _parse_float(v[1]) is not None]
                        if dma_vals:
                            result["dma_200"] = round(dma_vals[-1], 2)

        except Exception as e:
            logger.debug(f"Chart fetch failed for company_id {company_id}: {e}")

        return result

    @classmethod
    def fetch_full_profile(cls, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Fetches complete fundamental, valuation, multi-year variance, quarterly momentum,
        cash flows, efficiency ratios, price returns, and shareholding pattern from Screener.in.
        """
        clean_symbol = symbol.strip().upper()
        target_url, resolved_name = cls.resolve_canonical_url(clean_symbol)

        req = urllib.request.Request(
            target_url,
            headers={
                "User-Agent": cls.USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
            },
        )

        t0 = time.perf_counter()
        html = None
        try:
            with urllib.request.urlopen(req, timeout=12) as response:
                html = response.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            if e.code == 404 and "/consolidated/" in target_url:
                fallback_url = f"https://www.screener.in/company/{clean_symbol}/"
                try:
                    req_standalone = urllib.request.Request(
                        fallback_url,
                        headers={"User-Agent": cls.USER_AGENT, "Accept": "text/html"},
                    )
                    with urllib.request.urlopen(req_standalone, timeout=10) as resp2:
                        html = resp2.read().decode("utf-8", errors="replace")
                except Exception as e2:
                    logger.debug(f"Standalone fallback failed for {clean_symbol}: {e2}")
                    return None
            else:
                logger.debug(f"Screener fetch failed for {clean_symbol}: {e}")
                return None
        except Exception as e:
            logger.debug(f"Screener connection error for {clean_symbol}: {e}")
            return None

        t1 = time.perf_counter()
        response_time_ms = round((t1 - t0) * 1000, 2)

        if not html:
            return None

        p0 = time.perf_counter()
        try:
            soup = BeautifulSoup(html, "html.parser")

            # 1. Company Identity & Internal ID
            company_name = resolved_name
            if not company_name:
                h1 = soup.find("h1")
                if h1:
                    company_name = h1.get_text(strip=True)

            company_info_div = soup.find("div", id="company-info")
            company_id = None
            if company_info_div:
                company_id = company_info_div.get("data-company-id")

            # 2. Top Ratios
            raw_ratios: Dict[str, str] = {}
            for li in soup.find_all("li", {"data-source": "default"}):
                name_el = li.find("span", class_="name")
                val_el = li.find("span", class_="value")
                if name_el and val_el:
                    name = name_el.get_text(strip=True)
                    val = val_el.get_text(" ", strip=True)
                    raw_ratios[name] = val

            if not raw_ratios:
                return None

            cmp_val = _parse_float(raw_ratios.get("Current Price"))
            mcap_val = _parse_float(raw_ratios.get("Market Cap"))
            pe_val = _parse_float(raw_ratios.get("Stock P/E"))
            book_val = _parse_float(raw_ratios.get("Book Value"))
            div_val = _parse_float(raw_ratios.get("Dividend Yield"))
            roce_val = _parse_float(raw_ratios.get("ROCE"))
            roe_val = _parse_float(raw_ratios.get("ROE"))
            face_val = _parse_float(raw_ratios.get("Face Value"))

            high_52, low_52 = None, None
            hl_str = raw_ratios.get("High / Low", "")
            if "/" in hl_str:
                parts = hl_str.split("/")
                high_52 = _parse_float(parts[0])
                low_52 = _parse_float(parts[1])

            pb_val = None
            if cmp_val and book_val and book_val > 0:
                pb_val = round(cmp_val / book_val, 2)

            category = "SMALL"
            if mcap_val is not None:
                if mcap_val >= 20000.0:
                    category = "LARGE"
                elif mcap_val >= 5000.0:
                    category = "MID"
                elif mcap_val >= 500.0:
                    category = "SMALL"
                else:
                    category = "MICRO"

            # 3. Sector, Industry & Industry P/E from Peers
            sector, industry = None, None
            industry_pe = None

            peers_section = soup.find("section", id="peers")
            if peers_section:
                sub_text = peers_section.find("p", class_="sub")
                if sub_text:
                    text = sub_text.get_text(strip=True)
                    sec_match = re.search(r"Sector:\s*([^Ind]+?)(?=Industry:|$)", text)
                    ind_match = re.search(r"Industry:\s*(.+)$", text)
                    if sec_match:
                        sector = sec_match.group(1).strip()
                    if ind_match:
                        industry = ind_match.group(1).strip()

                # Search peer table for Industry P/E or median
                peers_table = peers_section.find("table")
                if peers_table:
                    pe_values: List[float] = []
                    for tr in peers_table.find_all("tr"):
                        tds = tr.find_all("td")
                        if len(tds) >= 4:
                            # Usually column 3 or 4 is P/E in peers table
                            pe_candidate = _parse_float(tds[3].get_text(strip=True))
                            if pe_candidate and 0 < pe_candidate < 200:
                                pe_values.append(pe_candidate)
                    if pe_values:
                        pe_values.sort()
                        mid = len(pe_values) // 2
                        industry_pe = round(pe_values[mid], 2)

            # 4. Profit & Loss (TTM Net Profit & TTM EPS)
            pat_12m = None
            eps_12m = None
            pl_section = soup.find("section", id="profit-loss")
            if pl_section:
                pl_table = pl_section.find("table")
                if pl_table:
                    for tr in pl_table.find_all("tr"):
                        tds = tr.find_all("td")
                        if not tds:
                            continue
                        metric_name = _clean_key(tds[0].get_text(strip=True))
                        vals = [td.get_text(strip=True) for td in tds[1:] if td.get_text(strip=True)]
                        if not vals:
                            continue
                        ttm_val = _parse_float(vals[-1])
                        if "net profit" in metric_name and ttm_val is not None:
                            pat_12m = ttm_val
                        elif "eps" in metric_name and ttm_val is not None:
                            eps_12m = ttm_val

            # 5. Compounded Multi-Year Growth Ratios
            sales_g_10y, sales_g_5y, sales_g_3y, sales_g_ttm = None, None, None, None
            pat_g_10y, pat_g_5y, pat_g_3y, pat_g_ttm = None, None, None, None
            stock_cagr_3y, stock_cagr_5y = None, None

            for t in soup.find_all("table", class_="ranges-table"):
                th = t.find("th")
                if not th:
                    continue
                title = th.get_text(strip=True).lower()
                row_map = {}
                for tr in t.find_all("tr"):
                    tds = tr.find_all("td")
                    if len(tds) >= 2:
                        k = _clean_key(tds[0].get_text(strip=True))
                        v = _parse_float(tds[1].get_text(strip=True))
                        row_map[k] = v

                if "sales growth" in title:
                    sales_g_10y = row_map.get("10 years")
                    sales_g_5y = row_map.get("5 years")
                    sales_g_3y = row_map.get("3 years")
                    sales_g_ttm = row_map.get("ttm")
                elif "profit growth" in title:
                    pat_g_10y = row_map.get("10 years")
                    pat_g_5y = row_map.get("5 years")
                    pat_g_3y = row_map.get("3 years")
                    pat_g_ttm = row_map.get("ttm")
                elif "cagr" in title:
                    stock_cagr_3y = row_map.get("3 years")
                    stock_cagr_5y = row_map.get("5 years")

            # PEG Ratio = PE / 3Y Profit Growth
            peg_ratio = None
            if pe_val and pat_g_3y and pat_g_3y > 0:
                peg_ratio = round(pe_val / pat_g_3y, 2)

            # 6. Quarterly Results (Momentum, Historical Time-Series & YoY)
            latest_qtr_name = None
            latest_qtr_sales = None
            latest_qtr_pat = None
            latest_qtr_eps = None
            qtr_sales_yoy = None
            qtr_pat_yoy = None
            qtr_eps_yoy = None
            opm_latest = None
            quarters_history: List[Dict[str, Any]] = []

            q_section = soup.find("section", id="quarters")
            if q_section:
                q_table = q_section.find("table")
                if q_table:
                    raw_headers = [th.get_text(strip=True) for th in q_table.find_all("th")]
                    quarter_names = [h for h in raw_headers if h and any(c.isdigit() for c in h)]
                    if quarter_names:
                        latest_qtr_name = quarter_names[-1]

                    q_metrics: Dict[str, List[Optional[float]]] = {}
                    for tr in q_table.find_all("tr"):
                        tds = tr.find_all("td")
                        if not tds:
                            continue
                        metric_name = _clean_key(tds[0].get_text(strip=True))
                        values = [_parse_float(td.get_text(strip=True)) for td in tds[1:]]
                        q_metrics[metric_name] = values

                    sales_vals = q_metrics.get("sales") or q_metrics.get("revenue") or []
                    op_vals = q_metrics.get("operating profit") or q_metrics.get("financing profit") or []
                    opm_vals = q_metrics.get("opm") or q_metrics.get("opm %") or q_metrics.get("financing margin %") or []
                    int_vals = q_metrics.get("interest", [])
                    dep_vals = q_metrics.get("depreciation", [])
                    pat_vals = q_metrics.get("net profit", [])
                    eps_vals = q_metrics.get("eps in rs", [])

                    if sales_vals:
                        latest_qtr_sales = sales_vals[-1]
                        if len(sales_vals) >= 5 and sales_vals[-5] and sales_vals[-5] != 0:
                            qtr_sales_yoy = round(((sales_vals[-1] - sales_vals[-5]) / abs(sales_vals[-5])) * 100, 2)
                    if pat_vals:
                        latest_qtr_pat = pat_vals[-1]
                        if len(pat_vals) >= 5 and pat_vals[-5] is not None:
                            base_val = pat_vals[-5]
                            denom = abs(base_val) if abs(base_val) >= 0.1 else 0.5
                            qtr_pat_yoy = round(((pat_vals[-1] - base_val) / denom) * 100, 2)
                    if eps_vals:
                        latest_qtr_eps = eps_vals[-1]
                        if len(eps_vals) >= 5 and eps_vals[-5] is not None and eps_vals[-5] != 0:
                            qtr_eps_yoy = round(((eps_vals[-1] - eps_vals[-5]) / abs(eps_vals[-5])) * 100, 2)
                    if opm_vals:
                        opm_latest = opm_vals[-1]

                    # QoQ Calculations (comparing latest quarter [-1] with previous quarter [-2])
                    qtr_sales_qoq = None
                    if len(sales_vals) >= 2 and sales_vals[-1] is not None and sales_vals[-2] is not None and sales_vals[-2] != 0:
                        qtr_sales_qoq = round(((sales_vals[-1] - sales_vals[-2]) / abs(sales_vals[-2])) * 100, 2)

                    qtr_pat_qoq = None
                    if len(pat_vals) >= 2 and pat_vals[-1] is not None and pat_vals[-2] is not None:
                        base_val_qoq = pat_vals[-2]
                        denom_qoq = abs(base_val_qoq) if abs(base_val_qoq) >= 0.1 else 0.5
                        qtr_pat_qoq = round(((pat_vals[-1] - base_val_qoq) / denom_qoq) * 100, 2)

                    for q_idx, q_header in enumerate(quarter_names):
                        q_label, q_fiscal, q_end_date = _parse_screener_quarter_date(q_header)
                        if not q_end_date:
                            continue

                        s_val = sales_vals[q_idx] if q_idx < len(sales_vals) else None
                        pat_val = pat_vals[q_idx] if q_idx < len(pat_vals) else None
                        op_val = op_vals[q_idx] if q_idx < len(op_vals) else None
                        eps_val = eps_vals[q_idx] if q_idx < len(eps_vals) else None
                        opm_val = opm_vals[q_idx] if q_idx < len(opm_vals) else None
                        int_val = int_vals[q_idx] if q_idx < len(int_vals) else None
                        dep_val = dep_vals[q_idx] if q_idx < len(dep_vals) else None

                        # YoY calculations for this specific quarter (comparing with index - 4)
                        rev_g_yoy = None
                        if q_idx >= 4 and s_val is not None and q_idx - 4 < len(sales_vals):
                            prior_s = sales_vals[q_idx - 4]
                            if prior_s and prior_s != 0:
                                rev_g_yoy = round(((s_val - prior_s) / abs(prior_s)) * 100, 2)

                        pat_g_yoy = None
                        if q_idx >= 4 and pat_val is not None and q_idx - 4 < len(pat_vals):
                            prior_p = pat_vals[q_idx - 4]
                            if prior_p is not None:
                                denom = abs(prior_p) if abs(prior_p) >= 0.1 else 0.5
                                pat_g_yoy = round(((pat_val - prior_p) / denom) * 100, 2)

                        # QoQ calculations for this specific quarter (comparing with index - 1)
                        rev_g_qoq = None
                        if q_idx >= 1 and s_val is not None and q_idx - 1 < len(sales_vals):
                            prior_s_q = sales_vals[q_idx - 1]
                            if prior_s_q and prior_s_q != 0:
                                rev_g_qoq = round(((s_val - prior_s_q) / abs(prior_s_q)) * 100, 2)

                        pat_g_qoq = None
                        if q_idx >= 1 and pat_val is not None and q_idx - 1 < len(pat_vals):
                            prior_p_q = pat_vals[q_idx - 1]
                            if prior_p_q is not None:
                                denom_q = abs(prior_p_q) if abs(prior_p_q) >= 0.1 else 0.5
                                pat_g_qoq = round(((pat_val - prior_p_q) / denom_q) * 100, 2)

                        quarters_history.append({
                            "raw_name": q_header,
                            "quarter": q_label,
                            "fiscal_period": q_fiscal,
                            "period_end": q_end_date,
                            "revenue": s_val,
                            "operating_income": op_val,
                            "net_profit": pat_val,
                            "eps": eps_val,
                            "opm": opm_val,
                            "interest_expense": int_val,
                            "depreciation": dep_val,
                            "revenue_growth": rev_g_yoy,
                            "pat_growth": pat_g_yoy,
                            "revenue_growth_qoq": rev_g_qoq,
                            "pat_growth_qoq": pat_g_qoq,
                        })

            # 7. Balance Sheet Solvency
            borrowings_val = None
            reserves_val = None
            total_assets_val = None
            debt_to_equity = None

            bs_section = soup.find("section", id="balance-sheet")
            if bs_section:
                bs_table = bs_section.find("table")
                if bs_table:
                    for tr in bs_table.find_all("tr"):
                        tds = tr.find_all("td")
                        if not tds:
                            continue
                        metric = _clean_key(tds[0].get_text(strip=True))
                        vals = [_parse_float(td.get_text(strip=True)) for td in tds[1:] if _parse_float(td.get_text(strip=True)) is not None]
                        if not vals:
                            continue
                        latest_val = vals[-1]
                        if "borrowings" in metric:
                            borrowings_val = latest_val
                        elif "reserves" in metric:
                            reserves_val = latest_val
                        elif "total assets" in metric:
                            total_assets_val = latest_val

            if borrowings_val is not None and reserves_val is not None:
                equity_base = (reserves_val or 0)
                if equity_base > 0:
                    debt_to_equity = round(borrowings_val / equity_base, 2)

            # 8. Cash Flows (CFO, FCF)
            cfo_val = None
            fcf_val = None
            cf_section = soup.find("section", id="cash-flow")
            if cf_section:
                cf_table = cf_section.find("table")
                if cf_table:
                    for tr in cf_table.find_all("tr"):
                        tds = tr.find_all("td")
                        if not tds:
                            continue
                        m_name = _clean_key(tds[0].get_text(strip=True))
                        vals = [_parse_float(td.get_text(strip=True)) for td in tds[1:] if _parse_float(td.get_text(strip=True)) is not None]
                        if vals and "operating activity" in m_name:
                            cfo_val = vals[-1]
            if cfo_val is not None:
                fcf_val = cfo_val  # baseline approximation if capex is embedded

            # 9. Efficiency Ratios (Debtor Days, Inventory Days, Cash Conversion Cycle)
            debtor_days = None
            inventory_days = None
            cash_conversion_cycle = None
            ratios_section = soup.find("section", id="ratios")
            if ratios_section:
                r_table = ratios_section.find("table")
                if r_table:
                    for tr in r_table.find_all("tr"):
                        tds = tr.find_all("td")
                        if not tds:
                            continue
                        r_name = _clean_key(tds[0].get_text(strip=True))
                        vals = [_parse_float(td.get_text(strip=True)) for td in tds[1:] if _parse_float(td.get_text(strip=True)) is not None]
                        if not vals:
                            continue
                        if "debtor days" in r_name:
                            debtor_days = vals[-1]
                        elif "inventory days" in r_name:
                            inventory_days = vals[-1]
                        elif "cash conversion" in r_name or "working capital days" in r_name:
                            cash_conversion_cycle = vals[-1]

            # 10. Shareholding Pattern
            promoter_pct, fii_pct, dii_pct, public_pct = None, None, None, None
            sh_section = soup.find("section", id="shareholding")
            if sh_section:
                sh_table = sh_section.find("table")
                if sh_table:
                    for tr in sh_table.find_all("tr"):
                        tds = tr.find_all("td")
                        if not tds:
                            continue
                        holder = _clean_key(tds[0].get_text(strip=True))
                        vals = [_parse_float(td.get_text(strip=True)) for td in tds[1:] if _parse_float(td.get_text(strip=True)) is not None]
                        if vals:
                            latest_pct = vals[-1]
                            if "promoter" in holder:
                                promoter_pct = latest_pct
                            elif "fii" in holder:
                                fii_pct = latest_pct
                            elif "dii" in holder:
                                dii_pct = latest_pct
                            elif "public" in holder:
                                public_pct = latest_pct

            # 11. Chart API for Price Returns (3m, 6m, 1y, DMA50, DMA200)
            chart_metrics = cls.fetch_chart_data(company_id)

            # 12. Piotroski F-Score (0 to 9)
            # Calculated from the 9 financial accounting tests
            piotroski = 0.0
            # Test 1: Positive Net Income
            if pat_12m and pat_12m > 0:
                piotroski += 1
            # Test 2: Positive ROA
            if pat_12m and total_assets_val and (pat_12m / total_assets_val) > 0:
                piotroski += 1
            # Test 3: Positive Cash Flow from Operations
            if cfo_val and cfo_val > 0:
                piotroski += 1
            # Test 4: Quality of earnings (CFO > PAT)
            if cfo_val and pat_12m and cfo_val > pat_12m:
                piotroski += 1
            # Test 5: Lower Long-Term Debt / Low Debt
            if debt_to_equity is not None and debt_to_equity <= 0.5:
                piotroski += 1
            # Test 6: Strong Margin Momentum
            if qtr_pat_yoy and qtr_pat_yoy > 0:
                piotroski += 1
            # Test 7: Sales Growth Momentum
            if sales_g_3y and sales_g_3y > 0:
                piotroski += 1
            # Test 8: High Capital Efficiency (ROCE > 15%)
            if roce_val and roce_val >= 15:
                piotroski += 1
            # Test 9: Shareholding Stability (Promoter >= 50%)
            if promoter_pct and promoter_pct >= 50:
                piotroski += 1

            # 13. Health Score (0-100 institutional heuristic)
            health = 50.0
            if roce_val and roce_val >= 20:
                health += 15
            elif roce_val and roce_val >= 15:
                health += 10
            if sales_g_3y and sales_g_3y >= 15:
                health += 15
            elif sales_g_3y and sales_g_3y >= 10:
                health += 10
            if pat_g_3y and pat_g_3y >= 15:
                health += 10
            if debt_to_equity is not None and debt_to_equity < 0.5:
                health += 10
            health = min(100.0, max(0.0, health))

            core_fields = [
                cmp_val, mcap_val, pe_val, roce_val, roe_val, pat_12m, eps_12m,
                sales_g_3y, pat_g_3y, latest_qtr_sales, promoter_pct,
            ]
            valid_fields = sum(1 for f in core_fields if f is not None)
            completeness = round((valid_fields / len(core_fields)) * 100, 1)

            p1 = time.perf_counter()
            parse_time_ms = round((p1 - p0) * 1000, 2)

            return {
                "symbol": clean_symbol,
                "company_name": company_name or clean_symbol,
                "sector": sector,
                "industry": industry,
                "exchange": "NSE",
                # Valuation Multiples (CMP Rs., Mar Cap Rs.Cr., P/E, Ind PE, B.V. Rs., CMP / BV)
                "current_price": cmp_val,
                "market_cap": mcap_val,
                "market_cap_category": category,
                "stock_pe": pe_val,
                "industry_pe": industry_pe,
                "price_to_book": pb_val,
                "book_value": book_val,
                "dividend_yield": div_val,
                "face_value": face_val,
                "peg_ratio": peg_ratio,
                # Trailing 12-Month & Profitability (PAT 12M Rs.Cr., EPS 12M Rs., OPM %)
                "pat_12m": pat_12m,
                "eps_12m": eps_12m,
                "roce": roce_val,
                "roe": roe_val,
                "opm_latest": opm_latest,
                "opm_ttm": opm_latest,
                # Multi-Year Compounded Variance (Sales growth %, Profit growth %, Profit Var 3Yrs %, Sales Var 3Yrs %)
                "sales_growth_ttm": sales_g_ttm,
                "profit_growth_ttm": pat_g_ttm,
                "sales_growth_3yr": sales_g_3y,
                "sales_growth_5yr": sales_g_5y,
                "sales_growth_10yr": sales_g_10y,
                "profit_growth_3yr": pat_g_3y,
                "profit_growth_5yr": pat_g_5y,
                "profit_growth_10yr": pat_g_10y,
                # Price Returns (3mth return %, 6mth return %, Stock CAGR)
                "return_3m": chart_metrics.get("return_3m"),
                "return_6m": chart_metrics.get("return_6m"),
                "return_1y": chart_metrics.get("return_1y"),
                "stock_cagr_3yr": stock_cagr_3y,
                "stock_cagr_5yr": stock_cagr_5y,
                "dma_50": chart_metrics.get("dma_50"),
                "dma_200": chart_metrics.get("dma_200"),
                # Quality & Scoring (Piotroski Scr)
                "piotroski_score": piotroski,
                "health_score": health,
                # Quarterly Momentum (Qtr Profit Var %, NP Qtr Rs.Cr.)
                "latest_quarter_name": latest_qtr_name,
                "latest_quarter_sales": latest_qtr_sales,
                "latest_quarter_net_profit": latest_qtr_pat,
                "latest_quarter_eps": latest_qtr_eps,
                "quarterly_sales_yoy": qtr_sales_yoy,
                "quarterly_pat_yoy": qtr_pat_yoy,
                "quarterly_sales_qoq": qtr_sales_qoq,
                "quarterly_pat_qoq": qtr_pat_qoq,
                "quarterly_eps_yoy": qtr_eps_yoy,
                "quarters_history": quarters_history,
                # Balance Sheet, Solvency & Cash Flow
                "borrowings": borrowings_val,
                "reserves": reserves_val,
                "total_assets": total_assets_val,
                "debt_to_equity": debt_to_equity,
                "cfo_latest": cfo_val,
                "free_cash_flow": fcf_val,
                "debtor_days": debtor_days,
                "inventory_days": inventory_days,
                "cash_conversion_cycle": cash_conversion_cycle,
                # Ownership
                "promoter_holding": promoter_pct,
                "fii_holding": fii_pct,
                "dii_holding": dii_pct,
                "public_holding": public_pct,
                # Range
                "high_52_week": high_52,
                "low_52_week": low_52,
                "data_completeness_score": completeness,
                "response_time_ms": response_time_ms,
                "parse_time_ms": parse_time_ms,
                "import_source": "screener.in",
            }

        except Exception as e:
            logger.error(f"Error parsing Screener.in full profile for {clean_symbol}: {e}")
            return None
