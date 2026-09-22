"""
Alpha India — Pytest Test Configuration & Fixtures
Institutional testing fixtures for FastAPI test client, database sessions, and auth headers.
"""

import os
import sys
import uuid
import pytest

# Ensure background workers are disabled during tests
os.environ["ENABLE_BACKGROUND_WORKERS"] = "false"

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from main import app
from app.db.database import SessionLocal, engine, Base
from app.models.user import User
from app.core.security import get_password_hash, create_access_token


@pytest.fixture(scope="session")
def client():
    """Provides a FastAPI test client with background workers disabled."""
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="function")
def db_session():
    """Provides an isolated database session per test function."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def test_user(db_session):
    """Creates a temporary test user and cleans up after the test."""
    unique_suffix = uuid.uuid4().hex[:8]
    email = f"test_{unique_suffix}@alphaindia.institutional"
    hashed_pwd = get_password_hash("AlphaInstitutional@2026")

    user = User(
        email=email,
        hashed_password=hashed_pwd,
        full_name="Institutional Test Trader",
        role="trader",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    yield user

    # Cleanup
    try:
        db_session.delete(user)
        db_session.commit()
    except Exception:
        db_session.rollback()


@pytest.fixture(scope="function")
def auth_headers(test_user):
    """Provides valid Bearer authorization headers for the test user."""
    token = create_access_token(
        subject=test_user.id,
        extra_claims={"email": test_user.email, "role": test_user.role},
    )
    return {"Authorization": f"Bearer {token}"}
