import { NextResponse, type NextRequest } from "next/server";
import { localeByCode } from "@/lib/blog/locales.mjs";

export function proxy(request: NextRequest) {
  const parts = request.nextUrl.pathname.split("/").filter(Boolean);
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
export const config = { matcher: ["/blog/:path*", "/:locale/blog/:path*"] };
