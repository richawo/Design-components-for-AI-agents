import { describeAgent, isBot, isClientEvent, sanitizeProps, validId } from "./events";
import { deliver, type AnalyticsBindings, type FunnelRecord } from "./sink";

/**
 * The first-party collector runs in the public router (proxy.ts), so a page
 * view never wakes the lazily imported Next server. It accepts small batches
 * from this site's own pages, drops bots and unknown events, enriches them
 * with Cloudflare's coarse location and forwards them to the sinks.
 */

export type EdgeGeo = { country?: string; region?: string; city?: string };
const MAX_BODY = 64 * 1024;
const MAX_EVENTS = 50;
/** Mixpanel's /track only accepts events from the last five days; clamp clock skew to an hour ahead. */
const MAX_AGE = 4 * 24 * 3600 * 1000;

const empty = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

export function sameSite(req: Request) {
  const origin = req.headers.get("origin");
  if (origin) return origin === new URL(req.url).origin;
  return req.headers.get("sec-fetch-site") === "same-origin";
}

export function parseBatch(raw: string, req: Request, geo: EdgeGeo, now = Date.now()): FunnelRecord[] {
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return []; }
  if (!body || typeof body !== "object") return [];
  const { d, u, s, events } = body as { d?: unknown; u?: unknown; s?: unknown; events?: unknown };
  if (!validId(d) || !Array.isArray(events)) return [];
  const userId = validId(u) ? u : null;
  const sessionId = validId(s) ? s : null;
  const agent = describeAgent(req.headers.get("user-agent"));
  const edge = {
    ...(geo.country ? { mp_country_code: geo.country } : {}),
    ...(geo.region ? { $region: geo.region } : {}),
    ...(geo.city ? { $city: geo.city } : {}),
    $browser: agent.browser,
    $os: agent.os,
    device_type: agent.deviceType,
  };
  const records: FunnelRecord[] = [];
  for (const item of events.slice(0, MAX_EVENTS)) {
    if (!item || typeof item !== "object") continue;
    const { e, t, id, p } = item as { e?: unknown; t?: unknown; id?: unknown; p?: unknown };
    if (!isClientEvent(e) || !validId(id)) continue;
    const time = typeof t === "number" && t > now - MAX_AGE && t < now + 3600_000 ? Math.round(t) : now;
    records.push({ event: e, time, insertId: id, deviceId: d, userId, sessionId, source: "web", props: { ...sanitizeProps(p), ...edge } });
  }
  return records;
}

export async function collect(
  req: Request,
  env: AnalyticsBindings,
  options: { geo?: EdgeGeo; waitUntil?: (promise: Promise<unknown>) => void; fetcher?: typeof fetch } = {},
) {
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  if (!sameSite(req) || isBot(req.headers.get("user-agent"))) return empty();
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BODY) return empty();
  const raw = await req.text();
  if (raw.length > MAX_BODY) return empty();
  const records = parseBatch(raw, req, options.geo ?? {});
  const delivery = deliver(env, records, options.fetcher);
  if (options.waitUntil) options.waitUntil(delivery);
  else await delivery;
  return empty();
}
