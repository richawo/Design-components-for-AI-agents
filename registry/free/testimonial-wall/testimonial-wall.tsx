"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent, type ReactNode, type RefObject } from "react";
import { animate, motion, useInView, useReducedMotion, type AnimationPlaybackControls } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type Testimonial = {
  /** Wrap one phrase in **double asterisks** to set it at full strength. */
  quote: string;
  name: string;
  role: string;
  company: string;
  /** Shows the small verified seal. */
  verified?: boolean;
};

export type TestimonialWallProps = {
  testimonials?: Testimonial[];
  /** Height of the wall in px at two or three columns. One column uses at most 600px. */
  height?: number;
  /** Drift speed of each column in px per second. Columns alternate direction. */
  speeds?: number[];
  /** Accessible name for the region. */
  label?: string;
  /** Show the small pause / play control (recommended: moving content should be stoppable). */
  pauseControl?: boolean;
  /** The one accent: the verified seal. Defaults to the theme’s ink, so the wall is greyscale. */
  accent?: string;
  theme?: "dark" | "light";
  /** Pauses the drift when set; makes the pause state controlled from outside. Without it the pause control keeps its own state. */
  paused?: boolean;
  /** Called with the next state when the pause control is used. */
  onPausedChange?: (paused: boolean) => void;
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    card: "#0c0c0d",
    cardHover: "#111113",
    line: "rgba(255,255,255,0.07)",
    sheen: "rgba(255,255,255,0.05)",
    ink: "#f4f4f5",
    body: "#94949a",
    meta: "#7c7c84",
    avatarFrom: "#2c2c30",
    avatarTo: "#151517",
    avatarInk: "#d4d4d8",
    avatarRing: "rgba(255,255,255,0.22)",
    spot: "rgba(255,255,255,0.055)",
    edge: "rgba(255,255,255,0.42)",
    lift: "0 24px 48px -24px rgba(0,0,0,0.9)",
    control: "#141416",
    controlHover: "#1b1b1e",
    controlInk: "#a1a1aa",
  },
  light: {
    card: "#ffffff",
    cardHover: "#ffffff",
    line: "rgba(24,24,27,0.08)",
    sheen: "rgba(255,255,255,0)",
    ink: "#18181b",
    body: "#5b5b63",
    meta: "#71717a",
    avatarFrom: "#f4f4f5",
    avatarTo: "#e4e4e7",
    avatarInk: "#3f3f46",
    avatarRing: "rgba(24,24,27,0.18)",
    spot: "rgba(24,24,27,0.035)",
    edge: "rgba(24,24,27,0.28)",
    lift: "0 24px 48px -28px rgba(24,24,27,0.3)",
    control: "#ffffff",
    controlHover: "#f4f4f5",
    controlInk: "#52525b",
  },
} as const;

type Palette = Record<keyof (typeof PALETTE)["dark"], string>;

/** The demo’s quiet backdrop; not part of the component. */
const STAGE = { dark: "#000000", light: "#f4f4f5" } as const;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** One place for the choreography. Seconds unless noted. */
const MOTION = {
  rise: 14, // px
  blur: 8, // px
  card: 0.5,
  columnStep: 0.05, // each column starts a beat after the one to its left
  wave: 0.26, // top of a column to its bottom: cards land in reading order
  ringAfter: 0.16, // the avatar ring draws once its card is down
  ring: 0.55,
  control: 0.62, // the pause button arrives as the wave finishes
  launch: 0.85, // the drift sets off (from rest) after the entrance
  fade: 0.15, // reduced motion
} as const;

/** Drift physics: velocity eases toward its goal with these time constants (s). */
const DRIFT = { stopTau: 0.32, goTau: 0.7, focusTau: 0.11, maxStep: 0.05 } as const;

const LAYOUT = {
  threeCols: 900, // px of container width
  twoCols: 560,
  singleMaxHeight: 600,
  focusMargin: 56, // px clear of the faded edges when a card takes focus
  maxRepeats: 8,
} as const;

