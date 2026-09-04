def calculate_growth_score(result):
    """
    Alpha India Growth Score v1
    Score between 0 and 100.
    """

    score = 0

    # Revenue Growth (30%)
    score += min(result.revenue_growth, 30) * 1.0

    # PAT Growth (36%)
    score += min(result.pat_growth, 30) * 1.2

    # ROCE (25%)
    score += min(result.roce, 25) * 1.0

    # Operating Margin (10%)
    score += min(result.operating_margin, 20) * 0.5

    # Net Profit Margin (10%)
    score += min(result.net_profit_margin, 20) * 0.5

    return round(min(score, 100), 1)