"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type RefObject } from "react";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useReducedMotion, useTransform, type Variants } from "motion/react";

type Link = { label: string; href: string; /** Small mono note after the label, e.g. "2 open". */ note?: string; external?: boolean };
type Column = { title: string; links: Link[] };
type NewsletterCopy = { title: string; body: string; placeholder: string; button: string; success: string };

export type FooterWordmarkProps = {
  /** The giant word at the bottom. Short, no descenders reads best. */
  wordmark?: string;
  headline?: string;
  email?: string;
  columns?: Column[];
  address?: string[];
  /** City label shown before the live time. */
  city?: string;
  /** IANA time zone for the live clock. */
  timeZone?: string;
  newsletter?: NewsletterCopy;
  /** Called with the address when the form is submitted. */
  onSubscribe?: (email: string) => void;
  legal?: string;
  legalLinks?: Link[];
  /** Share of the cap height cut off by the bottom edge, 0–0.3. */
  clip?: number;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const COLORS = {
  bg: "#050506",
  ink: "#ffffff",
  /** Text on the solid white pills. */
  onInk: "#000000",
  error: "#f87171",
  errorText: "#fca5a5",
  /** The wordmark's metal: white at the cap line fading into the floor. */
  metal: [
    { at: 0, color: "#ffffff", opacity: 0.9 },
    { at: 0.55, color: "#a1a1aa", opacity: 0.5 },
    { at: 1, color: "#3f3f46", opacity: 0.05 },
  ],
} as const;

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Entrance timeline, in seconds. Four blocks, each revealed when a quarter of
 * it is on screen: the closing line, the column grid, the wordmark and the
 * legal bar, which lands last. Inside a block: rules draw, then text in
 * reading order, then figures (rings, the clock), then live signals.
 */
const T = {
  lead: 0,
  word: 0.035,
  email: 0.3,
  chip: 0.42,
  ring: 0.24,
  grid: 0.32,
  column: 0.06,
  link: 0.03,
  clockCount: 0.32,
  countDur: 0.7,
  mark: 0.5,
  markDur: 0.9,
  legal: 0.62,
  dur: 0.6,
  drawDur: 0.8,
} as const;

/** Share of a block that must be on screen before it reveals. */
const REVEAL_AMOUNT = 0.25;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Until the wordmark is measured: a rough advance per character and ascent, in 100px units. */
const ESTIMATE = { advance: 58, ascent: 74 };
const MINUTES_PER_DAY = 24 * 60;

const reveal: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(8px)" },
  show: (delay: number) => ({ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: T.dur, ease: EASE, delay }, transitionEnd: { filter: "none" } }),
};
/** Rules draw from the left edge. */
const drawX: Variants = {
  hidden: { scaleX: 0 },
  show: (delay: number) => ({ scaleX: 1, transition: { duration: T.drawDur, ease: EASE, delay } }),
};
/** Circles draw along their path from twelve o’clock. */
const drawPath: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  show: (delay: number) => ({ pathLength: 1, opacity: 1, transition: { duration: 0.7, ease: EASE, delay } }),
};
/** Small round chips and dots arrive after their line. */
const pop: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  show: (delay: number) => ({ opacity: 1, scale: 1, transition: { duration: 0.45, ease: EASE, delay } }),
};
/** Reduced motion: one short fade, no transforms, blur or stagger. */
const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
};

const MONO_LABEL = "font-mono text-[11px] uppercase tracking-[0.16em] text-white/45";
const RING = "outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-4 focus-visible:ring-offset-(--fw-bg)";

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

/**
 * Scroll reveal for one block. A block waits until a quarter of it is on
 * screen, but never runs ahead of its slot in the shared timeline: blocks that
 * arrive together play in order, and one scrolled to later starts at once
 * instead of waiting out its slot. Returns the block's delay, or null while hidden.
 */
function useReveal(ref: RefObject<Element | null>, slot: number, clock: RefObject<number | null>) {
  const inView = useInView(ref, { once: true, amount: REVEAL_AMOUNT });
  const [start, setStart] = useState<number | null>(null);
  useEffect(() => {
    if (!inView) return;
    const now = performance.now() / 1000;
    clock.current ??= now;
    setStart(Math.max(0, slot - (now - clock.current)));
  }, [inView, slot, clock]);
  return start;
}

