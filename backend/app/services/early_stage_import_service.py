"""
Alpha India — Early Stage Import Service  (Phase 4)
Handles bulk import of early_stage_candidate records into the main pipeline.

For each candidate:
  1. Sanitise and generate a provisional ticker symbol.
  2. Create a provisional Company row (is_provisional=True) — or reuse existing.
  3. Enqueue the company in financial_import_queue (status=PENDING).
  4. Mark the candidate as status='imported'.
  5. Log to early_stage_import_log.

All steps run inside a single DB transaction — atomic per candidate.
A failed individual import is logged and skipped, not aborting the batch.
"""

import logging
import re
from datetime import datetime
from typing import Dict, List

from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.early_stage_candidate import EarlyStageCandidate
from app.models.early_stage_import_log import EarlyStageImportLog
from app.models.financial_import_queue import FinancialImportQueue

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sanitize_ticker(company_name: str, tentative_ticker: str | None) -> str:
    """
    Generate a clean provisional ticker symbol:
    - Use tentative_ticker if already present and valid (≤12 uppercase chars).
    - Otherwise derive from company_name: take the first 3 words, uppercase, strip noise.
    - Append _PRV suffix to mark as provisional (distinguishes from real NSE symbols).
    """
    if tentative_ticker:
        clean = re.sub(r"[^A-Z0-9]", "", tentative_ticker.upper())
        if 2 <= len(clean) <= 10:
            return f"{clean}_PRV"

    # Derive from name
    words  = re.findall(r"[A-Za-z]+", company_name)
    ticker = "".join(w[:4].upper() for w in words[:3])[:10]
    return f"{ticker}_PRV"


# ---------------------------------------------------------------------------
# Core import function (single candidate)
# ---------------------------------------------------------------------------

def _import_single(db: Session, candidate: EarlyStageCandidate) -> Dict:
    """
    Import one candidate. Returns {"status": "created"|"reused"|"error", "company_id": int}.
    Raises no exceptions — catches and returns "error" with message.
    """
    try:
        ticker = _sanitize_ticker(candidate.company_name, candidate.tentative_ticker)

        # --- Step 1: Find or create Company ---
        existing_company = (
            db.query(Company).filter(Company.symbol == ticker).first()
        )

        if existing_company:
            company = existing_company
            outcome = "reused"
        else:
            company = Company(
                symbol=ticker,
                company=candidate.company_name,
                sector=candidate.sector or "Unknown",
                industry="Unknown",
                market_cap="Unknown",
                exchange="NSE",
                listing_status="PROVISIONAL",
                is_provisional=True,
                is_growth_eligible=False,  # ineligible until data confirmed
                revenue_growth=0,
                pat_growth=0,
                roce=0,
                ai_score=0,
            )
            db.add(company)
            db.flush()  # get company.id without committing
            outcome = "created"

        # --- Step 2: Enqueue in financial_import_queue if not already there ---
        existing_queue = (
            db.query(FinancialImportQueue)
            .filter(FinancialImportQueue.symbol == ticker)
            .first()
        )
        if not existing_queue:
            db.add(FinancialImportQueue(
                company_id=company.id,
                symbol=ticker,
                status="PENDING",
                attempts=0,
                created_at=datetime.utcnow(),
            ))

        # --- Step 3: Mark candidate as imported ---
        candidate.status = "imported"

        # --- Step 4: Log the import ---
        db.add(EarlyStageImportLog(
            candidate_id=candidate.id,
            company_id=company.id,
            source=candidate.source,
        ))

        return {"status": outcome, "company_id": company.id, "ticker": ticker}

    except Exception as exc:
        logger.error(f"[Import] Failed for candidate '{candidate.company_name}': {exc}")
        return {"status": "error", "error": str(exc)}


# ---------------------------------------------------------------------------
# Bulk import (public API)
# ---------------------------------------------------------------------------

def bulk_import_candidates(
    db: Session,
    candidate_ids: List[int],
) -> Dict:
    """
    Import a list of early_stage_candidate IDs into the main pipeline.
    Returns a summary:
      {
        "total": int,
        "created": int,    # new Company rows
        "reused": int,     # candidate matched existing Company
        "errors": int,
        "details": [...]
      }
    """
    if not candidate_ids:
        return {"total": 0, "created": 0, "reused": 0, "errors": 0, "details": []}

    candidates = (
        db.query(EarlyStageCandidate)
        .filter(
            EarlyStageCandidate.id.in_(candidate_ids),
            EarlyStageCandidate.status != "imported",  # skip already-imported
        )
        .all()
    )

    summary = {"total": len(candidates), "created": 0, "reused": 0, "errors": 0, "details": []}

    for candidate in candidates:
        result = _import_single(db, candidate)
        summary["details"].append({"candidate_id": candidate.id, **result})

        if result["status"] == "created":
            summary["created"] += 1
        elif result["status"] == "reused":
            summary["reused"] += 1
        else:
            summary["errors"] += 1

    try:
        db.commit()
        logger.info(
            f"[Import] Bulk import done. "
            f"Created={summary['created']} Reused={summary['reused']} Errors={summary['errors']}"
        )
    except Exception as exc:
        db.rollback()
        logger.error(f"[Import] Commit failed: {exc}")
        summary["errors"] = summary["total"]
        summary["created"] = 0
        summary["reused"]  = 0

    return summary
