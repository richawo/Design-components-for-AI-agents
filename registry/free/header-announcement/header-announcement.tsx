"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, type MotionValue, type Variants } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type Announcement = {
  id: string;
  /** Small pill before the text, e.g. "New". It shimmers once each time it rolls in. */
  badge?: string;
  text: string;
  /** Shorter text for narrow containers (under 896px). Falls back to `text`. */
  short?: string;
  link?: { label: string; href: string };
};

export type HeaderAnnouncementProps = {
  messages?: Announcement[];
  /** Time each message stays up, in ms. Rotation pauses on hover and focus. */
  interval?: number;
  /** Controlled visibility. Omit to let the strip manage itself. */
  open?: boolean;
  /** Starting visibility when uncontrolled. */
  defaultOpen?: boolean;
  /** Called after the dismiss button is pressed, with the id of the message on show. Persist it however you like. */
  onDismiss?: (id: string) => void;
  /** Optional: remember dismissal in localStorage under this key. Off by default. */
  storageKey?: string;
  /** Optional brand colour for the badge. Defaults to white, so the strip stays monochrome. */
  accent?: string;
  /** Show the dismiss button. Turn it off for a notice that has to stay up. */
  dismissible?: boolean;
  /** Show the pager segments (wide containers only). Hidden automatically with a single message. */
  pager?: boolean;
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

const COLOR = {
  strip: "#0b0b0c",
  page: "#000000",
  /** Badge ink when no accent is passed. */
  badge: "#ffffff",
} as const;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

/** Durations in seconds. */
const MOTION = {
  unfold: 0.36, // strip height 0 → auto
  fold: 0.32, // height → 0 on dismiss
  roll: 0.5, // message roll
  shimmer: 0.9,
  shimmerDelay: 0.35,
  fade: 0.15, // reduced motion
} as const;

/** First view: the strip unfolds, the pager segments draw, the message rolls up, dismiss lands last; then the timer starts. */
const INTRO = {
  item: 0.45,
  rise: 8, // px
  blur: 6, // px
  pagerAt: 0.14,
  segmentStagger: 0.04,
  messageAt: 0.18,
  dismissAt: 0.36,
  /** The rotation timer starts once everything has landed, so the first segment fills after its block arrives. */
  done: 0.7,
} as const;

const RISE: Variants = {
  hidden: { opacity: 0, y: INTRO.rise, filter: `blur(${INTRO.blur}px)` },
  shown: (delay: number = 0) => ({ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: INTRO.item, ease: EASE_OUT, delay } }),
};
const FADE: Variants = { hidden: { opacity: 0 }, shown: { opacity: 1, transition: { duration: MOTION.fade } } };
const riseVariants = (reduce: boolean) => (reduce ? FADE : RISE);

/** A pager segment's track draws from its left edge. */
const DRAW: Variants = {
  hidden: { scaleX: 0, opacity: 0 },
  shown: (delay: number = 0) => ({ scaleX: 1, opacity: 1, transition: { duration: 0.4, ease: EASE_OUT, delay } }),
};

const DEFAULT_MESSAGES: Announcement[] = [
  {
    id: "v3",
    badge: "New",
    text: "Outpost 3.0 is here: incidents now draft their own postmortems.",
    short: "Outpost 3.0 drafts your postmortems",
    link: { label: "Read the release", href: "#release" },
  },
  {
    id: "week",
    badge: "Event",
    text: "Incident Week, 14–16 November: four talks, zero slide decks.",
    short: "Incident Week, 14–16 Nov",
    link: { label: "Save a seat", href: "#incident-week" },
  },
  {
    id: "tf",
    badge: "Beta",
    text: "The Terraform provider now manages on-call rotas as code.",
    short: "On-call rotas as code, in Terraform",
    link: { label: "View the docs", href: "#terraform" },
  },
];

/* ------------------------------------------------------------------ */
/* Hooks                                                                */
/* ------------------------------------------------------------------ */

/** Whether the element is on screen; the rotation pauses when it isn't. */
function useOnScreen(ref: RefObject<HTMLElement | null>) {
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return onScreen;
}

/**
 * Accumulates elapsed time in a rAF loop and writes 0–1 into `progress` (no React
 * renders per frame); calls `onDone` when a message's time is up. Elapsed time
 * survives pauses, so hovering holds the bar where it is.
 */
