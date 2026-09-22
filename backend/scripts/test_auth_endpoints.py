"""
Test FastAPI Auth Endpoints via TestClient
Validates HTTP registration, login, token responses, and /me endpoint.
"""

import sys
import uuid
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from starlette.testclient import TestClient
from main import app

client = TestClient(app)

def test_http_auth():
    print("==================================================")
    print("TESTING FASTAPI AUTH ENDPOINTS (/api/v1/auth)")
    print("==================================================")

    uid = uuid.uuid4().hex[:6]
    email = f"institutional_trader_{uid}@alphaindia.com"
    password = "SecurePassword@2026!"

    # 1. Register new user
    print("--- 1. POST /api/v1/auth/register ---")
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": "Institutional Trader",
        },
    )
    assert reg_resp.status_code == 201, f"Reg failed: {reg_resp.text}"
    reg_data = reg_resp.json()
    assert "access_token" in reg_data
    assert reg_data["token_type"] == "bearer"
    assert reg_data["user"]["email"] == email
    token = reg_data["access_token"]
    print(f"[OK] Registration successful for {email} (HTTP 201).")

    # 2. Duplicate registration rejection
    print("--- 2. Duplicate Registration Rejection ---")
    dup_resp = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password},
    )
    assert dup_resp.status_code == 400
    print("[OK] Correctly rejected duplicate email (HTTP 400).")

    # 3. Login with credentials
    print("--- 3. POST /api/v1/auth/login ---")
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    login_data = login_resp.json()
    assert "access_token" in login_data
    login_token = login_data["access_token"]
    print("[OK] Login successful and returned JWT Bearer token (HTTP 200).")

    # 4. Access protected /me endpoint with Bearer token
    print("--- 4. GET /api/v1/auth/me (Protected) ---")
    me_resp = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {login_token}"},
    )
    assert me_resp.status_code == 200, f"Me failed: {me_resp.text}"
    me_data = me_resp.json()
    assert me_data["email"] == email
    assert me_data["role"] == "trader"
    print(f"[OK] Protected profile retrieved: {me_data['email']} (Role: {me_data['role']}).")

    # 5. Unauthorized access rejection
    print("--- 5. Unauthorized Request Rejection ---")
    unauth_resp = client.get("/api/v1/auth/me")
    assert unauth_resp.status_code in (401, 403), f"Should fail unauthenticated: {unauth_resp.status_code}"
    print("[OK] Unauthenticated request rejected (HTTP 401/403).")

    print("==================================================")
    print("ALL FASTAPI AUTH ENDPOINT TESTS PASSED!")
    print("==================================================")

if __name__ == "__main__":
    test_http_auth()
