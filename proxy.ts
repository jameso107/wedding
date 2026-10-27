import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSessionValue } from "@/lib/planning/session";

// planning.oosterhouse.wedding (and planning.localhost in dev) serves the
// private dashboard from app/planning. Every other host is the public site,
// where /planning does not exist.
function isPlanningHost(host: string | null) {
  return host?.split(":")[0].startsWith("planning.") ?? false;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isPlanningHost(request.headers.get("host"))) {
    if (pathname === "/planning" || pathname.startsWith("/planning/")) {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.next();
  }

  // Send first-time visitors to pick Hannah or James.
  const person = readSessionValue(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (!person && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (person && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const url = request.nextUrl.clone();
  url.pathname = `/planning${pathname === "/" ? "" : pathname}`;
  const response = NextResponse.rewrite(url);
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|images/).*)"],
};
