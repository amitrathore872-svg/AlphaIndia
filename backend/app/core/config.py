from dotenv import load_dotenv
from pathlib import Path
import os

# Load .env from backend/.env
BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")

print("DATABASE_URL loaded:", DATABASE_URL is not None)

if DATABASE_URL is None:
    raise ValueError("DATABASE_URL not found in backend/.env")