/* ------------------------------------------------------------------ */
/* Demo content: Kiln, a deploy platform                                */
/* ------------------------------------------------------------------ */

const DEMO_TESTIMONIALS: Testimonial[] = [
  { quote: "We moved 41 services onto Kiln over a long weekend. **The only thing that broke was our habit of refreshing the deploy page.**", name: "Priya Raman", role: "Staff Engineer", company: "Ostrich Labs", verified: true },
  { quote: "Preview links used to live in a Slack thread. **Now they’re on every PR before I’ve finished writing the description.**", name: "Tom Achterberg", role: "Product Designer", company: "Meadowlark", verified: true },
  { quote: "Our p95 build went from 9m 40s to **2m 12s**. I checked twice because I assumed the cache was lying.", name: "Dana Okafor", role: "Platform Lead", company: "Fernway" },
  { quote: "Rollbacks take one click and about four seconds. **I’ve stopped dreading Friday afternoons**, which my team finds unsettling.", name: "Marcus Lindqvist", role: "CTO", company: "Haversack", verified: true },
  { quote: "**Kiln’s logs are the first I’ve read voluntarily.**", name: "Aiko Tanabe", role: "Site Reliability", company: "Cobalt Freight" },
  { quote: "We deleted 1,800 lines of CI YAML. **Nobody has asked for it back.**", name: "Leo Brandt", role: "Engineering Manager", company: "Tidewater Health", verified: true },
  { quote: "Support answered a gnarly edge-runtime question at 11pm on a Sunday, **with a code sample that actually ran.**", name: "Sofia Marchetti", role: "Founder", company: "Pantry Club" },
  { quote: "The cost view paid for the plan in its first week. **It found a staging cluster we’d forgotten about since March.**", name: "Ravi Dhillon", role: "Head of Infrastructure", company: "Quillmate", verified: true },
  { quote: "Branch databases changed how we review. **Designers click around real data** instead of describing screenshots.", name: "Hannah Wexler", role: "Design Engineer", company: "Orchard" },
  { quote: "Onboarding used to be a day of copying env vars. **Now it’s one command and a coffee.**", name: "Jonah Feld", role: "Developer Experience", company: "Brightloop", verified: true },
  { quote: "**Our status page went green before customers noticed it was red.** That’s the whole job, really.", name: "Chidi Nwosu", role: "VP Engineering", company: "Parcelwise" },
  { quote: "I expected another dashboard. **I got a deploy button I trust.**", name: "Elena Sokolova", role: "Independent developer", company: "Ferrous Studio", verified: true },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function inkOn(hex: string) {
  const v = hex.replace("#", "");
  const full = v.length === 3 ? [...v].map((c) => c + c).join("") : v.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#0a0a0b" : "#ffffff";
}

function cssVars(p: Palette, accent: string): CSSProperties {
  const vars: Record<string, string> = { "--wall-accent": accent, "--wall-on-accent": inkOn(accent) };
  for (const [k, v] of Object.entries(p)) vars[`--wall-${k}`] = v;
  return vars as CSSProperties;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wall-ink)]";

/* ------------------------------------------------------------------ */
/* Hooks                                                                */
/* ------------------------------------------------------------------ */

