# ==========================================================
# Alpha India Growth Score Engine
# Sprint 33.4 Stable Recovery
# PostgreSQL Compatible
# ==========================================================

from sqlalchemy import func

def growth_score_expression(result_model):
    revenue = func.coalesce(result_model.revenue_growth, 0.0)
    pat = func.coalesce(result_model.pat_growth, 0.0)

    # Clamp values between 0 and 40 before scoring.
    revenue_score = func.least(func.greatest(revenue, 0.0), 40.0)
    pat_score = func.least(func.greatest(pat, 0.0), 40.0)

    score = revenue_score * 1.25 + pat_score * 1.25

    return func.least(score, 100.0)