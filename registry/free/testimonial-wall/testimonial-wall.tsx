"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types and content                                                    */
/* ------------------------------------------------------------------ */

export type Testimonial = {
  /** Wrap one phrase in **double asterisks** to set it at full strength. */
  quote: string;
  name: string;
  role: string;
  company: string;
  /** Shows the small verified mark. */
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
  className?: string;
};

const defaultTestimonials: Testimonial[] = [
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

const ease = [0.22, 1, 0.36, 1] as const;

/* ------------------------------------------------------------------ */
/* Wall                                                                 */
/* ------------------------------------------------------------------ */

export function TestimonialWall({
  testimonials = defaultTestimonials,
  height = 720,
  speeds = [24, 30, 20],
  label = "What teams say about Kiln",
  pauseControl = true,
  className = "",
}: TestimonialWallProps) {
  const reduce = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLElement>(null);
  const [cols, setCols] = useState<number | null>(null);
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);

  // Column count follows the component's own width, not the viewport.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      setCols(w >= 900 ? 3 : w >= 560 ? 2 : 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Only drift while on screen and in a visible tab.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let inView = false;
    const sync = () => setActive(inView && !document.hidden);
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
  }, []);

  const n = cols ?? 3;
  const columns = Array.from({ length: n }, (_, c) => testimonials.filter((_, i) => i % n === c));
  const wallH = n === 1 ? Math.min(height, 600) : height;

  return (
    <section
      ref={rootRef}
      aria-label={label}
      className={`@container relative w-full ${className}`}
      style={reduce ? undefined : { height: wallH }}
    >
      {cols !== null && (
        <div className="grid h-full gap-4 @3xl:gap-5" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gridTemplateRows: reduce ? undefined : "minmax(0, 1fr)" }}>
          {columns.map((items, c) => (
            <Column
              key={`${n}-${c}`}
              items={items}
              index={c}
              speed={speeds[c % speeds.length] ?? 24}
              active={active && !reduce}
              paused={paused}
              reduce={reduce}
            />
          ))}
        </div>
      )}

      {pauseControl && !reduce && cols !== null && (
        <button
          type="button"
          aria-pressed={paused}
          aria-label={paused ? "Resume scrolling testimonials" : "Pause scrolling testimonials"}
          onClick={() => setPaused((p) => !p)}
          className="group absolute bottom-1 right-1 z-10 grid size-11 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <span className="grid size-8 place-items-center rounded-full bg-[#141416] text-white/60 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1),0_6px_20px_-6px_rgba(0,0,0,0.9)] transition-[background-color,color,scale] duration-150 group-hover:bg-[#1b1b1e] group-hover:text-white group-active:scale-[0.94]">
            <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
              {paused ? <path d="M3.5 2.2v7.6L9.8 6z" fill="currentColor" /> : <path d="M3.25 2.25v7.5M8.75 2.25v7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
            </svg>
          </span>
        </button>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Column: an endless vertical drift with velocity easing               */
/* ------------------------------------------------------------------ */

function Column({
  items,
  index,
  speed,
  active,
  paused,
  reduce,
}: {
  items: Testimonial[];
  index: number;
  speed: number;
  active: boolean;
  paused: boolean;
  reduce: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const setRef = useRef<HTMLUListElement>(null);
  const [reps, setReps] = useState(1);
  const dir = index % 2 === 1 ? 1 : -1;
  const s = useRef({ y: 0, v: speed * dir, P: 0, H: 0, hover: false, focus: false, target: null as number | null, seeded: false });
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const apply = () => {
    const t = trackRef.current;
    if (t) t.style.transform = `translate3d(0, ${(s.current.y - s.current.P).toFixed(2)}px, 0)`;
  };

  // Measure one period (a full set plus its trailing gap) and repeat the set if it can't fill the column.
  useLayoutEffect(() => {
    if (reduce) return;
    const vp = viewportRef.current;
    const set = setRef.current;
    if (!vp || !set) return;
    const measure = () => {
      const st = s.current;
      st.P = set.offsetHeight;
      st.H = vp.clientHeight;
      if (!st.seeded && st.P > 0) {
        // Start each column at a different phase so the rows never line up.
        st.y = st.P * ((index * 0.37 + 0.11) % 1);
        st.seeded = true;
      }
      const single = st.P / reps;
      const need = Math.max(1, Math.ceil((st.H + 1) / Math.max(1, single)));
      if (need !== reps) setReps(Math.min(8, need));
      apply();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(set);
    ro.observe(vp);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reps, reduce]);

  // The loop. Velocity eases towards its target, so a hover glides to a stop instead of freezing.
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const st = s.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const stopped = st.hover || st.focus || pausedRef.current;
      const goal = stopped ? 0 : speed * dir;
      st.v += (goal - st.v) * (1 - Math.exp(-dt / (stopped ? 0.32 : 0.7)));
      if (st.target !== null) {
        st.y += (st.target - st.y) * (1 - Math.exp(-dt / 0.11));
      } else {
        st.y += st.v * dt;
        if (st.P > 0) st.y = ((st.y % st.P) + st.P) % st.P;
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
    if (!card || reduce) return;
    const m = Math.max(56, st.H * 0.15);
    const top = st.y + card.offsetTop;
    const h = card.offsetHeight;
    let target = st.y;
    if (top < m || h > st.H - 2 * m) target = st.y + (m - top);
    else if (top + h > st.H - m) target = st.y - (top + h - (st.H - m));
    st.target = target;
    if (!active) {
      st.y = target;
      apply();
    }
  };
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    const st = s.current;
    st.focus = false;
    st.target = null;
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
            <li key={`${r}-${i}`}>
              <Card t={t} hidden={copy === "clone" || r > 0} />
            </li>
          ))}
        </Fragment>
      ))}
    </ul>
  );

  if (reduce) {
    return (
      <div onFocus={onFocus} onBlur={onBlur}>
        <ul className="flex flex-col gap-4 @3xl:gap-5">
          {items.map((t, i) => (
            <li key={i}>
              <Card t={t} hidden={false} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, ease, delay: index * 0.07 }}
      className="h-full min-w-0"
    >
      <div
        ref={viewportRef}
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
        className="relative -mx-1 h-full overflow-hidden px-1 [mask-image:linear-gradient(to_bottom,transparent,#000_18%,#000_82%,transparent)]"
      >
        <div ref={trackRef} className="will-change-transform">
          {set("clone")}
          {set("real")}
          {set("clone")}
        </div>
      </div>
    </motion.div>
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
        if (e.pointerType !== "mouse" || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        ref.current.style.setProperty("--x", `${e.clientX - r.left}px`);
        ref.current.style.setProperty("--y", `${e.clientY - r.top}px`);
      }}
      style={{ "--x": "50%", "--y": "-40px" } as CSSProperties}
      className="group/card relative isolate rounded-[16px] bg-[#0c0c0d] p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07),inset_0_1px_0_rgba(255,255,255,0.05)] transition-[translate,background-color,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[3px] hover:bg-[#111113] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09),inset_0_1px_0_rgba(255,255,255,0.06),0_24px_48px_-24px_rgba(0,0,0,0.9)] focus-visible:-translate-y-[3px] focus-visible:bg-[#111113] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white @3xl:p-6"
    >
      {/* Pointer spotlight: a soft wash on the surface and a brighter arc on the border. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] opacity-0 transition-opacity duration-200 group-hover/card:opacity-100"
        style={{ background: "radial-gradient(320px circle at var(--x) var(--y), rgba(255,255,255,0.055), transparent 50%)" }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] p-px opacity-0 transition-opacity duration-200 group-hover/card:opacity-100"
        style={{
          background: "radial-gradient(180px circle at var(--x) var(--y), rgba(255,255,255,0.42), transparent 70%)",
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
      <blockquote className="text-pretty text-[15px] leading-[1.6] tracking-[-0.005em] text-white/55">
        <p>
          <Quote text={t.quote} />
        </p>
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3">
        <Avatar name={t.name} />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[14px] font-medium tracking-[-0.01em] text-white/90">
            <span className="truncate">{t.name}</span>
            {t.verified && <Verified />}
          </span>
          <span className="block truncate text-[13px] text-white/40">
            {t.role}, {t.company}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}

function Quote({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  const out: ReactNode[] = [];
  parts.forEach((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) out.push(<span key={i} className="text-white/90">{p.slice(2, -2)}</span>);
    else out.push(<Fragment key={i}>{p}</Fragment>);
  });
  return (
    <>
      “{out}”
    </>
  );
}

/** Initials on a disc whose hue comes from the name, so each person keeps their colour everywhere. */
function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span
      aria-hidden="true"
      className="relative grid size-9 shrink-0 place-items-center rounded-full font-mono text-[11px] font-medium tracking-[0.02em]"
      style={{
        background: `radial-gradient(120% 120% at 30% 20%, hsl(${h} 32% 26%), hsl(${h} 30% 12%))`,
        color: `hsl(${h} 70% 84%)`,
        boxShadow: `inset 0 0 0 1px hsl(${h} 50% 70% / 0.18), inset 0 1px 0 rgba(255,255,255,0.08)`,
      }}
    >
      {initials}
    </span>
  );
}

function Verified() {
  return (
    <>
      <svg viewBox="0 0 16 16" className="size-[13px] shrink-0" aria-hidden="true">
        {/* An eight-lobed seal, drawn rather than borrowed. */}
        <path
          d="M8 .9l1.6 1.3 2-.3.7 1.9 1.9.7-.3 2L15.1 8l-1.3 1.6.3 2-1.9.7-.7 1.9-2-.3L8 15.1l-1.6-1.3-2 .3-.7-1.9-1.9-.7.3-2L.9 8l1.3-1.6-.3-2 1.9-.7.7-1.9 2 .3z"
          fill="#8ab8ff"
        />
        <path d="M5.2 8.2l1.9 1.9 3.8-4" fill="none" stroke="#0b0b0c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="sr-only">(verified customer)</span>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                 */
/* ------------------------------------------------------------------ */

function TestimonialWallDemo() {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-black px-4 py-12 text-white sm:px-8 sm:py-16">
      <div className="w-full max-w-[1180px]">
        <TestimonialWall />
      </div>
    </div>
  );
}

export default TestimonialWallDemo;
