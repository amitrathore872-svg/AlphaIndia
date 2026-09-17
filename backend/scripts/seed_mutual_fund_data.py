"""
Comprehensive Seed Script for Mutual Fund Intelligence Engine
Alpha India - Institutional Smart Money Radar
Expanded to Full Universe (32+ Schemes, 16 AMCs, and 800+ Categorized Equities)
"""

import sys
import os
import random
from datetime import date
from sqlalchemy import func

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.database import SessionLocal
from app.models.company import Company
from app.models.screener_growth_record import ScreenerGrowthRecord
from app.models.mf_models import (
    MFScheme,
    MFSchemeHolding,
    MFStockMonthlyAggregate,
    MFSectorFlow,
    MFAccumulationSignal,
)
from app.services.mf_analytics_service import MFAnalyticsService
from app.services.mf_signal_service import MFSignalService

# 32 Flagship Schemes across 16 leading AMCs
SCHEMES_MASTER = [
    # 1. HDFC Mutual Fund
    {"code": "HDFC_TOP100", "name": "HDFC Top 100 Fund", "amc": "HDFC Mutual Fund", "category": "Large Cap Fund", "is_active_alpha": True, "manager": "Rahul Baijal", "aum": 35400.0},
    {"code": "HDFC_FLEXI", "name": "HDFC Flexi Cap Fund", "amc": "HDFC Mutual Fund", "category": "Flexi Cap Fund", "is_active_alpha": True, "manager": "Roshi Jain", "aum": 59800.0},
    {"code": "HDFC_MIDCAP", "name": "HDFC Mid-Cap Opportunities Fund", "amc": "HDFC Mutual Fund", "category": "Mid Cap Fund", "is_active_alpha": True, "manager": "Chirag Setalvad", "aum": 68200.0},
    {"code": "HDFC_SMALLCAP", "name": "HDFC Small Cap Fund", "amc": "HDFC Mutual Fund", "category": "Small Cap Fund", "is_active_alpha": True, "manager": "Chirag Setalvad", "aum": 32500.0},

    # 2. ICICI Prudential Mutual Fund
    {"code": "ICICI_BLUECHIP", "name": "ICICI Pru Bluechip Fund", "amc": "ICICI Prudential Mutual Fund", "category": "Large Cap Fund", "is_active_alpha": True, "manager": "Anish Tawakley", "aum": 56100.0},
    {"code": "ICICI_MULTI_ASSET", "name": "ICICI Prudential Multi-Asset Fund", "amc": "ICICI Prudential Mutual Fund", "category": "Multi Asset Allocation", "is_active_alpha": True, "manager": "Sankaran Naren", "aum": 48200.0},
    {"code": "ICICI_LARGE_MID", "name": "ICICI Pru Large & Mid Cap Fund", "amc": "ICICI Prudential Mutual Fund", "category": "Large & Mid Cap Fund", "is_active_alpha": True, "manager": "Ihab Dalwai", "aum": 15400.0},
    {"code": "ICICI_SMALLCAP", "name": "ICICI Pru Smallcap Fund", "amc": "ICICI Prudential Mutual Fund", "category": "Small Cap Fund", "is_active_alpha": True, "manager": "Sharmila D'mello", "aum": 9200.0},

    # 3. SBI Mutual Fund
    {"code": "SBI_BLUECHIP", "name": "SBI Bluechip Fund", "amc": "SBI Mutual Fund", "category": "Large Cap Fund", "is_active_alpha": True, "manager": "Sohini Andani", "aum": 47800.0},
    {"code": "SBI_FOCUSED", "name": "SBI Focused Equity Fund", "amc": "SBI Mutual Fund", "category": "Flexi Cap Fund", "is_active_alpha": True, "manager": "Rama Iyer Srinivasan", "aum": 33600.0},
    {"code": "SBI_MAGNUM_MID", "name": "SBI Magnum Midcap Fund", "amc": "SBI Mutual Fund", "category": "Mid Cap Fund", "is_active_alpha": True, "manager": "Bhavin Vithlani", "aum": 19400.0},
    {"code": "SBI_SMALLCAP", "name": "SBI Small Cap Fund", "amc": "SBI Mutual Fund", "category": "Small Cap Fund", "is_active_alpha": True, "manager": "R. Srinivasan", "aum": 31200.0},

    # 4. Nippon India Mutual Fund
    {"code": "NIPPON_LARGECAP", "name": "Nippon India Large Cap Fund", "amc": "Nippon India Mutual Fund", "category": "Large Cap Fund", "is_active_alpha": True, "manager": "Sailesh Raj Bhan", "aum": 29800.0},
    {"code": "NIPPON_GROWTH", "name": "Nippon India Growth Fund", "amc": "Nippon India Mutual Fund", "category": "Mid Cap Fund", "is_active_alpha": True, "manager": "Rupesh Patel", "aum": 31500.0},
    {"code": "NIPPON_SMALLCAP", "name": "Nippon India Small Cap Fund", "amc": "Nippon India Mutual Fund", "category": "Small Cap Fund", "is_active_alpha": True, "manager": "Samir Rachh", "aum": 58400.0},

    # 5. Kotak Mahindra Mutual Fund
    {"code": "KOTAK_BLUECHIP", "name": "Kotak Bluechip Fund", "amc": "Kotak Mahindra Mutual Fund", "category": "Large Cap Fund", "is_active_alpha": True, "manager": "Harish Krishnan", "aum": 9100.0},
    {"code": "KOTAK_FLEXI", "name": "Kotak Flexicap Fund", "amc": "Kotak Mahindra Mutual Fund", "category": "Flexi Cap Fund", "is_active_alpha": True, "manager": "Harsha Upadhyaya", "aum": 49600.0},
    {"code": "KOTAK_EMERGING", "name": "Kotak Emerging Equity Fund", "amc": "Kotak Mahindra Mutual Fund", "category": "Mid Cap Fund", "is_active_alpha": True, "manager": "Pankaj Tibrewal", "aum": 48900.0},
    {"code": "KOTAK_SMALLCAP", "name": "Kotak Small Cap Fund", "amc": "Kotak Mahindra Mutual Fund", "category": "Small Cap Fund", "is_active_alpha": True, "manager": "Pankaj Tibrewal", "aum": 16800.0},

    # 6. PPFAS Mutual Fund
    {"code": "PPFAS_FLEXI", "name": "Parag Parikh Flexi Cap Fund", "amc": "PPFAS Mutual Fund", "category": "Flexi Cap Fund", "is_active_alpha": True, "manager": "Rajeev Thakkar", "aum": 72400.0},

    # 7. Mirae Asset Mutual Fund
    {"code": "MIRAE_LARGECAP", "name": "Mirae Asset Large Cap Fund", "amc": "Mirae Asset Mutual Fund", "category": "Large Cap Fund", "is_active_alpha": True, "manager": "Gaurav Misra", "aum": 39200.0},
    {"code": "MIRAE_LARGE_MID", "name": "Mirae Asset Large & Midcap Fund", "amc": "Mirae Asset Mutual Fund", "category": "Large & Mid Cap Fund", "is_active_alpha": True, "manager": "Neelesh Surana", "aum": 40100.0},
    {"code": "MIRAE_MIDCAP", "name": "Mirae Asset Midcap Fund", "amc": "Mirae Asset Mutual Fund", "category": "Mid Cap Fund", "is_active_alpha": True, "manager": "Ankit Jain", "aum": 16300.0},

    # 8. Quant Mutual Fund
    {"code": "QUANT_ACTIVE", "name": "Quant Active Fund", "amc": "Quant Mutual Fund", "category": "Multi Cap Fund", "is_active_alpha": True, "manager": "Sandeep Tandon", "aum": 11400.0},
    {"code": "QUANT_MIDCAP", "name": "Quant Mid Cap Fund", "amc": "Quant Mutual Fund", "category": "Mid Cap Fund", "is_active_alpha": True, "manager": "Sanjeev Sharma", "aum": 9800.0},
    {"code": "QUANT_SMALLCAP", "name": "Quant Small Cap Fund", "amc": "Quant Mutual Fund", "category": "Small Cap Fund", "is_active_alpha": True, "manager": "Sanjeev Sharma", "aum": 23600.0},

    # 9. Motilal Oswal Mutual Fund
    {"code": "MOTILAL_FLEXI", "name": "Motilal Oswal Flexi Cap Fund", "amc": "Motilal Oswal Mutual Fund", "category": "Flexi Cap Fund", "is_active_alpha": True, "manager": "Niket Shah", "aum": 11800.0},
    {"code": "MOTILAL_MIDCAP", "name": "Motilal Oswal Midcap Fund", "amc": "Motilal Oswal Mutual Fund", "category": "Mid Cap Fund", "is_active_alpha": True, "manager": "Niket Shah", "aum": 16900.0},

    # 10. Axis Mutual Fund
    {"code": "AXIS_BLUECHIP", "name": "Axis Bluechip Fund", "amc": "Axis Mutual Fund", "category": "Large Cap Fund", "is_active_alpha": True, "manager": "Shreyash Devalkar", "aum": 31500.0},
    {"code": "AXIS_MIDCAP", "name": "Axis Midcap Fund", "amc": "Axis Mutual Fund", "category": "Mid Cap Fund", "is_active_alpha": True, "manager": "Shreyash Devalkar", "aum": 26400.0},
    {"code": "AXIS_SMALLCAP", "name": "Axis Small Cap Fund", "amc": "Axis Mutual Fund", "category": "Small Cap Fund", "is_active_alpha": True, "manager": "Mayank Hyanki", "aum": 21500.0},

    # 11. DSP Mutual Fund
    {"code": "DSP_MIDCAP", "name": "DSP Midcap Fund", "amc": "DSP Mutual Fund", "category": "Mid Cap Fund", "is_active_alpha": True, "manager": "Vinit Sambre", "aum": 18200.0},
    {"code": "DSP_SMALLCAP", "name": "DSP Small Cap Fund", "amc": "DSP Mutual Fund", "category": "Small Cap Fund", "is_active_alpha": True, "manager": "Vinit Sambre", "aum": 15900.0},

    # 12. Bandhan Mutual Fund
    {"code": "BANDHAN_SMALLCAP", "name": "Bandhan Small Cap Fund", "amc": "Bandhan Mutual Fund", "category": "Small Cap Fund", "is_active_alpha": True, "manager": "Manish Gunwani", "aum": 5800.0},

    # 13. Tata Mutual Fund
    {"code": "TATA_SMALLCAP", "name": "Tata Small Cap Fund", "amc": "Tata Mutual Fund", "category": "Small Cap Fund", "is_active_alpha": True, "manager": "Chandraprakash Padiyar", "aum": 8600.0},

    # 14. UTI Mutual Fund
    {"code": "UTI_FLEXICAP", "name": "UTI Flexi Cap Fund", "amc": "UTI Mutual Fund", "category": "Flexi Cap Fund", "is_active_alpha": True, "manager": "Ajay Tyagi", "aum": 17200.0},
]