/** Minutes since midnight in `timeZone`, updated on each minute boundary. Null until mounted. */
function useMinuteOfDay(timeZone: string) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    let timer = 0;
    const tick = () => {
      const d = new Date();
      setNow(d);
      // Wake on the next minute boundary rather than polling every second.
      timer = window.setTimeout(tick, 60_000 - (d.getTime() % 60_000) + 20);
    };
    tick();
    return () => window.clearTimeout(timer);
  }, []);
  if (!now) return null;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "short" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { minutes: (Number(get("hour")) % 24) * 60 + Number(get("minute")), zone: get("timeZoneName"), iso: now.toISOString() };
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function FooterWordmark({
  wordmark = "saltmarsh",
  headline = "Got a brief, a hunch or a half-built thing?",
  email = "hello@saltmarsh.studio",
  columns = [
    {
      title: "Studio",
      links: [
        { label: "About", href: "#about" },
        { label: "Services", href: "#services" },
        { label: "Careers", href: "#careers", note: "2 open" },
        { label: "Press kit", href: "#press" },
      ],
    },
    {
      title: "Work",
      links: [
        { label: "Case studies", href: "#work" },
        { label: "Archive", href: "#archive" },
        { label: "Playground", href: "#playground" },
        { label: "Awards", href: "#awards" },
      ],
    },
    {
      title: "Elsewhere",
      links: [
        { label: "Instagram", href: "#", external: true },
        { label: "Are.na", href: "#", external: true },
        { label: "LinkedIn", href: "#", external: true },
        { label: "Read.cv", href: "#", external: true },
      ],
    },
  ],
  address = ["2nd floor, 14 Rivington St", "London EC2A 3DU"],
  city = "London",
  timeZone = "Europe/London",
  newsletter = {
    title: "Low Tide",
    body: "A short letter every other Thursday: what we’re making, reading and stealing. No growth hacks.",
    placeholder: "you@domain.com",
    button: "Subscribe",
    success: "You’re in. The next one lands Thursday.",
  },
  onSubscribe,
  legal = "© 2026 Saltmarsh Studio Ltd. Registered in England, no. 13840219.",
  legalLinks = [
    { label: "Privacy", href: "#privacy" },
    { label: "Cookies", href: "#cookies" },
    { label: "Accessibility", href: "#accessibility" },
  ],
  clip = 0.14,
}: FooterWordmarkProps) {
  const reduce = !!useReducedMotion();
  const vars = { "--fw-bg": COLORS.bg, "--fw-ink": COLORS.ink, "--fw-on-ink": COLORS.onInk, "--fw-error": COLORS.error, "--fw-error-text": COLORS.errorText } as CSSProperties;

  const clock = useRef<number | null>(null);
  const leadRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const legalRef = useRef<HTMLDivElement>(null);
  const leadAt = useReveal(leadRef, T.lead, clock);
  const gridAt = useReveal(gridRef, T.grid, clock);
  const markAt = useReveal(markRef, T.mark, clock);
  const legalAt = useReveal(legalRef, T.legal, clock);

  const v = reduce ? fade : reveal;
  const draw = reduce ? fade : drawX;
  const at = (start: number | null, offset: number) => (start ?? 0) + offset;
  const state = (start: number | null) => (start === null ? "hidden" : "show");

  return (
    <footer style={vars} className="@container relative isolate overflow-hidden bg-(--fw-bg) text-(--fw-ink)">
      {/* The top hairline fades out at both ends and draws from the centre. */}
      <motion.div
        aria-hidden="true"
        initial="hidden"
        animate={state(leadAt)}
        variants={draw}
        custom={at(leadAt, 0)}
        className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent,rgb(255_255_255/0.2),transparent)]"
      />
      <div className="mx-auto max-w-[1440px] px-5 pt-16 @2xl:px-8 @2xl:pt-20 @5xl:px-12 @5xl:pt-24">
        {/* Closing line + email */}
        <motion.div ref={leadRef} initial="hidden" animate={state(leadAt)} className="flex flex-col gap-10 @3xl:flex-row @3xl:items-end @3xl:justify-between">
          <div>
            <h2 className="max-w-[17ch] font-display text-[clamp(2.4rem,1.3rem+4.4cqi,5.5rem)] font-bold leading-[0.95] tracking-[-0.05em]">
              <span className="sr-only">{headline}</span>
              <span aria-hidden="true">
                {headline.split(" ").map((w, i, all) => (
                  <span key={`${w}-${i}`}>
                    <motion.span variants={v} custom={at(leadAt, i * T.word)} className="inline-block">
                      {w}
                    </motion.span>
                    {i < all.length - 1 ? " " : null}
                  </span>
                ))}
              </span>
            </h2>
            <EmailLink email={email} start={leadAt} reduce={reduce} />
          </div>
          <BackToTop start={leadAt} reduce={reduce} />
        </motion.div>

        {/* Columns */}
        <motion.div
          ref={gridRef}
          initial="hidden"
          animate={state(gridAt)}
          className="relative mt-16 grid grid-cols-2 gap-x-6 gap-y-12 pt-10 @2xl:grid-cols-4 @5xl:mt-24 @6xl:grid-cols-12 @6xl:gap-x-8"
        >
          <motion.span aria-hidden="true" variants={draw} custom={at(gridAt, 0)} className="absolute inset-x-0 top-0 h-0.5 origin-left bg-white/15" />
          {columns.map((col, ci) => (
            <LinkColumn key={col.title} column={col} delay={at(gridAt, ci * T.column)} reduce={reduce} />
          ))}
          <Visit address={address} city={city} timeZone={timeZone} start={gridAt === null ? null : at(gridAt, columns.length * T.column)} reduce={reduce} />
          <motion.div variants={v} custom={at(gridAt, (columns.length + 1) * T.column)} className="col-span-2 @2xl:col-span-4 @6xl:col-span-4 @6xl:col-start-9">
            <Newsletter {...newsletter} onSubscribe={onSubscribe} reduce={reduce} />
          </motion.div>
        </motion.div>

        {/* Legal */}
        <motion.div
          ref={legalRef}
          initial="hidden"
          animate={state(legalAt)}
          className="relative mt-14 flex flex-col gap-3 py-5 font-mono text-[11px] uppercase tracking-[0.12em] text-white/55 @5xl:flex-row @5xl:items-center @5xl:justify-between"
        >
          <motion.span aria-hidden="true" variants={draw} custom={at(legalAt, 0)} className="absolute inset-x-0 top-0 h-px origin-left bg-white/[0.08]" />
          <motion.p variants={v} custom={at(legalAt, 0.06)}>
            {legal}
          </motion.p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {legalLinks.map((l, i) => (
              <motion.li key={l.label} variants={v} custom={at(legalAt, 0.1 + i * T.link)}>
                <a href={l.href} className="inline-flex min-h-8 items-center outline-none transition-[color,transform] duration-150 hover:text-white focus-visible:underline active:scale-[0.97]">
                  {l.label}
                </a>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        <div ref={markRef}>
          <Wordmark text={wordmark} clip={clip} start={markAt} reduce={reduce} />
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Parts                                                               */
/* ------------------------------------------------------------------ */

function EmailLink({ email, start, reduce }: { email: string; start: number | null; reduce: boolean }) {
  const at = (o: number) => (start ?? 0) + o;
  return (
    <motion.a
      href={`mailto:${email}`}
      variants={reduce ? fade : reveal}
      custom={at(T.email)}
      className={`group mt-8 inline-flex max-w-full items-center gap-3 font-display text-[clamp(1.25rem,0.9rem+1.6cqi,2.25rem)] font-semibold tracking-[-0.035em] transition-transform duration-150 active:scale-[0.99] ${RING}`}
    >
      <span className="relative truncate pb-1">
        {email}
        {/* Underline: draws in on reveal (outer), retracts to the right on hover (inner). */}
        <motion.span aria-hidden="true" variants={reduce ? fade : drawX} custom={at(T.email + 0.12)} className="absolute inset-x-0 bottom-0 block h-0.5 origin-left">
          <span className="block size-full origin-right bg-current transition-transform duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-0" />
        </motion.span>
      </span>
      <motion.span
        aria-hidden="true"
        variants={reduce ? fade : pop}
        custom={at(T.chip)}
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-(--fw-ink) text-(--fw-on-ink) @2xl:size-12"
      >
        <svg viewBox="0 0 16 16" className="size-4 transition-transform duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-rotate-45 @2xl:size-5" fill="none">
          <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.span>
    </motion.a>
  );
}

function BackToTop({ start, reduce }: { start: number | null; reduce: boolean }) {
  const at = (o: number) => (start ?? 0) + o;
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })}
      className={`group flex shrink-0 items-center gap-3 self-start text-[15px] font-semibold transition-transform duration-150 active:scale-[0.97] @3xl:flex-col @3xl:items-end @3xl:self-end ${RING}`}
    >
      <span className="relative flex size-14 items-center justify-center @5xl:size-20">
        {/* The ring draws along its path; non-scaling stroke keeps it 2px at both sizes. */}
        <svg viewBox="0 0 80 80" className="absolute inset-0 size-full -rotate-90" fill="none" aria-hidden="true">
          <motion.circle cx="40" cy="40" r="39" stroke="currentColor" strokeOpacity="0.15" strokeWidth="2" vectorEffect="non-scaling-stroke" variants={reduce ? fade : drawPath} custom={at(T.ring)} />
        </svg>
        <motion.svg
          viewBox="0 0 16 16"
          variants={reduce ? fade : reveal}
          custom={at(T.ring + 0.2)}
          className="size-5 @5xl:size-6"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M8 13V3m0 0L3.5 7.5M8 3l4.5 4.5"
            className="transition-transform duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-1"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.svg>
      </span>
      <motion.span variants={reduce ? fade : reveal} custom={at(T.ring + 0.26)} className="font-mono text-[11px] uppercase tracking-[0.16em]">
        Back to top
      </motion.span>
    </button>
  );
}

