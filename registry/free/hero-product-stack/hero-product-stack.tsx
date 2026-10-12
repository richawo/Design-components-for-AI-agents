"use client";

import { useEffect, useId, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
  type Variants,
} from "motion/react";

type Link = { label: string; href: string };
type Tone = "solid" | "muted" | "hatch" | "accent";

export type CalendarEvent = {
  /** 0 = first day column. */
  day: number;
  /** Start hour as a decimal, e.g. 9.5 for 9:30. */
  start: number;
  /** Length in hours. */
  hours: number;
  title: string;
  /** `accent` marks the block the thread just moved; it lands last. */
  tone: Tone;
};

export type ThreadMessage = { initials: string; name: string; time: string; text: string };

export type HeroProductStackProps = {
  /** Headline, one string per line. The `emphasis` word is set in serif italic. */
  headline?: string[];
  emphasis?: string;
  body?: string;
  primary?: Link;
  secondary?: Link;
  /** A numeric `score` counts up from zero. */
  rating?: { score: string; note: string };
  weekLabel?: string;
  days?: string[];
  /** Index of today in `days`, for the now line. */
  today?: number;
  /** Current time as a decimal hour, for the now line. */
  now?: number;
  events?: CalendarEvent[];
  /** Burndown card. `actual` is points left per day so far; the sprint runs `days` days. */
  sprint?: { name: string; status: string; actual: number[]; total: number; days: number };
  /** Comment card. `moved` is the chip on the last message. */
  thread?: { title: string; messages: ThreadMessage[]; moved: string; placeholder: string };
  /** The one signal colour: the now line, the moved block and its chip, focus rings. */
  accent?: string;
  theme?: "dark" | "light";
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    page: "#0a0a0b",
    window: "#141416",
    ink: "#f4f4f5",
    onInk: "#0a0a0b",
    shadow:
      "0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 16px -6px rgba(0,0,0,0.5), 0 32px 64px -20px rgba(0,0,0,0.75), 0 70px 100px -40px rgba(0,0,0,0.9)",
  },
  light: {
    page: "#eef0f3",
    window: "#ffffff",
    ink: "#14161a",
    onInk: "#ffffff",
    shadow:
      "0 0 0 1px rgba(20,22,26,0.06), 0 1px 2px rgba(20,22,26,0.06), 0 6px 12px -4px rgba(20,22,26,0.08), 0 24px 48px -16px rgba(20,22,26,0.18), 0 60px 90px -40px rgba(20,22,26,0.28)",
  },
} as const;

const DEFAULT_ACCENT = "#ff6a3d";
const EASE = [0.22, 1, 0.36, 1] as const;

/** Design size of the stage. It is scaled as a whole, so the composition never reflows. */
const STAGE = { w: 640, h: 560 } as const;
const LAYERS = {
  calendar: { x: 70, y: 10, w: 560, h: 392, z: 0 },
  burndown: { x: 0, y: 262, w: 290, h: 222, z: 70 },
  thread: { x: 322, y: 298, w: 300, h: 236, z: 140 },
} as const;
const CAL = { startHour: 9, endHour: 18, rowH: 31, gutter: 40 } as const;
const TILT = { yaw: [-20, -4], pitch: [14, 2], spring: { stiffness: 120, damping: 18, mass: 0.6 } } as const;
const REST_POSE = "rotateX(8deg) rotateY(-12deg)";

/**
 * One timeline, in seconds. Copy lands first (headline lines, body, actions,
 * rating), then the product assembles back to front: windows, their text,
 * the chart, and finally the block the thread moved.
 */
const T = {
  line: 0,
  lineStep: 0.065,
  body: 0.24,
  actions: 0.29,
  rating: 0.34,
  calendar: 0.22,
  calHead: 0.28,
  calGrid: 0.32,
  events: 0.36,
  eventDay: 0.03,
  eventStep: 0.018,
  nowLine: 0.56,
  burndown: 0.32,
  bdText: 0.38,
  bdDraw: 0.44,
  bdDrawDur: 0.55,
  thread: 0.4,
  msg: 0.46,
  msgStep: 0.07,
  composer: 0.6,
  moved: 0.72,
  dur: 0.5,
} as const;