MONTH_DATES = [
    date(2024, 3, 31),
    date(2024, 4, 30),
    date(2024, 5, 31),
    date(2024, 6, 30),
    date(2024, 7, 31),
    date(2024, 8, 31),
]


def seed_mutual_fund_intelligence():
    random.seed(42)
    db = SessionLocal()
    print("=" * 70)
    print("STARTING FULL-UNIVERSE MUTUAL FUND INTELLIGENCE SEEDING")
    print("=" * 70)

    try:
        # -------------------------------------------------------------
        # 1. Seed or Update 32 Flagship Schemes across 16 AMCs
        # -------------------------------------------------------------
        schemes_by_code = {}
        for s_data in SCHEMES_MASTER:
            scheme = db.query(MFScheme).filter(MFScheme.scheme_code == s_data["code"]).first()
            if not scheme:
                scheme = MFScheme(
                    scheme_code=s_data["code"],
                    scheme_name=s_data["name"],
                    amc_name=s_data["amc"],
                    category=s_data["category"],
                    is_active_alpha=s_data["is_active_alpha"],
                    fund_manager_name=s_data["manager"],
                    aum_cr=s_data["aum"],
                )
                db.add(scheme)
                db.commit()
                db.refresh(scheme)
            else:
                scheme.scheme_name = s_data["name"]
                scheme.amc_name = s_data["amc"]
                scheme.category = s_data["category"]
                scheme.fund_manager_name = s_data["manager"]
                scheme.aum_cr = s_data["aum"]
                db.commit()
            schemes_by_code[s_data["code"]] = scheme

        all_schemes = list(schemes_by_code.values())
        print(f"[1/5] Registered & Verified {len(all_schemes)} Mutual Fund Schemes across 16 AMCs.")

        # Group schemes by mandate for targeted stock allocation
        large_schemes = [s for s in all_schemes if "Large" in s.category]
        flexi_schemes = [s for s in all_schemes if "Flexi" in s.category or "Multi" in s.category]
        mid_schemes = [s for s in all_schemes if "Mid" in s.category]
        small_schemes = [s for s in all_schemes if "Small" in s.category]

        # -------------------------------------------------------------
        # 2. Sync Market Cap Categories across Companies from Screener
        # -------------------------------------------------------------
        screener_records = db.query(ScreenerGrowthRecord).all()
        screener_by_symbol = {s.symbol.upper(): s for s in screener_records}
        print(f"[2/5] Found {len(screener_by_symbol)} Screener growth records for company enrichment.")

        companies = db.query(Company).all()
        updated_companies_count = 0

        for comp in companies:
            sym = comp.symbol.upper()
            scr = screener_by_symbol.get(sym)
            if scr:
                # Assign category
                if scr.market_cap_category in ["LARGE", "MID", "SMALL", "MICRO"]:
                    comp.market_cap_category = scr.market_cap_category
                else:
                    mcap = scr.market_cap or 0.0
                    if mcap >= 20000:
                        comp.market_cap_category = "LARGE"
                    elif mcap >= 5000:
                        comp.market_cap_category = "MID"
                    elif mcap >= 1000:
                        comp.market_cap_category = "SMALL"
                    else:
                        comp.market_cap_category = "MICRO"

                # Update numeric market cap & sector if needed
                if scr.market_cap:
                    comp.market_cap = str(round(scr.market_cap, 2))
                if scr.sector and (comp.sector == "Unknown" or not comp.sector):
                    comp.sector = scr.sector
                if scr.industry and (comp.industry == "Unknown" or not comp.industry):
                    comp.industry = scr.industry
                updated_companies_count += 1
            else:
                # If numeric market cap exists on Company
                if comp.market_cap and comp.market_cap != "Unknown":
                    try:
                        mcap_val = float(str(comp.market_cap).replace("Cr", "").strip())
                        if mcap_val >= 20000:
                            comp.market_cap_category = "LARGE"
                        elif mcap_val >= 5000:
                            comp.market_cap_category = "MID"
                        elif mcap_val >= 1000:
                            comp.market_cap_category = "SMALL"
                        else:
                            comp.market_cap_category = "MICRO"
                        updated_companies_count += 1
                    except (ValueError, TypeError):
                        pass

        db.commit()
        print(f"      Enriched and categorized {updated_companies_count} companies with Market Cap Tiers.")

        # -------------------------------------------------------------
        # 3. Select Full Universe of Equities to Seed Holdings
        # -------------------------------------------------------------
        # Filter companies with categorized tiers and known sectors
        large_comps = db.query(Company).filter(Company.market_cap_category == "LARGE").all()
        mid_comps = db.query(Company).filter(Company.market_cap_category == "MID").all()
        small_comps = db.query(Company).filter(Company.market_cap_category == "SMALL").limit(300).all()
        micro_comps = db.query(Company).filter(Company.market_cap_category == "MICRO").limit(100).all()

        universe_companies = large_comps + mid_comps + small_comps + micro_comps
        print(f"[3/5] Target Seeding Universe: {len(universe_companies)} Equities")
        print(f"      - Large Cap: {len(large_comps)}")
        print(f"      - Mid Cap:   {len(mid_comps)}")
        print(f"      - Small Cap: {len(small_comps)}")
        print(f"      - Micro Cap: {len(micro_comps)}")

        # -------------------------------------------------------------
        # 4. Generate High-Density Monthly Holdings & MoM Trends
        # -------------------------------------------------------------
        # Fresh entries bucket for latest month: we pick ~50 stocks across all 4 tiers
        fresh_entry_stocks = set(
            random.sample(large_comps, min(8, len(large_comps))) +
            random.sample(mid_comps, min(14, len(mid_comps))) +
            random.sample(small_comps, min(20, len(small_comps))) +
            random.sample(micro_comps, min(10, len(micro_comps)))
        )

        total_holdings_created = 0
        total_aggregates_created = 0
        latest_report_date = MONTH_DATES[-1]

        for c_idx, comp in enumerate(universe_companies):
            cat = comp.market_cap_category
            scr = screener_by_symbol.get(comp.symbol.upper())

            # Determine baseline price & market cap
            if scr and scr.current_price and scr.current_price > 0:
                base_price = scr.current_price
            else:
                base_price = 450.0 + (hash(comp.symbol) % 3500)

            if scr and scr.market_cap and scr.market_cap > 0:
                mcap_cr = scr.market_cap
            else:
                mcap_cr = 25000.0 if cat == "LARGE" else (8000.0 if cat == "MID" else (2500.0 if cat == "SMALL" else 650.0))

            # Select compatible schemes based on category mandate
            if cat == "LARGE":
                eligible_schemes = large_schemes + flexi_schemes[:4]
                scheme_count = min(len(eligible_schemes), random.randint(5, 10))
            elif cat == "MID":
                eligible_schemes = mid_schemes + flexi_schemes[2:6] + large_schemes[:2]
                scheme_count = min(len(eligible_schemes), random.randint(4, 8))
            elif cat == "SMALL":
                eligible_schemes = small_schemes + mid_schemes[:3] + flexi_schemes[:2]
                scheme_count = min(len(eligible_schemes), random.randint(3, 7))
            else:  # MICRO
                eligible_schemes = small_schemes + flexi_schemes[:2]
                scheme_count = min(len(eligible_schemes), random.randint(2, 4))

            chosen_schemes = random.sample(eligible_schemes, scheme_count)

            # Base pool of shares held by institutions
            total_equity_shares = int((mcap_cr * 10000000.0) / max(base_price, 1.0))
            institutional_ownership_pct = (
                random.uniform(14.0, 32.0) if cat == "LARGE"
                else (random.uniform(9.0, 24.0) if cat == "MID"
                else (random.uniform(4.0, 16.0) if cat == "SMALL"
                else random.uniform(1.5, 8.0)))
            )
            base_inst_shares = int(total_equity_shares * (institutional_ownership_pct / 100.0))

            is_stealth = (cat in ["MID", "SMALL", "MICRO"]) and (hash(comp.symbol) % 7 == 0)
            is_consensus = (cat in ["LARGE", "MID"]) and (hash(comp.symbol) % 5 == 0)

            # Month-by-month evolution
            prev_total_shares = 0

            for m_idx, report_date in enumerate(MONTH_DATES):
                # Monthly price fluctuation
                price_trend = 1.0 + ((m_idx - 2) * 0.02) + ((hash(comp.symbol + str(m_idx)) % 10 - 5) * 0.01)
                cur_price = round(max(5.0, base_price * price_trend), 2)

                # Institutional growth factor
                inst_factor = 1.0 + (m_idx * 0.04) if is_stealth or is_consensus else 1.0 + ((m_idx - 2) * 0.015)
                cur_inst_shares = int(base_inst_shares * inst_factor)

                month_total_shares = 0
                month_total_value_cr = 0.0
                active_alpha_count = 0

                for s_idx, scheme in enumerate(chosen_schemes):
                    # Distribute shares among chosen schemes
                    portion = (1.0 / len(chosen_schemes)) * (0.8 + (s_idx * 0.05))
                    scheme_shares = int(cur_inst_shares * portion)
                    val_cr = round((scheme_shares * cur_price) / 10000000.0, 2)
                    weight_pct = round((val_cr / max(scheme.aum_cr, 100.0)) * 100.0, 2)

                    # Determine holding status
                    is_new_entry_here = (
                        m_idx == len(MONTH_DATES) - 1 and
                        comp in fresh_entry_stocks and
                        s_idx == 0
                    )

                    if is_new_entry_here:
                        status = "NEW_ENTRY"
                        prev_shares = 0
                        mom_pct = 100.0
                    elif m_idx == 0:
                        prev_shares = int(scheme_shares * 0.95)
                        mom_pct = 5.0
                        status = "HOLD"
                    else:
                        # MoM variation
                        change_rate = (hash(f"{comp.symbol}_{scheme.scheme_code}_{m_idx}") % 30 - 12) / 100.0
                        prev_shares = max(1, int(scheme_shares / (1.0 + change_rate)))
                        mom_pct = round(((scheme_shares - prev_shares) / prev_shares) * 100.0, 1)

                        if mom_pct >= 25.0:
                            status = "AGGRESSIVE_ADD"
                        elif mom_pct >= 5.0:
                            status = "ADD"
                        elif mom_pct <= -25.0:
                            status = "HEAVY_TRIM"
                        elif mom_pct <= -5.0:
                            status = "TRIMMED"
                        else:
                            status = "HOLD"

                    month_total_shares += scheme_shares
                    month_total_value_cr += val_cr
                    if scheme.is_active_alpha:
                        active_alpha_count += 1

                    # Upsert holding
                    holding = (
                        db.query(MFSchemeHolding)
                        .filter(
                            MFSchemeHolding.scheme_id == scheme.id,
                            MFSchemeHolding.company_id == comp.id,
                            MFSchemeHolding.report_date == report_date,
                        )
                        .first()
                    )
                    if not holding:
                        holding = MFSchemeHolding(
                            scheme_id=scheme.id,
                            company_id=comp.id,
                            report_date=report_date,
                            shares_held=scheme_shares,
                            market_value_cr=val_cr,
                            weight_pct=weight_pct,
                            prev_shares_held=prev_shares,
                            mom_shares_change_pct=mom_pct,
                            holding_status=status,
                        )
                        db.add(holding)
                    else:
                        holding.shares_held = scheme_shares
                        holding.market_value_cr = val_cr
                        holding.weight_pct = weight_pct
                        holding.prev_shares_held = prev_shares
                        holding.mom_shares_change_pct = mom_pct
                        holding.holding_status = status

                    total_holdings_created += 1

                # Calculate Aggregate for this month
                net_shares_delta = month_total_shares - prev_total_shares if prev_total_shares > 0 else int(month_total_shares * 0.08)
                net_val_delta = round((net_shares_delta * cur_price) / 10000000.0, 2)
                prev_total_shares = month_total_shares

                float_abs = round(abs(net_shares_delta) / max(total_equity_shares * 0.5, 1) * 100.0, 2)
                eq_pct = round((month_total_shares / max(total_equity_shares, 1)) * 100.0, 2)
                free_float_pct = round(eq_pct * 2.1, 2)

                # Smart Money Score (0 to 100)
                base_score = 75.0 if is_consensus else (70.0 if is_stealth else 58.0)
                score = round(min(98.0, max(35.0, base_score + (m_idx * 2.5) + (float_abs * 2.0))), 1)

                agg = (
                    db.query(MFStockMonthlyAggregate)
                    .filter(
                        MFStockMonthlyAggregate.company_id == comp.id,
                        MFStockMonthlyAggregate.report_date == report_date,
                    )
                    .first()
                )
                if not agg:
                    agg = MFStockMonthlyAggregate(
                        company_id=comp.id,
                        report_date=report_date,
                        total_schemes_holding=len(chosen_schemes),
                        active_alpha_schemes_holding=active_alpha_count,
                        total_shares_held=month_total_shares,
                        total_value_cr=round(month_total_value_cr, 2),
                        pct_of_equity=eq_pct,
                        pct_of_free_float=free_float_pct,
                        net_shares_flow_mom=net_shares_delta,
                        net_value_flow_mom_cr=net_val_delta,
                        smart_money_score=score,
                        float_absorption_pct=float_abs,
                        star_manager_count=3 if is_consensus else (2 if is_stealth else 1),
                        is_stealth_accumulation=is_stealth,
                        is_consensus_bet=is_consensus,
                    )
                    db.add(agg)
                else:
                    agg.total_schemes_holding = len(chosen_schemes)
                    agg.active_alpha_schemes_holding = active_alpha_count
                    agg.total_shares_held = month_total_shares
                    agg.total_value_cr = round(month_total_value_cr, 2)
                    agg.pct_of_equity = eq_pct
                    agg.pct_of_free_float = free_float_pct
                    agg.net_shares_flow_mom = net_shares_delta
                    agg.net_value_flow_mom_cr = net_val_delta
                    agg.smart_money_score = score
                    agg.float_absorption_pct = float_abs
                    agg.is_stealth_accumulation = is_stealth
                    agg.is_consensus_bet = is_consensus

                total_aggregates_created += 1

                # Generate signals for latest month
                if m_idx == len(MONTH_DATES) - 1 and (score >= 75.0 or comp in fresh_entry_stocks):
                    MFSignalService.evaluate_and_generate_signal(db, comp.id, report_date, cur_price)

            if (c_idx + 1) % 100 == 0 or (c_idx + 1) == len(universe_companies):
                db.commit()
                print(f"      Processed {c_idx + 1}/{len(universe_companies)} companies...")

        db.commit()
        print(f"[4/5] Successfully generated {total_holdings_created} holdings records and {total_aggregates_created} monthly aggregates.")

        # -------------------------------------------------------------
        # 5. Seed Sector Flows
        # -------------------------------------------------------------
        sectors_data = [
            {"sector": "Electronics EMS", "inflow": 6410.0, "prev": 6210.0, "delta": 3.2, "trend": "UP", "top_add": "DIXON", "top_trim": "PGEL"},
            {"sector": "Capital Goods", "inflow": 5880.0, "prev": 5620.0, "delta": 4.6, "trend": "UP", "top_add": "ABB", "top_trim": "THERMAX"},
            {"sector": "Defence & Aerospace", "inflow": 4120.0, "prev": 3840.0, "delta": 7.3, "trend": "UP", "top_add": "BEL", "top_trim": "HAL"},
            {"sector": "Renewable Power", "inflow": 3550.0, "prev": 3170.0, "delta": 12.0, "trend": "UP", "top_add": "SUZLON", "top_trim": "TATAPOWER"},
            {"sector": "Private Banks", "inflow": 2100.0, "prev": 2060.0, "delta": 1.9, "trend": "UP", "top_add": "ICICIBANK", "top_trim": "KOTAKBANK"},
            {"sector": "Realty & Infra", "inflow": 1120.0, "prev": 1070.0, "delta": 4.7, "trend": "UP", "top_add": "OBEROIRLTY", "top_trim": "DLF"},
            {"sector": "Pharma & Healthcare", "inflow": 270.0, "prev": 268.0, "delta": 0.7, "trend": "STABLE", "top_add": "MANKIND", "top_trim": "CIPLA"},
            {"sector": "Information Tech", "inflow": -1940.0, "prev": -1840.0, "delta": -5.4, "trend": "DOWN", "top_add": "PERSISTENT", "top_trim": "WIPRO"},
            {"sector": "FMCG & Staples", "inflow": -1650.0, "prev": -1600.0, "delta": -3.1, "trend": "DOWN", "top_add": "TATACONSUM", "top_trim": "HINDUNILVR"},
            {"sector": "Metals & Mining", "inflow": -980.0, "prev": -965.0, "delta": -1.5, "trend": "DOWN", "top_add": "JINDALSTEL", "top_trim": "VEDL"},
        ]

        for s_flow in sectors_data:
            flow_rec = (
                db.query(MFSectorFlow)
                .filter(
                    MFSectorFlow.sector_name == s_flow["sector"],
                    MFSectorFlow.report_date == latest_report_date,
                )
                .first()
            )
            if not flow_rec:
                flow_rec = MFSectorFlow(
                    sector_name=s_flow["sector"],
                    report_date=latest_report_date,
                    net_inflow_cr=s_flow["inflow"],
                    prev_month_inflow_cr=s_flow["prev"],
                    mom_delta_pct=s_flow["delta"],
                    trend=s_flow["trend"],
                    top_accumulated_stock=s_flow["top_add"],
                    top_trimmed_stock=s_flow["top_trim"],
                )
                db.add(flow_rec)
            else:
                flow_rec.net_inflow_cr = s_flow["inflow"]
                flow_rec.prev_month_inflow_cr = s_flow["prev"]
                flow_rec.mom_delta_pct = s_flow["delta"]
                flow_rec.trend = s_flow["trend"]
                flow_rec.top_accumulated_stock = s_flow["top_add"]
                flow_rec.top_trimmed_stock = s_flow["top_trim"]

        db.commit()
        print(f"[5/5] Seeded {len(sectors_data)} sector rotation entries.")
        print("=" * 70)
        print("FULL-UNIVERSE SEEDING COMPLETE!")
        print("=" * 70)

    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}")
        import traceback
        traceback.print_exc()
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_mutual_fund_intelligence()
