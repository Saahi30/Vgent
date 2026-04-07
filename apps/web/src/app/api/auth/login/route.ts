import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  // Authenticate with Supabase GoTrue
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return NextResponse.json(
      { success: false, error: body.error_description || body.msg || "Invalid credentials" },
      { status: 401 }
    );
  }

  const data = await res.json();
  const accessToken = data.access_token;
  const refreshToken = data.refresh_token;

  const response = NextResponse.json({
    success: true,
    user: data.user,
    access_token: accessToken,
  });

  // Store access token as session cookie (used by middleware for route protection)
  response.cookies.set("vgent_session", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: data.expires_in || 3600,
  });

  // Store refresh token for token renewal
  response.cookies.set("vgent_refresh", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}