/** Rise 12px out of an 8px blur. `custom` is the start time; the filter is dropped at rest so 3D text stays crisp. */
const reveal: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(8px)" },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: T.dur, ease: EASE, delay },
    transitionEnd: { filter: "none" },
  }),
};
/** Windows rise further, from a softer blur. */
const windowIn: Variants = {
  hidden: { opacity: 0, y: 28, filter: "blur(8px)" },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.7, ease: EASE, delay },
    transitionEnd: { filter: "none" },
  }),
};
/** Calendar blocks drop into their slot. */
const blockIn: Variants = {
  hidden: { opacity: 0, y: -6, scaleY: 0.82, filter: "blur(4px)" },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    scaleY: 1,
    filter: "blur(0px)",
    transition: { duration: 0.42, ease: EASE, delay },
    transitionEnd: { filter: "none" },
  }),
};
/** The moved block lands from a little higher, so the eye connects it to the thread. */
const landIn: Variants = {
  hidden: { opacity: 0, y: -14, scale: 0.94, filter: "blur(4px)" },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: EASE, delay },
    transitionEnd: { filter: "none" },
  }),
};
const drawX: Variants = {
  hidden: { scaleX: 0 },
  show: (delay: number) => ({ scaleX: 1, transition: { duration: 0.5, ease: EASE, delay } }),
};
const drawY: Variants = {
  hidden: { scaleY: 0 },
  show: (delay: number) => ({ scaleY: 1, transition: { duration: 0.5, ease: EASE, delay } }),
};
const drawPath: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  show: (delay: number) => ({ pathLength: 1, opacity: 1, transition: { duration: 0.5, ease: EASE, delay } }),
};
/** Reduced motion: one short fade for everything, no transforms, blur or stagger. */
const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
};

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-(--ps-accent)";

