import { auth } from "@/auth";
import { routing } from "@/i18n/routing";
import { isAuthBypassed } from "@/lib/auth-bypass";
import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";

const handleI18n = createMiddleware(routing);
const localePattern = /^\/(th|en|ru)(\/|$)/;

function localeFromPath(pathname: string) {
  return pathname.match(localePattern)?.[1];
}

function isLoginPath(pathname: string) {
  return pathname === "/login" || /^\/(th|en|ru)\/login(\/|$)/.test(pathname);
}

function preferredLocale(req: Parameters<Parameters<typeof auth>[0]>[0]) {
  return localeFromPath(req.nextUrl.pathname) ?? req.cookies.get("NEXT_LOCALE")?.value ?? routing.defaultLocale;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isApiPath = pathname.startsWith("/api/");

  if (isAuthBypassed()) {
    return isApiPath ? NextResponse.next() : handleI18n(req);
  }

  // Allow auth routes and public assets
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Allow internal API routes with their own auth (LINE webhook, notify, gdrive)
  if (
    pathname.startsWith("/api/line") ||
    pathname.startsWith("/api/notify") ||
    pathname.startsWith("/api/gdrive")
  ) {
    return NextResponse.next();
  }

  if (isLoginPath(pathname)) {
    return handleI18n(req);
  }

  if (isApiPath) {
    return NextResponse.next();
  }

  if (!req.auth) {
    const locale = preferredLocale(req);
    const loginUrl = new URL(`/${locale}/login`, req.url);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return handleI18n(req);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
