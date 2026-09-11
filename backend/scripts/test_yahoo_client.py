import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT))

from app.clients.yahoo_client import YahooClient


client = YahooClient()

symbol = "KTKBANK"

print("=" * 70)
print("ALPHA INDIA — YAHOO FINANCE TEST")
print("=" * 70)

company = client.company_info(symbol)

print("\nCompany")
for k, v in company.items():
    print(f"{k}: {v}")

income = client.quarterly_income_statement(symbol)

print("\nQuarterly Income Statement")
print(f"Rows: {income.shape[0]}")
print(f"Columns (quarters): {income.shape[1]}")

print("\nAvailable Quarters")
print(income.columns)

print("\nTop 15 Financial Metrics")
print(income.head(15))

balance = client.quarterly_balance_sheet(symbol)

print("\nQuarterly Balance Sheet")
print(balance.head(10))

# ---------------- Cash Flow ----------------

cashflow = client.quarterly_cash_flow(symbol)

print("\nQuarterly Cash Flow")

if cashflow.empty:
    print("Quarterly cash flow not available from Yahoo Finance.")
else:
    print(cashflow.head(10))

print("\nYahoo Finance Client Test Passed.")