function LinkColumn({ column, delay, reduce }: { column: Column; delay: number; reduce: boolean }) {
  const v = reduce ? fade : reveal;
  return (
    <nav aria-label={column.title} className="@6xl:col-span-2">
      <motion.h3 variants={v} custom={delay} className={MONO_LABEL}>
        {column.title}
      </motion.h3>
      <ul className="mt-4 space-y-1">
        {column.links.map((l, i) => (
          <motion.li key={l.label} variants={v} custom={delay + 0.05 + i * T.link}>
            <a
              href={l.href}
              target={l.external ? "_blank" : undefined}
              rel={l.external ? "noreferrer" : undefined}
              className="group inline-flex min-h-9 items-center gap-1.5 text-[17px] font-medium tracking-[-0.015em] outline-none transition-transform duration-150 focus-visible:underline focus-visible:decoration-2 focus-visible:underline-offset-4 active:scale-[0.97]"
            >
              <span className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1.5px] bg-left-bottom bg-no-repeat transition-[background-size] duration-300 group-hover:bg-[length:100%_1.5px]">
                {l.label}
              </span>
              {l.external ? (
                <span aria-hidden="true" className="text-[13px] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                  ↗
                </span>
              ) : null}
              {l.note ? <span className="rounded-full bg-white/[0.08] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-white/80">{l.note}</span> : null}
              {l.external ? <span className="sr-only">(opens in a new tab)</span> : null}
            </a>
          </motion.li>
        ))}
      </ul>
    </nav>
  );
}