/** Column count follows the component’s own width, not the viewport. */
function useColumnCount(ref: RefObject<HTMLElement | null>) {
  const [cols, setCols] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      setCols(w >= LAYOUT.threeCols ? 3 : w >= LAYOUT.twoCols ? 2 : 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return cols;
}

/** True while the wall is on screen and the tab is visible: the only time the drift runs. */
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

/**
 * The first-view cascade. Cards live in a track the drift loop moves imperatively, so the
 * entrance is imperative too: one tween per card on screen, delayed by where it sits (top to
 * bottom, left column first), rising out of a blur; its avatar ring then draws round.
 * Returns true once the cascade is scheduled, so cards mounted later render settled.
 */
function useCascade(viewportRef: RefObject<HTMLDivElement | null>, play: boolean, column: number) {
  const [entered, setEntered] = useState(false);
  const runs = useRef<AnimationPlaybackControls[]>([]);

  useLayoutEffect(() => {
    const vp = viewportRef.current;
    if (!play || runs.current.length || !vp) return;
    const top = vp.getBoundingClientRect().top;
    const height = vp.clientHeight || 1;

    for (const el of vp.querySelectorAll<HTMLElement>("[data-enter]")) {
      const y = el.getBoundingClientRect().top - top;
      if (y > height || y + el.offsetHeight < 0) continue; // off screen: already settled
      const delay = column * MOTION.columnStep + Math.min(1, Math.max(0, y / height)) * MOTION.wave;
      const set = (p: number) => {
        el.style.opacity = String(p);
        el.style.transform = `translateY(${((1 - p) * MOTION.rise).toFixed(2)}px)`;
        el.style.filter = p < 1 ? `blur(${((1 - p) * MOTION.blur).toFixed(2)}px)` : "";
      };
      set(0);
      runs.current.push(animate(0, 1, { duration: MOTION.card, ease: EASE_OUT, delay, onUpdate: set }));

      const ring = el.querySelector<SVGCircleElement>("[data-ring]");
      if (ring) {
        const draw = (v: number) => (ring.style.strokeDashoffset = String(v));
        draw(1);
        runs.current.push(animate(1, 0, { duration: MOTION.ring, ease: EASE_OUT, delay: delay + MOTION.ringAfter, onUpdate: draw }));
      }
    }
    setEntered(true);
  }, [play, viewportRef, column]);

  // Unmounting mid-cascade lands every card rather than leaving one half-faded.
  useEffect(() => () => runs.current.forEach((r) => r.complete()), []);
  return entered;
}

/* ------------------------------------------------------------------ */
/* Wall                                                                 */
/* ------------------------------------------------------------------ */

export function TestimonialWall({
  testimonials = DEMO_TESTIMONIALS,
  height = 720,
  speeds = [24, 30, 20],
  label = "What teams say about Kiln",
  pauseControl = true,
  accent,
  theme = "dark",
  paused: pausedProp,
  onPausedChange,
  className = "",
}: TestimonialWallProps) {
  const reduce = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLElement>(null);
  const cols = useColumnCount(rootRef);
  const onScreen = useOnScreen(rootRef);
  const play = useInView(rootRef, { once: true, amount: 0.2 });
  const [pausedInner, setPausedInner] = useState(false);
  const paused = pausedProp ?? pausedInner;
  const palette = PALETTE[theme];

  const n = cols ?? 3;
  const columns = Array.from({ length: n }, (_, c) => testimonials.filter((_, i) => i % n === c));
  const wallH = n === 1 ? Math.min(height, LAYOUT.singleMaxHeight) : height;

  return (
    <motion.section
      ref={rootRef}
      aria-label={label}
      initial={reduce ? { opacity: 0 } : false}
      animate={reduce && play ? { opacity: 1 } : undefined}
      transition={{ duration: MOTION.fade }}
      className={`@container relative w-full font-sans antialiased ${className}`}
      style={{ ...cssVars(palette, accent ?? palette.ink), ...(reduce ? {} : { height: wallH }) }}
    >
      {cols !== null && (
        <div className="grid h-full gap-4 @3xl:gap-5" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gridTemplateRows: reduce ? undefined : "minmax(0, 1fr)" }}>
          {columns.map((items, c) =>
            reduce ? (
              <StaticColumn key={`${n}-${c}`} items={items} />
            ) : (
              <Column key={`${n}-${c}`} items={items} index={c} speed={speeds[c % speeds.length] ?? speeds[0] ?? 24} active={onScreen} play={play} paused={paused} />
            ),
          )}
        </div>
      )}

      {pauseControl && !reduce && cols !== null && (
        <motion.div
          initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
          animate={play ? { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } } : undefined}
          transition={{ duration: 0.4, ease: EASE_OUT, delay: MOTION.control }}
          className="absolute bottom-1 right-1 z-10"
        >
          <PauseButton paused={paused} onToggle={() => {
            setPausedInner(!paused);
            onPausedChange?.(!paused);
          }} />
        </motion.div>
      )}
    </motion.section>
  );
}

