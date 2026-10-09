"use client";

import { createElement, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useReducedMotion } from "motion/react";

/* ------------------------------------------------------------------ */
/* Glyph sets                                                           */
/* ------------------------------------------------------------------ */

/**
 * "auto" is case-aware: lowercase scrambles through lowercase, capitals through
 * capitals, digits through digits, and punctuation never scrambles. Words keep
 * their silhouette while they decode, which is what makes it read as type
 * rather than noise.
 */
export type TextDecodeGlyphs = "auto" | "symbols" | "blocks" | "binary" | "hex" | (string & {});

// Mid-width letters only: no i/l/j or m/w, so glyphs sit inside the final
// character's box even in a proportional face.
const LOWER = "abcdeghknopqrsuvxyz";
const UPPER = "ABCDEFGHKLNOPRSTUVXYZ";
const DIGIT = "0123456789";

const PRESETS: Record<string, string> = {
  symbols: "#%&*+=-/\\<>[]{}|:;_~",
  blocks: "░▒▓▖▗▘▝▚▞▙▛▜▟",
  binary: "01",
  hex: "0123456789ABCDEF",
};

/** Characters the effect leaves alone in "auto" mode. */
const isScramblable = (ch: string, glyphs: TextDecodeGlyphs) =>
  glyphs === "auto" ? /[A-Za-z0-9]/.test(ch) : /\S/.test(ch);

function poolFor(ch: string, glyphs: TextDecodeGlyphs) {
  if (glyphs === "auto") {
    if (/[a-z]/.test(ch)) return LOWER;
    if (/[A-Z]/.test(ch)) return UPPER;
    return DIGIT;
  }
  return PRESETS[glyphs] ?? glyphs;
}

/** Cheap, stable hash so a glyph sequence never repeats the same pattern twice in a row. */
function hash(a: number, b: number, c: number) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

type Tag = "span" | "p" | "div" | "h1" | "h2" | "h3" | "h4" | "li" | "strong";

export type TextDecodeProps = {
  /** The text. Use \n for a hard line break; long lines wrap normally. */
  text?: string;
  /** "view" decodes once when 30% visible, "hover" on pointer enter or keyboard focus, "both" does both. */
  trigger?: "view" | "hover" | "both";
  /** How fast the resolving edge travels, in characters per second. Long strings are capped at ~1.1s. */
  speed?: number;
  /** "auto" (case-aware letters and digits), a preset ("symbols", "blocks", "binary", "hex") or your own string of glyphs. */
  glyphs?: TextDecodeGlyphs;
  /** Colour of the brief flash as each character lands. */
  flashColor?: string;
  /** Milliseconds to wait before the on-view decode. Stagger several lines with this. */
  delay?: number;
  /** Change this value to replay the decode. */
  replayKey?: string | number;
  /** Element to render. Inside a link or button, hover and focus on that parent trigger the effect. */
  as?: Tag;
  className?: string;
  style?: CSSProperties;
  onDone?: () => void;
};

type Cell = { ch: string; scramble: boolean } | { br: true };
type Phase = 0 | 1 | 2; // waiting, scrambling, resolved

const MAX_SWEEP = 1100;
const GLYPH_MS = 56;