function useRotationTimer({ progress, interval, paused, index, onDone }: { progress: MotionValue<number>; interval: number; paused: boolean; index: number; onDone: () => void }) {
  const elapsed = useRef(0);
  useEffect(() => {
    elapsed.current = 0;
    progress.set(0);
  }, [index, progress]);
  useEffect(() => {
    if (paused) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // Cap each step so a tab returning from the background doesn't skip a message.
      elapsed.current += Math.min(now - last, 100);
      last = now;
      const p = elapsed.current / interval;
      if (p >= 1) return onDone();
      progress.set(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, interval, index, onDone, progress]);
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function HeaderAnnouncement({
  messages = DEFAULT_MESSAGES,
  interval = 5200,
  open,
  defaultOpen = true,
  onDismiss,
  storageKey,
  accent,
  dismissible = true,
  pager = true,
  className = "",
}: HeaderAnnouncementProps) {
  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const visible = (open ?? innerOpen) && messages.length > 0;

  // Optional persistence. Read once on mount; never required.
  useEffect(() => {
    if (!storageKey) return;
    try {
      if (window.localStorage.getItem(storageKey) === "dismissed") setInnerOpen(false);
    } catch {
      /* storage blocked: stay open */
    }
  }, [storageKey]);

  const dismiss = (id: string) => {
    if (open === undefined) setInnerOpen(false);
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, "dismissed");
      } catch {
        /* storage blocked: dismissal lasts for this visit only */
      }
    }
    onDismiss?.(id);
  };

  // The strip mounts per showing, so bringing it back replays its entrance.
  return <AnimatePresence>{visible ? <Strip key="strip" messages={messages} interval={interval} accent={accent} dismissible={dismissible} pager={pager} onDismiss={dismiss} className={className} /> : null}</AnimatePresence>;
}