/** Address and the live local time. The clock counts up from 00:00 once its block lands, then ticks each minute. */
function Visit({ address, city, timeZone, start, reduce }: { address: string[]; city: string; timeZone: string; start: number | null; reduce: boolean }) {
  const v = reduce ? fade : reveal;
  const at = (o: number) => (start ?? 0) + o;
  const time = useMinuteOfDay(timeZone);
  const minutes = useMotionValue(0);
  const text = useTransform(minutes, (m) => {
    const t = Math.round(m) % MINUTES_PER_DAY;
    return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  });
  const filter = useTransform(minutes, (m) => `blur(${(1 - Math.min(1, m / Math.max(1, time?.minutes ?? 1))) * 3}px)`);
  const counted = useRef(false);
  // The live dot pings only while the clock is on screen.
  const dotRef = useRef<HTMLSpanElement>(null);
  const live = useInView(dotRef);

  useEffect(() => {
    if (start === null || time === null) return;
    if (reduce || counted.current) {
      minutes.jump(time.minutes);
      return;
    }
    counted.current = true;
    const controls = animate(minutes, time.minutes, { duration: T.countDur, delay: start + T.clockCount, ease: EASE });
    return () => controls.stop();
  }, [start, time?.minutes, reduce, minutes]);

  return (
    <div className="@6xl:col-span-2">
      <motion.h3 variants={v} custom={at(0)} className={MONO_LABEL}>
        Visit
      </motion.h3>
      <motion.address variants={v} custom={at(0.05)} className="mt-4 text-[17px] not-italic leading-[1.45] tracking-[-0.015em]">
        {address.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </motion.address>
      <div className="mt-6">
        <motion.p variants={v} custom={at(0.12)} className={`flex items-center gap-2 ${MONO_LABEL}`}>
          <motion.span ref={dotRef} variants={reduce ? fade : pop} custom={at(0.3)} className="relative flex size-2">
            {live && !reduce ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-40" /> : null}
            <span className="relative inline-flex size-2 rounded-full bg-white" />
          </motion.span>
          Local time{time?.zone ? ` · ${time.zone}` : ""}
        </motion.p>
        <motion.p variants={v} custom={at(0.18)} className="mt-1.5 font-display text-[22px] font-semibold tracking-[-0.03em]">
          {city}{" "}
          <time className="tabular-nums" dateTime={time?.iso}>
            {time ? <motion.span className="inline-block" style={{ filter }}>{text}</motion.span> : "--:--"}
          </time>
        </motion.p>
      </div>
    </div>
  );
}

function Newsletter({ title, body, placeholder, button, success, onSubscribe, reduce }: NewsletterCopy & { onSubscribe?: (email: string) => void; reduce: boolean }) {
  const id = useId();
  const [value, setValue] = useState("");
  const [state, setState] = useState<"idle" | "error" | "done">("idle");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(value.trim())) return setState("error");
    onSubscribe?.(value.trim());
    setState("done");
  };

  return (
    <div className="@2xl:grid @2xl:grid-cols-2 @2xl:gap-x-8 @6xl:block">
      <div>
        <h3 className={MONO_LABEL}>Newsletter</h3>
        <p className="mt-4 font-sans text-[26px] font-semibold leading-none tracking-[-0.035em]">{title}</p>
        <p className="mt-2 max-w-[40ch] text-[15px] leading-relaxed text-white/60">{body}</p>
      </div>
      <div className="mt-5 min-h-[56px] @2xl:mt-9 @6xl:mt-5">
        <AnimatePresence mode="wait" initial={false}>
          {state === "done" ? (
            <motion.p
              key="done"
              role="status"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.4, ease: EASE }}
              className="flex h-14 items-center gap-3 rounded-full bg-(--fw-ink) px-5 text-[15px] font-medium text-(--fw-on-ink)"
            >
              <svg viewBox="0 0 16 16" className="size-4 shrink-0" fill="none" aria-hidden="true">
                <motion.path
                  d="M3 8.5l3 3 7-7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={reduce ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.38, ease: EASE, delay: 0.15 }}
                />
              </svg>
              {success}
            </motion.p>
          ) : (
            <motion.form key="form" noValidate onSubmit={submit} exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, transition: { duration: 0.2 } }}>
              <label htmlFor={id} className="sr-only">
                Email address
              </label>
              <div
                className={`flex h-14 items-center rounded-full border-2 bg-white/[0.04] p-1 pl-5 transition-colors duration-150 focus-within:bg-white/[0.07] ${
                  state === "error" ? "border-(--fw-error)" : "border-white/15"
                }`}
              >
                <input
                  id={id}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={value}
                  placeholder={placeholder}
                  aria-invalid={state === "error"}
                  aria-describedby={`${id}-err`}
                  onChange={(e) => {
                    setValue(e.target.value);
                    if (state === "error") setState("idle");
                  }}
                  className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-white/35"
                />
                <button
                  type="submit"
                  className="h-full shrink-0 rounded-full bg-(--fw-ink) px-5 text-[14px] font-semibold text-(--fw-on-ink) outline-none transition-transform duration-150 hover:-translate-y-px active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-(--fw-bg)"
                >
                  {button}
                </button>
              </div>
              <p id={`${id}-err`} aria-live="polite" className="mt-2 min-h-5 pl-5 text-[13px] font-medium text-(--fw-error-text)">
                {state === "error" ? "That doesn’t look like an email address yet." : ""}
              </p>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

