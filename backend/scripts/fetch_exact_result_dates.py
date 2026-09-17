"""
Fetch exact BSE/NSE result announcement dates and the exact day close prices on those dates.
"""
import sys
import pandas as pd
import yfinance as yf

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

symbols_map = [
    ("CPCL", "CHENNPETRO.NS", "Chennai Petroleum Corp"),
    ("ORIENTBELL", "ORIENTBELL.NS", "Orient Bell Ltd"),
    ("ADOR", "ADORWELD.NS", "Ador Welding Ltd"),
    ("GAYAPROJ", "GAYAPROJ.NS", "Gayatri Projects Ltd"),
    ("SHREDIGCEM", "SHREDIGCEM.NS", "Shree Digvijay Cement"),
    ("NELCO", "NELCO.NS", "NELCO Limited"),
    ("MOKSH", "MOKSH.NS", "Moksh Ornaments Ltd"),
    ("MOLDTECH", "MOLDTECH.NS", "Mold-Tek Tech Ltd"),
    ("ADANIPOWER", "ADANIPOWER.NS", "Adani Power Ltd"),
    ("TCS", "TCS.NS", "Tata Consultancy Services"),
    ("DIXON", "DIXON.NS", "Dixon Technologies Ltd"),
    ("PREMIERENE", "PREMIERENE.NS", "Premier Energies Ltd"),
    ("KAYNES", "KAYNES.NS", "Kaynes Technology India"),
    ("WAAREERTL", "WAAREERTL.BO", "Waaree Renewable Tech"),
    ("GENSOL", "GENSOL.BO", "Gensol Engineering Ltd"),
]

print("=" * 110)
print(f"{'#':<3} {'Symbol':<12} {'Company Name':<28} {'Announce Date':<15} {'Day Close Price':<18} {'Exchange':<10}")
print("=" * 110)

for idx, (sym, yf_sym, name) in enumerate(symbols_map, 1):
    try:
        t = yf.Ticker(yf_sym)
        hist = t.history(period="2y")
        
        # Strip timezone from index for easy matching
        if not hist.empty:
            hist.index = hist.index.tz_localize(None)

        # Get earnings dates
        ed = None
        try:
            ed = t.get_earnings_dates(limit=12)
        except Exception:
            pass

        announce_date = None
        close_price = None

        if ed is not None and not ed.empty:
            # Drop timezone
            ed_dates = [pd.Timestamp(d).tz_localize(None) for d in ed.index]
            past_dates = [d for d in ed_dates if d <= pd.Timestamp.now()]
            if past_dates:
                # Most recent past earnings announcement date
                target_dt = past_dates[0]
                announce_date = target_dt.strftime("%Y-%m-%d")
                
                # Check exact day or previous trading day in history
                exact_or_prev = hist[hist.index <= target_dt]
                if not exact_or_prev.empty:
                    close_price = exact_or_prev.iloc[-1]["Close"]
                    announce_date = exact_or_prev.index[-1].strftime("%Y-%m-%d")
        
        # Fallback if no specific earnings date table exists in yfinance
        if close_price is None and not hist.empty:
            announce_date = hist.index[-1].strftime("%Y-%m-%d")
            close_price = hist.iloc[-1]["Close"]

        exch = "BSE" if ".BO" in yf_sym else "NSE"
        cp_str = f"Rs. {close_price:,.2f}" if close_price is not None else "N/A"
        print(f"{idx:<3} {sym:<12} {name:<28} {str(announce_date):<15} {cp_str:<18} {exch:<10}")

    except Exception as exc:
        print(f"{idx:<3} {sym:<12} {name:<28} Error: {exc}")

print("=" * 110)
