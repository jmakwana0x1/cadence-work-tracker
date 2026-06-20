import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/auth/login", request.url));

  const { origin } = new URL(request.url);
  const redirectUri = `${origin}/api/calendar/callback`;

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id",     process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri",  redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope",         "https://www.googleapis.com/auth/calendar");
  url.searchParams.set("access_type",   "offline");
  url.searchParams.set("prompt",        "consent"); // force refresh_token on every connect
  url.searchParams.set("state",         user.id);   // carry user_id through the flow

  return NextResponse.redirect(url.toString());
}
