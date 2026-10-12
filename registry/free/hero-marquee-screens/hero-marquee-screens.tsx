"use client";

import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { motion, useInView, useReducedMotion, type Variants } from "motion/react";
import { ArrowRight, Check, Pause, Play } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

type Link = { label: string; href: string };

/** One product screen in the marquee: a framed header plus whatever markup you draw for its body. */
export type MarqueeScreen = {
  title: string;
  /** Mono note on the right of the frame header ("128 active", "Week 42"). */
  meta?: string;
  /** The screen itself, drawn in markup. It is laid out on a 320 × 176 canvas and scaled with the row. */
  body: ReactNode;
};

export type HeroMarqueeScreensProps = {
  /** Mono line above the headline, after a small accent dot. */
  eyebrow?: string;
  headline?: string;
  body?: string;
  primary?: Link;
  secondary?: Link;
  /** Product name in every frame header and in the screen-reader description. */
  product?: string;
  /** The screens the rows are built from. Each row starts at a different one, so no two rows line up. */
  screens?: MarqueeScreen[];
  /** How many rows drift under the copy: 2 or 3. Neighbouring rows run in opposite directions. */
  rows?: number;
  /** Drift speed in px per second. The row under the pointer eases down to a fifth of it. */
  speed?: number;
  /** Lay the rows on a tabletop: tipped back and turned a few degrees. */
  tilt?: boolean;
  /** Copy alignment. Left splits headline and body into two columns on wide containers. */
  align?: "left" | "center";
  /** The one signal colour: the eyebrow dot, and the live or selected thing on each screen. */
  accent?: string;
  theme?: "dark" | "light";
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    page: "#08080a",
    ink: "#f5f5f6",
    onInk: "#08080a",
    card: "#111114",
    cardHover: "#16161a",
    line: "rgba(255,255,255,0.08)",
    lineHover: "rgba(255,255,255,0.2)",
    sheen: "rgba(255,255,255,0.06)",
    shadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 48px -24px rgba(0,0,0,0.9), 0 8px 16px -8px rgba(0,0,0,0.6)",
  },
  light: {
    page: "#ececea",
    ink: "#111113",
    onInk: "#ffffff",
    card: "#ffffff",
    cardHover: "#ffffff",
    line: "rgba(17,17,19,0.08)",
    lineHover: "rgba(17,17,19,0.22)",
    sheen: "rgba(255,255,255,1)",
    shadow: "0 1px 0 rgba(255,255,255,1) inset, 0 22px 40px -26px rgba(17,17,19,0.32), 0 6px 14px -8px rgba(17,17,19,0.12)",
  },
} as const;

/** International orange: the colour of a container that is moving right now. */
const DEFAULT_ACCENT = "#ff5a1f";
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** The design canvas every screen is drawn on; rows scale it with the container. */
const SCREEN = { w: 320, h: 208, header: 32 } as const;

/** One timeline, in seconds: copy first, then the rows land, then each row sets off. */
const T = {
  eyebrow: 0,
  headline: 0.06,
  word: 0.035,
  body: 0.24,
  actions: 0.32,
  rows: 0.46,
  rowStep: 0.08,
  launchAfter: 0.45,
} as const;

/** Drift feel. Velocity eases towards its goal, so a hover glides down instead of braking. */
const DRIFT = {
  goTau: 0.8, // seconds to ease up to cruising speed
  slowTau: 0.3, // seconds to ease down when the pointer arrives
  hoverFactor: 0.2, // the hovered row keeps a fifth of its speed: slowed, never frozen
  rowFactors: [1, 0.78, 1.14], // rows never move in lockstep
  maxStep: 0.05, // clamp long frames (tab switches) so rows never jump
  maxRepeats: 6,
} as const;

/** Tabletop pose for `tilt`. Scaled up so the turned rows still reach every corner. */
const TILT = { rotateX: 24, rotateZ: -7, scale: 1.16, perspective: 1600 } as const;
const SPRING_SOFT = { type: "spring", stiffness: 180, damping: 26 } as const;

const reveal: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(8px)" },
  show: (delay: number) => ({ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: EASE_OUT, delay }, transitionEnd: { filter: "none" } }),
};
const rowIn: Variants = {
  hidden: { opacity: 0, y: 24, filter: "blur(8px)" },
  show: (delay: number) => ({ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.75, ease: EASE_OUT, delay }, transitionEnd: { filter: "none" } }),
};
const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0 } },
};

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--hms-ink)";
const META = "font-mono text-[9px] uppercase tracking-[0.12em] text-(--hms-ink)/65";

