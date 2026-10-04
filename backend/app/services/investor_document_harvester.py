"""
Alpha India — Investor Document Harvester Service
Continuously discovers, harvests, and indexes Investor Presentations and Concall Transcripts
from NSE, BSE, and Screener corporate document repositories.
"""

import datetime
import logging
import re
import urllib.request
from typing import Any, Dict, List, Optional, Tuple
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from app.clients.bse_client import BSEClient
from app.clients.nse_client import NSEClient
from app.models.company import Company
from app.models.investor_intelligence import InvestorDocument
from app.services.pdf_extractor_service import PDFExtractorService

logger = logging.getLogger(__name__)


def _normalize_fiscal_period(raw_str: str) -> str:
    """Normalizes raw period string like 'Aug 2026' or 'Q1FY26' into 'Q1 FY27' or similar."""
    clean = raw_str.strip().upper()

    # Match explicit Q1 FY26, Q2-FY25, etc.
    m_q = re.search(r"(Q[1-4])\s*(?:-|/)?\s*(?:FY)?\s*(\d{2,4})", clean)
    if m_q:
        q = m_q.group(1)
        yr = m_q.group(2)[-2:]
        return f"{q} FY{yr}"

    # Match month year: e.g. Aug 2026 -> Q1 FY27 (Indian fiscal year)
    m_my = re.search(r"(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+(\d{4})", clean)
    if m_my:
        mon = m_my.group(1)
        yr = int(m_my.group(2))
        month_map = {
            "JAN": (4, yr), "FEB": (4, yr), "MAR": (4, yr),
            "APR": (1, yr + 1), "MAY": (1, yr + 1), "JUN": (1, yr + 1),
            "JUL": (2, yr + 1), "AUG": (2, yr + 1), "SEP": (2, yr + 1),
            "OCT": (3, yr + 1), "NOV": (3, yr + 1), "DEC": (3, yr + 1),
        }
        q_num, fy_year = month_map.get(mon, (1, yr))
        return f"Q{q_num} FY{str(fy_year)[-2:]}"

    return clean[:20] if clean else "Current"