type Box = { x: number; w: number; asc: number };

/**
 * The giant word. Rendered as SVG text at 100 units and measured with canvas
 * (actual ink bounds, tracking included) so the viewBox hugs the glyphs: the
 * word spans the container edge to edge at any width, and the bottom of the
 * viewBox stops above the baseline so the letters sink into the floor. On
 * reveal the word rises out of that floor and sharpens.
 */
function Wordmark({ text, clip, start, reduce }: { text: string; clip: number; start: number | null; reduce: boolean }) {
  const gradientId = `${useId()}-metal`;
  const ref = useRef<SVGTextElement>(null);
  const [box, setBox] = useState<Box>({ x: 0, w: text.length * ESTIMATE.advance, asc: ESTIMATE.ascent });
  const [measured, setMeasured] = useState(false);

  useEffect(() => {
    let live = true;
    const measure = () => {
      const el = ref.current;
      const ctx = document.createElement("canvas").getContext("2d");
      if (!el || !ctx || !live) return;
      const cs = getComputedStyle(el);
      ctx.font = `${cs.fontWeight} 100px ${cs.fontFamily}`;
      if ("letterSpacing" in ctx) ctx.letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
      const m = ctx.measureText(text);
      const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
      if (w > 0) {
        setBox({ x: -m.actualBoundingBoxLeft, w, asc: m.actualBoundingBoxAscent });
        setMeasured(true);
      }
    };
    measure();
    document.fonts?.ready.then(measure);
    return () => {
      live = false;
    };
  }, [text]);

  const c = Math.min(Math.max(clip, 0), 0.3);
  const h = box.asc * (1 - c);
  const shown = start !== null && measured;

  return (
    <motion.svg
      aria-hidden="true"
      viewBox={`${box.x} ${-box.asc} ${box.w} ${h}`}
      className="mt-6 block w-full select-none overflow-hidden @2xl:mt-8"
      initial={false}
      animate={shown ? { opacity: 1, filter: "blur(0px)" } : { opacity: 0, filter: reduce ? "blur(0px)" : "blur(8px)" }}
      transition={{ duration: reduce ? 0.15 : T.markDur, ease: EASE, delay: shown ? (start ?? 0) : 0 }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
          {COLORS.metal.map((s) => (
            <stop key={s.at} offset={s.at} stopColor={s.color} stopOpacity={s.opacity} />
          ))}
        </linearGradient>
      </defs>
      {/* Translate in viewBox units: from fully below the floor to resting. */}
      <motion.text
        ref={ref}
        fontSize="100"
        fill={`url(#${gradientId})`}
        className="font-display font-semibold tracking-[-0.065em]"
        initial={false}
        animate={{ y: shown || reduce ? 0 : h }}
        transition={{ duration: reduce ? 0 : T.markDur, ease: EASE, delay: shown ? (start ?? 0) : 0 }}
      >
        {text}
      </motion.text>
    </motion.svg>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                */
/* ------------------------------------------------------------------ */

/** Demo: the footer at the foot of a quiet page, with a short run-up so its reveal plays as it arrives. */
export default function FooterWordmarkDemo() {
  return (
    <div className="flex min-h-dvh flex-col justify-end bg-black">
      {/* A short run-up of empty page, so the reveal plays as the footer arrives. */}
      <div aria-hidden className="h-28" />
      <FooterWordmark />
    </div>
  );
}
