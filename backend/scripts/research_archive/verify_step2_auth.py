"""
Step 2 Verification Suite: Authentication, Multi-Tenancy & User Isolation
Tests bcrypt hashing, JWT token lifecycle, user registration & login,
and multi-tenant asset isolation between distinct user accounts.
"""

import sys
import uuid
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.core.security import hash_password, verify_password, create_access_token, decode_access_token
from app.db.database import SessionLocal, engine, Base
from app.models.user import User
from app.models.portfolio import Portfolio
from app.models.watchlist import Watchlist
from app.services.portfolio_intelligence_service import PortfolioIntelligenceService


def run_verification():
    print("==================================================")
    print("ALPHA INDIA — STEP 2 AUTH & MULTI-TENANCY VERIFICATION")
    print("==================================================")

    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # -------------------------------------------------------------
        # Test 1: Cryptography & JWT Token Lifecycle
        # -------------------------------------------------------------
        print("--- 1. Testing Hashing & JWT Integrity ---")
        raw_pw = "InstitutionalAlpha#2026"
        hashed = hash_password(raw_pw)
        assert hashed != raw_pw
        assert verify_password(raw_pw, hashed) is True
        assert verify_password("WrongPassword123", hashed) is False

        token = create_access_token(subject=101, extra_claims={"role": "trader"})
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["sub"] == "101"
        assert payload["role"] == "trader"

        # Verify tampered token is rejected
        tampered_token = token[:-5] + "XXXXX"
        assert decode_access_token(tampered_token) is None
        print("[OK] Bcrypt hashing and JWT signature validation verified.")

        # -------------------------------------------------------------
        # Test 2: User Persistence & Registration
        # -------------------------------------------------------------
        print("--- 2. Testing User Creation & Retrieval ---")
        unique_suffix = uuid.uuid4().hex[:6]
        email_a = f"trader_a_{unique_suffix}@alphaindia.local"
        email_b = f"trader_b_{unique_suffix}@alphaindia.local"

        user_a = User(
            email=email_a,
            hashed_password=hash_password("PassA_12345!"),
            full_name="Trader Alpha",
            role="trader",
            is_active=True,
        )
        user_b = User(
            email=email_b,
            hashed_password=hash_password("PassB_12345!"),
            full_name="Trader Beta",
            role="trader",
            is_active=True,
        )
        db.add(user_a)
        db.add(user_b)
        db.commit()
        db.refresh(user_a)
        db.refresh(user_b)

        assert user_a.id is not None
        assert user_b.id is not None
        assert user_a.id != user_b.id
        print(f"[OK] Created isolated users: User A (ID: {user_a.id}) & User B (ID: {user_b.id})")

        # -------------------------------------------------------------
        # Test 3: Multi-Tenant Portfolio Isolation
        # -------------------------------------------------------------
        print("--- 3. Testing Multi-Tenant Portfolio Isolation ---")
        p_a = PortfolioIntelligenceService.create_portfolio(
            db=db,
            name=f"User A Growth Vault {unique_suffix}",
            user_id=user_a.id,
            cash_balance=500000.0,
        )
        p_b = PortfolioIntelligenceService.create_portfolio(
            db=db,
            name=f"User B Tactical Swing {unique_suffix}",
            user_id=user_b.id,
            cash_balance=250000.0,
        )

        user_a_portfolios = PortfolioIntelligenceService.get_all_portfolios(db, user_id=user_a.id)
        user_a_ids = [p["id"] for p in user_a_portfolios]
        assert p_a.id in user_a_ids
        assert p_b.id not in user_a_ids, "Security breach: User A can see User B's portfolio!"

        user_b_portfolios = PortfolioIntelligenceService.get_all_portfolios(db, user_id=user_b.id)
        user_b_ids = [p["id"] for p in user_b_portfolios]
        assert p_b.id in user_b_ids
        assert p_a.id not in user_b_ids, "Security breach: User B can see User A's portfolio!"
        print("[OK] Verified strict portfolio isolation between distinct tenant IDs.")

        # -------------------------------------------------------------
        # Test 4: Multi-Tenant Watchlist Scoping
        # -------------------------------------------------------------
        print("--- 4. Testing Multi-Tenant Watchlist Scoping ---")
        wl_a = Watchlist(
            name=f"User A Tech Watchlist {unique_suffix}",
            user_id=user_a.id,
            color="emerald",
        )
        wl_b = Watchlist(
            name=f"User B Infra Watchlist {unique_suffix}",
            user_id=user_b.id,
            color="amber",
        )
        db.add(wl_a)
        db.add(wl_b)
        db.commit()
        db.refresh(wl_a)
        db.refresh(wl_b)

        wl_query_a = db.query(Watchlist).filter(Watchlist.user_id == user_a.id).all()
        wl_ids_a = [w.id for w in wl_query_a]
        assert wl_a.id in wl_ids_a
        assert wl_b.id not in wl_ids_a, "Security breach: User A can see User B's watchlist!"
        print("[OK] Verified strict watchlist isolation between distinct tenant IDs.")

        print("==================================================")
        print("ALL STEP 2 AUTH & MULTI-TENANCY TESTS PASSED!")
        print("==================================================")

    finally:
        db.close()


if __name__ == "__main__":
    run_verification()
