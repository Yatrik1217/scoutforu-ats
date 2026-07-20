import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  // careers.<your-domain> serves the public careers page at its root:
  //   careers.scoutforu.com/          -> /careers
  //   careers.scoutforu.com/<jobId>   -> /careers/<jobId>
  //   careers.scoutforu.com/embed     -> /careers/embed
  // Nothing else (the ATS itself) is reachable on that host.
  const host = (request.headers.get("host") || "").toLowerCase();
  if (host.startsWith("careers.")) {
    const { pathname } = request.nextUrl;
    const url = request.nextUrl.clone();
    url.pathname = pathname.startsWith("/careers")
      ? pathname
      : pathname === "/"
        ? "/careers"
        : `/careers${pathname}`;
    return NextResponse.rewrite(url);
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    // Run on everything except API routes (they do their own token auth),
    // static assets & images.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
