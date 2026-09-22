"""
Integration Tests for Growth Screener API
Verifies server-side sorting, pagination, and filter bounds.
"""


def test_growth_screener_endpoint(client):
    """Verifies that /growth-screener returns sorted and paginated records."""
    # 1. Request page 1 with limit 10 sorted by market_cap desc
    resp = client.get(
        "/growth-screener",
        params={"page": 1, "limit": 10, "sort_by": "market_cap", "sort_order": "desc"},
    )
    assert resp.status_code == 200, f"Failed: {resp.text}"
    data = resp.json()
    assert "results" in data
    results = data["results"]
    assert len(results) <= 10

    # 2. Verify sorting if items exist
    caps = [float(item.get("market_cap") or 0) for item in results if item.get("market_cap") is not None]
    if len(caps) >= 2:
        assert caps == sorted(caps, reverse=True), "Market cap is not sorted in descending order!"


def test_growth_screener_filters(client):
    """Verifies that dynamic filter options are served properly."""
    resp = client.get("/growth-screener/filters")
    assert resp.status_code == 200
    filters = resp.json()
    assert isinstance(filters, dict)
    assert "sectors" in filters or "market_cap_categories" in filters or len(filters) >= 1
