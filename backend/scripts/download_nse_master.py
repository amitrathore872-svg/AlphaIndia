import requests
from pathlib import Path

OUTPUT_FILE = Path("data/nse_companies_master.csv")

NSE_URL = (
    "https://archives.nseindia.com/content/equities/EQUITY_L.csv"
)

HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "text/csv,*/*",
    "Referer": "https://www.nseindia.com/",
}


def download_master():
    print("🇮🇳 Downloading NSE Master Company List...")

    response = requests.get(
        NSE_URL,
        headers=HEADERS,
        timeout=30,
    )

    response.raise_for_status()

    OUTPUT_FILE.write_bytes(response.content)

    print(f"✅ Saved to {OUTPUT_FILE}")
    print(f"📦 File Size: {OUTPUT_FILE.stat().st_size:,} bytes")


if __name__ == "__main__":
    download_master()