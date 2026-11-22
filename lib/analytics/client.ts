import { COLLECT_PATH, DEVICE_HEADER, KEPT_QUERY, UTM_KEYS, classifyPath, referringDomain, type ClientEvent, type Props } from "./events";

/**
 * Dependency-free browser tracker. Events are batched and posted to this
 * site's own collector, which forwards them to Analytics Engine and Mixpanel.
 *
 * Identity is pseudonymous: a random device id, a 30-minute session id and,
 * after sign-in, the account's internal id. No email address, IP address,
 * search text or form content is ever sent. Global Privacy Control and Do Not
 * Track turn tracking off, as do automated browsers (unless `dfa.debug` is set
 * in localStorage) and embedded previews.
 */

const SESSION_IDLE = 30 * 60 * 1000;
const KEYS = { device: "dfa.did", user: "dfa.uid", session: "dfa.ses", first: "dfa.ft", debug: "dfa.debug" } as const;

type Session = { id: string; last: number; pages: number; landing: string; referrer: string | null; utm: Props };
type Queued = { e: ClientEvent; t: number; id: string; p: Props };

let queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let enabledCache: boolean | undefined;
let memory: Record<string, string> = {};

function read(key: string) {
  try { return window.localStorage.getItem(key); } catch { return memory[key] ?? null; }
}
function write(key: string, value: string | null) {
  try { if (value === null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, value); }
  catch { if (value === null) delete memory[key]; else memory[key] = value; }
}
function json<T>(key: string): T | null {
  try { return JSON.parse(read(key) ?? "null") as T | null; } catch { return null; }
}

export function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function analyticsEnabled() {
  if (enabledCache !== undefined) return enabledCache;
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const debug = read(KEYS.debug) === "1";
  enabledCache = debug || !(
    nav.globalPrivacyControl === true || nav.doNotTrack === "1" || nav.msDoNotTrack === "1"
    || nav.webdriver === true || window.top !== window.self
  );
  return enabledCache;
}

export function deviceId() {
  let id = read(KEYS.device);
  if (!id) { id = uuid(); write(KEYS.device, id); }
  return id;
}

const userId = () => read(KEYS.user);

function campaign(search: URLSearchParams): Props {
  const utm: Props = {};
  for (const key of UTM_KEYS) { const value = search.get(key); if (value) utm[key] = value.slice(0, 120); }
  return utm;
}

/** Continue or start the visit. A new campaign landing always starts a new session. */
function session(advance: boolean): Session {
  const now = Date.now();
  const search = new URLSearchParams(window.location.search);
  const utm = campaign(search);
  const external = referringDomain(document.referrer);
  const ownHost = window.location.hostname.replace(/^www\./, "");
  let current = json<Session>(KEYS.session);
  const newCampaign = Object.keys(utm).length > 0 && JSON.stringify(utm) !== JSON.stringify(current?.utm ?? {});
  if (!current || now - current.last > SESSION_IDLE || newCampaign) {
    const { pageType } = classifyPath(window.location.pathname);
    current = { id: uuid(), last: now, pages: 0, landing: pageType, referrer: external && external !== ownHost ? external : null, utm };
  }
  current.last = now;
  if (advance) current.pages += 1;
  write(KEYS.session, JSON.stringify(current));
  if (!read(KEYS.first)) {
    write(KEYS.first, JSON.stringify({ referrer: current.referrer, landing: current.landing, utm, at: new Date(now).toISOString() }));
  }
  return current;
}

function context(): Props {
  const { pageType, slug, locale } = classifyPath(window.location.pathname);
  const current = session(false);
  const first = json<{ referrer: string | null; landing: string; utm: Props; at: string }>(KEYS.first);
  const search = new URLSearchParams(window.location.search);
  const kept: Props = {};
  for (const key of KEPT_QUERY) { const value = search.get(key); if (value) kept[`q_${key}`] = value.slice(0, 80); }
  return {
    path: window.location.pathname,
    $current_url: window.location.origin + window.location.pathname,
    page_type: pageType,
    slug,
    locale,
    session_page_index: current.pages,
    landing_page_type: current.landing,
    $referring_domain: current.referrer,
    ...current.utm,
    initial_referring_domain: first?.referrer ?? null,
    initial_landing_page_type: first?.landing ?? null,
    initial_utm_source: (first?.utm?.utm_source as string | undefined) ?? null,
    initial_utm_campaign: (first?.utm?.utm_campaign as string | undefined) ?? null,
    $screen_width: window.screen?.width ?? null,
    viewport_width: window.innerWidth,
    ...kept,
  };
}

function send(useBeacon: boolean) {
  clearTimeout(timer);
  timer = undefined;
  if (!queue.length) return;
  const events = queue.splice(0, 50);
  const body = JSON.stringify({ v: 1, d: deviceId(), u: userId(), s: json<Session>(KEYS.session)?.id ?? null, events });
  // text/plain keeps sendBeacon a simple request in every browser.
  const blob = new Blob([body], { type: "text/plain" });
  let sent = false;
  if (useBeacon && typeof navigator.sendBeacon === "function") {
    try { sent = navigator.sendBeacon(COLLECT_PATH, blob); } catch { sent = false; }
  }
  if (!sent) {
    fetch(COLLECT_PATH, { method: "POST", body, keepalive: body.length < 60_000, credentials: "same-origin", headers: { "Content-Type": "text/plain" } }).catch(() => {});
  }
  if (queue.length) send(useBeacon);
}

/** Send anything still queued, using a beacon so it survives the page closing. */
export function flush() { send(true); }

/** Queue a funnel event with the current page and visit context. */
export function track(event: ClientEvent, props: Props = {}, options: { newPage?: boolean } = {}) {
  if (!analyticsEnabled()) return;
  try {
    if (options.newPage) session(true);
    queue.push({ e: event, t: Date.now(), id: uuid(), p: { ...context(), ...props } });
    if (read(KEYS.debug) === "1") console.info("[analytics]", event, props);
    if (queue.length >= 20) send(false);
    else if (!timer) timer = setTimeout(() => send(false), 2000);
  } catch {
    // Tracking must never break the page.
  }
}

/** Link this browser's journey to an account. Only the internal account id is sent. */
export function identify(id: string | null | undefined) {
  if (!id || !analyticsEnabled()) return;
  if (read(KEYS.user) === id) return;
  write(KEYS.user, id);
}

/** Forget the account on sign-out; the device id stays so the next visit remains anonymous. */
export function resetIdentity() { write(KEYS.user, null); }

/** Headers that let commerce routes attribute server-confirmed events to this browser. */
export function deviceHeaders(): Record<string, string> {
  return analyticsEnabled() ? { [DEVICE_HEADER]: deviceId() } : {};
}

/** Test hook. */
export function resetAnalyticsForTests() { queue = []; enabledCache = undefined; memory = {}; clearTimeout(timer); timer = undefined; }
