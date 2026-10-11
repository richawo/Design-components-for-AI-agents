import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@/app/globals.css";
import { ACCENT_BOOTSTRAP } from "@/lib/accent";
import { site } from "@/lib/site";
import { localeByCode } from "@/lib/blog/locales.mjs";

export const rootMetadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name}: ${site.tagline}`, template: `%s | ${site.name}` },
  description: site.description,
  applicationName: site.name,
  verification: { other: { "msvalidate.01": "7249F2B57E686284704E0A75B0323CD2" } },
  icons: { icon: "/icon.svg" },
  openGraph: { siteName: site.name, type: "website", locale: "en_GB" },
  twitter: { card: "summary_large_image", site: site.twitter },
  robots: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  alternates: { types: { "application/rss+xml": "/rss.xml", "text/plain": "/llms.txt" } },
};

export const rootViewport: Viewport = { themeColor: "#000000", width: "device-width", initialScale: 1 };

export function RootDocument({ children, locale = "en" }: { children: React.ReactNode; locale?: string }) {
  const language = localeByCode(locale) ?? localeByCode("en")!;
  return (
    <html suppressHydrationWarning lang={language.htmlLang} dir={language.direction} data-scroll-behavior="smooth">
      <head><script dangerouslySetInnerHTML={{ __html: ACCENT_BOOTSTRAP }} /></head>
      <body>{children}</body>
    </html>
  );
}
