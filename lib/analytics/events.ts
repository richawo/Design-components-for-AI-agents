/**
 * Funnel analytics vocabulary shared by the browser tracker, the first-party
 * collector and server-side conversion events. docs/ANALYTICS.md describes
 * every event and the funnels built from them; keep both in step.
 */

/** First-party collector path. Neutral naming keeps generic blocklists from dropping it. */
export const COLLECT_PATH = "/_dfa/e";
/** Header that carries the browser's anonymous device id to commerce routes. */
export const DEVICE_HEADER = "x-dfa-device";

/** Events the browser may send. The collector drops anything else. */
export const CLIENT_EVENTS = [
  // Navigation and engagement
  "page_view",
  "page_engagement",
  "content_engaged",
  "blog_read_progress",
  "link_clicked",
  "copied",
  // Pricing and checkout
  "plan_cadence_changed",
  "checkout_clicked",
  "checkout_redirected",
  "checkout_error",
  "checkout_cancelled",
  // Account
  "sign_in_code_requested",
  "sign_in_failed",
  "signed_in",
  "signed_out",
  "account_loaded",
  "licence_key_activated",
  "billing_portal_opened",
  "purchase_confirmed",
] as const;

/** Events only the server records, because only the server can confirm them. */
export const SERVER_EVENTS = [
  "checkout_session_created",
  "checkout_session_expired",
  "purchase_completed",
] as const;

export type ClientEvent = (typeof CLIENT_EVENTS)[number];
export type ServerEvent = (typeof SERVER_EVENTS)[number];
export type AnalyticsEvent = ClientEvent | ServerEvent;
export type PropValue = string | number | boolean | null;
export type Props = Record<string, PropValue>;

const CLIENT_EVENT_SET = new Set<string>(CLIENT_EVENTS);
export const isClientEvent = (name: unknown): name is ClientEvent => typeof name === "string" && CLIENT_EVENT_SET.has(name);

export type PageType =
  | "home" | "blog_index" | "blog_category" | "blog_post" | "pricing" | "components_index"
  | "component" | "blocks_index" | "block" | "category" | "docs" | "account" | "oauth" | "file" | "other";

/** Locale codes are lower-case language tags such as `de` or `pt-br`; English has no prefix. */
const LOCALE_SEGMENT = /^[a-z]{2,3}(?:-[a-z0-9]{2,4})?$/;
const SECTIONS = new Set(["blog", "pricing", "components", "blocks", "categories", "docs", "account", "oauth"]);

/** Classify a pathname into a page type, its slug and its locale. */
export function classifyPath(pathname: string, locales?: ReadonlySet<string>): { pageType: PageType; slug: string | null; locale: string } {
  const parts = pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  let locale = "en";
  if (parts.length && !SECTIONS.has(parts[0]) && LOCALE_SEGMENT.test(parts[0]) && (!locales || locales.has(parts[0]))) locale = parts.shift()!;
  const [section, second, third] = parts;
  if (/\.(?:xml|md|txt|json|png|jpe?g|webp|svg|mp4)$/i.test(parts.at(-1) ?? "")) return { pageType: "file", slug: null, locale };
  const slug = (value?: string) => (value ? value.slice(0, 120) : null);
  if (!section) return { pageType: "home", slug: null, locale };
  switch (section) {
    case "blog":
      if (!second || second === "page") return { pageType: "blog_index", slug: null, locale };
      if (second === "category") return { pageType: "blog_category", slug: slug(third), locale };
      return { pageType: "blog_post", slug: slug(second), locale };
    case "pricing": return { pageType: "pricing", slug: null, locale };
    case "components": return second ? { pageType: "component", slug: slug(second), locale } : { pageType: "components_index", slug: null, locale };
    case "blocks": return second ? { pageType: "block", slug: slug(second), locale } : { pageType: "blocks_index", slug: null, locale };
    case "categories": return { pageType: "category", slug: slug(second), locale };
    case "docs": return { pageType: "docs", slug: slug(second), locale };
    case "account": return { pageType: "account", slug: null, locale };
    case "oauth": return { pageType: "oauth", slug: null, locale };
    default: return { pageType: "other", slug: slug(section), locale };
  }
}

/** Query parameters worth keeping on a page view. Everything else (codes, ids, search text) is dropped. */
export const KEPT_QUERY = ["plan", "tier", "cancelled", "welcome", "pending", "category", "ref"] as const;
export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;

const KEY = /^\$?[a-z][a-z0-9_]{0,47}$/;
const MAX_PROPS = 48;
const MAX_STRING = 300;

/** Keep only small, flat, primitive properties with safe keys. */
export function sanitizeProps(input: unknown): Props {
  const out: Props = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  let count = 0;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (count >= MAX_PROPS) break;
    if (!KEY.test(key)) continue;
    if (typeof value === "string") out[key] = value.slice(0, MAX_STRING);
    else if (typeof value === "number") { if (!Number.isFinite(value)) continue; out[key] = value; }
    else if (typeof value === "boolean" || value === null) out[key] = value;
    else continue;
    count++;
  }
  return out;
}

const ID = /^[A-Za-z0-9_-]{8,64}$/;
/** Device, session and event ids are browser-generated UUIDs; reject anything else. */
export const validId = (value: unknown): value is string => typeof value === "string" && ID.test(value);

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|slack|curl|wget|python-requests|httpclient|node-fetch|axios|go-http|java\//i;
export const isBot = (userAgent: string | null) => !userAgent || BOT.test(userAgent);

/** Coarse, dependency-free user-agent summary. */
export function describeAgent(userAgent: string | null): { browser: string; os: string; deviceType: string } {
  const ua = userAgent ?? "";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\/|CriOS\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Other";
  const os = /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X|Macintosh/.test(ua) ? "Mac OS X"
    : /Windows/.test(ua) ? "Windows" : /CrOS/.test(ua) ? "Chrome OS" : /Linux/.test(ua) ? "Linux" : "Other";
  const deviceType = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? "tablet" : /Mobi|iPhone|Android/.test(ua) ? "mobile" : "desktop";
  return { browser, os, deviceType };
}

/** Hostname of a referrer URL, or null when it is missing or malformed. */
export function referringDomain(referrer: unknown): string | null {
  if (typeof referrer !== "string" || !referrer) return null;
  try { return new URL(referrer).hostname.replace(/^www\./, "") || null; } catch { return null; }
}