const DEFAULT_EVENTS: CalendarEvent[] = [
  { day: 0, start: 9, hours: 1, title: "Sprint planning", tone: "solid" },
  { day: 0, start: 10.5, hours: 2, title: "Pricing page, deep work", tone: "muted" },
  { day: 0, start: 14, hours: 1, title: "1:1 with Priya", tone: "muted" },
  { day: 1, start: 9.5, hours: 0.5, title: "Standup", tone: "muted" },
  { day: 1, start: 10.5, hours: 2.5, title: "Focus: checkout flow", tone: "solid" },
  { day: 1, start: 14.5, hours: 1.5, title: "Design crit", tone: "muted" },
  { day: 2, start: 9.5, hours: 0.5, title: "Standup", tone: "muted" },
  { day: 2, start: 11, hours: 1, title: "Call with Halcyon", tone: "solid" },
  { day: 2, start: 13.5, hours: 2.5, title: "Ship v2.3", tone: "muted" },
  { day: 3, start: 9.5, hours: 0.5, title: "Standup", tone: "muted" },
  { day: 3, start: 10, hours: 1, title: "Roadmap review", tone: "muted" },
  { day: 3, start: 11.5, hours: 3.5, title: "No-meeting block", tone: "hatch" },
  { day: 3, start: 12, hours: 1.5, title: "Checkout copy rewrite", tone: "accent" },
  { day: 4, start: 9.5, hours: 0.5, title: "Standup", tone: "muted" },
  { day: 4, start: 11, hours: 1, title: "Demo day", tone: "solid" },
  { day: 4, start: 15, hours: 1, title: "Retro, with snacks", tone: "muted" },
];

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function HeroProductStack({
  headline = ["Planning", "for teams", "who hate", "planning."],
  emphasis = "hate",
  body = "Cadence turns a sprawling backlog into a week you can actually see. Drag work onto the calendar, let the burndown keep everyone honest, and settle debates in the comments instead of another meeting.",
  primary = { label: "Start planning free", href: "#signup" },
  secondary = { label: "Take the two-minute tour", href: "#tour" },
  rating = { score: "4.8", note: "from 1,900 reviews · Free for teams under 10" },
  weekLabel = "Week 41 · 5–9 Oct",
  days = ["Mon 5", "Tue 6", "Wed 7", "Thu 8", "Fri 9"],
  today = 2,
  now = 12.6,
  events = DEFAULT_EVENTS,
  sprint = { name: "Sprint 14", status: "2 days ahead", actual: [64, 60, 55, 49, 47, 40, 33, 23], total: 64, days: 10 },
  thread = {
    title: "Checkout copy",
    messages: [
      { initials: "MR", name: "Maya R.", time: "2h", text: "Can we drop the second “Continue” button? Nobody has clicked it since March." },
      { initials: "DK", name: "Dev K.", time: "1h", text: "Agreed. Moving the rewrite into Thursday’s no-meeting block." },
    ],
    moved: "Moved to Thu, 12:00",
    placeholder: "Reply, or type / to schedule",
  },
  accent = DEFAULT_ACCENT,
  theme = "dark",
}: HeroProductStackProps) {
  const rootRef = useRef<HTMLElement>(null);
  const headingId = useId();
  const reduce = !!useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  // Reveal once, when a fifth of the hero is on screen. The stack has its own
  // trigger because it sits below the fold on phones.
  const inView = useInView(rootRef, { once: true, amount: 0.2 });
  const stageInView = useInView(stageRef, { once: true, amount: 0.3 });
  const p = PALETTE[theme];
  const vars = {
    "--ps-page": p.page,
    "--ps-window": p.window,
    "--ps-ink": p.ink,
    "--ps-on-ink": p.onInk,
    "--ps-shadow": p.shadow,
    "--ps-accent": accent,
  } as CSSProperties;
  const v = (variants: Variants) => (reduce ? fade : variants);

  return (
    <motion.section
      ref={rootRef}
      aria-labelledby={headingId}
      style={vars}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      className="@container relative isolate overflow-hidden bg-(--ps-page) text-(--ps-ink)"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-16 @xl:px-8 @xl:py-20 @5xl:grid-cols-12 @5xl:gap-8 @5xl:px-12 @5xl:py-28">
        <div className="@5xl:col-span-5">
          <h1
            id={headingId}
            className="font-display text-[clamp(2.75rem,1.6rem+4.6cqi,5.25rem)] font-semibold leading-[0.98] tracking-[-0.05em]"
          >
            {headline.map((line, i) => (
              <motion.span key={i} variants={v(reveal)} custom={T.line + i * T.lineStep} className="block">
                <Emphasised text={line} word={emphasis} />
              </motion.span>
            ))}
          </h1>
          <motion.p variants={v(reveal)} custom={T.body} className="mt-7 max-w-[46ch] text-[17px] leading-[1.6] text-(--ps-ink)/70">
            {body}
          </motion.p>
          <motion.div variants={v(reveal)} custom={T.actions} className="mt-9 flex flex-col items-start gap-4 @md:flex-row @md:flex-wrap @md:items-center @md:gap-6">
            <PrimaryLink link={primary} />
            <TourLink link={secondary} />
          </motion.div>
          <motion.div variants={v(reveal)} custom={T.rating}>
            <Rating rating={rating} active={inView} reduce={reduce} />
          </motion.div>
        </div>

        <div ref={stageRef} data-demo="stack" className="@5xl:col-span-7">
          <Stage reduce={reduce} show={stageInView}>
            <Layer name="calendar" box={LAYERS.calendar} variants={v(windowIn)} delay={T.calendar} drift={0}>
              <CalendarWindow weekLabel={weekLabel} days={days} today={today} now={now} events={events} variants={v} />
            </Layer>
            <Layer name="burndown" box={LAYERS.burndown} variants={v(windowIn)} delay={T.burndown} drift={1}>
              <BurndownCard sprint={sprint} active={stageInView} reduce={reduce} variants={v} />
            </Layer>
            <Layer name="thread" box={LAYERS.thread} variants={v(windowIn)} delay={T.thread} drift={2}>
              <ThreadCard thread={thread} variants={v} />
            </Layer>
          </Stage>
        </div>
      </div>
    </motion.section>
  );
}

/** Sets one word of a line in serif italic: emphasis by voice, not by colour. */
function Emphasised({ text, word }: { text: string; word: string }) {
  const i = word ? text.indexOf(word) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="pr-[0.04em] font-serif font-normal italic tracking-[-0.02em]">{word}</span>
      {text.slice(i + word.length)}
    </>
  );
}

function PrimaryLink({ link }: { link: Link }) {
  return (
    <a
      href={link.href}
      data-demo="primary"
      className={`inline-flex h-13 items-center justify-center rounded-full bg-(--ps-ink) px-7 text-[15px] font-semibold text-(--ps-on-ink) transition-[background-color,transform] duration-150 hover:bg-(--ps-ink)/88 active:scale-[0.97] ${FOCUS}`}
    >
      {link.label}
    </a>
  );
}

