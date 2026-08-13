import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Supabase redirects recovery / magic links here with a `code`. Exchange it for
// a session, then forward to the intended page (e.g. /reset-password).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/pipeline";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
