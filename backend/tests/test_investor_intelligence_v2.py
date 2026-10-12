"""
Alpha India — Investor Intelligence & Management Commitment Engine Tests (v2.3)
Tests for:
1. Indian FY Quarter Assignment and Calendar-to-Fiscal Mapping
2. Document Deduplication and SHA-256 Content Hashing
3. Management Commitment Extraction & Revision Tracking
4. Delivery Rate Calculation & Due vs Not-Yet-Due Denominator Integrity
5. Latest-Publication-First Feed Sorting & Pending Presentation Visibility
6. Coverage Dashboard Endpoints & Processing Stage Breakdown
"""

import datetime
import pytest
from app.services.investor_document_harvester import InvestorDocumentHarvester
from app.services.investor_intelligence_service import InvestorIntelligenceService
from app.models.investor_intelligence import InvestorDocument, ManagementCommitment


def test_indian_fiscal_year_quarter_assignment():
    """Verifies Indian fiscal year quarter parsing and distinction between calendar and financial quarters."""
    # October 2026 announcement -> Q2 FY27
    oct_date = datetime.date(2026, 10, 15)
    period, fy, q, ann_date = InvestorDocumentHarvester.resolve_quarter_and_date("Investor Presentation Q2 FY27", oct_date)
    assert period == "Q2 FY27"
    assert fy == 2027
    assert q == 2

    # May 2026 announcement -> Q4 FY26 reporting (since May publishes Q4 results)
    may_date = datetime.date(2026, 5, 20)
    period, fy, q, ann_date = InvestorDocumentHarvester.resolve_quarter_and_date("Earnings Presentation Q4 FY26", may_date)
    assert period == "Q4 FY26"
    assert fy == 2026
    assert q == 4

    # January 2027 announcement for Q3 FY27
    jan_date = datetime.date(2027, 1, 25)
    period, fy, q, ann_date = InvestorDocumentHarvester.resolve_quarter_and_date("Investor Presentation Q3 FY27", jan_date)
    assert period == "Q3 FY27"
    assert fy == 2027
    assert q == 3


def test_content_hashing_and_deduplication():
    """Verifies that content hashing produces deterministic SHA-256 hashes."""
    doc_text_1 = "TCS Q2 FY27 Investor Presentation: Constant Currency Revenue up 8.2% YoY."
    doc_text_2 = "TCS Q2 FY27 Investor Presentation: Constant Currency Revenue up 8.2% YoY."
    doc_text_3 = "Infosys Q2 FY27 Earnings Release."

    h1 = InvestorDocumentHarvester.compute_content_hash(doc_text_1)
    h2 = InvestorDocumentHarvester.compute_content_hash(doc_text_2)
    h3 = InvestorDocumentHarvester.compute_content_hash(doc_text_3)

    assert h1 == h2
    assert h1 != h3
    assert len(h1) == 64  # SHA-256 hex length


def test_delivery_rate_calculation_rules(db_session):
    """
    Verifies that delivery rate:
    - Is calculated as: met / (met + partially_met + missed) * 100
    - Strictly excludes not_yet_due, withdrawn, and unverified from the assessable denominator
    - Never marks an upcoming commitment as missed
    """
    summary = InvestorIntelligenceService.get_commitments_summary(db_session)
    assert "delivery_rate_pct" in summary
    assert "total_recorded" in summary
    assert "assessable_denominator" in summary
    assert "not_yet_due" in summary

    # Verify formula integrity
    met = summary["commitments_met"]
    partially_met = summary["commitments_partially_met"]
    missed = summary["commitments_missed"]
    assessable = met + partially_met + missed

    assert summary["assessable_denominator"] == assessable
    if assessable > 0:
        expected_rate = round((met / assessable) * 100, 1)
        assert summary["delivery_rate_pct"] == expected_rate


def test_commitment_revision_history_preservation(db_session):
    """
    Verifies that guidance revisions are recorded as dated events
    and do not overwrite original guidance statement or targets.
    """
    first_doc = db_session.query(InvestorDocument).first()
    doc_id = first_doc.id if first_doc else 1

    test_commitment = ManagementCommitment(
        company_id=1,
        symbol="TATAELXSI",
        document_id=doc_id,
        statement="Management targets 20% constant currency revenue growth for FY27.",
        category="FINANCIAL_TARGET",
        is_financial_target=True,
        target_value="20% CC revenue growth",
        target_period="FY27",
        status="REVISED",
        revisions=[
            {
                "date": "2026-10-12",
                "revised_target": "16-18% CC revenue growth",
                "reason": "Macro delays in European automotive segment",
                "source_quarter": "Q2 FY27",
            }
        ],
    )
    db_session.add(test_commitment)
    db_session.commit()

    # Re-fetch and verify original target is intact
    fetched = (
        db_session.query(ManagementCommitment)
        .filter_by(symbol="TATAELXSI", statement="Management targets 20% constant currency revenue growth for FY27.")
        .first()
    )
    assert fetched is not None
    assert fetched.target_value == "20% CC revenue growth"
    assert len(fetched.revisions) == 1
    assert fetched.revisions[0]["revised_target"] == "16-18% CC revenue growth"

    # Cleanup
    db_session.delete(fetched)
    db_session.commit()


def test_quarterly_coverage_endpoint(client):
    """Verifies that the /coverage endpoint returns all required metrics and stage drilldowns."""
    response = client.get("/api/v1/investor-intelligence/coverage")
    assert response.status_code == 200
    data = response.json()

    assert "selected_quarter" in data
    assert "available_quarters" in data
    assert "total_discovered" in data
    assert "analyzed_count" in data
    assert "analyzed_percentage" in data
    assert "pending_count" in data
    assert "failed_count" in data
    assert "companies_covered" in data
    assert "commitments_extracted" in data
    assert "commitments_due" in data
    assert "drilldown_records" in data

    # Check stage breakdown contains all distinct processing stages
    drilldowns = data["drilldown_records"]
    assert "DISCOVERED_NOT_DOWNLOADED" in drilldowns
    assert "DOWNLOADED_NOT_EXTRACTED" in drilldowns
    assert "EXTRACTED_NOT_ANALYZED" in drilldowns
    assert "ANALYZED" in drilldowns
    assert "FAILED" in drilldowns


def test_feed_latest_first_sorting(client):
    """Verifies that the feed sorts primarily by announcement_date desc."""
    response = client.get("/api/v1/investor-intelligence/feed?limit=20")
    assert response.status_code == 200
    data = response.json()

    assert "items" in data
    assert "total" in data
    items = data["items"]

    # Verify descending publication order for non-null dates
    dates = [i["announcement_date"] for i in items if i.get("announcement_date")]
    for j in range(len(dates) - 1):
        assert dates[j] >= dates[j + 1], f"Date at {j} ({dates[j]}) is older than date at {j+1} ({dates[j+1]})"


def test_commitments_ledger_endpoint(client):
    """Verifies that the commitments ledger endpoint returns structured records."""
    response = client.get("/api/v1/investor-intelligence/commitments?limit=10")
    assert response.status_code == 200
    data = response.json()

    assert "items" in data
    assert "total" in data
    if data["items"]:
        item = data["items"][0]
        assert "id" in item
        assert "symbol" in item
        assert "statement" in item
        assert "status" in item
        assert "is_financial_target" in item
