"""Tests for authentication and authorization logic."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

from app.core.auth import CurrentUser, verify_jwt, get_current_user, require_role


# ---------------------------------------------------------------------------
# verify_jwt
# ---------------------------------------------------------------------------


class TestVerifyJWT:
    async def test_missing_jwt_secret_raises_500(self):
        with patch("app.core.auth.settings") as mock_settings:
            mock_settings.supabase_jwt_secret = ""
            with pytest.raises(HTTPException) as exc_info:
                await verify_jwt("some-token")
            assert exc_info.value.status_code == 500
            assert "not configured" in exc_info.value.detail

    async def test_invalid_token_raises_401(self):
        with patch("app.core.auth.settings") as mock_settings:
            mock_settings.supabase_jwt_secret = "a-secret-that-is-long-enough-for-hs256"
            with pytest.raises(HTTPException) as exc_info:
                await verify_jwt("bad.token.value")
            assert exc_info.value.status_code == 401
            assert "Invalid or expired" in exc_info.value.detail

    async def test_valid_token_returns_payload(self):
        """Create a real HS256 JWT, verify it decodes."""
        from jose import jwt as jose_jwt

        secret = "a-secret-that-is-long-enough-for-hs256"
        payload = {"sub": "user-123", "aud": "authenticated", "email": "u@example.com"}
        token = jose_jwt.encode(payload, secret, algorithm="HS256")

        with patch("app.core.auth.settings") as mock_settings:
            mock_settings.supabase_jwt_secret = secret
            result = await verify_jwt(token)

        assert result["sub"] == "user-123"
        assert result["email"] == "u@example.com"


# ---------------------------------------------------------------------------
# get_current_user
# ---------------------------------------------------------------------------


class TestGetCurrentUser:
    async def test_missing_sub_claim_raises_401(self):
        """Token valid but missing 'sub' claim."""
        creds = MagicMock()
        creds.credentials = "token"
        db = AsyncMock()

        with patch("app.core.auth.verify_jwt", new_callable=AsyncMock) as mock_verify:
            mock_verify.return_value = {"email": "a@b.com"}  # no "sub"
            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(credentials=creds, db=db)
            assert exc_info.value.status_code == 401
            assert "missing user ID" in exc_info.value.detail

    async def test_user_not_in_db_raises_401(self):
        creds = MagicMock()
        creds.credentials = "token"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        db = AsyncMock()
        db.execute.return_value = mock_result

        with patch("app.core.auth.verify_jwt", new_callable=AsyncMock) as mock_verify:
            mock_verify.return_value = {"sub": "user-123"}
            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(credentials=creds, db=db)
            assert exc_info.value.status_code == 401
            assert "User not found" in exc_info.value.detail

    async def test_inactive_user_raises_403(self):
        creds = MagicMock()
        creds.credentials = "token"

        user_obj = MagicMock()
        user_obj.is_active = False
        user_obj.id = "user-123"
        user_obj.tenant_id = "tenant-1"
        user_obj.role = "owner"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = user_obj
        db = AsyncMock()
        db.execute.return_value = mock_result

        with patch("app.core.auth.verify_jwt", new_callable=AsyncMock) as mock_verify:
            mock_verify.return_value = {"sub": "user-123"}
            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(credentials=creds, db=db)
            assert exc_info.value.status_code == 403
            assert "disabled" in exc_info.value.detail

    async def test_valid_user_returns_current_user(self):
        creds = MagicMock()
        creds.credentials = "token"

        user_obj = MagicMock()
        user_obj.is_active = True
        user_obj.id = "user-123"
        user_obj.tenant_id = "tenant-1"
        user_obj.role = "owner"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = user_obj
        db = AsyncMock()
        db.execute.return_value = mock_result

        with patch("app.core.auth.verify_jwt", new_callable=AsyncMock) as mock_verify:
            mock_verify.return_value = {"sub": "user-123", "email": "u@example.com"}
            result = await get_current_user(credentials=creds, db=db)

        assert isinstance(result, CurrentUser)
        assert result.id == "user-123"
        assert result.tenant_id == "tenant-1"
        assert result.role == "owner"
        assert result.email == "u@example.com"


# ---------------------------------------------------------------------------
# require_role
# ---------------------------------------------------------------------------


class TestRequireRole:
    async def test_allowed_role_passes(self):
        checker = require_role("owner", "admin")
        user = CurrentUser(id="u1", tenant_id="t1", role="owner")
        result = await checker(user=user)
        assert result is user

    async def test_disallowed_role_raises_403(self):
        checker = require_role("superadmin")
        user = CurrentUser(id="u1", tenant_id="t1", role="member")
        with pytest.raises(HTTPException) as exc_info:
            await checker(user=user)
        assert exc_info.value.status_code == 403
        assert "Requires one of" in exc_info.value.detail


# ---------------------------------------------------------------------------
# Integration: unauthenticated requests to protected endpoints
# ---------------------------------------------------------------------------


class TestUnauthenticatedRequests:
    async def test_admin_tenants_requires_auth(self, client_no_auth):
        resp = await client_no_auth.get("/api/admin/tenants")
        assert resp.status_code in (401, 403)

    async def test_admin_health_requires_auth(self, client_no_auth):
        resp = await client_no_auth.get("/api/admin/health")
        assert resp.status_code in (401, 403)

    async def test_health_check_is_public(self, client_no_auth):
        resp = await client_no_auth.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"


class TestNonSuperadminBlocked:
    """Regular users should be rejected from admin endpoints."""

    async def test_regular_user_cannot_list_tenants(self, client_user):
        resp = await client_user.get("/api/admin/tenants")
        assert resp.status_code == 403

    async def test_regular_user_cannot_get_admin_health(self, client_user):
        resp = await client_user.get("/api/admin/health")
        assert resp.status_code == 403

    async def test_regular_user_cannot_get_admin_usage(self, client_user):
        resp = await client_user.get("/api/admin/usage")
        assert resp.status_code == 403