function TourLink({ link }: { link: Link }) {
  return (
    <a
      href={link.href}
      className={`group inline-flex h-11 items-center gap-3 rounded-full pr-2 text-[15px] font-semibold transition-transform duration-150 active:scale-[0.97] ${FOCUS}`}
    >
      <span className="flex size-9 items-center justify-center rounded-full bg-(--ps-ink)/[0.08] ring-1 ring-(--ps-ink)/10 transition-colors duration-150 group-hover:bg-(--ps-ink)/[0.14]">
        <svg viewBox="0 0 16 16" className="ml-0.5 size-3.5 transition-transform duration-150 group-hover:translate-x-px" aria-hidden="true">
          <path d="M4.5 2.8v10.4L13 8z" fill="currentColor" />
        </svg>
      </span>
      {link.label}
    </a>
  );
}

const STAR = "M8 1.2l2 4.3 4.7.6-3.4 3.2.9 4.6L8 11.6l-4.2 2.3.9-4.6L1.3 6.1 6 5.5z";

function Rating({ rating, active, reduce }: { rating: NonNullable<HeroProductStackProps["rating"]>; active: boolean; reduce: boolean }) {
  const target = Number.parseFloat(rating.score);
  const numeric = Number.isFinite(target);
  const decimals = rating.score.split(".")[1]?.length ?? 0;
  const p = useProgress(active && numeric, reduce, T.rating + 0.1, 0.7);
  const score = useTransform(p, (t) => (t * (numeric ? target : 0)).toFixed(decimals));
  const blur = useTransform(p, (t) => `blur(${((1 - t) * 3).toFixed(2)}px)`);

  return (
    <p className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-(--ps-ink)/65">
      <span className="flex gap-0.5" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.svg
            key={i}
            viewBox="0 0 16 16"
            className="size-3.5"
            variants={reduce ? fade : drawStar}
            custom={T.rating + 0.12 + i * 0.04}
          >
            <path d={STAR} fill="currentColor" className="text-(--ps-ink)" />
          </motion.svg>
        ))}
      </span>
      <span>
        <motion.span className="inline-block font-semibold tabular-nums text-(--ps-ink)" style={reduce ? undefined : { filter: blur }}>
          {numeric ? score : rating.score}
        </motion.span>{" "}
        {rating.note}
      </span>
    </p>
  );
}

const drawStar: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  show: (delay: number) => ({ opacity: 1, scale: 1, transition: { duration: 0.3, ease: EASE, delay } }),
};

/* ------------------------------------------------------------------ */
/* Stage: fixed design size, scaled to fit, tilted toward the pointer  */
/* ------------------------------------------------------------------ */

function Stage({ reduce, show, children }: { reduce: boolean; show: boolean; children: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scale = useFitScale(wrapRef, STAGE.w);
  const height = useTransform(scale, (s) => s * STAGE.h);
  const { rotateX, rotateY } = usePointerTilt(reduce);
  // The float loop is ambient, so it only runs while the stage is on screen.
  const onScreen = useInView(wrapRef);

  return (
    <motion.div
      ref={wrapRef}
      className="relative w-full"
      style={{ height, "--ps-play": onScreen && !reduce ? "running" : "paused" } as MotionStyleWithVars}
      role="img"
      aria-label="Cadence app: a week calendar, a sprint burndown chart and a comment thread"
    >
      <style>{`@keyframes tm-hero-product-stack-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}`}</style>
      <motion.div
        className="absolute left-1/2 top-0 origin-top"
        style={{ width: STAGE.w, height: STAGE.h, marginLeft: -STAGE.w / 2, scale }}
      >
        <div className="size-full [perspective:1600px]">
          <motion.div
            className="relative size-full [transform-style:preserve-3d]"
            style={reduce ? { transform: REST_POSE } : { rotateX, rotateY }}
            initial="hidden"
            animate={show ? "show" : "hidden"}
          >
            {children}
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Scale factor that fits a fixed-width design into its container. */
function useFitScale(ref: RefObject<HTMLElement | null>, designWidth: number) {
  const scale = useMotionValue(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) scale.set(Math.min(1, entry.contentRect.width / designWidth));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, designWidth, scale]);
  return scale;
}

/** Maps the pointer across the window to a sprung yaw and pitch. Mouse only; touch keeps the rest pose. */
function usePointerTilt(reduce: boolean) {
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, TILT.spring);
  const sy = useSpring(py, TILT.spring);
  const rotateY = useTransform(sx, [-1, 1], [...TILT.yaw]);
  const rotateX = useTransform(sy, [-1, 1], [...TILT.pitch]);

  useEffect(() => {
    if (reduce) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      px.set((e.clientX / window.innerWidth) * 2 - 1);
      py.set((e.clientY / window.innerHeight) * 2 - 1);
    };
    const onLeave = () => {
      px.set(0);
      py.set(0);
    };
    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [reduce, px, py]);

  return { rotateX, rotateY };
}

