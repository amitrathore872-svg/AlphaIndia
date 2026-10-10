"""
Alpha India - Indian Equity Transaction Cost Model
Sprint 43.1 Forensic Friction & Tax Architecture

Computes regulatory fees and slippage according to Indian market norms:
- Brokerage: Default ₹20 / executed order (or percentage-based cap)
- STT (Securities Transaction Tax): 0.025% on intraday Sell turnover
- Exchange Turnover Charges: 0.00345% (NSE Cash)
- GST: 18% on (Brokerage + Exchange Turnover)
- SEBI Charges: 0.0001% (₹10 per crore)
- Stamp Duty: 0.003% on Buy turnover
- Slippage: Configurable % (default 0.05% per execution leg)
Distinguishes Gross P&L from Net P&L.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict


@dataclass
class CostBreakdown:
    brokerage: float = 0.0
    stt: float = 0.0
    exchange_turnover: float = 0.0
    gst: float = 0.0
    sebi_charges: float = 0.0
    stamp_duty: float = 0.0
    slippage_cost: float = 0.0
    total_friction: float = 0.0

    def to_dict(self) -> Dict[str, float]:
        return {
            "brokerage": round(self.brokerage, 2),
            "stt": round(self.stt, 2),
            "exchange_turnover": round(self.exchange_turnover, 2),
            "gst": round(self.gst, 2),
            "sebi_charges": round(self.sebi_charges, 2),
            "stamp_duty": round(self.stamp_duty, 2),
            "slippage_cost": round(self.slippage_cost, 2),
            "total_friction": round(self.total_friction, 2),
        }


class TransactionCostModel:
    """
    Forensic transaction cost and regulatory friction model.
    """

    def __init__(
        self,
        brokerage_per_order: float = 20.0,
        slippage_pct: float = 0.05,
        stt_pct: float = 0.025,
        exchange_turnover_pct: float = 0.00345,
        gst_pct: float = 18.0,
        sebi_charges_pct: float = 0.0001,
        stamp_duty_pct: float = 0.003,
    ):
        self.brokerage_per_order = brokerage_per_order
        self.slippage_pct = slippage_pct
        self.stt_pct = stt_pct
        self.exchange_turnover_pct = exchange_turnover_pct
        self.gst_pct = gst_pct
        self.sebi_charges_pct = sebi_charges_pct
        self.stamp_duty_pct = stamp_duty_pct

    def calculate_round_trip_costs(
        self,
        entry_price: float,
        exit_price: float,
        shares: int,
    ) -> CostBreakdown:
        if shares <= 0:
            return CostBreakdown()

        buy_val = entry_price * shares
        sell_val = exit_price * shares
        total_turnover = buy_val + sell_val

        # 1. Brokerage (₹20 buy + ₹20 sell)
        brokerage = self.brokerage_per_order * 2.0

        # 2. STT (0.025% on intraday Sell turnover)
        stt = sell_val * (self.stt_pct / 100.0)

        # 3. Exchange Turnover Charge (0.00345% on total turnover)
        exch_turnover = total_turnover * (self.exchange_turnover_pct / 100.0)

        # 4. GST (18% on Brokerage + Exchange Turnover)
        gst = (brokerage + exch_turnover) * (self.gst_pct / 100.0)

        # 5. SEBI Charges (0.0001% on total turnover)
        sebi = total_turnover * (self.sebi_charges_pct / 100.0)

        # 6. Stamp Duty (0.003% on Buy turnover)
        stamp = buy_val * (self.stamp_duty_pct / 100.0)

        # 7. Slippage (Configurable %, e.g., 0.05% on both legs)
        slippage = total_turnover * (self.slippage_pct / 100.0)

        total = brokerage + stt + exch_turnover + gst + sebi + stamp + slippage

        return CostBreakdown(
            brokerage=brokerage,
            stt=stt,
            exchange_turnover=exch_turnover,
            gst=gst,
            sebi_charges=sebi,
            stamp_duty=stamp,
            slippage_cost=slippage,
            total_friction=total,
        )
