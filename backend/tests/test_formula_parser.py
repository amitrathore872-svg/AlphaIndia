"""
Unit & Integration Tests for Custom Quantitative Screener Formula Parser & API
"""

import pytest
from app.services.formula_parser import (
    FormulaTokenizer,
    FormulaASTParser,
    FormulaParserError,
    QuantitativeFormulaService,
)


def test_formula_tokenization():
    """Verifies that mathematical expressions and multi-word metrics tokenize accurately."""
    expr = "ROCE > 20 AND (Sales Growth >= 25 OR Profit Growth > 30) AND Debt to Equity < 0.5"
    tokenizer = FormulaTokenizer(expr)
    tokens = tokenizer.tokenize()

    types = [t.type for t in tokens]
    assert types == [
        "METRIC", "OP", "NUMBER",
        "LOGICAL",
        "LPAREN",
        "METRIC", "OP", "NUMBER",
        "LOGICAL",
        "METRIC", "OP", "NUMBER",
        "RPAREN",
        "LOGICAL",
        "METRIC", "OP", "NUMBER",
        "EOF",
    ]


def test_formula_validation_success():
    """Verifies validation on legitimate institutional formulas."""
    f1 = "ROCE > 20 AND ROE > 18 AND Debt to Equity < 0.5 AND Sales Growth > 15"
    v1 = QuantitativeFormulaService.validate_formula(f1)
    assert v1["valid"] is True
    assert set(v1["metrics_detected"]) == {"roce", "roe", "debt to equity", "sales growth"}

    f2 = "Piotroski Score >= 7 AND PE < 30 AND (OPM > 20 OR ROCE > 25)"
    v2 = QuantitativeFormulaService.validate_formula(f2)
    assert v2["valid"] is True


def test_formula_validation_syntax_errors():
    """Verifies that malformed syntax or injection attempts are safely rejected."""
    # 1. Unrecognized keyword / SQL injection attempt
    bad_sql = "ROCE > 20; DROP TABLE users;--"
    v_sql = QuantitativeFormulaService.validate_formula(bad_sql)
    assert v_sql["valid"] is False
    assert "unrecognized keyword" in v_sql["error"].lower()

    # 2. Missing operator or value
    bad_syntax = "ROCE > AND Sales Growth"
    v_syntax = QuantitativeFormulaService.validate_formula(bad_syntax)
    assert v_syntax["valid"] is False

    # 3. Unclosed parenthesis
    bad_parens = "(ROCE > 20 AND PE < 15"
    v_parens = QuantitativeFormulaService.validate_formula(bad_parens)
    assert v_parens["valid"] is False


def test_formula_api_validate(client):
    """Tests /api/v1/screener-formula/validate endpoint."""
    resp = client.post(
        "/api/v1/screener-formula/validate",
        json={"formula": "ROCE > 22 AND PE < 25 AND Debt to Equity < 0.3"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["valid"] is True
    assert len(data["metrics_detected"]) == 3


def test_formula_api_presets(client):
    """Tests /api/v1/screener-formula/presets endpoint."""
    resp = client.get("/api/v1/screener-formula/presets")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert len(data["presets"]) >= 3


def test_formula_api_metrics(client):
    """Tests /api/v1/screener-formula/metrics endpoint."""
    resp = client.get("/api/v1/screener-formula/metrics")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert len(data["categories"]) >= 4


def test_formula_api_run(client):
    """Tests /api/v1/screener-formula/run execution against database."""
    resp = client.post(
        "/api/v1/screener-formula/run",
        json={
            "formula": "Market Cap > 1000 AND ROCE > 15",
            "page": 1,
            "limit": 10,
            "sort_by": "market_cap",
            "sort_order": "desc",
        },
    )
    assert resp.status_code == 200, f"Execution failed: {resp.text}"
    data = resp.json()
    assert data["success"] is True
    assert "total" in data
    assert "execution_time_ms" in data
    assert isinstance(data["results"], list)
    assert len(data["results"]) <= 10

    if data["results"]:
        first = data["results"][0]
        assert "symbol" in first
        assert "current_price" in first
        assert "roce" in first
        assert first["roce"] is not None
        assert float(first["roce"]) > 15.0
        assert float(first["market_cap"]) > 1000.0


def test_formula_quantitative_factors_validation():
    """Verifies that FCF Yield, RSI, Beta, 52W Proximity, and CFO/PAT parse accurately."""
    formula = (
        "FCF Yield > 3.0 AND RSI >= 50 AND Beta < 1.2 "
        "AND Distance to 52W High <= 20 AND CFO to PAT > 0.8"
    )
    res = QuantitativeFormulaService.validate_formula(formula)
    assert res["valid"] is True
    detected = set(res["metrics_detected"])
    assert "fcf yield" in detected
    assert "rsi" in detected
    assert "beta" in detected
    assert "distance to 52w high" in detected
    assert "cfo to pat" in detected


def test_formula_api_run_with_quant_factors(client):
    """Verifies live query execution filtering on FCF Yield and RSI."""
    resp = client.post(
        "/api/v1/screener-formula/run",
        json={
            "formula": "FCF Yield > 2.0 AND ROCE > 12",
            "page": 1,
            "limit": 5,
            "sort_by": "fcf_yield",
            "sort_order": "desc",
        },
    )
    assert resp.status_code == 200, f"Execution failed: {resp.text}"
    data = resp.json()
    assert data["success"] is True
    assert data["total"] > 0
    assert len(data["results"]) > 0

    first = data["results"][0]
    assert "fcf_yield" in first
    assert "rsi_14" in first
    assert "beta" in first
    assert "distance_52w_high" in first
    assert first["fcf_yield"] is not None
    assert float(first["fcf_yield"]) > 2.0