function PauseButton({ paused, onToggle }: { paused: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      data-demo="pause"
      aria-pressed={paused}
      aria-label={paused ? "Resume scrolling testimonials" : "Pause scrolling testimonials"}
      onClick={onToggle}
      className={`group grid size-11 place-items-center rounded-full ${focusRing}`}
    >
      <span className="grid size-8 place-items-center rounded-full bg-[var(--wall-control)] text-[var(--wall-controlInk)] shadow-[inset_0_0_0_1px_var(--wall-line),0_6px_20px_-6px_rgba(0,0,0,0.6)] transition-[background-color,color,scale] duration-150 group-hover:bg-[var(--wall-controlHover)] group-hover:text-[var(--wall-ink)] group-active:scale-[0.94]">
        <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
          {paused ? <path d="M3.5 2.2v7.6L9.8 6z" fill="currentColor" /> : <path d="M3.25 2.25v7.5M8.75 2.25v7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
        </svg>
      </span>
    </button>
  );
}

/** Reduced motion: the same columns at natural height. No masks, clones or drift. */
function StaticColumn({ items }: { items: Testimonial[] }) {
  return (
    <ul className="flex min-w-0 flex-col gap-4 @3xl:gap-5">
      {items.map((t, i) => (
        <li key={i}>
          <Card t={t} hidden={false} />
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Column: an endless vertical drift with velocity easing               */
/* ------------------------------------------------------------------ */

type DriftState = { y: number; v: number; period: number; viewport: number; hover: boolean; focus: boolean; target: number | null; seeded: boolean; launched: boolean };

function Column({ items, index, speed, active, play, paused }: { items: Testimonial[]; index: number; speed: number; active: boolean; play: boolean; paused: boolean }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const setRef = useRef<HTMLUListElement>(null);
  const [reps, setReps] = useState(1);
  const dir = index % 2 === 1 ? 1 : -1;
  // Starts at rest: the drift only sets off once the cards have landed.
  const s = useRef<DriftState>({ y: 0, v: 0, period: 0, viewport: 0, hover: false, focus: false, target: null, seeded: false, launched: false });
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const apply = () => {
    const t = trackRef.current;
    if (t) t.style.transform = `translate3d(0, ${(s.current.y - s.current.period).toFixed(2)}px, 0)`;
  };

  // Measure one period (a full set plus its trailing gap) and repeat the set if it can’t fill the column.
  useLayoutEffect(() => {
    const vp = viewportRef.current;
    const set = setRef.current;
    if (!vp || !set) return;
    const measure = () => {
      const st = s.current;
      st.period = set.offsetHeight;
      st.viewport = vp.clientHeight;
      if (!st.seeded && st.period > 0) {
        // Start each column at a different phase so the rows never line up.
        st.y = st.period * ((index * 0.37 + 0.11) % 1);
        st.seeded = true;
      }
      const single = st.period / reps;
      const need = Math.max(1, Math.ceil((st.viewport + 1) / Math.max(1, single)));
      if (need !== reps) setReps(Math.min(LAYOUT.maxRepeats, need));
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

  const entered = useCascade(viewportRef, play, index);

  useEffect(() => {
    if (!play) return;
    const t = setTimeout(() => (s.current.launched = true), MOTION.launch * 1000);
    return () => clearTimeout(t);
  }, [play]);

  // The loop. Velocity eases towards its goal, so a hover glides to a stop instead of freezing.
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const st = s.current;
      const dt = Math.min(DRIFT.maxStep, (now - last) / 1000);
      last = now;
      const stopped = st.hover || st.focus || pausedRef.current || !st.launched;
      const goal = stopped ? 0 : speed * dir;
      st.v += (goal - st.v) * (1 - Math.exp(-dt / (stopped ? DRIFT.stopTau : DRIFT.goTau)));
      if (st.target !== null) {
        st.y += (st.target - st.y) * (1 - Math.exp(-dt / DRIFT.focusTau));
      } else {
        st.y += st.v * dt;
        if (st.period > 0) st.y = ((st.y % st.period) + st.period) % st.period;
      }
      apply();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, speed, dir]);

  /** A focused card glides fully into view (clear of the faded edges) and its column holds still. */
  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>("[data-card]");
    const st = s.current;
    st.focus = true;
    if (!card) return;
    const m = Math.max(LAYOUT.focusMargin, st.viewport * 0.15);
    const top = st.y + card.offsetTop;
    const h = card.offsetHeight;
    let target = st.y;
    if (top < m || h > st.viewport - 2 * m) target = st.y + (m - top);
    else if (top + h > st.viewport - m) target = st.y - (top + h - (st.viewport - m));
    st.target = target;
    if (!active) {
      st.y = target;
      apply();
    }
  };
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    s.current.focus = false;
    s.current.target = null;
  };

  const set = (copy: "real" | "clone") => (
    <ul
      ref={copy === "real" ? setRef : undefined}
      aria-hidden={copy === "clone" || undefined}
      inert={copy === "clone" || undefined}
      className="relative flex flex-col gap-4 pb-4 @3xl:gap-5 @3xl:pb-5"
    >
      {Array.from({ length: reps }, (_, r) => (
        <Fragment key={r}>
          {items.map((t, i) => (
            <li key={`${r}-${i}`} data-enter className={entered ? undefined : "opacity-0"}>
              <Card t={t} hidden={copy === "clone" || r > 0} />
            </li>
          ))}
        </Fragment>
      ))}
    </ul>
  );

  return (
    <div
      ref={viewportRef}
      data-demo={`column-${index}`}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") s.current.hover = true;
      }}
      onPointerLeave={() => {
        s.current.hover = false;
      }}
      onFocus={onFocus}
      onBlur={onBlur}
      // Focus inside overflow:hidden would scroll the column; we move the track ourselves instead.
      onScroll={(e) => {
        e.currentTarget.scrollTop = 0;
      }}
      className="relative -mx-1 h-full min-w-0 overflow-hidden px-1 [mask-image:linear-gradient(to_bottom,transparent,#000_18%,#000_82%,transparent)]"
    >
      <div ref={trackRef} className="will-change-transform">
        {set("clone")}
        {set("real")}
        {set("clone")}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                 */
/* ------------------------------------------------------------------ */

function Card({ t, hidden }: { t: Testimonial; hidden: boolean }) {
  const ref = useRef<HTMLElement>(null);
  return (
    <figure
      ref={ref}
      data-card
      tabIndex={hidden ? -1 : 0}
      aria-hidden={hidden || undefined}
      onPointerMove={(e) => {
        // CSS variables, not state: following the pointer never re-renders.
        if (e.pointerType !== "mouse" || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        ref.current.style.setProperty("--x", `${e.clientX - r.left}px`);
        ref.current.style.setProperty("--y", `${e.clientY - r.top}px`);
      }}
      style={{ "--x": "50%", "--y": "-40px" } as CSSProperties}
      className={`group/card relative isolate rounded-[16px] bg-[var(--wall-card)] p-5 shadow-[inset_0_0_0_1px_var(--wall-line),inset_0_1px_0_var(--wall-sheen)] transition-[translate,background-color,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[3px] hover:bg-[var(--wall-cardHover)] hover:shadow-[inset_0_0_0_1px_var(--wall-line),inset_0_1px_0_var(--wall-sheen),var(--wall-lift)] focus-visible:-translate-y-[3px] focus-visible:bg-[var(--wall-cardHover)] @3xl:p-6 ${focusRing}`}
    >
      {/* Pointer spotlight: a soft wash on the surface and a brighter arc on the border. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] opacity-0 transition-opacity duration-200 group-hover/card:opacity-100"
        style={{ background: "radial-gradient(320px circle at var(--x) var(--y), var(--wall-spot), transparent 50%)" }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] p-px opacity-0 transition-opacity duration-200 group-hover/card:opacity-100"
        style={{
          background: "radial-gradient(180px circle at var(--x) var(--y), var(--wall-edge), transparent 70%)",
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
      <blockquote className="text-pretty text-[15px] leading-[1.6] tracking-[-0.005em] text-[var(--wall-body)]">
        <p>
          <Quote text={t.quote} />
        </p>
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3">
        <Avatar name={t.name} />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[14px] font-medium tracking-[-0.01em] text-[var(--wall-ink)]">
            <span className="truncate">{t.name}</span>
            {t.verified && <VerifiedSeal />}
          </span>
          <span className="block truncate text-[13px] text-[var(--wall-meta)]">
            {t.role}, {t.company}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}

/** Real curly quotes around the text; one **phrase** at full strength so each card has a hook. */
function Quote({ text }: { text: string }) {
  const parts: ReactNode[] = text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((p, i) =>
      p.startsWith("**") && p.endsWith("**") ? (
        <span key={i} className="text-[var(--wall-ink)]">
          {p.slice(2, -2)}
        </span>
      ) : (
        <Fragment key={i}>{p}</Fragment>
      ),
    );
  return <>“{parts}”</>;
}

/** Initials on a grey disc, inside a hairline ring that draws round on first view. */
function Avatar({ name }: { name: string }) {
  return (
    <span aria-hidden="true" className="relative grid size-9 shrink-0 place-items-center">
      <span
        className="grid size-8 place-items-center rounded-full font-mono text-[10.5px] font-medium tracking-[0.02em] text-[var(--wall-avatarInk)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
        style={{ background: "radial-gradient(120% 120% at 30% 20%, var(--wall-avatarFrom), var(--wall-avatarTo))" }}
      >
        {initials(name)}
      </span>
      <svg viewBox="0 0 36 36" className="absolute inset-0 size-full -rotate-90" fill="none">
        <circle data-ring cx="18" cy="18" r="17.5" pathLength={1} strokeDasharray="1" stroke="var(--wall-avatarRing)" strokeWidth="1" />
      </svg>
    </span>
  );
}

/** An eight-lobed seal, drawn rather than borrowed, in the accent. */
function VerifiedSeal() {
  return (
    <>
      <svg viewBox="0 0 16 16" className="size-[13px] shrink-0" aria-hidden="true">
        <path
          d="M8 .9l1.6 1.3 2-.3.7 1.9 1.9.7-.3 2L15.1 8l-1.3 1.6.3 2-1.9.7-.7 1.9-2-.3L8 15.1l-1.6-1.3-2 .3-.7-1.9-1.9-.7.3-2L.9 8l1.3-1.6-.3-2 1.9-.7.7-1.9 2 .3z"
          fill="var(--wall-accent)"
        />
        <path d="M5.2 8.2l1.9 1.9 3.8-4" fill="none" stroke="var(--wall-on-accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="sr-only">(verified customer)</span>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                 */
/* ------------------------------------------------------------------ */

export default function TestimonialWallDemo({ paused: forced, ...overrides }: Partial<TestimonialWallProps> = {}) {
  const theme = overrides.theme ?? "dark";
  const [paused, setPaused] = useState(forced ?? false);
  useEffect(() => {
    if (forced !== undefined) setPaused(forced);
  }, [forced]);
  // The dark wall's ink accent would vanish on white cards, so it only applies on dark.
  const accent = theme === "light" && overrides.accent?.toLowerCase() === PALETTE.dark.ink ? undefined : overrides.accent;
  return (
    <div className="flex min-h-dvh w-full items-center justify-center px-4 py-12 sm:px-8 sm:py-16" style={{ background: STAGE[theme] }}>
      <div className="w-full max-w-[1180px]">
        <TestimonialWall {...overrides} accent={accent} paused={paused} onPausedChange={setPaused} />
      </div>
    </div>
  );
}
