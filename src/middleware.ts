import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession, type Role } from "@/lib/auth";

// Routes that require authentication, with optional role restrictions.
const PROTECTED: { prefix: string; roles?: Role[] }[] = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/products", roles: ["admin", "manager"] },
  { prefix: "/labels", roles: ["admin"] },
  { prefix: "/scan" },
  { prefix: "/inventory" },
  { prefix: "/reports" },
  { prefix: "/", roles: undefined }, // dashboard
];

function matchRule(pathname: string) {
  // Most specific prefix first.
  const sorted = [...PROTECTED].sort((a, b) => b.prefix.length - a.prefix.length);
  return sorted.find((r) =>
    r.prefix === "/" ? pathname === "/" : pathname === r.prefix || pathname.startsWith(r.prefix + "/")
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public assets / auth endpoints / login page pass through.
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/icons") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // API routes enforce their own auth in handlers; let them through.
  if (pathname.startsWith("/api/")) return NextResponse.next();

  const rule = matchRule(pathname);
  if (!rule) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = await verifySession(token);

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (rule.roles && !rule.roles.includes(user.role)) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("denied", "1");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
