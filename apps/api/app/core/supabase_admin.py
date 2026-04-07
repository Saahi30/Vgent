"""Supabase Admin API helper — uses service_role key to manage auth users."""

import httpx
from app.core.config import get_settings


def _headers() -> dict:
    settings = get_settings()
    return {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }


def _base_url() -> str:
    return get_settings().supabase_url


async def create_auth_user(email: str, password: str, full_name: str = "") -> dict:
    """Create a user in Supabase Auth. Returns the auth user dict."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{_base_url()}/auth/v1/admin/users",
            headers=_headers(),
            json={
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {"full_name": full_name},
            },
        )
        if resp.status_code >= 400:
            detail = resp.json().get("msg") or resp.json().get("message") or resp.text
            raise Exception(f"Supabase auth error: {detail}")
        return resp.json()


async def delete_auth_user(user_id: str) -> None:
    """Delete a user from Supabase Auth."""
    async with httpx.AsyncClient() as client:
        resp = await client.delete(
            f"{_base_url()}/auth/v1/admin/users/{user_id}",
            headers=_headers(),
        )
        if resp.status_code >= 400:
            detail = resp.json().get("msg") or resp.json().get("message") or resp.text
            raise Exception(f"Supabase auth delete error: {detail}")


async def list_auth_users() -> list[dict]:
    """List all auth users."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{_base_url()}/auth/v1/admin/users",
            headers=_headers(),
        )
        if resp.status_code >= 400:
            raise Exception(f"Supabase auth error: {resp.text}")
        return resp.json().get("users", [])
