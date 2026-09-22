"""
Alpha India - Quantitative Screener Formula Parser & AST Compiler
Compiles custom financial screening expressions (e.g.
"Sales Growth > 25 AND ROCE > 20 AND Debt to Equity < 0.5 AND Piotroski Score >= 7")
into safe, parameterized SQLAlchemy filter clauses with zero SQL injection risk.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple, Union
from sqlalchemy import and_, or_, not_
from sqlalchemy.sql.elements import BinaryExpression, ColumnElement

from app.models.screener_growth_record import ScreenerGrowthRecord

# Canonical Financial Metric Mapping
# Case-insensitive, space/underscore-insensitive mapping to model columns
METRIC_MAP: Dict[str, Any] = {
    # Growth Metrics
    "sales_growth": ScreenerGrowthRecord.quarterly_sales_yoy,
    "sales growth": ScreenerGrowthRecord.quarterly_sales_yoy,
    "quarterly_sales_yoy": ScreenerGrowthRecord.quarterly_sales_yoy,
    "quarterly sales yoy": ScreenerGrowthRecord.quarterly_sales_yoy,
    "sales yoy": ScreenerGrowthRecord.quarterly_sales_yoy,
    "profit_growth": ScreenerGrowthRecord.quarterly_pat_yoy,
    "profit growth": ScreenerGrowthRecord.quarterly_pat_yoy,
    "quarterly_pat_yoy": ScreenerGrowthRecord.quarterly_pat_yoy,
    "quarterly profit yoy": ScreenerGrowthRecord.quarterly_pat_yoy,
    "pat growth": ScreenerGrowthRecord.quarterly_pat_yoy,
    "pat growth yoy": ScreenerGrowthRecord.quarterly_pat_yoy,
    "profit yoy": ScreenerGrowthRecord.quarterly_pat_yoy,
    "sales_growth_3yr": ScreenerGrowthRecord.sales_growth_3yr,
    "sales growth 3yr": ScreenerGrowthRecord.sales_growth_3yr,
    "sales growth 3y": ScreenerGrowthRecord.sales_growth_3yr,
    "sales growth 3 year": ScreenerGrowthRecord.sales_growth_3yr,
    "profit_growth_3yr": ScreenerGrowthRecord.profit_growth_3yr,
    "profit growth 3yr": ScreenerGrowthRecord.profit_growth_3yr,
    "profit growth 3y": ScreenerGrowthRecord.profit_growth_3yr,
    "profit growth 3 year": ScreenerGrowthRecord.profit_growth_3yr,
    "sales_growth_5yr": ScreenerGrowthRecord.sales_growth_5yr,
    "profit_growth_5yr": ScreenerGrowthRecord.profit_growth_5yr,
    "quarterly_sales_qoq": ScreenerGrowthRecord.quarterly_sales_qoq,
    "quarterly_pat_qoq": ScreenerGrowthRecord.quarterly_pat_qoq,
    # Profitability & Return Ratios
    "roce": ScreenerGrowthRecord.roce,
    "roe": ScreenerGrowthRecord.roe,
    "opm": ScreenerGrowthRecord.opm_latest,
    "opm latest": ScreenerGrowthRecord.opm_latest,
    "operating profit margin": ScreenerGrowthRecord.opm_latest,
    "opm ttm": ScreenerGrowthRecord.opm_ttm,
    # Valuation Multiples
    "pe": ScreenerGrowthRecord.stock_pe,
    "p/e": ScreenerGrowthRecord.stock_pe,
    "stock pe": ScreenerGrowthRecord.stock_pe,
    "stock_pe": ScreenerGrowthRecord.stock_pe,
    "price to earning": ScreenerGrowthRecord.stock_pe,
    "industry pe": ScreenerGrowthRecord.industry_pe,
    "pb": ScreenerGrowthRecord.price_to_book,
    "p/b": ScreenerGrowthRecord.price_to_book,
    "price to book": ScreenerGrowthRecord.price_to_book,
    "price_to_book": ScreenerGrowthRecord.price_to_book,
    "book value": ScreenerGrowthRecord.book_value,
    "dividend yield": ScreenerGrowthRecord.dividend_yield,
    "peg ratio": ScreenerGrowthRecord.peg_ratio,
    "peg_ratio": ScreenerGrowthRecord.peg_ratio,
    # Scale & Pricing
    "market cap": ScreenerGrowthRecord.market_cap,
    "market_cap": ScreenerGrowthRecord.market_cap,
    "mcap": ScreenerGrowthRecord.market_cap,
    "cmp": ScreenerGrowthRecord.current_price,
    "current price": ScreenerGrowthRecord.current_price,
    "current_price": ScreenerGrowthRecord.current_price,
    "price": ScreenerGrowthRecord.current_price,
    # Financial Solvency & Quality
    "debt to equity": ScreenerGrowthRecord.debt_to_equity,
    "debt_to_equity": ScreenerGrowthRecord.debt_to_equity,
    "debt equity": ScreenerGrowthRecord.debt_to_equity,
    "d/e": ScreenerGrowthRecord.debt_to_equity,
    "interest coverage": ScreenerGrowthRecord.interest_coverage,
    "interest_coverage": ScreenerGrowthRecord.interest_coverage,
    "piotroski": ScreenerGrowthRecord.piotroski_score,
    "piotroski score": ScreenerGrowthRecord.piotroski_score,
    "piotroski_score": ScreenerGrowthRecord.piotroski_score,
    "health score": ScreenerGrowthRecord.health_score,
    "health_score": ScreenerGrowthRecord.health_score,
    "ai score": ScreenerGrowthRecord.health_score,
    "free cash flow": ScreenerGrowthRecord.free_cash_flow,
    "fcf": ScreenerGrowthRecord.free_cash_flow,
    # Ownership
    "promoter holding": ScreenerGrowthRecord.promoter_holding,
    "promoter_holding": ScreenerGrowthRecord.promoter_holding,
    "fii holding": ScreenerGrowthRecord.fii_holding,
    "fii_holding": ScreenerGrowthRecord.fii_holding,
    "dii holding": ScreenerGrowthRecord.dii_holding,
    "dii_holding": ScreenerGrowthRecord.dii_holding,
    # Moving Averages
    "dma 50": ScreenerGrowthRecord.dma_50,
    "50 dma": ScreenerGrowthRecord.dma_50,
    "dma_50": ScreenerGrowthRecord.dma_50,
    "dma 200": ScreenerGrowthRecord.dma_200,
    "200 dma": ScreenerGrowthRecord.dma_200,
    "dma_200": ScreenerGrowthRecord.dma_200,
    "return 1y": ScreenerGrowthRecord.return_1y,
    "return 6m": ScreenerGrowthRecord.return_6m,
    "return 3m": ScreenerGrowthRecord.return_3m,
    # Free Cash Flow & Cash Flow Ratios (Sprint 36.6)
    "fcf yield": ScreenerGrowthRecord.fcf_yield,
    "fcf_yield": ScreenerGrowthRecord.fcf_yield,
    "free cash flow yield": ScreenerGrowthRecord.fcf_yield,
    "free_cash_flow_yield": ScreenerGrowthRecord.fcf_yield,
    "cfo to pat": ScreenerGrowthRecord.cfo_to_pat,
    "cfo_to_pat": ScreenerGrowthRecord.cfo_to_pat,
    "cfo / pat": ScreenerGrowthRecord.cfo_to_pat,
    "cfo": ScreenerGrowthRecord.cfo_latest,
    "cfo latest": ScreenerGrowthRecord.cfo_latest,
    "cfo_latest": ScreenerGrowthRecord.cfo_latest,
    "operating cash flow": ScreenerGrowthRecord.cfo_latest,
    # Technical Momentum, Volatility & Relative Strength (Sprint 36.6)
    "rsi": ScreenerGrowthRecord.rsi_14,
    "rsi 14": ScreenerGrowthRecord.rsi_14,
    "rsi_14": ScreenerGrowthRecord.rsi_14,
    "relative strength index": ScreenerGrowthRecord.rsi_14,
    "beta": ScreenerGrowthRecord.beta,
    "market beta": ScreenerGrowthRecord.beta,
    "stock beta": ScreenerGrowthRecord.beta,
    "distance to 52w high": ScreenerGrowthRecord.distance_52w_high,
    "distance to 52 week high": ScreenerGrowthRecord.distance_52w_high,
    "distance_52w_high": ScreenerGrowthRecord.distance_52w_high,
    "52w distance": ScreenerGrowthRecord.distance_52w_high,
    "52w high distance": ScreenerGrowthRecord.distance_52w_high,
    "pct from 52w high": ScreenerGrowthRecord.distance_52w_high,
    # Working Capital & Operating Efficiency
    "cash conversion cycle": ScreenerGrowthRecord.cash_conversion_cycle,
    "cash_conversion_cycle": ScreenerGrowthRecord.cash_conversion_cycle,
    "ccc": ScreenerGrowthRecord.cash_conversion_cycle,
    "working capital days": ScreenerGrowthRecord.cash_conversion_cycle,
    "debtor days": ScreenerGrowthRecord.debtor_days,
    "debtor_days": ScreenerGrowthRecord.debtor_days,
    "inventory days": ScreenerGrowthRecord.inventory_days,
    "inventory_days": ScreenerGrowthRecord.inventory_days,
    # Balance Sheet & Solvency
    "borrowings": ScreenerGrowthRecord.borrowings,
    "total debt": ScreenerGrowthRecord.borrowings,
    "total_debt": ScreenerGrowthRecord.borrowings,
    "debt": ScreenerGrowthRecord.borrowings,
    "reserves": ScreenerGrowthRecord.reserves,
    "reserves and surplus": ScreenerGrowthRecord.reserves,
    "total assets": ScreenerGrowthRecord.total_assets,
    "total_assets": ScreenerGrowthRecord.total_assets,
    # Earnings & Compounded Growth
    "pat 12m": ScreenerGrowthRecord.pat_12m,
    "pat_12m": ScreenerGrowthRecord.pat_12m,
    "ttm profit": ScreenerGrowthRecord.pat_12m,
    "ttm pat": ScreenerGrowthRecord.pat_12m,
    "eps": ScreenerGrowthRecord.eps_12m,
    "eps 12m": ScreenerGrowthRecord.eps_12m,
    "eps_12m": ScreenerGrowthRecord.eps_12m,
    "quarterly eps yoy": ScreenerGrowthRecord.quarterly_eps_yoy,
    "quarterly_eps_yoy": ScreenerGrowthRecord.quarterly_eps_yoy,
    "sales growth 10yr": ScreenerGrowthRecord.sales_growth_10yr,
    "sales_growth_10yr": ScreenerGrowthRecord.sales_growth_10yr,
    "profit growth 10yr": ScreenerGrowthRecord.profit_growth_10yr,
    "profit_growth_10yr": ScreenerGrowthRecord.profit_growth_10yr,
    "stock cagr 3yr": ScreenerGrowthRecord.stock_cagr_3yr,
    "stock_cagr_3yr": ScreenerGrowthRecord.stock_cagr_3yr,
    "stock cagr 5yr": ScreenerGrowthRecord.stock_cagr_5yr,
    "stock_cagr_5yr": ScreenerGrowthRecord.stock_cagr_5yr,
}


@dataclass
class Token:
    type: str  # 'METRIC', 'OP', 'NUMBER', 'LOGICAL', 'LPAREN', 'RPAREN', 'EOF'
    value: Any
    pos: int


class FormulaParserError(Exception):
    def __init__(self, message: str, pos: int = 0):
        super().__init__(f"{message} at position {pos}")
        self.message = message
        self.pos = pos


class FormulaTokenizer:
    # Sorted multi-word metric keys longest first to match greedily
    _SORTED_METRICS = sorted(METRIC_MAP.keys(), key=lambda k: len(k), reverse=True)

    def __init__(self, text: str):
        self.text = text
        self.pos = 0
        self.n = len(text)

    def tokenize(self) -> List[Token]:
        tokens: List[Token] = []
        while self.pos < self.n:
            # Skip whitespace
            if self.text[self.pos].isspace():
                self.pos += 1
                continue

            start_pos = self.pos
            char = self.text[self.pos]

            # Parentheses
            if char == "(":
                tokens.append(Token("LPAREN", "(", start_pos))
                self.pos += 1
                continue
            if char == ")":
                tokens.append(Token("RPAREN", ")", start_pos))
                self.pos += 1
                continue

            # Comparison Operators: >=, <=, !=, ==, >, <, =
            if self.text[self.pos : self.pos + 2] in (">=", "<=", "!=", "=="):
                op = self.text[self.pos : self.pos + 2]
                tokens.append(Token("OP", ">=" if op == ">=" else ("<=" if op == "<=" else ("!=" if op == "!=" else "==")), start_pos))
                self.pos += 2
                continue
            if char in (">", "<", "="):
                tokens.append(Token("OP", "==" if char == "=" else char, start_pos))
                self.pos += 1
                continue

            # Numbers (integers, floats, negative numbers, percentage signs)
            # Match number: e.g. 25, 25.5, -4.2, 30%
            num_match = re.match(r"^-?\d+(\.\d+)?%?", self.text[self.pos:])
            if num_match:
                # Disambiguate with metric if current string is part of a word like '50 dma'
                raw_val = num_match.group(0)
                # Check if this could be part of a metric e.g. '50 dma'
                matched_metric = self._try_match_metric()
                if matched_metric:
                    tokens.append(Token("METRIC", matched_metric, start_pos))
                    continue

                cleaned_num = raw_val.rstrip("%")
                val = float(cleaned_num) if "." in cleaned_num else float(cleaned_num)
                tokens.append(Token("NUMBER", val, start_pos))
                self.pos += len(raw_val)
                continue

            # Check Logical Operators: AND, OR, NOT
            sub_text = self.text[self.pos:].strip()
            upper_3 = self.text[self.pos : self.pos + 3].upper()
            upper_2 = self.text[self.pos : self.pos + 2].upper()

            if upper_3 == "AND" and (self.pos + 3 == self.n or not self.text[self.pos + 3].isalnum()):
                tokens.append(Token("LOGICAL", "AND", start_pos))
                self.pos += 3
                continue
            if upper_2 == "OR" and (self.pos + 2 == self.n or not self.text[self.pos + 2].isalnum()):
                tokens.append(Token("LOGICAL", "OR", start_pos))
                self.pos += 2
                continue
            if upper_3 == "NOT" and (self.pos + 3 == self.n or not self.text[self.pos + 3].isalnum()):
                tokens.append(Token("LOGICAL", "NOT", start_pos))
                self.pos += 3
                continue

            # Check Metric Keywords
            metric_match = self._try_match_metric()
            if metric_match:
                tokens.append(Token("METRIC", metric_match, start_pos))
                continue

            # Unrecognized token error
            err_snip = self.text[self.pos : min(self.n, self.pos + 15)]
            raise FormulaParserError(f"Unrecognized keyword or token '{err_snip}'", start_pos)

        tokens.append(Token("EOF", None, self.pos))
        return tokens

    def _try_match_metric(self) -> Optional[str]:
        remaining = self.text[self.pos:].lower()
        for metric_name in self._SORTED_METRICS:
            m_len = len(metric_name)
            if remaining.startswith(metric_name):
                # Ensure word boundary after match
                if m_len == len(remaining) or not remaining[m_len].isalnum():
                    self.pos += m_len
                    return metric_name
        return None


class FormulaASTParser:
    """
    Recursive-descent parser that builds SQLAlchemy ColumnElement expressions.
    Grammar:
        Expr       := OrExpr
        OrExpr     := AndExpr ( 'OR' AndExpr )*
        AndExpr    := NotExpr ( 'AND' NotExpr )*
        NotExpr    := 'NOT' NotExpr | Primary
        Primary    := '(' Expr ')' | Condition
        Condition  := METRIC OP NUMBER
    """

    def __init__(self, tokens: List[Token]):
        self.tokens = tokens
        self.cursor = 0

    def current(self) -> Token:
        return self.tokens[self.cursor]

    def consume(self, expected_type: Optional[str] = None) -> Token:
        tok = self.current()
        if expected_type and tok.type != expected_type:
            raise FormulaParserError(
                f"Expected {expected_type}, got '{tok.value}'",
                tok.pos,
            )
        self.cursor += 1
        return tok

    def parse(self) -> ColumnElement:
        expr = self.parse_expr()
        if self.current().type != "EOF":
            tok = self.current()
            raise FormulaParserError(f"Unexpected token '{tok.value}' after complete expression", tok.pos)
        return expr

    def parse_expr(self) -> ColumnElement:
        return self.parse_or()

    def parse_or(self) -> ColumnElement:
        left = self.parse_and()
        while self.current().type == "LOGICAL" and self.current().value == "OR":
            self.consume("LOGICAL")
            right = self.parse_and()
            left = or_(left, right)
        return left

    def parse_and(self) -> ColumnElement:
        left = self.parse_not()
        while self.current().type == "LOGICAL" and self.current().value == "AND":
            self.consume("LOGICAL")
            right = self.parse_not()
            left = and_(left, right)
        return left

    def parse_not(self) -> ColumnElement:
        if self.current().type == "LOGICAL" and self.current().value == "NOT":
            self.consume("LOGICAL")
            child = self.parse_not()
            return not_(child)
        return self.parse_primary()

    def parse_primary(self) -> ColumnElement:
        tok = self.current()
        if tok.type == "LPAREN":
            self.consume("LPAREN")
            expr = self.parse_expr()
            self.consume("RPAREN")
            return expr
        elif tok.type == "METRIC":
            return self.parse_condition()
        else:
            raise FormulaParserError(f"Expected condition or '(', got '{tok.value}'", tok.pos)

    def parse_condition(self) -> ColumnElement:
        metric_tok = self.consume("METRIC")
        op_tok = self.consume("OP")
        num_tok = self.consume("NUMBER")

        column = METRIC_MAP[metric_tok.value]
        op = op_tok.value
        val = num_tok.value

        # Build parameterized SQLAlchemy binary expression
        if op == ">":
            return and_(column.isnot(None), column > val)
        elif op == ">=":
            return and_(column.isnot(None), column >= val)
        elif op == "<":
            return and_(column.isnot(None), column < val)
        elif op == "<=":
            return and_(column.isnot(None), column <= val)
        elif op in ("=", "=="):
            return and_(column.isnot(None), column == val)
        elif op == "!=":
            return and_(column.isnot(None), column != val)
        else:
            raise FormulaParserError(f"Unsupported comparison operator '{op}'", op_tok.pos)


class QuantitativeFormulaService:
    """
    High-level service interface for validating and executing custom screener formulas.
    """

    @classmethod
    def validate_formula(cls, formula: str) -> Dict[str, Any]:
        """Validates syntax and returns extracted metrics and AST verification."""
        clean = formula.strip()
        if not clean:
            return {"valid": False, "error": "Formula cannot be empty."}

        try:
            tokenizer = FormulaTokenizer(clean)
            tokens = tokenizer.tokenize()
            parser = FormulaASTParser(tokens)
            _ = parser.parse()

            metrics_detected = list({t.value for t in tokens if t.type == "METRIC"})
            return {
                "valid": True,
                "formula": clean,
                "metrics_detected": metrics_detected,
                "token_count": len(tokens) - 1,
                "message": "Formula syntax is valid and verified against warehouse columns.",
            }
        except FormulaParserError as e:
            return {
                "valid": False,
                "error": e.message,
                "position": e.pos,
            }
        except Exception as ex:
            return {
                "valid": False,
                "error": f"Syntax error: {str(ex)}",
            }

    @classmethod
    def compile_filter(cls, formula: str) -> Optional[ColumnElement]:
        """Compiles formula string into an executable SQLAlchemy boolean expression."""
        clean = formula.strip()
        if not clean:
            return None

        tokenizer = FormulaTokenizer(clean)
        tokens = tokenizer.tokenize()
        parser = FormulaASTParser(tokens)
        return parser.parse()

    @classmethod
    def get_presets(cls) -> List[Dict[str, Any]]:
        """Returns standard institutional preset screening strategies."""
        return [
            {
                "id": "coffee_can",
                "title": "Coffee Can Compounders",
                "badge": "High Quality",
                "description": "Clean balance sheet leaders with >20% ROCE, low leverage, and consistent double-digit growth.",
                "formula": "ROCE > 20 AND ROE > 18 AND Debt to Equity < 0.5 AND Sales Growth > 15",
            },
            {
                "id": "high_growth_breakout",
                "title": "High-Velocity Earnings Acceleration",
                "badge": "Growth Leader",
                "description": "Companies exhibiting >30% top-line and >35% bottom-line quarterly acceleration with fat operating margins.",
                "formula": "Quarterly Sales YoY > 30 AND Quarterly Profit YoY > 35 AND OPM > 18",
            },
            {
                "id": "piotroski_elite",
                "title": "Piotroski Quality Compounders",
                "badge": "Forensic Elite",
                "description": "Top-decile Piotroski F-Score (8-9), virtually debt-free with high capital efficiency.",
                "formula": "Piotroski Score >= 8 AND Debt to Equity < 0.3 AND ROCE > 15",
            },
            {
                "id": "deep_value_safety",
                "title": "Benjamin Graham Deep Value Margin",
                "badge": "Deep Value",
                "description": "Undervalued equities with P/E < 18, low P/B, and positive operational profitability.",
                "formula": "PE < 18 AND PB < 2.5 AND ROCE > 14 AND Debt to Equity < 0.8",
            },
            {
                "id": "promoter_skin_in_game",
                "title": "Promoter Skin-in-the-Game Compounders",
                "badge": "Ownership Conviction",
                "description": "High promoter ownership (>65%) combined with high return on capital and zero pledge.",
                "formula": "Promoter Holding > 65 AND ROCE > 22 AND Debt to Equity < 0.2",
            },
            {
                "id": "cash_cow_compounders",
                "title": "Cash Cow Compounders (High FCF Yield)",
                "badge": "Cash Engine",
                "description": "High FCF yield (>3.5%) with robust ROCE, minimal leverage, and cash-backed earnings quality.",
                "formula": "FCF Yield > 3.5 AND ROCE > 20 AND Debt to Equity < 0.4 AND CFO to PAT > 0.9",
            },
            {
                "id": "minervini_prebreakout",
                "title": "Minervini Pre-Breakout Radar",
                "badge": "Momentum Radar",
                "description": "Coiling tightly within 15% of 52W high with bullish RSI(14) momentum and top-line expansion.",
                "formula": "RSI >= 55 AND RSI <= 70 AND Distance to 52W High <= 15 AND Sales Growth > 15",
            },
            {
                "id": "low_beta_quality",
                "title": "Low-Beta Institutional Defense",
                "badge": "Low Volatility",
                "description": "Low market beta (<0.9) with high capital efficiency, forensic quality (Piotroski >= 7), and zero debt.",
                "formula": "Beta < 0.9 AND ROCE > 18 AND Debt to Equity < 0.3 AND Piotroski Score >= 7",
            },
            {
                "id": "working_capital_masters",
                "title": "Working Capital & Cash Flow Masters",
                "badge": "Operating Lean",
                "description": "Ultra-efficient working capital (Cash Conversion Cycle < 60 days) driving high profit growth.",
                "formula": "Cash Conversion Cycle < 60 AND ROCE > 15 AND Profit Growth > 20",
            },
        ]