function Strip({
  messages,
  interval,
  accent,
  dismissible,
  pager,
  onDismiss,
  className,
}: {
  messages: Announcement[];
  interval: number;
  accent?: string;
  dismissible: boolean;
  pager: boolean;
  onDismiss: (id: string) => void;
  className: string;
}) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId();
  const rootRef = useRef<HTMLElement>(null);
  const progress = useMotionValue(0);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [landed, setLanded] = useState(false);
  const onScreen = useOnScreen(rootRef);
  const count = messages.length;
  const current = messages[Math.min(index, count - 1)];
  const rise = riseVariants(reduce);

  useEffect(() => {
    const t = window.setTimeout(() => setLanded(true), reduce ? 0 : INTRO.done * 1000);
    return () => window.clearTimeout(t);
  }, [reduce]);

  const go = useCallback(
    (next: number, direction: 1 | -1) => {
      setDir(direction);
      setIndex(((next % count) + count) % count);
    },
    [count],
  );
  const advance = useCallback(() => go(index + 1, 1), [go, index]);

  const paused = hover || focus || !onScreen || reduce || count < 2;
  useRotationTimer({ progress, interval, paused: paused || !landed, index, onDone: advance });

  return (
    <motion.section
      ref={rootRef}
      aria-label="Announcements"
      aria-roledescription="carousel"
      initial={{ height: 0 }}
      animate={{ height: "auto", transition: { duration: reduce ? 0 : MOTION.unfold, ease: EASE_OUT } }}
      exit={{ height: 0, transition: { duration: reduce ? 0 : MOTION.fold, ease: EASE_IN_OUT, delay: reduce ? 0 : 0.06 } }}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setFocus(false)}
      style={{ backgroundColor: COLOR.strip }}
      className={`relative overflow-hidden text-white ${className}`}
    >
      <motion.div exit={{ opacity: 0, transition: { duration: 0.14, ease: EASE_IN } }} className="@container border-b border-white/[0.08]">
        <div className="mx-auto grid h-11 max-w-[1280px] grid-cols-[1fr_auto] items-center pl-4 pr-1 @2xl:h-10 @2xl:grid-cols-[96px_1fr_96px] @2xl:px-6">
          {count > 1 && pager ? (
            <Pager messages={messages} index={index} progress={progress} reduce={reduce} paused={paused && !reduce} onPick={(i) => go(i, i < index ? -1 : 1)} />
          ) : (
            <span className="hidden @2xl:block" />
          )}

          {/* Message roll: the first message rolls up into place as part of the entrance. */}
          <div className="relative h-full min-w-0 overflow-hidden" aria-live={paused ? "polite" : "off"} aria-atomic="true">
            <AnimatePresence initial custom={dir}>
              <motion.div
                key={current.id}
                custom={dir}
                variants={{
                  enter: (d: number) => (reduce ? { opacity: 0 } : { y: d > 0 ? "100%" : "-100%", opacity: 0, filter: "blur(4px)" }),
                  center: { y: "0%", opacity: 1, filter: "blur(0px)" },
                  exit: (d: number) => (reduce ? { opacity: 0 } : { y: d > 0 ? "-100%" : "100%", opacity: 0, filter: "blur(4px)" }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: reduce ? MOTION.fade : MOTION.roll, ease: EASE_OUT, delay: landed || reduce ? 0 : INTRO.messageAt }}
                className="absolute inset-0 flex items-center gap-2.5 @2xl:justify-center"
                id={`${uid}-msg`}
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${count}`}
              >
                <Message message={current} accent={accent} reduce={reduce} shimmerDelay={(landed ? 0 : INTRO.messageAt) + MOTION.shimmerDelay} />
              </motion.div>
            </AnimatePresence>
          </div>

          {dismissible ? (
            <motion.div variants={rise} initial="hidden" animate="shown" custom={INTRO.dismissAt} className="flex justify-end">
              <button
                type="button"
                data-demo="dismiss"
                onClick={() => onDismiss(current.id)}
                aria-label="Dismiss announcements"
                className="relative z-10 flex size-11 items-center justify-center rounded-lg text-white/45 outline-none transition-[color,background-color,transform] duration-150 hover:bg-white/[0.06] hover:text-white active:scale-[0.94] focus-visible:ring-2 focus-visible:ring-white/70 @2xl:size-7 @2xl:rounded-md"
              >
                <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
                  <path d="m4 4 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </motion.div>
          ) : (
            <span className="hidden @2xl:block" />
          )}
        </div>
      </motion.div>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* Pager: one segment per message; the live one fills as time runs.    */
/* ------------------------------------------------------------------ */

function Pager({
  messages,
  index,
  progress,
  reduce,
  paused,
  onPick,
}: {
  messages: Announcement[];
  index: number;
  progress: MotionValue<number>;
  reduce: boolean;
  paused: boolean;
  onPick: (i: number) => void;
}) {
  const count = messages.length;
  return (
    <div className="hidden items-center gap-0.5 @2xl:flex" role="group" aria-label="Choose announcement">
      {messages.map((m, i) => (
        <button
          key={m.id}
          type="button"
          data-demo={`pager-${i + 1}`}
          onClick={() => onPick(i)}
          aria-label={`Announcement ${i + 1} of ${count}`}
          aria-current={i === index ? "true" : undefined}
          className="group flex h-6 w-6 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <motion.span
            variants={reduce ? FADE : DRAW}
            initial="hidden"
            animate="shown"
            custom={INTRO.pagerAt + i * INTRO.segmentStagger}
            className="relative block h-[3px] w-4 origin-left overflow-hidden rounded-full bg-white/[0.16] transition-colors duration-150 group-hover:bg-white/30"
          >
            {i === index ? (
              <motion.span
                className={`absolute inset-0 origin-left rounded-full transition-colors duration-200 ${paused ? "bg-white/55" : "bg-white/90"}`}
                style={reduce ? undefined : { scaleX: progress }}
              />
            ) : null}
          </motion.span>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One message: badge, text, link.                                      */
/* ------------------------------------------------------------------ */

function Message({ message, accent, reduce, shimmerDelay }: { message: Announcement; accent?: string; reduce: boolean; shimmerDelay: number }) {
  return (
    <>
      {message.badge ? <Badge label={message.badge} accent={accent} reduce={reduce} delay={shimmerDelay} /> : null}
      <p className="min-w-0 truncate text-[13px] leading-none tracking-[-0.005em] text-white/80">
        <span className="@4xl:hidden">{message.short ?? message.text}</span>
        <span className="hidden @4xl:inline">{message.text}</span>
      </p>
      {message.link ? (
        <a
          href={message.link.href}
          className="group/l relative flex shrink-0 items-center gap-1 rounded-md text-[13px] font-medium leading-none text-white outline-none after:absolute after:-inset-x-1.5 after:-inset-y-2 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0c] @max-2xl:static @max-2xl:after:inset-0 @max-2xl:after:rounded-none"
        >
          <span className="sr-only @2xl:not-sr-only">{message.link.label}</span>
          <svg viewBox="0 0 16 16" className="size-3.5 text-white/60 transition-[transform,color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/l:translate-x-0.5 group-hover/l:text-white" fill="none" aria-hidden="true">
            <path d="M3 8h9.5m0 0L8.5 4M12.5 8l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      ) : null}
    </>
  );
}

/** A mono pill; a single white sweep crosses it once as it arrives. The colour comes from `accent` (white by default). */
function Badge({ label, accent, reduce, delay }: { label: string; accent?: string; reduce: boolean; delay: number }) {
  const ink = accent ?? COLOR.badge;
  const style = {
    color: ink,
    backgroundColor: `color-mix(in srgb, ${ink} 10%, transparent)`,
    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${ink} 22%, transparent)`,
  } satisfies CSSProperties;
  return (
    <span style={style} className="relative inline-flex h-5 shrink-0 items-center overflow-hidden rounded-full px-2 font-mono text-[10px] font-medium uppercase leading-none tracking-[0.08em]">
      {label}
      {reduce ? null : (
        <motion.span
          aria-hidden="true"
          initial={{ x: "-110%" }}
          animate={{ x: "110%" }}
          transition={{ duration: MOTION.shimmer, ease: EASE_IN_OUT, delay }}
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(100deg,transparent_25%,rgba(255,255,255,0.5)_50%,transparent_75%)] mix-blend-plus-lighter"
        />
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Demo: the strip above a site's wordmark row and the release note it  */
/* points to, so dismissing visibly glides the page up. Stage only.     */
/* ------------------------------------------------------------------ */

const PAGE = { at: 0.3, stagger: 0.06 } as const;

const NOTES = [
  { k: "01", title: "Drafts from the timeline", body: "Every message, alert and deploy in the incident channel becomes a dated line in the draft." },
  { k: "02", title: "Owners already filled in", body: "Follow-ups are assigned to whoever acted on them, with a due date your on-call rota agrees with." },
  { k: "03", title: "Nothing ships unread", body: "Drafts stay private until a responder signs them off. Outpost never publishes on its own." },
];

/**
 * `open` is lifted into the demo so a control can show and dismiss the strip while the
 * stage below keeps gliding with it; clearing the override returns to the resting state: open.
 */
export default function HeaderAnnouncementDemo({ open: forcedOpen, onDismiss, ...overrides }: Partial<HeaderAnnouncementProps> = {}) {
  const reduce = useReducedMotion() ?? false;
  const rise = riseVariants(reduce);
  const [open, setOpen] = useState(forcedOpen ?? true);
  useEffect(() => {
    setOpen(forcedOpen ?? true);
  }, [forcedOpen]);
  const at = (k: number) => PAGE.at + k * PAGE.stagger;
  return (
    <div className="min-h-[560px] text-white" style={{ backgroundColor: COLOR.page }}>
      <HeaderAnnouncement
        {...overrides}
        open={open}
        onDismiss={(id) => {
          setOpen(false);
          onDismiss?.(id);
        }}
      />
      <div className="border-b border-white/[0.06]">
        <motion.div variants={rise} initial="hidden" animate="shown" custom={at(0)} className="mx-auto flex h-16 max-w-[1280px] items-center gap-2 px-4 sm:px-6">
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
            <path d="M12 3 4 7.5v9L12 21l8-4.5v-9Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="m4 7.5 8 4.5 8-4.5M12 12v9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" opacity="0.5" />
          </svg>
          <span className="font-display text-[16px] font-semibold tracking-[-0.035em]">Outpost</span>
          <AnimatePresence>{!open ? <BringBack onClick={() => setOpen(true)}>Bring the strip back</BringBack> : null}</AnimatePresence>
        </motion.div>
      </div>
      <main className="mx-auto max-w-[1280px] px-4 pb-20 pt-12 sm:px-6 sm:pt-16">
        <motion.p variants={rise} initial="hidden" animate="shown" custom={at(1)} className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">
          Release notes · 3.0 · 9 Oct 2026
        </motion.p>
        <motion.h1
          variants={rise}
          initial="hidden"
          animate="shown"
          custom={at(2)}
          className="mt-5 max-w-[18ch] text-balance font-display text-[clamp(2rem,1.4rem+2.6vw,3.5rem)] font-semibold leading-[1] tracking-[-0.045em]"
        >
          Incidents now draft their own postmortems.
        </motion.h1>
        <motion.p variants={rise} initial="hidden" animate="shown" custom={at(3)} className="mt-5 max-w-[56ch] text-pretty text-[16px] leading-[1.65] text-white/60">
          When an incident closes, Outpost writes the first draft from the channel, the pages and the deploy log, so the review starts from facts instead of a blank document.
        </motion.p>
        <ol className="mt-12 max-w-[880px]">
          {NOTES.map((n, i) => (
            <motion.li
              key={n.k}
              variants={rise}
              initial="hidden"
              animate="shown"
              custom={at(4 + i)}
              className="grid grid-cols-[32px_1fr] gap-x-4 gap-y-1.5 border-t border-white/[0.08] py-5 sm:grid-cols-[48px_240px_1fr] sm:gap-x-6"
            >
              <p className="font-mono text-[11px] leading-[22px] tabular-nums text-white/35">{n.k}</p>
              <p className="text-[15px] font-medium leading-[22px] tracking-[-0.015em]">{n.title}</p>
              <p className="col-start-2 text-pretty text-[14px] leading-[1.6] text-white/55 sm:col-start-3">{n.body}</p>
            </motion.li>
          ))}
        </ol>
      </main>
    </div>
  );
}

function BringBack({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { delay: 0.25, duration: 0.4, ease: EASE_OUT } }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      className="ml-auto flex"
    >
      <button
        type="button"
        data-demo="bring-back"
        onClick={onClick}
        className="h-9 rounded-full px-4 font-mono text-[11.5px] uppercase tracking-[0.12em] text-white/45 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] outline-none transition-[color,background-color,transform] duration-150 hover:bg-white/[0.04] hover:text-white active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-white/70"
      >
        {children}
      </button>
    </motion.div>
  );
}