/** A 0→1 motion value that plays once when `active` turns true. Reduced motion jumps straight to 1. */
function useProgress(active: boolean, reduce: boolean, delay: number, duration: number): MotionValue<number> {
  const p = useMotionValue(0);
  useEffect(() => {
    if (!active) return;
    if (reduce) {
      p.jump(1);
      return;
    }
    const controls = animate(p, 1, { delay, duration, ease: EASE });
    return () => controls.stop();
  }, [active, reduce, delay, duration, p]);
  return p;
}

type Box = { x: number; y: number; w: number; h: number; z: number };
type MotionStyleWithVars = Record<string, string | number | MotionValue<number>>;

/** One window in the stack: placed in 3D, drifting on its own slow loop, rising in on cue. */
function Layer({ name, box, variants, delay, drift, children }: { name: string; box: Box; variants: Variants; delay: number; drift: number; children: ReactNode }) {
  const style: CSSProperties = { left: box.x, top: box.y, width: box.w, height: box.h, transform: `translateZ(${box.z}px)` };
  // Each layer drifts on a slightly different period so the stack never moves in lockstep.
  // The stage pauses the loop (via --ps-play) when it is offscreen or motion is reduced.
  const float: CSSProperties = {
    animationName: "tm-hero-product-stack-float",
    animationDuration: `${6 + drift * 1.3}s`,
    animationDelay: `${drift * 0.8}s`,
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
    animationPlayState: "var(--ps-play)",
  };
  return (
    <div className="absolute [transform-style:preserve-3d]" style={style} data-demo={name}>
      <div className="size-full" style={float}>
        <motion.div
          variants={variants}
          custom={delay}
          className="size-full overflow-hidden rounded-[14px] bg-(--ps-window) shadow-(--ps-shadow)"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Windows                                                             */
/* ------------------------------------------------------------------ */

const TONE: Record<Tone, string> = {
  solid: "bg-(--ps-ink)/90 text-(--ps-on-ink)",
  muted: "bg-(--ps-ink)/[0.07] text-(--ps-ink)/75",
  hatch: "border border-dashed border-(--ps-ink)/20 text-(--ps-ink)/65",
  accent: "bg-(--ps-accent) text-white",
};
const HATCH = "repeating-linear-gradient(135deg, color-mix(in srgb, var(--ps-ink) 7%, transparent) 0 2px, transparent 2px 7px)";

type VariantPicker = (v: Variants) => Variants;

function CalendarWindow({
  weekLabel,
  days,
  today,
  now,
  events,
  variants: v,
}: {
  weekLabel: string;
  days: string[];
  today: number;
  now: number;
  events: CalendarEvent[];
  variants: VariantPicker;
}) {
  const hours = CAL.endHour - CAL.startHour;
  const yOf = (hour: number) => (hour - CAL.startHour) * CAL.rowH + 4;
  const colWidth = `(100% - ${CAL.gutter}px) / ${days.length}`;
  // Blocks drop in column by column, top to bottom; the accent block waits for the thread.
  const order = new Map<CalendarEvent, number>();
  days.forEach((_, d) =>
    events
      .filter((e) => e.day === d && e.tone !== "accent")
      .sort((a, b) => a.start - b.start)
      .forEach((e, i) => order.set(e, T.events + d * T.eventDay + i * T.eventStep)),
  );

  return (
    <div className="flex size-full flex-col">
      <motion.div variants={v(reveal)} custom={T.calHead} className="flex h-12 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <span className="font-display text-[15px] font-semibold tracking-[-0.02em]">{weekLabel}</span>
          <span className="flex gap-1 text-(--ps-ink)/65" aria-hidden="true">
            <Chevron dir="left" />
            <Chevron dir="right" />
          </span>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-(--ps-ink)/[0.06] p-0.5 text-[11px] font-medium">
          <span className="rounded-full bg-(--ps-window) px-2.5 py-1 shadow-[0_1px_2px_rgba(0,0,0,0.2)] ring-1 ring-(--ps-ink)/[0.06]">Week</span>
          <span className="px-2.5 py-1 text-(--ps-ink)/65">Sprint</span>
          <span className="px-2.5 py-1 text-(--ps-ink)/65">Roadmap</span>
        </div>
      </motion.div>
      <Hairline variants={v(drawX)} delay={T.calHead} />

      <div className="relative grid text-[11px]" style={{ gridTemplateColumns: `${CAL.gutter}px repeat(${days.length}, 1fr)` }}>
        <span />
        {days.map((d, i) => (
          <motion.span
            key={d}
            variants={v(reveal)}
            custom={T.calGrid + i * 0.03}
            className={`flex items-center gap-1.5 px-2 py-2 font-medium ${i === today ? "text-(--ps-ink)" : "text-(--ps-ink)/65"}`}
          >
            {d}
            {i === today ? <span className="size-1 rounded-full bg-(--ps-accent)" aria-hidden="true" /> : null}
          </motion.span>
        ))}
      </div>
      <Hairline variants={v(drawX)} delay={T.calGrid} />

      <div className="relative flex-1">
        {/* Hour rules draw left to right, a hair apart. */}
        {Array.from({ length: hours }, (_, i) => (
          <motion.span
            key={i}
            variants={v(drawX)}
            custom={T.calGrid + i * 0.015}
            className="absolute right-0 h-px origin-left bg-(--ps-ink)/[0.05]"
            style={{ top: yOf(CAL.startHour + i), left: CAL.gutter }}
          />
        ))}
        {Array.from({ length: hours }, (_, i) => (
          <motion.span
            key={i}
            variants={v(reveal)}
            custom={T.calGrid + i * 0.015}
            className="absolute -translate-y-1/2 text-right text-[9.5px] tabular-nums text-(--ps-ink)/65"
            style={{ top: yOf(CAL.startHour + i), width: CAL.gutter - 8 }}
          >
            {CAL.startHour + i}:00
          </motion.span>
        ))}

        {days.map((d, col) => (
          <div
            key={d}
            className="absolute inset-y-0"
            style={{ left: `calc(${CAL.gutter}px + ${colWidth} * ${col})`, width: `calc(${colWidth})` }}
          >
            <motion.span variants={v(drawY)} custom={T.calGrid} className="absolute inset-y-0 left-0 w-px origin-top bg-(--ps-ink)/[0.06]" />
            {col === today ? <motion.span variants={v(fade)} custom={T.calGrid} className="absolute inset-0 bg-(--ps-ink)/[0.03]" /> : null}
            {events
              .filter((e) => e.day === col)
              .map((e) => (
                <motion.div
                  key={e.title + e.start}
                  variants={v(e.tone === "accent" ? landIn : blockIn)}
                  custom={e.tone === "accent" ? T.moved : (order.get(e) ?? T.events)}
                  className={`absolute origin-top overflow-hidden rounded-[6px] px-1.5 text-[10px] font-medium leading-[1.25] ${
                    e.tone === "accent" ? "inset-x-2" : "inset-x-1"
                  } ${e.hours <= 0.5 ? "flex items-center truncate" : "py-1"} ${TONE[e.tone]}`}
                  style={{ top: yOf(e.start) + 1, height: e.hours * CAL.rowH - 2, backgroundImage: e.tone === "hatch" ? HATCH : undefined }}
                >
                  {e.title}
                </motion.div>
              ))}
          </div>
        ))}

        {/* Now line across today. */}
        <div
          className="pointer-events-none absolute flex items-center"
          style={{ top: yOf(now), left: `calc(${CAL.gutter}px + ${colWidth} * ${today})`, width: `calc(${colWidth})` }}
          aria-hidden="true"
        >
          <motion.span variants={v(dotIn)} custom={T.nowLine} className="-ml-1 size-2 rounded-full bg-(--ps-accent)" />
          <motion.span variants={v(drawX)} custom={T.nowLine} className="h-[1.5px] flex-1 origin-left bg-(--ps-accent)" />
        </div>
      </div>
    </div>
  );
}

const dotIn: Variants = {
  hidden: { opacity: 0, scale: 0 },
  show: (delay: number) => ({ opacity: 1, scale: 1, transition: { duration: 0.3, ease: EASE, delay } }),
};

function Hairline({ variants, delay }: { variants: Variants; delay: number }) {
  return <motion.span variants={variants} custom={delay} className="block h-px origin-left bg-(--ps-ink)/[0.07]" aria-hidden="true" />;
}

/* ------------------------------------------------------------------ */
/* Burndown                                                            */
/* ------------------------------------------------------------------ */

const CHART = { w: 250, h: 92, top: 6 } as const;

/** Linear interpolation of the polyline's y (and its source value) at x. */
function sampleAt(points: readonly (readonly [number, number, number])[], x: number) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (x <= b[0]) {
      const t = b[0] === a[0] ? 1 : (x - a[0]) / (b[0] - a[0]);
      return { y: a[1] + (b[1] - a[1]) * t, value: a[2] + (b[2] - a[2]) * t };
    }
  }
  const last = points[points.length - 1] ?? [0, 0, 0];
  return { y: last[1], value: last[2] };
}

