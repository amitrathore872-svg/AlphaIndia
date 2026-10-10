"""
Alpha India - Position Sizing Architecture
Sprint 43.1 Capital Allocation & Risk Management Engine

Supports:
1. FIXED_QUANTITY: Constant number of shares
2. FIXED_CAPITAL: Constant rupee allocation per trade
3. RISK_BASED: Fixed capital risk / (entry - stop), with max position value cap
"""

from __future__ import annotations

import math
from typing import Any, Dict


class PositionSizer:
    """
    Computes executed share quantity based on risk parameters and portfolio capital.
    """

    @classmethod
    def calculate_position(
        self,
        sizing_model: str,
        capital: float,
        entry_price: float,
        stop_price: Optional[float] = None,
        risk_per_trade_pct: float = 1.0,  # 1% of capital
        fixed_qty: int = 100,
        fixed_allocation_inr: float = 100000.0,
        max_position_value_pct: float = 25.0,  # Max 25% of total capital in 1 stock
    ) -> Dict[str, Any]:
        if entry_price <= 0:
            return {"shares": 0, "position_value": 0.0, "risk_amount": 0.0}

        model = sizing_model.upper().strip()
        max_position_val = capital * (max_position_value_pct / 100.0)

        if model == "FIXED_QUANTITY":
            shares = max(1, fixed_qty)
            pos_val = shares * entry_price
            if pos_val > max_position_val:
                shares = max(1, int(max_position_val / entry_price))
                pos_val = shares * entry_price
            risk_amt = shares * abs(entry_price - (stop_price or (entry_price * 0.99)))

        elif model == "FIXED_CAPITAL":
            target_val = min(fixed_allocation_inr, max_position_val)
            shares = max(1, int(target_val / entry_price))
            pos_val = shares * entry_price
            risk_amt = shares * abs(entry_price - (stop_price or (entry_price * 0.99)))

        else:  # RISK_BASED (Default)
            risk_budget = capital * (risk_per_trade_pct / 100.0)
            if stop_price and stop_price < entry_price:
                risk_per_share = entry_price - stop_price
            else:
                risk_per_share = entry_price * 0.01  # Default 1% risk distance

            ideal_shares = math.floor(risk_budget / max(0.5, risk_per_share))
            # Cap by max position value
            capped_shares = math.floor(max_position_val / entry_price)
            shares = max(1, min(ideal_shares, capped_shares))
            pos_val = shares * entry_price
            risk_amt = shares * risk_per_share

        return {
            "shares": int(shares),
            "position_value": round(pos_val, 2),
            "risk_amount": round(risk_amt, 2),
        }
