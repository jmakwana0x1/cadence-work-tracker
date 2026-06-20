import { createClient } from "@/lib/supabase/server";
import { storeTokens } from "@/lib/google/calendar";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code    = searchParams.get("code");
  const userId  = searchParams.get("state");
  const error   = searchParams.get("error");

  if (error || !code || !userId) {
    return NextResponse.redirect(`${origin}/dashboard?calendar_error=access_denied`);
  }

  // Verify the user session matches the state param
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) {
    return NextResponse.redirect(`${origin}/dashboard?calendar_error=user_mismatch`);
  }

  // Exchange code for tokens
  const redirectUri = `${origin}/api/calendar/callback`;
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  redirectUri,
      grant_type:    "authorization_code",
    }),
  });

  const tokenJson = await resp.json();
  if (!resp.ok) {
    const msg = encodeURIComponent(`token_exchange_failed:${resp.status}:${tokenJson.error ?? ""}`);
    return NextResponse.redirect(`${origin}/dashboard?calendar_error=${msg}`);
  }

  const { access_token, refresh_token, expires_in } = tokenJson;

  try {
    await storeTokens(userId, access_token, refresh_token ?? null, expires_in);
  } catch (err) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : "store_failed");
    return NextResponse.redirect(`${origin}/dashboard?calendar_error=${msg}`);
  }

  return NextResponse.redirect(`${origin}/dashboard?calendar_connected=1`);
}