function BurndownCard({
  sprint,
  active,
  reduce,
  variants: v,
}: {
  sprint: NonNullable<HeroProductStackProps["sprint"]>;
  active: boolean;
  reduce: boolean;
  variants: VariantPicker;
}) {
  const clipId = useId();
  const { w: W, h: H, top } = CHART;
  const points = sprint.actual.map((value, i) => [(i / Math.max(1, sprint.days - 1)) * W, H - (value / sprint.total) * (H - top), value] as const);
  const path = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1] ?? ([0, H, 0] as const);
  const area = `${path} L${last[0].toFixed(1)} ${H} L0 ${H} Z`;

  // One progress value draws the line, fills the area under it, moves the tip
  // and counts the points down, so the number always matches the drawing.
  const p = useProgress(active, reduce, T.bdDraw, T.bdDrawDur);
  const tipX = useTransform(p, (t) => t * last[0]);
  const tipY = useTransform(tipX, (x) => sampleAt(points, x).y);
  const left = useTransform(tipX, (x) => String(Math.round(sampleAt(points, x).value)));
  const blur = useTransform(p, (t) => `blur(${((1 - t) * 3).toFixed(2)}px)`);
  const tipOpacity = useTransform(p, [0, 0.04], [0, 1]);
  const clipWidth = useTransform(tipX, (x) => x + 4);

  return (
    <div className="flex size-full flex-col p-5">
      <div className="flex items-start justify-between">
        <motion.div variants={v(reveal)} custom={T.bdText}>
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-(--ps-ink)/65">{sprint.name} burndown</p>
          <p className="mt-1.5 font-display text-[30px] font-semibold leading-none tracking-[-0.04em] tabular-nums">
            <motion.span className="inline-block" style={reduce ? undefined : { filter: blur }}>
              {left}
            </motion.span>
            <span className="ml-1.5 font-sans text-[12px] font-medium tracking-normal text-(--ps-ink)/65">pts left</span>
          </p>
        </motion.div>
        <motion.span
          variants={v(reveal)}
          custom={T.bdDraw + T.bdDrawDur - 0.1}
          className="rounded-full bg-(--ps-ink)/[0.08] px-2.5 py-1 text-[10.5px] font-semibold ring-1 ring-(--ps-ink)/10"
        >
          {sprint.status}
        </motion.span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-auto h-[92px] w-full overflow-visible" aria-hidden="true">
        <defs>
          <clipPath id={clipId}>
            <motion.rect x={-4} y={-8} height={H + 16} style={{ width: clipWidth }} />
          </clipPath>
        </defs>
        {[0.25, 0.5, 0.75].map((f, i) => (
          <motion.line
            key={f}
            x1="0"
            x2={W}
            y1={H * f}
            y2={H * f}
            stroke="currentColor"
            strokeOpacity="0.07"
            variants={v(drawX)}
            custom={T.bdText + i * 0.03}
            style={{ originX: 0 }}
          />
        ))}
        {/* Ideal line: fades in first so the actual has something to beat. */}
        <motion.line
          x1="0"
          y1={top}
          x2={W}
          y2={H}
          stroke="currentColor"
          strokeOpacity="0.3"
          strokeDasharray="3 4"
          strokeWidth="1.2"
          variants={v(fade)}
          custom={T.bdText}
        />
        <g clipPath={`url(#${clipId})`}>
          <path d={area} fill="currentColor" fillOpacity="0.07" />
          <path d={path} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        </g>
        <motion.g style={{ opacity: tipOpacity }}>
          <motion.circle cx={tipX} cy={tipY} r="6" fill="currentColor" fillOpacity="0.15" />
          <motion.circle cx={tipX} cy={tipY} r="3" fill="currentColor" stroke="var(--ps-window)" strokeWidth="1.5" />
        </motion.g>
      </svg>
      <motion.div variants={v(reveal)} custom={T.bdDraw} className="mt-2 flex justify-between text-[9.5px] tabular-nums text-(--ps-ink)/65">
        <span>Day 1</span>
        <span>Today</span>
        <span>Day {sprint.days}</span>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Thread                                                              */
/* ------------------------------------------------------------------ */

function ThreadCard({ thread, variants: v }: { thread: NonNullable<HeroProductStackProps["thread"]>; variants: VariantPicker }) {
  const lastIndex = thread.messages.length - 1;
  return (
    <div className="flex size-full flex-col">
      <motion.div variants={v(reveal)} custom={T.msg - 0.06} className="flex h-11 items-center justify-between px-4">
        <p className="text-[12.5px] font-semibold">
          <span className="text-(--ps-ink)/65">#</span> {thread.title}
        </p>
        <span className="text-[10.5px] tabular-nums text-(--ps-ink)/65">{thread.messages.length + 1} comments</span>
      </motion.div>
      <Hairline variants={v(drawX)} delay={T.msg - 0.06} />
      <div className="flex flex-1 flex-col gap-3 px-4 pt-3">
        {thread.messages.map((m, i) => {
          const at = T.msg + i * T.msgStep;
          return (
            <motion.div key={m.initials + i} variants={v(reveal)} custom={at} className="flex gap-2.5">
              <Avatar initials={m.initials} solid={i === 0} variants={v(drawPath)} delay={at + 0.06} />
              <div className="min-w-0">
                <p className="text-[11px]">
                  <span className="font-semibold">{m.name}</span> <span className="text-(--ps-ink)/65">{m.time}</span>
                </p>
                <p className="mt-0.5 text-[11.5px] leading-[1.4] text-(--ps-ink)/75">{m.text}</p>
                {i === lastIndex ? <MovedChip label={thread.moved} variants={v(landIn)} /> : null}
              </div>
            </motion.div>
          );
        })}
      </div>
      <motion.div
        variants={v(reveal)}
        custom={T.composer}
        className="m-3 mt-2 flex h-9 items-center justify-between rounded-[9px] bg-(--ps-ink)/[0.04] pl-3 pr-1 text-[11px] text-(--ps-ink)/65 ring-1 ring-(--ps-ink)/10"
      >
        {thread.placeholder}
        <span className="flex size-7 items-center justify-center rounded-[7px] bg-(--ps-ink) text-(--ps-on-ink)" aria-hidden="true">
          <svg viewBox="0 0 12 12" className="size-3">
            <path d="M6 10V2m0 0L2.5 5.5M6 2l3.5 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </motion.div>
    </div>
  );
}

/** Initials avatar whose hairline ring draws around it once the message lands. */
function Avatar({ initials, solid, variants, delay }: { initials: string; solid: boolean; variants: Variants; delay: number }) {
  return (
    <span className="relative flex size-6 shrink-0 items-center justify-center">
      <svg viewBox="0 0 28 28" className="absolute -inset-0.5 size-7 -rotate-90 overflow-visible" aria-hidden="true">
        <motion.circle cx="14" cy="14" r="13.25" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" variants={variants} custom={delay} />
      </svg>
      <span
        className={`flex size-[22px] items-center justify-center rounded-full text-[8.5px] font-bold ${
          solid ? "bg-(--ps-ink) text-(--ps-on-ink)" : "bg-(--ps-ink)/[0.12] text-(--ps-ink)"
        }`}
      >
        {initials}
      </span>
    </span>
  );
}

/** The chip lands a beat before the calendar block it describes. */
function MovedChip({ label, variants }: { label: string; variants: Variants }) {
  return (
    <motion.span
      variants={variants}
      custom={T.moved - 0.08}
      className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-(--ps-accent)/15 px-2 py-0.5 text-[10px] font-semibold text-(--ps-ink) ring-1 ring-(--ps-accent)/40"
    >
      <svg viewBox="0 0 12 12" className="size-2.5 text-(--ps-accent)" aria-hidden="true">
        <rect x="1.5" y="2.5" width="9" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M1.5 5h9M4 1.2v2.2M8 1.2v2.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      {label}
    </motion.span>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 12 12" className="size-3.5">
      <path
        d={dir === "left" ? "M7.5 2.5 4 6l3.5 3.5" : "M4.5 2.5 8 6 4.5 9.5"}
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Gallery demo. The overrides are spread onto the one featured instance, so the
 * Customize panel (accent, theme, today, now, ...) drives the real component.
 */
export default function HeroProductStackDemo(overrides: Partial<HeroProductStackProps> = {}) {
  return <HeroProductStack {...overrides} />;
}
