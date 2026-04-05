"""Shared test fixtures for Vgent API tests."""

import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# Prevent pydantic-settings from reading the real .env.local file
# which contains NEXT_PUBLIC_* vars that the Settings model rejects.
# We point it at a non-existent file so it only reads os.environ.
os.environ["ENV_FILE"] = "/dev/null"

# Set test environment variables BEFORE any app imports
os.environ["SUPABASE_URL"] = "https://test.supabase.co"
os.environ["SUPABASE_ANON_KEY"] = "test-anon-key"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "test-service-role-key"
os.environ["SUPABASE_JWT_SECRET"] = "test-jwt-secret-at-least-32-characters-long"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///test.db"
os.environ["REDIS_URL"] = "redis://localhost:6379"
os.environ["API_URL"] = "http://localhost:8000"
os.environ["APP_URL"] = "http://localhost:3000"

# Clear the settings LRU cache so our env vars take effect,
# and patch the Config to not load the env file.
from app.core.config import Settings, get_settings

# Override the env_file in Settings.Config before first instantiation
Settings.model_config["env_file"] = ""
get_settings.cache_clear()

from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.core.database import get_db


# ---------------------------------------------------------------------------
# Mock DB session
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_db():
    """An AsyncMock that behaves like an AsyncSession."""
    session = AsyncMock(spec=AsyncSession)
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.close = AsyncMock()
    session.execute = AsyncMock()
    session.get = AsyncMock(return_value=None)
    return session


# ---------------------------------------------------------------------------
# Mock users
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_user():
    """A regular tenant owner user."""
    return CurrentUser(
        id="test-user-id",
        tenant_id="test-tenant-id",
        role="owner",
        email="owner@example.com",
    )


@pytest.fixture
def mock_member():
    """A regular tenant member user."""
    return CurrentUser(
        id="member-user-id",
        tenant_id="test-tenant-id",
        role="member",
        email="member@example.com",
    )


@pytest.fixture
def mock_superadmin():
    """A superadmin user (no tenant)."""
    return CurrentUser(
        id="admin-id",
        tenant_id=None,
        role="superadmin",
        email="admin@example.com",
    )


# ---------------------------------------------------------------------------
# FastAPI test client helpers
# ---------------------------------------------------------------------------

def _override_db(mock_session):
    """Create an async generator that yields the mock session."""
    async def _get_db_override():
        yield mock_session
    return _get_db_override


def _override_user(user: CurrentUser):
    """Create a dependency override that returns a fixed user."""
    async def _get_user_override():
        return user
    return _get_user_override


@pytest.fixture
def app_with_superadmin(mock_db, mock_superadmin):
    """Return a FastAPI app with auth overridden to superadmin + mock DB."""
    # Clear settings cache so test env vars are picked up
    from app.core.config import get_settings
    get_settings.cache_clear()

    from main import app
    app.dependency_overrides[get_db] = _override_db(mock_db)
    app.dependency_overrides[get_current_user] = _override_user(mock_superadmin)
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
def app_with_user(mock_db, mock_user):
    """Return a FastAPI app with auth overridden to regular user + mock DB."""
    from app.core.config import get_settings
    get_settings.cache_clear()

    from main import app
    app.dependency_overrides[get_db] = _override_db(mock_db)
    app.dependency_overrides[get_current_user] = _override_user(mock_user)
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
def app_no_auth(mock_db):
    """Return a FastAPI app with mock DB but NO auth override (requests will 401/403)."""
    from app.core.config import get_settings
    get_settings.cache_clear()

    from main import app
    app.dependency_overrides[get_db] = _override_db(mock_db)
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
async def client_superadmin(app_with_superadmin):
    """Async HTTP client authenticated as superadmin."""
    transport = ASGITransport(app=app_with_superadmin)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def client_user(app_with_user):
    """Async HTTP client authenticated as regular user."""
    transport = ASGITransport(app=app_with_user)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def client_no_auth(app_no_auth):
    """Async HTTP client with no auth (should get 401/403)."""
    transport = ASGITransport(app=app_no_auth)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