function cssVars(theme: "dark" | "light", accent: string): CSSProperties {
  const p = PALETTE[theme];
  return {
    "--hms-page": p.page,
    "--hms-ink": p.ink,
    "--hms-on-ink": p.onInk,
    "--hms-card": p.card,
    "--hms-card-hover": p.cardHover,
    "--hms-line": p.line,
    "--hms-line-hover": p.lineHover,
    "--hms-sheen": p.sheen,
    "--hms-shadow": p.shadow,
    "--hms-accent": accent,
  } as CSSProperties;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Each row walks the screens with its own stride (1, 3, 5… whichever is coprime with the count),
 * from its own start. Every row still shows every screen once per lap, but neighbours are never
 * the same, so screens can't stack into columns however the phases drift.
 */
function rowScreens(screens: MarqueeScreen[], row: number) {
  const n = screens.length;
  if (n < 3) return screens;
  let step = 1 + 2 * row;
  while (gcd(step % n || 1, n) !== 1) step += 1;
  const start = (row * 5) % n;
  return screens.map((_, i) => screens[(start + i * step) % n]);
}

/* ------------------------------------------------------------------ */
/* Hooks                                                                */
/* ------------------------------------------------------------------ */

/** True while the element is on screen and the tab is visible: the only time the rows drift. */
function useOnScreen(ref: RefObject<HTMLElement | null>) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let inView = false;
    const sync = () => setOn(inView && !document.hidden);
    const io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      sync();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", sync);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [ref]);
  return on;
}

/* ------------------------------------------------------------------ */
/* Hero                                                                 */
/* ------------------------------------------------------------------ */