export function TextDecode({
  text = "Signal found at 1420 MHz.",
  trigger = "both",
  speed = 32,
  glyphs = "auto",
  flashColor = "#ffffff",
  delay = 0,
  replayKey,
  as = "span",
  className,
  style,
  onDone,
}: TextDecodeProps) {
  const reduce = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLElement | null>(null);
  const cellRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const raf = useRef(0);
  const running = useRef(false);
  const seed = useRef(1);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const reveals = trigger !== "hover";
  // The first render is the pre-reveal state, so server HTML never flashes the final text.
  const [armed] = useState(reveals);

  const cells = useMemo<Cell[]>(() => {
    const out: Cell[] = [];
    for (const ch of Array.from(text)) out.push(ch === "\n" ? { br: true } : { ch, scramble: isScramblable(ch, glyphs) });
    return out;
  }, [text, glyphs]);

  /** Writes one cell's state to the DOM. Never goes through React, so a 60-character line costs nothing. */
  const paint = (i: number, state: "hidden" | "glyph" | "old" | "final" | "flash", glyph = "") => {
    const el = cellRefs.current[i];
    if (!el) return;
    const base = el.firstElementChild as HTMLElement;
    const over = el.lastElementChild as HTMLElement;
    if (state === "hidden") {
      base.style.opacity = "0";
      over.style.opacity = "0";
    } else if (state === "glyph") {
      base.style.opacity = "0";
      over.getAnimations().forEach((a) => a.cancel());
      if (over.textContent !== glyph) over.textContent = glyph;
      over.style.color = "currentColor";
      over.style.textShadow = "none";
      over.style.opacity = "0.5";
    } else if (state === "old") {
      // The previous value holds its place until the wave reaches it.
      base.style.opacity = "0";
      over.getAnimations().forEach((a) => a.cancel());
      over.textContent = glyph;
      over.style.color = "currentColor";
      over.style.textShadow = "none";
      over.style.opacity = glyph ? "1" : "0";
    } else if (state === "final") {
      base.style.opacity = "1";
      over.style.opacity = "0";
    } else {
      base.style.opacity = "1";
      over.textContent = (cells[i] as { ch: string }).ch;
      over.style.color = flashColor;
      over.style.textShadow = `0 0 12px color-mix(in srgb, ${flashColor} 30%, transparent)`;
      over.style.opacity = "1";
      over
        .animate([{ opacity: 1 }, { opacity: 0 }], { duration: 560, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "forwards" })
        .finished.then(() => {
          over.style.opacity = "0";
        })
        .catch(() => {});
    }
  };

  const showAll = () => {
    cancelAnimationFrame(raf.current);
    running.current = false;
    cells.forEach((c, i) => {
      if (!("br" in c)) paint(i, "final");
    });
  };

  /** "reveal" starts from nothing; "replay" sweeps a scramble band through text that is already there. */
  const run = (mode: "reveal" | "replay", wait = 0, from?: string) => {
    cancelAnimationFrame(raf.current);
    running.current = true;
    const s = ++seed.current;
    const old = from === undefined ? null : Array.from(from.replace(/\n/g, " "));
    const idx: number[] = [];
    cells.forEach((c, i) => {
      if ("br" in c) return;
      // On a text change, characters that didn't change stay put: only the difference decodes.
      if (old && old[i] === c.ch) paint(i, "final");
      else idx.push(i);
    });
    const n = idx.length;
    const stagger = Math.min(1000 / Math.max(1, speed), MAX_SWEEP / Math.max(1, n));
    const lead = Math.min(380, Math.max(170, stagger * 7));
    const phases: Phase[] = new Array(cells.length).fill(0);
    const offsets = cells.map((_, i) => hash(i, s, 7) % GLYPH_MS);
    const t0 = performance.now() + wait;
    if (mode === "reveal") idx.forEach((i) => paint(i, "hidden"));
    else if (old) idx.forEach((i) => paint(i, "old", old[i] ?? ""));

    const tick = (now: number) => {
      const t = now - t0;
      let pending = false;
      for (let k = 0; k < n; k++) {
        const i = idx[k];
        const cell = cells[i] as { ch: string; scramble: boolean };
        const start = k * stagger;
        const end = cell.scramble ? start + lead : start;
        if (t < start) {
          pending = true;
          continue;
        }
        if (t < end) {
          pending = true;
          const step = Math.floor((t + offsets[i]) / GLYPH_MS);
          const pool = poolFor(cell.ch, glyphs);
          let g = pool[hash(i, step, s) % pool.length];
          if (g === cell.ch && pool.length > 1) g = pool[(pool.indexOf(g) + 1) % pool.length];
          phases[i] = 1;
          paint(i, "glyph", g);
          continue;
        }
        if (phases[i] !== 2) {
          phases[i] = 2;
          // Spaces and punctuation simply appear; scrambled characters land with a flash.
          paint(i, cell.scramble ? "flash" : "final");
        }
      }
      if (pending) raf.current = requestAnimationFrame(tick);
      else {
        running.current = false;
        doneRef.current?.();
      }
    };
    raf.current = requestAnimationFrame(tick);
  };

  // Keep the latest closures for the listeners below without re-binding them.
  const runRef = useRef(run);
  runRef.current = run;
  const showAllRef = useRef(showAll);
  showAllRef.current = showAll;

  // On-view decode (once), text changes, and the reduced-motion shortcut.
  const prevText = useRef(text);
  const revealed = useRef(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const from = prevText.current;
    prevText.current = text;
    if (reduce) {
      showAllRef.current();
      return;
    }
    if (from !== text) {
      // The old value scrambles into the new one, left to right.
      revealed.current = true;
      runRef.current("replay", 0, from);
      return;
    }
    if (!reveals || revealed.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          revealed.current = true;
          runRef.current("reveal", delay);
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, reduce]);

  // Hover and keyboard focus, on the nearest interactive ancestor when there is one.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || trigger === "view" || reduce) return;
    const target = (el.closest("a, button, [role='button'], [data-decode-trigger]") as HTMLElement | null) ?? el;
    const go = () => {
      if (!running.current) runRef.current("replay");
    };
    const onFocus = () => {
      if (target.matches(":focus-visible")) go();
    };
    target.addEventListener("pointerenter", go);
    target.addEventListener("focusin", onFocus);
    return () => {
      target.removeEventListener("pointerenter", go);
      target.removeEventListener("focusin", onFocus);
    };
  }, [trigger, reduce]);

  // Explicit replays.
  const prevReplay = useRef(replayKey);
  useEffect(() => {
    if (prevReplay.current === replayKey) return;
    prevReplay.current = replayKey;
    if (reduce) return;
    runRef.current(reveals ? "reveal" : "replay");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  cellRefs.current.length = cells.length;

  return createElement(
    as,
    {
      ref: (node: HTMLElement | null) => {
        rootRef.current = node;
      },
      className,
      style,
    },
    <>
      <style>{CSS}</style>
      <span className="sr-only select-none">{text}</span>
      <span aria-hidden="true">
        {cells.map((c, i) =>
          "br" in c ? (
            <br key={i} />
          ) : c.ch === " " ? (
            <span
              key={i}
              ref={(node) => {
                cellRefs.current[i] = node;
              }}
              className="tdc-cell"
            >
              <span> </span>
              <span className="tdc-over" />
            </span>
          ) : (
            <span
              key={i}
              ref={(node) => {
                cellRefs.current[i] = node;
              }}
              className="tdc-cell"
            >
              {/* The final character is always in the flow (only its opacity changes), so its width is reserved from frame one. */}
              <span style={armed ? { opacity: 0 } : undefined}>{c.ch}</span>
              <span className="tdc-over" />
            </span>
          ),
        )}
      </span>
    </>,
  );
}

/**
 * The overlay fills the character's content box and centres its glyph on both
 * axes. Centring any line box inside the content area puts its baseline exactly
 * on the real character's baseline, whatever the font or line-height.
 */
const CSS = `.tdc-cell{position:relative}.tdc-over{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;user-select:none;-webkit-user-select:none;opacity:0;white-space:pre}`;

/* ------------------------------------------------------------------ */
/* Demo                                                                 */
/* ------------------------------------------------------------------ */

const readings = [
  "Hydrogen line · drift corrected 0.003 Hz · 04:12:51 UTC",
  "Hydrogen line · SNR 41.7 dB · 04:12:55 UTC",
  "Hydrogen line · source RA 19h 22m 40s · 04:12:59 UTC",
  "Hydrogen line · integration 6 of 8 complete · 04:13:03 UTC",
];

const links = ["Archive", "Observations", "Instruments", "Contact"];

function TextDecodeDemo() {
  const [replay, setReplay] = useState(0);
  const [reading, setReading] = useState(0);
  const reduce = useReducedMotion() ?? false;
  const stageRef = useRef<HTMLDivElement>(null);

  // The one ambient signal: the status line takes a new reading every few seconds, and decodes it.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);
    const id = window.setInterval(() => {
      if (visible && !document.hidden) setReading((r) => (r + 1) % readings.length);
    }, 4200);
    return () => {
      io.disconnect();
      window.clearInterval(id);
    };
  }, []);

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-black px-5 py-16 text-white sm:px-10">
      <div ref={stageRef} className="@container w-full max-w-[960px]">
        <TextDecode
          as="p"
          text="Observation log · Dish 04 / 07"
          trigger="both"
          replayKey={replay}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/45"
        />

        <TextDecode
          as="h2"
          text={"Signal found\nat 1420 MHz."}
          trigger="view"
          delay={160}
          speed={26}
          replayKey={replay}
          className="mt-6 font-display text-[clamp(2.75rem,1.1rem+6.2vw,6.5rem)] font-medium leading-[0.95] tracking-[-0.045em] text-white"
        />

        <p className="mt-9 flex items-start gap-3 font-mono text-[12.5px] leading-[1.6] text-white/60 @xl:text-[13px]">
          <span aria-hidden="true" className="relative mt-[7px] flex size-1.5 shrink-0">
            {!reduce && <span className="absolute inset-0 animate-ping rounded-full bg-[#7dd3a8] opacity-60" />}
            <span className="relative size-1.5 rounded-full bg-[#7dd3a8]" />
          </span>
          <TextDecode text={readings[reading]} trigger="view" glyphs="binary" delay={520} speed={60} replayKey={replay} />
        </p>

        <div className="mt-14 flex flex-col gap-6 border-t border-white/[0.09] pt-5 @xl:flex-row @xl:items-center @xl:justify-between">
          <nav aria-label="Observatory">
            <ul className="-mx-2 grid grid-cols-2 gap-x-2 gap-y-1 @md:flex @md:flex-wrap @md:gap-x-4">
              {links.map((l, i) => (
                <li key={l}>
                  <a
                    href={`#${l.toLowerCase()}`}
                    className="group inline-flex h-11 items-center gap-2.5 rounded-[6px] px-2 font-mono text-[12px] uppercase tracking-[0.14em] text-white/55 outline-none transition-colors duration-150 hover:text-white focus-visible:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  >
                    <span aria-hidden="true" className="text-white/25 transition-colors duration-150 group-hover:text-[#7dd3a8]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <TextDecode text={l} trigger="hover" glyphs="symbols" speed={40} />
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <button
            type="button"
            onClick={() => setReplay((r) => r + 1)}
            className="group inline-flex h-11 items-center gap-2 self-start rounded-full px-4 font-mono text-[11px] uppercase tracking-[0.16em] text-white/55 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] outline-none transition-[color,background-color,transform] duration-150 hover:bg-white/[0.04] hover:text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black active:scale-[0.97] @xl:self-auto"
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-3.5 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-rotate-45">
              <path d="M2.75 8a5.25 5.25 0 1 0 1.6-3.77" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M2.5 2.5v2.75h2.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Replay
          </button>
        </div>
      </div>
    </div>
  );
}

export default TextDecodeDemo;
