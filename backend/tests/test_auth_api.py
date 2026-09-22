"""
Unit & Integration Tests for Authentication & Multi-Tenancy Isolation
"""

import uuid
from app.models.portfolio import Portfolio
from app.models.user import User
from app.core.security import get_password_hash, create_access_token


def test_register_and_login_flow(client, db_session):
    """Verifies that a new user can register, receive a JWT token, and authenticate."""
    suffix = uuid.uuid4().hex[:8]
    email = f"user_{suffix}@alphaindia.com"
    password = "StrongPassword@123"

    # 1. Register new user
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": "Test Alpha Trader",
        },
    )
    assert reg_resp.status_code == 201, f"Registration failed: {reg_resp.text}"
    data = reg_resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == email

    # 2. Duplicate registration should be rejected
    dup_resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": "Duplicate Attempt",
        },
    )
    assert dup_resp.status_code == 400
    assert "already exists" in dup_resp.json()["detail"].lower()

    # 3. Login with correct credentials
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_resp.status_code == 200
    login_data = login_resp.json()
    assert "access_token" in login_data
    token = login_data["access_token"]

    # 4. Login with incorrect password
    bad_login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "WrongPassword!456"},
    )
    assert bad_login_resp.status_code == 401

    # 5. Access /me with valid token
    me_resp = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_resp.status_code == 200
    me_data = me_resp.json()
    assert me_data["email"] == email

    # 6. Access /me with invalid token
    bad_me_resp = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid_token_xyz"},
    )
    assert bad_me_resp.status_code == 401

    # Cleanup created user
    u = db_session.query(User).filter(User.email == email).first()
    if u:
        db_session.delete(u)
        db_session.commit()


def test_multi_tenant_portfolio_isolation(client, db_session, test_user, auth_headers):
    """Verifies that User A cannot read or modify User B's portfolio."""
    # Create User B
    suffix = uuid.uuid4().hex[:8]
    user_b = User(
        email=f"user_b_{suffix}@alphaindia.com",
        full_name=f"Trader B {suffix}",
        hashed_password=get_password_hash("Password123!"),
        role="trader",
        is_active=True,
    )
    db_session.add(user_b)
    db_session.commit()
    db_session.refresh(user_b)

    # Create portfolio owned by User B
    portfolio_b = Portfolio(
        user_id=user_b.id,
        name=f"User B Confidential Portfolio {suffix}",
        cash_balance=500000.0,
    )
    db_session.add(portfolio_b)
    db_session.commit()
    db_session.refresh(portfolio_b)

    try:
        # User A (test_user via auth_headers) attempts to query User B's portfolio
        resp = client.get(
            f"/portfolio/{portfolio_b.id}/summary",
            headers=auth_headers,
        )
        # Should return 404 Not Found or error (tenant isolation)
        assert resp.status_code in (404, 403, 400), f"Expected 404/403 for cross-tenant access, got {resp.status_code}"

        # User A queries their own portfolios list
        list_resp = client.get(
            "/portfolio/list",
            headers=auth_headers,
        )
        assert list_resp.status_code == 200
        portfolios = list_resp.json()
        assert not any(p["id"] == portfolio_b.id for p in portfolios), "User B's portfolio leaked to User A!"
    finally:
        # Cleanup
        db_session.delete(portfolio_b)
        db_session.delete(user_b)
        db_session.commit()
