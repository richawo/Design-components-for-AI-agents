import { NextResponse, type NextRequest } from "next/server";
import { localeByCode } from "@/lib/blog/locales.mjs";
import { SITE_ROUTES, preferredLocale, localizePath } from "@/lib/i18n/routing";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/oauth/authorize") {
    // The approval page must never be framed or leak its query to other sites.
    const response = NextResponse.next();
    response.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }
  const parts = request.nextUrl.pathname.split("/").filter(Boolean);
  const preference = preferredLocale(request.headers.get("cookie"));
  if (preference !== "en" && (request.nextUrl.pathname === "/account" || (request.nextUrl.pathname === "/pricing" && request.nextUrl.searchParams.has("cancelled")))) {
    const url = request.nextUrl.clone();
    url.pathname = localizePath(url.pathname, preference);
    const response = NextResponse.redirect(url, 307);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Vary", "Cookie");
    return response;
  }
  if (parts[0] === "en" && (!parts[1] || SITE_ROUTES.includes(parts[1]))) {
    const url = request.nextUrl.clone(); url.pathname = "/" + parts.slice(1).join("/");
    return NextResponse.redirect(url, 308);
  }
  let locale = "en";
  if (localeByCode(parts[0]) && parts[1] === "blog") {
    locale = parts.shift()!;
    if (locale === "en") {
      const url = request.nextUrl.clone(); url.pathname = "/" + parts.join("/");
      return NextResponse.redirect(url, 308);
    }
  }
  if (parts[0] !== "blog" || parts.some((part) => /\.(?:xml|md|png|jpg|webp)$/.test(part))) return NextResponse.next();
  if (request.headers.get("accept")?.includes("text/markdown")) {
    const url = request.nextUrl.clone();
    url.pathname = `/md/blog/${locale}${parts.length > 1 ? "/" + parts.slice(1).join("/") : ""}`;
    const response = NextResponse.rewrite(url);
    response.headers.set("Vary", "Accept");
    return response;
  }
  const response = NextResponse.next();
  response.headers.set("Vary", "Accept");
  return response;
}
export const config = { matcher: ["/blog/:path*", "/:locale/blog/:path*", "/en/:path*", "/account", "/pricing", "/oauth/authorize"] };
