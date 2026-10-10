/**
 * One scheduler for every gallery card's demo video, so a page full of cards
 * plays like a page and not like forty decoders at once.
 *
 * - Near view (within NEAR_MARGIN of the viewport) a card gets its source, so
 *   the first frame is decoded before it scrolls in.
 * - Of the cards meaningfully in view, the most visible play (see MAX_PLAYING);
 *   the rest hold their frame. A hovered or keyboard-focused card always
 *   plays, taking the place of the least visible one.
 * - Off screen for UNLOAD_AFTER_MS, a card drops its source and its decoder.
 * - Everything pauses while the tab is hidden, and stops for good if the
 *   reader turns on reduced motion.
 */

/**
 * Most videos playing at once. A 1440x900 gallery shows at most two rows of
 * three cards half or more on screen (six), a phone one or two, so six never
 * holds back a card a normal window shows. With hardware decoding each
 * 1280x800 clip costs about 2.5% of one core (measured on an M1: 7% idle, 22%
 * with six playing). Machines that report four cores or 4 GB or less, where
 * decoding may land on the CPU, get three.
 */
export const MAX_PLAYING = 6;
const MAX_PLAYING_LOW_END = 3;

function cap(): number {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const lowEnd = (nav.hardwareConcurrency || 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
  return lowEnd ? MAX_PLAYING_LOW_END : MAX_PLAYING;
}

/** A card plays once this much of it is on screen. */
const IN_VIEW_AT = 0.5;
/** Sources attach this far ahead of the viewport, so playback starts as the card arrives. */
const NEAR_MARGIN = "400px 0px";
const UNLOAD_AFTER_MS = 2000;

export type PlaybackClient = {
  /** Attach (true) or drop (false) the video source. */
  setLoaded(loaded: boolean): void;
  /** Play (true) or hold (false). Only called while loaded. */
  setPlaying(playing: boolean): void;
};

type Entry = {
  client: PlaybackClient;
  ratio: number;
  near: boolean;
  loaded: boolean;
  playing: boolean;
  engaged: boolean;
  unload?: number;
};

const entries = new Map<Element, Entry>();
let nearIO: IntersectionObserver | null = null;
let viewIO: IntersectionObserver | null = null;
let frame = 0;
let disabled = false;

/** Reduced motion and Save-Data readers get the poster only. */
export function videoAllowed(): boolean {
  if (disabled) return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !conn?.saveData;
}

function schedule() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    apply();
  });
}

function apply() {
  const hidden = document.visibilityState === "hidden";
  const mid = window.innerHeight / 2;
  const ranked = [...entries]
    .filter(([, e]) => e.loaded && (e.engaged || e.ratio >= IN_VIEW_AT))
    .map(([card, e]) => {
      const r = card.getBoundingClientRect();
      return { e, engaged: e.engaged, ratio: e.ratio, off: Math.abs(r.top + r.height / 2 - mid) };
    })
    .sort((a, b) => Number(b.engaged) - Number(a.engaged) || b.ratio - a.ratio || a.off - b.off);
  const play = new Set(hidden || disabled ? [] : ranked.slice(0, cap()).map((x) => x.e));
  for (const e of entries.values()) {
    const want = play.has(e);
    if (want !== e.playing) {
      e.playing = want;
      e.client.setPlaying(want);
    }
  }
}

function setNear(card: Element, near: boolean) {
  const e = entries.get(card);
  if (!e || e.near === near) return;
  e.near = near;
  window.clearTimeout(e.unload);
  if (near) {
    if (!e.loaded) {
      e.loaded = true;
      e.client.setLoaded(true);
    }
  } else {
    e.unload = window.setTimeout(() => {
      if (e.near || !e.loaded) return;
      if (e.playing) {
        e.playing = false;
        e.client.setPlaying(false);
      }
      e.loaded = false;
      e.client.setLoaded(false);
    }, UNLOAD_AFTER_MS);
  }
  schedule();
}

function init() {
  if (nearIO) return;
  nearIO = new IntersectionObserver((list) => list.forEach((x) => setNear(x.target, x.isIntersecting)), { rootMargin: NEAR_MARGIN });
  viewIO = new IntersectionObserver(
    (list) => {
      for (const x of list) {
        const e = entries.get(x.target);
        if (e) e.ratio = x.isIntersecting ? x.intersectionRatio : 0;
      }
      schedule();
    },
    { threshold: [0, 0.25, 0.5, 0.75, 1] },
  );
  document.addEventListener("visibilitychange", schedule);
  window.addEventListener("resize", schedule, { passive: true });
  window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", (m) => {
    if (!m.matches) return;
    disabled = true;
    for (const e of entries.values()) {
      e.playing = false;
      e.client.setPlaying(false);
      e.loaded = false;
      e.client.setLoaded(false);
    }
  });
}

/** Hand a card to the scheduler. Returns the cleanup and an engage(on) for hover and focus. */
export function registerCard(card: Element, client: PlaybackClient): { engage(on: boolean): void; release(): void } {
  init();
  const entry: Entry = { client, ratio: 0, near: false, loaded: false, playing: false, engaged: false };
  entries.set(card, entry);
  nearIO!.observe(card);
  viewIO!.observe(card);
  return {
    engage(on) {
      if (entry.engaged === on) return;
      entry.engaged = on;
      schedule();
    },
    release() {
      window.clearTimeout(entry.unload);
      nearIO!.unobserve(card);
      viewIO!.unobserve(card);
      entries.delete(card);
      schedule();
    },
  };
}
