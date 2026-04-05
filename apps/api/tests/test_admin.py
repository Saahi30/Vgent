"""Tests for admin API endpoints."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from datetime import datetime, timezone


def _make_mock_tenant(**overrides):
    """Create a mock tenant with all required TenantResponse fields."""
    tenant = MagicMock()
    tenant.id = overrides.get("id", uuid4())
    tenant.name = overrides.get("name", "Acme Corp")
    tenant.slug = overrides.get("slug", "acme-corp")
    tenant.plan = overrides.get("plan", "free")
    tenant.is_active = overrides.get("is_active", True)
    tenant.max_agents = overrides.get("max_agents", 3)
    tenant.max_concurrent_calls = overrides.get("max_concurrent_calls", 5)
    tenant.monthly_call_minutes_limit = overrides.get("monthly_call_minutes_limit", 1000)
    tenant.metadata = overrides.get("metadata", {})
    tenant.created_at = overrides.get("created_at", datetime(2025, 1, 1, tzinfo=timezone.utc))
    tenant.updated_at = overrides.get("updated_at", datetime(2025, 1, 1, tzinfo=timezone.utc))
    return tenant


# ---------------------------------------------------------------------------
# Admin list tenants
# ---------------------------------------------------------------------------


class TestAdminListTenants:
    async def test_list_tenants_returns_paginated(self, client_superadmin, mock_db):
        """Superadmin can list tenants."""
        mock_tenant = _make_mock_tenant(name="Acme Corp")

        count_result = MagicMock()
        count_result.scalar.return_value = 1

        list_result = MagicMock()
        list_result.scalars.return_value.all.return_value = [mock_tenant]

        mock_db.execute = AsyncMock(side_effect=[count_result, list_result])

        resp = await client_superadmin.get("/api/admin/tenants?page=1&page_size=20")

        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert body["page"] == 1
        assert len(body["data"]) == 1
        assert body["data"][0]["name"] == "Acme Corp"

    async def test_list_tenants_empty(self, client_superadmin, mock_db):
        count_result = MagicMock()
        count_result.scalar.return_value = 0

        list_result = MagicMock()
        list_result.scalars.return_value.all.return_value = []

        mock_db.execute = AsyncMock(side_effect=[count_result, list_result])

        resp = await client_superadmin.get("/api/admin/tenants")
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 0
        assert body["data"] == []
        assert body["total_pages"] == 0


class TestAdminGetTenant:
    async def test_get_tenant_found(self, client_superadmin, mock_db):
        tenant_id = uuid4()
        mock_tenant = _make_mock_tenant(id=tenant_id, name="Acme Corp")

        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = mock_tenant
        mock_db.execute.return_value = result_mock

        resp = await client_superadmin.get(f"/api/admin/tenants/{tenant_id}")
        assert resp.status_code == 200
        assert resp.json()["data"]["name"] == "Acme Corp"

    async def test_get_tenant_not_found(self, client_superadmin, mock_db):
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = result_mock

        resp = await client_superadmin.get(f"/api/admin/tenants/{uuid4()}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Admin suspend tenant
# ---------------------------------------------------------------------------


class TestAdminSuspendTenant:
    async def test_suspend_tenant_toggles_active(self, client_superadmin, mock_db):
        tenant_id = uuid4()
        mock_tenant = _make_mock_tenant(id=tenant_id, is_active=True)

        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = mock_tenant
        mock_db.execute.return_value = result_mock

        resp = await client_superadmin.post(f"/api/admin/tenants/{tenant_id}/suspend")
        assert resp.status_code == 200
        # The handler toggles is_active: True -> False
        assert mock_tenant.is_active is False

    async def test_suspend_nonexistent_tenant_returns_404(self, client_superadmin, mock_db):
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = result_mock

        resp = await client_superadmin.post(f"/api/admin/tenants/{uuid4()}/suspend")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Admin usage endpoint
# ---------------------------------------------------------------------------


class TestAdminUsage:
    async def test_usage_returns_stats(self, client_superadmin, mock_db):
        # 4 db.execute calls in admin_platform_usage
        mock_db.execute = AsyncMock(side_effect=[
            MagicMock(scalar=MagicMock(return_value=10)),   # total_tenants
            MagicMock(scalar=MagicMock(return_value=25)),   # total_calls_today
            MagicMock(scalar=MagicMock(return_value=3)),    # active_calls
            MagicMock(scalar=MagicMock(return_value=7200)), # total_seconds_today
        ])

        resp = await client_superadmin.get("/api/admin/usage")
        assert resp.status_code == 200

        data = resp.json()["data"]
        assert data["total_tenants"] == 10
        assert data["total_calls_today"] == 25
        assert data["active_calls_now"] == 3
        assert data["total_minutes_today"] == 120.0


# ---------------------------------------------------------------------------
# Admin health endpoint
# ---------------------------------------------------------------------------


class TestAdminHealth:
    async def test_health_db_ok_redis_ok(self, client_superadmin, mock_db):
        mock_db.execute = AsyncMock()  # succeeds

        with patch("app.routers.admin.redis_client") as mock_redis:
            mock_redis.ping = AsyncMock()
            resp = await client_superadmin.get("/api/admin/health")

        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["database"] is True
        assert data["redis"] is True

    async def test_health_db_fail_redis_ok(self, client_superadmin, mock_db):
        mock_db.execute = AsyncMock(side_effect=Exception("DB down"))

        with patch("app.routers.admin.redis_client") as mock_redis:
            mock_redis.ping = AsyncMock()
            resp = await client_superadmin.get("/api/admin/health")

        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["database"] is False
        assert data["redis"] is True

    async def test_health_db_ok_redis_fail(self, client_superadmin, mock_db):
        mock_db.execute = AsyncMock()

        with patch("app.routers.admin.redis_client") as mock_redis:
            mock_redis.ping = AsyncMock(side_effect=Exception("Redis down"))
            resp = await client_superadmin.get("/api/admin/health")

        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["database"] is True
        assert data["redis"] is False


# ---------------------------------------------------------------------------
# Non-superadmin access denied
# ---------------------------------------------------------------------------


class TestAdminAccessDenied:
    async def test_regular_user_cannot_list_tenants(self, client_user):
        resp = await client_user.get("/api/admin/tenants")
        assert resp.status_code == 403

    async def test_regular_user_cannot_suspend(self, client_user):
        resp = await client_user.post(f"/api/admin/tenants/{uuid4()}/suspend")
        assert resp.status_code == 403

    async def test_regular_user_cannot_view_usage(self, client_user):
        resp = await client_user.get("/api/admin/usage")
        assert resp.status_code == 403