class InvestorDocumentHarvester:
    USER_AGENT = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )

    # -------------------------------------------------------------------------
    # 1. Harvest Full History from Curated Screener Documents
    # -------------------------------------------------------------------------
    @classmethod
    def harvest_for_symbol(cls, db: Session, symbol: str) -> Dict[str, Any]:
        """
        Discovers and registers all Concall Transcripts and Investor Presentations
        for a stock symbol.
        """
        sym = symbol.strip().upper()
        comp = db.query(Company).filter(Company.symbol == sym).first()
        comp_id = comp.id if comp else None
        comp_name = comp.company if comp else sym

        url = f"https://www.screener.in/company/{sym}/consolidated/"
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": cls.USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
        )

        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                html = resp.read().decode("utf-8", errors="ignore")
        except Exception as exc:
            # Fallback to standalone if consolidated fails
            try:
                fallback_url = f"https://www.screener.in/company/{sym}/"
                f_req = urllib.request.Request(fallback_url, headers={"User-Agent": cls.USER_AGENT})
                with urllib.request.urlopen(f_req, timeout=15) as f_resp:
                    html = f_resp.read().decode("utf-8", errors="ignore")
            except Exception as f_exc:
                logger.error(f"Failed to fetch document page for {sym}: {exc} / {f_exc}")
                return {"symbol": sym, "discovered": 0, "error": str(exc)}

        soup = BeautifulSoup(html, "lxml")
        discovered_count = 0

        # Scan for Concalls section
        for h3 in soup.find_all(["h3", "h4"]):
            if "concall" in h3.get_text().lower():
                ul = h3.find_next("ul")
                if not ul:
                    continue

                for li in ul.find_all("li"):
                    raw_text = li.get_text(" ", strip=True)
                    # Extract date / period header e.g. 'Aug 2026'
                    period_match = re.search(r"([A-Za-z]{3}\s+\d{4})", raw_text)
                    period_raw = period_match.group(1) if period_match else ""
                    normalized_period = _normalize_fiscal_period(period_raw)

                    # Links inside this row: Transcript, PPT, REC
                    for a in li.find_all("a"):
                        link_text = a.get_text(strip=True).upper()
                        link_url = a.get("href")
                        if not link_url or not link_url.startswith("http"):
                            continue

                        doc_type = None
                        if "TRANSCRIPT" in link_text or "TRANSCRIPT" in link_url.upper():
                            doc_type = "CONCALL_TRANSCRIPT"
                        elif "PPT" in link_text or "PRESENTATION" in link_url.upper() or "INVESTOR" in link_url.upper():
                            doc_type = "INVESTOR_PRESENTATION"

                        if not doc_type:
                            continue

                        # Check deduplication
                        exists = (
                            db.query(InvestorDocument)
                            .filter(
                                InvestorDocument.symbol == sym,
                                InvestorDocument.pdf_url == link_url,
                            )
                            .first()
                        )
                        if exists:
                            continue

                        # Create new record
                        doc = InvestorDocument(
                            company_id=comp_id,
                            symbol=sym,
                            company_name=comp_name,
                            exchange="SCREENER",
                            doc_type=doc_type,
                            fiscal_period=normalized_period,
                            headline=f"{sym} {doc_type.replace('_', ' ')} - {normalized_period}",
                            source_url=url,
                            pdf_url=link_url,
                            status="PENDING",
                        )
                        db.add(doc)
                        discovered_count += 1

        db.commit()
        return {
            "symbol": sym,
            "discovered": discovered_count,
            "status": "SUCCESS",
        }

    # -------------------------------------------------------------------------
    # 2. Harvest from Live NSE & BSE Exchange Wire (Real-time Drops)
    # -------------------------------------------------------------------------
    @classmethod
    def harvest_from_exchange_wires(cls, db: Session) -> Dict[str, Any]:
        """
        Polls official NSE and BSE corporate announcement endpoints in real time,
        filtering specifically for newly dropped Investor Presentations & Concall Transcripts.
        """
        discovered = 0
        nse_client = NSEClient()
        bse_client = BSEClient()

        # 1. Scan NSE global announcements
        try:
            nse_announcements = nse_client.global_announcements()
            for ann in nse_announcements:
                desc = (ann.get("desc") or "").upper()
                text = (ann.get("attchmntText") or "").upper()
                combined = f"{desc} {text}"
                pdf_url = ann.get("attchmntFile")
                sym = (ann.get("symbol") or "").strip().upper()

                if not sym or not pdf_url or not pdf_url.startswith("http"):
                    continue

                doc_type = None
                if any(k in combined for k in ["TRANSCRIPT", "EARNINGS CALL", "CONCALL", "AUDIO RECORDING"]):
                    doc_type = "CONCALL_TRANSCRIPT"
                elif any(k in combined for k in ["INVESTOR PRESENTATION", "EARNINGS PPT", "ANALYST PRESENTATION", "INVESTOR UPDATE"]):
                    doc_type = "INVESTOR_PRESENTATION"

                if not doc_type:
                    continue

                # Ensure company
                comp = db.query(Company).filter(Company.symbol == sym).first()
                comp_id = comp.id if comp else None
                comp_name = comp.company if comp else (ann.get("sm_name") or sym)

                exists = (
                    db.query(InvestorDocument)
                    .filter(
                        InvestorDocument.symbol == sym,
                        InvestorDocument.pdf_url == pdf_url,
                    )
                    .first()
                )
                if exists:
                    continue

                # Parse date
                ann_date = None
                if ann.get("sort_date"):
                    try:
                        ann_date = datetime.datetime.fromisoformat(ann["sort_date"]).date()
                    except Exception:
                        ann_date = datetime.date.today()

                doc = InvestorDocument(
                    company_id=comp_id,
                    symbol=sym,
                    company_name=comp_name,
                    exchange="NSE",
                    doc_type=doc_type,
                    fiscal_period="Current",
                    announcement_date=ann_date,
                    headline=desc[:200] or f"{sym} {doc_type}",
                    source_url="https://www.nseindia.com",
                    pdf_url=pdf_url,
                    status="PENDING",
                )
                db.add(doc)
                discovered += 1

        except Exception as nse_err:
            logger.warning(f"NSE Wire harvest warning: {nse_err}")

        # 2. Scan BSE announcements
        try:
            bse_announcements = bse_client.announcements()
            for b_item in bse_announcements:
                headline = (b_item.get("headline") or "").upper()
                cat = (b_item.get("category") or "").upper()
                subcat = (b_item.get("sub_category") or "").upper()
                combined = f"{headline} {cat} {subcat}"
                pdf_url = b_item.get("pdf_url")
                scrip = str(b_item.get("scrip_code") or "").strip()

                if not pdf_url or not pdf_url.startswith("http"):
                    continue

                doc_type = None
                if any(k in combined for k in ["TRANSCRIPT", "EARNINGS CALL TRANSCRIPT", "CON. CALL"]):
                    doc_type = "CONCALL_TRANSCRIPT"
                elif any(k in combined for k in ["INVESTOR PRESENTATION", "ANALYST PRESENTATION", "INVESTOR MEET"]):
                    doc_type = "INVESTOR_PRESENTATION"

                if not doc_type:
                    continue

                # Resolve company
                comp = None
                if scrip:
                    comp = db.query(Company).filter(Company.bse_code == scrip).first()
                if not comp and b_item.get("company_name"):
                    comp = db.query(Company).filter(Company.company.ilike(f"%{b_item['company_name'][:15]}%")).first()

                sym = comp.symbol if comp else f"BSE_{scrip}"
                comp_id = comp.id if comp else None
                comp_name = comp.company if comp else (b_item.get("company_name") or sym)

                exists = (
                    db.query(InvestorDocument)
                    .filter(
                        InvestorDocument.symbol == sym,
                        InvestorDocument.pdf_url == pdf_url,
                    )
                    .first()
                )
                if exists:
                    continue

                doc = InvestorDocument(
                    company_id=comp_id,
                    symbol=sym,
                    company_name=comp_name,
                    exchange="BSE",
                    doc_type=doc_type,
                    fiscal_period="Current",
                    announcement_date=datetime.date.today(),
                    headline=headline[:200] or f"{sym} {doc_type}",
                    source_url="https://www.bseindia.com",
                    pdf_url=pdf_url,
                    status="PENDING",
                )
                db.add(doc)
                discovered += 1

        except Exception as bse_err:
            logger.warning(f"BSE Wire harvest warning: {bse_err}")

        db.commit()
        return {"discovered": discovered}

    # -------------------------------------------------------------------------
    # 3. Synchronize & Extract Text from Pending Documents
    # -------------------------------------------------------------------------
    @classmethod
    def extract_pending_documents(cls, db: Session, limit: int = 5) -> List[InvestorDocument]:
        """
        Finds pending investor documents, downloads their PDFs, and extracts text segments.
        """
        pending_docs = (
            db.query(InvestorDocument)
            .filter(InvestorDocument.status == "PENDING")
            .order_by(InvestorDocument.id.desc())
            .limit(limit)
            .all()
        )

        extracted_docs = []
        for doc in pending_docs:
            try:
                res = PDFExtractorService.process_document_url(
                    pdf_url=doc.pdf_url,
                    symbol=doc.symbol,
                    doc_type=doc.doc_type,
                    doc_name=f"{doc.symbol}_{doc.fiscal_period}_{doc.doc_type}_{doc.id}",
                )

                if res["success"]:
                    doc.raw_text_length = len(res["raw_text"])
                    doc.parsed_text = res["raw_text"][:40000]  # Store preview/core text
                    doc.management_speech_text = res["management_speech"]
                    doc.analyst_qa_text = res["analyst_qa"]
                    doc.status = "EXTRACTED"
                    doc.error_message = None
                    extracted_docs.append(doc)
                else:
                    doc.status = "FAILED"
                    doc.error_message = res.get("error", "Unknown extraction error")

            except Exception as e:
                logger.error(f"Error extracting document {doc.id} ({doc.symbol}): {e}")
                doc.status = "FAILED"
                doc.error_message = str(e)

            db.commit()

        return extracted_docs
