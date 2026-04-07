import { NextRequest, NextResponse } from "next/server";

/**
 * Returns the current JWT access token from the httpOnly cookie.
 * This lets client-side code get the token for API calls.
 */
export async function GET(request: NextRequest) {
  const session = request.cookies.get("vgent_session");

  if (!session?.value) {
    return NextResponse.json({ token: null }, { status: 401 });
  }

  return NextResponse.json({ token: session.value });
}
