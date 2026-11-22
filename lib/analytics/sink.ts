import type { Props } from "./events";

/**
 * Delivery for funnel events. Every event goes to Cloudflare Workers Analytics
 * Engine (always on, queryable with SQL) and, when MIXPANEL_TOKEN is set, to
 * Mixpanel for funnels, retention and flows. Neither sink may ever break a
 * page, checkout or webhook, so failures are swallowed after one log line.
 */

export type AnalyticsBindings = {
  FUNNEL_EVENTS?: { writeDataPoint(point: { blobs?: (string | null)[]; doubles?: number[]; indexes?: string[] }): void };
  MIXPANEL_TOKEN?: string;
  MIXPANEL_API_HOST?: string;
};

export type FunnelRecord = {
  event: string;
  /** Milliseconds since the epoch. */
  time: number;
  insertId: string;
  deviceId: string | null;
  userId: string | null;
  sessionId: string | null;
  source: "web" | "server";
  props: Props;
};

const str = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value)).slice(0, 256);
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

/**
 * Analytics Engine has positional columns. This order is a public contract for
 * the SQL in docs/ANALYTICS.md; append new fields, never reorder.
 */
export function dataPoint(record: FunnelRecord) {
  const p = record.props;
  return {
    indexes: [(record.deviceId ?? record.userId ?? "anonymous").slice(0, 96)],
    blobs: [
      record.event, //            blob1
      str(p.page_type), //        blob2
      str(p.path), //             blob3
      str(record.deviceId), //    blob4
      str(record.sessionId), //   blob5
      str(record.userId), //      blob6
      str(p.$referring_domain), // blob7  session referrer
      str(p.utm_source), //       blob8
      str(p.utm_medium), //       blob9
      str(p.utm_campaign), //     blob10
      str(p.mp_country_code), //  blob11
      str(p.locale), //           blob12
      str(p.plan), //             blob13
      str(p.slug), //             blob14
      str(p.target ?? p.error), // blob15
      str(p.device_type), //      blob16
      record.source, //           blob17
      str(p.landing_page_type), // blob18
      str(p.$browser), //         blob19
      str(p.label), //            blob20
    ],
    doubles: [
      1, //                       double1 count
      num(p.engaged_ms), //       double2
      num(p.max_scroll_pct), //   double3
      num(p.revenue), //          double4 USD
      num(p.session_page_index), // double5
      record.time, //             double6
    ],
  };
}

export function mixpanelEvent(record: FunnelRecord, token: string) {
  // Simplified ID Merge: $device_id and $user_id link the anonymous journey to the account.
  const distinctId = record.userId ?? (record.deviceId ? `$device:${record.deviceId}` : `$server:${record.insertId}`);
  return {
    event: record.event,
    properties: {
      ...record.props,
      token,
      time: record.time,
      distinct_id: distinctId,
      $insert_id: record.insertId,
      ...(record.deviceId ? { $device_id: record.deviceId } : {}),
      ...(record.userId ? { $user_id: record.userId } : {}),
      ...(record.sessionId ? { session_id: record.sessionId } : {}),
      event_source: record.source,
      mp_lib: "dfa",
    },
  };
}

export async function deliver(env: AnalyticsBindings, records: FunnelRecord[], fetcher: typeof fetch = fetch) {
  if (!records.length) return;
  try {
    for (const record of records) env.FUNNEL_EVENTS?.writeDataPoint(dataPoint(record));
  } catch { console.error("analytics: analytics engine write failed"); }
  const token = env.MIXPANEL_TOKEN;
  if (!token) return;
  const host = (env.MIXPANEL_API_HOST || "https://api-eu.mixpanel.com").replace(/\/$/, "");
  try {
    // ip=0: location comes from Cloudflare's edge data, not from Mixpanel seeing our Worker's address.
    const response = await fetcher(`${host}/track?ip=0&strict=1`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(records.map((record) => mixpanelEvent(record, token))),
    });
    if (!response.ok) console.error(`analytics: mixpanel rejected events (${response.status})`);
  } catch { console.error("analytics: mixpanel unavailable"); }
}