export function HeroMarqueeScreens({
  eyebrow = "Halyard 3.0 · For freight teams under 20",
  headline = "Run freight like a team of fifty.",
  body = "Quotes, bookings, customs and invoices on one quiet desk. Halyard watches every container, so your four people only open the ones that need them.",
  primary = { label: "Start a free trial", href: "#trial" },
  secondary = { label: "Book a 20-minute demo", href: "#demo" },
  product = "Halyard",
  screens = DEFAULT_SCREENS,
  rows = 3,
  speed = 22,
  tilt = false,
  align = "center",
  accent = DEFAULT_ACCENT,
  theme = "dark",
  className = "",
}: HeroMarqueeScreensProps) {
  const reduce = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { once: true, amount: 0.2 });
  const onScreen = useOnScreen(bandRef);
  const [paused, setPaused] = useState(false);
  const headingId = useId();
  const rowCount = Math.round(Math.min(3, Math.max(2, rows)));
  const centred = align === "center";
  const v = (variants: Variants) => (reduce ? fade : variants);
  const words = headline.split(/\s+/).filter(Boolean);

  return (
    <motion.section
      ref={rootRef}
      aria-labelledby={headingId}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      className={`@container relative isolate w-full overflow-hidden bg-(--hms-page) font-sans text-(--hms-ink) antialiased ${className}`}
      style={cssVars(theme, accent)}
    >
      <div className="mx-auto w-full max-w-[1320px] px-4 pt-16 @3xl:px-10 @3xl:pt-24 @6xl:px-14 @6xl:pt-24">
        <div className={centred ? "mx-auto flex max-w-[1040px] flex-col items-center text-center" : "grid grid-cols-1 items-end gap-x-14 gap-y-0 @5xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]"}>
          <div className={centred ? "flex flex-col items-center" : "min-w-0"}>
            <motion.p variants={v(reveal)} custom={T.eyebrow} className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-(--hms-ink)/65 @3xl:text-[12px]">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-(--hms-accent)" />
              {eyebrow}
            </motion.p>
            <h1
              id={headingId}
              className={`mt-5 font-display text-[clamp(2.75rem,7.6cqi,6.4rem)] font-semibold leading-[0.92] tracking-[-0.055em] text-balance @3xl:mt-6 ${centred ? "max-w-[15ch]" : "max-w-[14ch]"}`}
            >
              {words.map((word, i) => (
                <Fragment key={`${word}-${i}`}>
                  <motion.span variants={v(reveal)} custom={T.headline + i * T.word} className="inline-block">
                    {word}
                  </motion.span>
                  {i < words.length - 1 ? " " : null}
                </Fragment>
              ))}
            </h1>
          </div>

          <div className={centred ? "flex flex-col items-center" : "min-w-0 @5xl:pb-2"}>
            <motion.p
              variants={v(reveal)}
              custom={T.body}
              className={`mt-6 max-w-[50ch] text-[15px] leading-[1.6] text-pretty text-(--hms-ink)/65 @3xl:text-[17px] ${centred ? "@3xl:mt-7" : "@5xl:mt-0"}`}
            >
              {body}
            </motion.p>
            <motion.div variants={v(reveal)} custom={T.actions} className={`mt-8 flex flex-wrap items-center gap-x-6 gap-y-4 ${centred ? "justify-center" : ""}`}>
              <a
                href={primary.href}
                data-demo="cta"
                className={`group/cta inline-flex h-12 items-center gap-2 rounded-full bg-(--hms-ink) pr-5 pl-6 text-[15px] font-medium text-(--hms-on-ink) shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-[opacity,scale] duration-150 ease-out hover:opacity-90 active:scale-[0.97] ${FOCUS}`}
              >
                {primary.label}
                <ArrowRight aria-hidden="true" size={16} strokeWidth={2} className="transition-transform duration-150 ease-out group-hover/cta:translate-x-0.5 motion-reduce:transition-none" />
              </a>
              <a
                href={secondary.href}
                className={`inline-flex h-12 items-center rounded-full px-1 text-[15px] font-medium text-(--hms-ink)/70 underline decoration-(--hms-ink)/25 underline-offset-[6px] transition-colors duration-150 hover:text-(--hms-ink) hover:decoration-(--hms-ink)/60 ${FOCUS}`}
              >
                {secondary.label}
              </a>
            </motion.div>
          </div>
        </div>
      </div>

      <Band
        bandRef={bandRef}
        screens={screens}
        product={product}
        rowCount={rowCount}
        speed={speed}
        tilt={tilt}
        reduce={reduce}
        active={onScreen && !reduce}
        launched={inView}
        paused={paused}
      />

      {reduce ? null : (
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Play the moving screens" : "Pause the moving screens"}
          data-demo="pause"
          className={`absolute right-4 bottom-4 z-10 grid size-11 place-items-center rounded-full bg-(--hms-card) text-(--hms-ink)/75 shadow-[inset_0_0_0_1px_var(--hms-line),var(--hms-shadow)] transition-[color,scale] duration-150 hover:text-(--hms-ink) active:scale-[0.96] @3xl:right-8 @3xl:bottom-6 ${FOCUS}`}
        >
          {paused ? <Play aria-hidden="true" size={15} strokeWidth={2} /> : <Pause aria-hidden="true" size={15} strokeWidth={2} />}
        </button>
      )}
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* Band                                                                 */
/* ------------------------------------------------------------------ */

type BandProps = {
  bandRef: RefObject<HTMLDivElement | null>;
  screens: MarqueeScreen[];
  product: string;
  rowCount: number;
  speed: number;
  tilt: boolean;
  reduce: boolean;
  active: boolean;
  launched: boolean;
  paused: boolean;
};

/** Edges fade on all four sides; the bottom fade is longer so the last row sinks into the page. */
const BAND_MASK =
  "linear-gradient(to right, transparent, #000 11%, #000 89%, transparent), linear-gradient(to bottom, transparent, #000 7%, #000 78%, transparent)";

function Band({ bandRef, screens, product, rowCount, speed, tilt, reduce, active, launched, paused }: BandProps) {
  const description = `${product} screens drifting past: ${screens.map((s) => s.title.toLowerCase()).join(", ")}.`;
  return (
    <div className="relative mt-14 @3xl:mt-16">
      <p className="sr-only">{description}</p>
      <div
        ref={bandRef}
        aria-hidden="true"
        data-speed={speed}
        data-tilt={tilt ? "on" : "off"}
        className="relative overflow-hidden pt-4 pb-16 [--hms-s:0.72] @3xl:pb-20 @3xl:[--hms-s:0.82] @6xl:[--hms-s:0.86]"
        style={{ maskImage: BAND_MASK, WebkitMaskImage: BAND_MASK, maskComposite: "intersect", WebkitMaskComposite: "source-in" }}
      >
        <motion.div
          className="flex flex-col gap-3.5 @3xl:gap-[18px]"
          initial={false}
          animate={tilt ? { rotateX: TILT.rotateX, rotateZ: TILT.rotateZ, scale: TILT.scale } : { rotateX: 0, rotateZ: 0, scale: 1 }}
          transition={reduce ? { duration: 0 } : SPRING_SOFT}
          style={{ transformPerspective: TILT.perspective, transformOrigin: "50% 35%" }}
        >
          {Array.from({ length: rowCount }, (_, r) => (
            <motion.div key={r} variants={reduce ? fade : rowIn} custom={T.rows + r * T.rowStep} initial="hidden" animate={launched ? "show" : "hidden"}>
              <MarqueeRow
                index={r}
                screens={rowScreens(screens, r)}
                product={product}
                speed={speed * DRIFT.rowFactors[r % DRIFT.rowFactors.length]}
                active={active}
                launchAt={launched ? T.rows + r * T.rowStep + T.launchAfter : null}
                paused={paused}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Row                                                                  */
/* ------------------------------------------------------------------ */

type RowProps = {
  index: number;
  screens: MarqueeScreen[];
  product: string;
  speed: number;
  active: boolean;
  /** Seconds after mount when the row may start drifting; null until the hero is in view. */
  launchAt: number | null;
  paused: boolean;
};

type DriftState = { x: number; v: number; period: number; seeded: boolean; hover: boolean; launched: boolean };

function MarqueeRow({ index, screens, product, speed, active, launchAt, paused }: RowProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const setRef = useRef<HTMLDivElement>(null);
  const [reps, setReps] = useState(1);
  // Even rows travel left, odd rows right.
  const dir = index % 2 === 0 ? -1 : 1;
  const s = useRef<DriftState>({ x: 0, v: 0, period: 0, seeded: false, hover: false, launched: false });
  const live = useRef({ speed, paused });
  useEffect(() => {
    live.current = { speed, paused };
  }, [speed, paused]);

  const apply = () => {
    const t = trackRef.current;
    // Centre the middle set on x, so the track overhangs both ends of the row: tilted rows never show a corner.
    if (t) t.style.transform = `translate3d(${(s.current.x - 1.5 * s.current.period).toFixed(2)}px, 0, 0)`;
  };

  // One period is a full set plus its trailing gap. Repeat the set until it covers the row.
  useLayoutEffect(() => {
    const vp = viewportRef.current;
    const set = setRef.current;
    if (!vp || !set) return;
    const measure = () => {
      const st = s.current;
      st.period = set.offsetWidth;
      if (!st.seeded && st.period > 0) {
        // Each row starts at its own phase, so screens never line up into columns.
        st.x = st.period * ((index * 0.41 + 0.17) % 1);
        st.seeded = true;
      }
      if (st.period > 0) st.x = ((st.x % st.period) + st.period) % st.period;
      const single = st.period / reps;
      const need = Math.max(1, Math.ceil((vp.offsetWidth + 1) / Math.max(1, single)));
      if (need !== reps) setReps(Math.min(DRIFT.maxRepeats, need));
      apply();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(set);
    ro.observe(vp);
    return () => ro.disconnect();
    // `apply` only reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reps, index]);

  // Hold still until the row has landed, then set off.
  useEffect(() => {
    if (launchAt === null) return;
    const t = window.setTimeout(() => (s.current.launched = true), launchAt * 1000);
    return () => window.clearTimeout(t);
  }, [launchAt]);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const st = s.current;
      const dt = Math.min(DRIFT.maxStep, (now - last) / 1000);
      last = now;
      const { speed: cruise, paused: held } = live.current;
      const stopped = held || !st.launched;
      const goal = stopped ? 0 : cruise * dir * (st.hover ? DRIFT.hoverFactor : 1);
      const tau = st.hover || stopped ? DRIFT.slowTau : DRIFT.goTau;
      st.v += (goal - st.v) * (1 - Math.exp(-dt / tau));
      st.x += st.v * dt;
      if (st.period > 0) st.x = ((st.x % st.period) + st.period) % st.period;
      apply();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, dir]);

  const set = (copy: "real" | "clone") => (
    <div ref={copy === "real" ? setRef : undefined} className="flex shrink-0 gap-3.5 pr-3.5 @3xl:gap-[18px] @3xl:pr-[18px]">
      {Array.from({ length: reps }, (_, r) => (
        <Fragment key={r}>
          {screens.map((screen, i) => (
            <ScreenFrame key={`${r}-${i}`} screen={screen} product={product} />
          ))}
        </Fragment>
      ))}
    </div>
  );

  return (
    <div
      ref={viewportRef}
      data-demo={`row-${index}`}
      data-dir={dir < 0 ? "left" : "right"}
      onPointerEnter={(e) => {
        if (e.pointerType !== "touch") s.current.hover = true;
      }}
      onPointerLeave={() => {
        s.current.hover = false;
      }}
      className="relative py-1"
    >
      <div ref={trackRef} className="flex w-max will-change-transform">
        {set("clone")}
        {set("real")}
        {set("clone")}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Screen frame                                                         */
/* ------------------------------------------------------------------ */

const frameSize: CSSProperties = {
  width: `calc(${SCREEN.w}px * var(--hms-s))`,
  height: `calc(${SCREEN.h}px * var(--hms-s))`,
};
const canvasSize: CSSProperties = {
  width: SCREEN.w,
  height: SCREEN.h,
  transform: "scale(var(--hms-s))",
  transformOrigin: "0 0",
};

/** The card around every screen: hairline, top sheen, soft deep shadow; it lifts under the pointer. */
function ScreenFrame({ screen, product }: { screen: MarqueeScreen; product: string }) {
  return (
    <div
      style={frameSize}
      className="relative shrink-0 overflow-hidden rounded-[12px] bg-(--hms-card) shadow-[inset_0_0_0_1px_var(--hms-line),var(--hms-shadow)] transition-[translate,background-color,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:bg-(--hms-card-hover) hover:shadow-[inset_0_0_0_1px_var(--hms-line-hover),var(--hms-shadow)]"
    >
      <div style={canvasSize} className="flex flex-col">
        <div className="flex h-8 shrink-0 items-center justify-between border-b border-(--hms-ink)/[0.07] px-3">
          <div className="flex min-w-0 items-center gap-1.5">
            <Mark />
            <span className="text-[10.5px] font-medium text-(--hms-ink)/65">{product}</span>
            <span className="text-[10.5px] text-(--hms-ink)/65">/</span>
            <span className="truncate text-[10.5px] font-medium text-(--hms-ink)/90">{screen.title}</span>
          </div>
          {screen.meta ? <span className={META}>{screen.meta}</span> : null}
        </div>
        <div className="relative min-h-0 flex-1 p-3">{screen.body}</div>
      </div>
    </div>
  );
}

function Mark() {
  return (
    <svg aria-hidden="true" width="11" height="11" viewBox="0 0 12 12" className="shrink-0 text-(--hms-ink)">
      <path d="M6 1 L10.5 9.5 H6 Z" fill="currentColor" />
      <path d="M5 3.2 L5 9.5 H1.8 Z" fill="currentColor" opacity="0.45" />
      <path d="M1 10.6 H11" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* The default screens: Halyard, a freight desk, drawn in markup        */
/* ------------------------------------------------------------------ */

type ShipmentStatus = "transit" | "customs" | "delivered";

const SHIPMENTS: { ref: string; lane: string; status: ShipmentStatus; eta: string }[] = [
  { ref: "HLY-20418", lane: "NGB → RTM", status: "transit", eta: "Thu 14:20" },
  { ref: "HLY-20409", lane: "SHA → FXT", status: "customs", eta: "Fri 09:00" },
  { ref: "HLY-20391", lane: "PUS → HAM", status: "transit", eta: "Mon 06:40" },
  { ref: "HLY-20377", lane: "YTN → ANR", status: "delivered", eta: "Delivered" },
  { ref: "HLY-20362", lane: "TAO → GDN", status: "transit", eta: "Tue 18:05" },
];
const STATUS_LABEL: Record<ShipmentStatus, string> = { transit: "In transit", customs: "Customs", delivered: "Delivered" };

function StatusDot({ status }: { status: ShipmentStatus }) {
  if (status === "transit") return <span className="size-1.5 rounded-full bg-(--hms-accent)" />;
  if (status === "customs") return <span className="size-1.5 rounded-full ring-1 ring-(--hms-ink)/50 ring-inset" />;
  return <span className="size-1.5 rounded-full bg-(--hms-ink)/35" />;
}

function ShipmentsBody() {
  return (
    <div className="flex h-full flex-col text-[10px]">
      <div className={`grid grid-cols-[72px_68px_1fr_auto] gap-2 pb-1.5 ${META}`}>
        <span>Ref</span>
        <span>Lane</span>
        <span>Status</span>
        <span className="text-right">ETA</span>
      </div>
      {SHIPMENTS.map((row) => (
        <div key={row.ref} className="grid grid-cols-[72px_68px_1fr_auto] items-center gap-2 border-t border-(--hms-ink)/[0.06] py-[5.5px]">
          <span className="font-mono text-(--hms-ink)/90 tabular-nums">{row.ref}</span>
          <span className="text-(--hms-ink)/65">{row.lane}</span>
          <span className="flex items-center gap-1.5 text-(--hms-ink)/75">
            <StatusDot status={row.status} />
            {STATUS_LABEL[row.status]}
          </span>
          <span className="text-right text-(--hms-ink)/65 tabular-nums">{row.eta}</span>
        </div>
      ))}
    </div>
  );
}

/** Cubic Bézier point, for placing the vessel on its route without measuring the DOM. */
function bezier(t: number, p0: number, p1: number, p2: number, p3: number) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}
const ROUTE = { from: [18, 92], c1: [90, 18], c2: [200, 112], to: [278, 34], progress: 0.62 } as const;

function RouteBody() {
  const pattern = `hms-dots-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const { from, c1, c2, to, progress } = ROUTE;
  const d = `M${from[0]} ${from[1]} C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${to[0]} ${to[1]}`;
  const vx = bezier(progress, from[0], c1[0], c2[0], to[0]);
  const vy = bezier(progress, from[1], c1[1], c2[1], to[1]);
  return (
    <div className="flex h-full flex-col">
      <svg viewBox="0 0 296 120" className="h-[120px] w-full text-(--hms-ink)" aria-hidden="true">
        <defs>
          <pattern id={pattern} width="8" height="8" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill="currentColor" opacity="0.14" />
          </pattern>
        </defs>
        <rect width="296" height="120" rx="6" fill={`url(#${pattern})`} />
        <path d={d} fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1.2" strokeDasharray="3 3" />
        <path d={d} fill="none" stroke="var(--hms-accent)" strokeWidth="1.8" strokeLinecap="round" pathLength={1} strokeDasharray={`${progress} 1`} />
        <circle cx={from[0]} cy={from[1]} r="3" fill="currentColor" />
        <circle cx={to[0]} cy={to[1]} r="3" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <circle cx={vx} cy={vy} r="7" fill="var(--hms-accent)" opacity="0.18" />
        <circle cx={vx} cy={vy} r="3.4" fill="var(--hms-accent)" />
        <text x={from[0] + 8} y={from[1] + 16} className="fill-current font-mono text-[8.5px] uppercase" opacity="0.55">
          Ningbo
        </text>
        <text x={to[0] - 8} y={to[1] - 10} textAnchor="end" className="fill-current font-mono text-[8.5px] uppercase" opacity="0.55">
          Rotterdam
        </text>
      </svg>
      <div className="mt-auto flex items-baseline justify-between text-[10px]">
        <span className="font-medium text-(--hms-ink)/90">MSC Aurelia</span>
        <span className="text-(--hms-ink)/65 tabular-nums">Day 23 of 37 · ETA Thu 14:20</span>
      </div>
    </div>
  );
}

const INVOICE_LINES = [
  ["Ocean freight, 40′ HC", "£12,400.00"],
  ["Port handling", "£1,860.00"],
  ["Customs clearance", "£640.00"],
  ["Drayage to Leicester", "£3,520.00"],
] as const;

function InvoiceBody() {
  return (
    <div className="flex h-full flex-col text-[10px]">
      <div className="flex items-baseline justify-between">
        <span className="text-(--hms-ink)/65">Billed to</span>
        <span className="font-medium text-(--hms-ink)/90">Kestrel Foods Ltd</span>
      </div>
      <div className="mt-2.5 flex flex-col gap-[5px]">
        {INVOICE_LINES.map(([label, amount]) => (
          <div key={label} className="flex items-baseline justify-between">
            <span className="text-(--hms-ink)/65">{label}</span>
            <span className="font-mono text-(--hms-ink)/80 tabular-nums">{amount}</span>
          </div>
        ))}
      </div>
      <div className="mt-auto flex items-end justify-between border-t border-(--hms-ink)/[0.08] pt-2">
        <div>
          <div className={META}>Total</div>
          <div className="mt-0.5 font-mono text-[17px] font-medium tracking-[-0.02em] text-(--hms-ink) tabular-nums">£18,420.00</div>
        </div>
        <span className="flex items-center gap-1 text-(--hms-ink)/75">
          <Check aria-hidden="true" size={11} strokeWidth={2.4} />
          Paid 3 Oct
        </span>
      </div>
    </div>
  );
}

/** On-time share per day, last 20 days. Today is the last bar. */
const ON_TIME = [62, 70, 66, 74, 71, 78, 69, 80, 76, 83, 79, 85, 81, 88, 84, 90, 86, 92, 89, 96] as const;

function KpiBody() {
  const max = Math.max(...ON_TIME);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-end justify-between">
        <div>
          <div className={META}>On time · 30 days</div>
          <div className="mt-1 text-[30px] leading-none font-semibold tracking-[-0.04em] text-(--hms-ink) tabular-nums">97.4%</div>
        </div>
        <span className="font-mono text-[10px] text-(--hms-ink)/70 tabular-nums">+2.1 pts</span>
      </div>
      <div className="mt-auto flex h-[58px] items-end gap-[3px]">
        {ON_TIME.map((value, i) => (
          <span
            key={i}
            className={`flex-1 rounded-[2px] ${i === ON_TIME.length - 1 ? "bg-(--hms-accent)" : "bg-(--hms-ink)/20"}`}
            style={{ height: `${(value / max) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-(--hms-ink)/65">
        <span>Avg dwell 1.8 d</span>
        <span>Claims 0</span>
      </div>
    </div>
  );
}

const CUSTOMS_DOCS = [
  { label: "Commercial invoice", done: true },
  { label: "Packing list", done: true },
  { label: "EORI GB 7724 0193 1000", done: true },
  { label: "Certificate of origin", done: false },
] as const;

function CustomsBody() {
  const done = CUSTOMS_DOCS.filter((d) => d.done).length;
  return (
    <div className="flex h-full flex-col text-[10px]">
      <div className="flex flex-col gap-[7px]">
        {CUSTOMS_DOCS.map((doc) => (
          <div key={doc.label} className="flex items-center gap-2">
            {doc.done ? (
              <span className="grid size-3.5 place-items-center rounded-full bg-(--hms-ink) text-(--hms-on-ink)">
                <Check aria-hidden="true" size={8} strokeWidth={3.2} />
              </span>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 14 14" className="size-3.5">
                <circle cx="7" cy="7" r="5.6" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.4" className="text-(--hms-ink)" />
                <path d="M7 1.4 A5.6 5.6 0 0 1 12.6 7" fill="none" stroke="var(--hms-accent)" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            )}
            <span className={doc.done ? "text-(--hms-ink)/80" : "text-(--hms-ink)"}>{doc.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-auto">
        <div className="flex justify-between text-(--hms-ink)/65">
          <span>Waiting on supplier</span>
          <span className="tabular-nums">
            {done} of {CUSTOMS_DOCS.length}
          </span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-(--hms-ink)/10">
          <div className="h-full rounded-full bg-(--hms-ink)/70" style={{ width: `${(done / CUSTOMS_DOCS.length) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

const CHAT: { from: "them" | "you"; text: string }[] = [
  { from: "them", text: "Aurelia’s held 6 hours at Antwerp. Sorry." },
  { from: "you", text: "Move the truck to the 16:00 slot?" },
  { from: "them", text: "Done. Driver is Tomasz, plate KR 4471." },
];

function ChatBody() {
  return (
    <div className="flex h-full flex-col justify-end gap-1.5 text-[10px] leading-[1.4]">
      {CHAT.map((m) => (
        <div
          key={m.text}
          className={
            m.from === "you"
              ? "max-w-[78%] self-end rounded-[10px] rounded-br-[3px] bg-(--hms-ink) px-2.5 py-1.5 text-(--hms-on-ink)"
              : "max-w-[78%] self-start rounded-[10px] rounded-bl-[3px] bg-(--hms-ink)/[0.07] px-2.5 py-1.5 text-(--hms-ink)/85"
          }
        >
          {m.text}
        </div>
      ))}
      <div className="mt-0.5 flex items-center gap-1.5 text-(--hms-ink)/65">
        <span className="size-1.5 rounded-full bg-(--hms-accent)" />
        Brightline is typing
      </div>
    </div>
  );
}

const WEEK = [
  { day: "Mon", date: 13, slots: [["07:00", "FXT"], ["13:30", "TIL"]] },
  { day: "Tue", date: 14, slots: [["09:15", "SOU"]] },
  { day: "Wed", date: 15, slots: [["06:40", "FXT"], ["11:00", "LGP"], ["16:00", "FXT"]], today: true },
  { day: "Thu", date: 16, slots: [["14:20", "FXT"]] },
  { day: "Fri", date: 17, slots: [["08:00", "TIL"], ["15:45", "SOU"]] },
] as const;

function CalendarBody() {
  return (
    <div className="grid h-full grid-cols-5 gap-1.5 text-[9.5px]">
      {WEEK.map((col) => {
        const today = "today" in col && col.today;
        return (
          <div key={col.day} className="flex min-w-0 flex-col gap-1">
            <div className={`border-t-2 pt-1 ${today ? "border-(--hms-accent)" : "border-(--hms-ink)/10"}`}>
              <div className="text-(--hms-ink)/65">{col.day}</div>
              <div className={`text-[13px] font-medium tabular-nums ${today ? "text-(--hms-ink)" : "text-(--hms-ink)/75"}`}>{col.date}</div>
            </div>
            {col.slots.map(([time, port]) => (
              <div key={time} className="rounded-[5px] bg-(--hms-ink)/[0.06] px-1.5 py-1 shadow-[inset_0_0_0_1px_var(--hms-line)]">
                <div className="font-mono text-(--hms-ink)/85 tabular-nums">{time}</div>
                <div className="text-(--hms-ink)/65">{port}</div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

const QUOTES = [
  { carrier: "Corvid Line", transit: "34 d", price: "$4,610" },
  { carrier: "Saltmarsh", transit: "31 d", price: "$4,180", booked: true },
  { carrier: "Meridian Box", transit: "38 d", price: "$3,950" },
] as const;

function QuotesBody() {
  return (
    <div className="flex h-full flex-col gap-1.5 text-[10px]">
      <div className="text-(--hms-ink)/65">40′ HC · Shanghai to Felixstowe</div>
      {QUOTES.map((q) => {
        const booked = "booked" in q && q.booked;
        return (
          <div
            key={q.carrier}
            className={`flex items-center justify-between rounded-[7px] px-2.5 py-[7px] ${
              booked ? "bg-(--hms-ink)/[0.05] shadow-[inset_0_0_0_1px_var(--hms-accent)]" : "shadow-[inset_0_0_0_1px_var(--hms-line)]"
            }`}
          >
            <span className="font-medium text-(--hms-ink)/90">{q.carrier}</span>
            <span className="flex items-center gap-3 tabular-nums">
              <span className="text-(--hms-ink)/65">{q.transit}</span>
              <span className="w-[42px] text-right font-mono text-(--hms-ink)/90">{q.price}</span>
              {booked ? (
                <span className="flex w-[48px] items-center justify-end gap-1 text-(--hms-accent)">
                  <Check aria-hidden="true" size={10} strokeWidth={2.6} />
                  Booked
                </span>
              ) : (
                <span className="w-[48px] text-right text-(--hms-ink)/65">Quote</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const DEFAULT_SCREENS: MarqueeScreen[] = [
  { title: "Shipments", meta: "128 active", body: <ShipmentsBody /> },
  { title: "HLY-20418", meta: "Tracking", body: <RouteBody /> },
  { title: "INV-3307", meta: "Invoice", body: <InvoiceBody /> },
  { title: "Reliability", meta: "Oct", body: <KpiBody /> },
  { title: "Customs", meta: "HLY-20409", body: <CustomsBody /> },
  { title: "Brightline Haulage", meta: "Carrier", body: <ChatBody /> },
  { title: "Pickups", meta: "Week 42", body: <CalendarBody /> },
  { title: "Quotes", meta: "3 of 3 in", body: <QuotesBody /> },
];

/* ------------------------------------------------------------------ */
/* Demo                                                                 */
/* ------------------------------------------------------------------ */

export default function HeroMarqueeScreensDemo(overrides: Partial<HeroMarqueeScreensProps> = {}) {
  return (
    <div style={{ background: PALETTE[overrides.theme ?? "dark"].page }}>
      <HeroMarqueeScreens {...overrides} />
    </div>
  );
}
