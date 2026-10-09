"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, type MotionValue } from "motion/react";

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
  className?: string;
};

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

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

export function HeaderAnnouncement({
  messages = DEFAULT_MESSAGES,
  interval = 5200,
  open,
  defaultOpen = true,
  onDismiss,
  storageKey,
  className = "",
}: HeaderAnnouncementProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId();
  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const visible = (open ?? innerOpen) && messages.length > 0;
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const rootRef = useRef<HTMLElement>(null);
  const progress = useMotionValue(0);
  const elapsed = useRef(0);
  const count = messages.length;
  const current = messages[Math.min(index, count - 1)];

  // Optional persistence. Read once on mount; never required.
  useEffect(() => {
    if (!storageKey) return;
    try {
      if (window.localStorage.getItem(storageKey) === "dismissed") setInnerOpen(false);
    } catch {
      /* storage blocked: stay open */
    }
  }, [storageKey]);

  const go = useCallback(
    (next: number, direction: 1 | -1) => {
      elapsed.current = 0;
      progress.set(0);
      setDir(direction);
      setIndex(((next % count) + count) % count);
    },
    [count, progress],
  );

  // Pause offscreen (and in hidden tabs, which stop rAF anyway).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  const paused = hover || focus || !onScreen || reduce || count < 2;

  useEffect(() => {
    if (!visible || paused) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      elapsed.current += Math.min(now - last, 100);
      last = now;
      const p = elapsed.current / interval;
      if (p >= 1) {
        go(index + 1, 1);
        return;
      }
      progress.set(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, paused, interval, index, go, progress]);

  const dismiss = () => {
    if (open === undefined) setInnerOpen(false);
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, "dismissed");
      } catch {
        /* ignore */
      }
    }
    onDismiss?.(current.id);
  };

  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.section
          ref={rootRef}
          key="strip"
          aria-label="Announcements"
          aria-roledescription="carousel"
          initial={{ height: 0 }}
          animate={{ height: "auto", transition: { duration: reduce ? 0 : 0.36, ease: EASE_OUT } }}
          exit={{ height: 0, transition: { duration: reduce ? 0 : 0.32, ease: EASE_IN_OUT, delay: reduce ? 0 : 0.06 } }}
          onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
          onPointerLeave={() => setHover(false)}
          onFocus={() => setFocus(true)}
          onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setFocus(false)}
          className={`relative overflow-hidden bg-[#0b0b0c] text-white ${className}`}
        >
          <motion.div
            initial={false}
            exit={{ opacity: 0, transition: { duration: 0.14 } }}
            className="@container border-b border-white/[0.08]"
          >
            <div className="mx-auto grid h-11 max-w-[1280px] grid-cols-[1fr_auto] items-center pl-4 pr-1 @2xl:h-10 @2xl:grid-cols-[96px_1fr_96px] @2xl:px-6">
              {/* Pager: one segment per message; the live one fills as time runs. */}
              {count > 1 ? (
                <div className="hidden items-center gap-0.5 @2xl:flex" role="group" aria-label="Choose announcement">
                  {messages.map((m, i) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => go(i, i < index ? -1 : 1)}
                      aria-label={`Announcement ${i + 1} of ${count}`}
                      aria-current={i === index ? "true" : undefined}
                      className="group flex h-6 w-6 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                    >
                      <Segment active={i === index} progress={progress} reduce={reduce} paused={paused && !reduce && count > 1} />
                    </button>
                  ))}
                </div>
              ) : (
                <span className="hidden @2xl:block" />
              )}

              {/* Message roll */}
              <div className="relative h-full min-w-0 overflow-hidden" aria-live={paused ? "polite" : "off"} aria-atomic="true">
                <AnimatePresence initial={false} custom={dir}>
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
                    transition={{ duration: reduce ? 0.15 : 0.5, ease: EASE_OUT }}
                    className="absolute inset-0 flex items-center gap-2.5 @2xl:justify-center"
                    id={`${uid}-msg`}
                    aria-roledescription="slide"
                    aria-label={`${index + 1} of ${count}`}
                  >
                    {current.badge ? <Badge label={current.badge} reduce={reduce} /> : null}
                    <p className="min-w-0 truncate text-[13px] leading-none tracking-[-0.005em] text-white/80">
                      <span className="@4xl:hidden">{current.short ?? current.text}</span>
                      <span className="hidden @4xl:inline">{current.text}</span>
                    </p>
                    {current.link ? (
                      <a
                        href={current.link.href}
                        className="group/l relative flex shrink-0 items-center gap-1 rounded-md text-[13px] font-medium leading-none text-white outline-none after:absolute after:-inset-x-1.5 after:-inset-y-2 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0c] @max-2xl:static @max-2xl:after:inset-0 @max-2xl:after:rounded-none"
                      >
                        <span className="sr-only @2xl:not-sr-only">{current.link.label}</span>
                        <svg viewBox="0 0 16 16" className="size-3.5 text-white/60 transition-[transform,color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/l:translate-x-0.5 group-hover/l:text-white" fill="none" aria-hidden="true">
                          <path d="M3 8h9.5m0 0L8.5 4M12.5 8l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </a>
                    ) : null}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={dismiss}
                  aria-label="Dismiss announcements"
                  className="relative z-10 flex size-11 items-center justify-center rounded-lg text-white/45 outline-none transition-[color,background-color,transform] duration-150 hover:bg-white/[0.06] hover:text-white active:scale-[0.94] focus-visible:ring-2 focus-visible:ring-white/70 @2xl:size-7 @2xl:rounded-md"
                >
                  <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
                    <path d="m4 4 8 8m0-8-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}

function Segment({ active, progress, reduce, paused }: { active: boolean; progress: MotionValue<number>; reduce: boolean; paused: boolean }) {
  return (
    <span className="relative block h-[3px] w-4 overflow-hidden rounded-full bg-white/[0.16] transition-colors duration-150 group-hover:bg-white/30">
      {active ? (
        <motion.span
          className={`absolute inset-0 origin-left rounded-full transition-colors duration-200 ${paused ? "bg-white/55" : "bg-white/90"}`}
          style={reduce ? undefined : { scaleX: progress }}
        />
      ) : null}
    </span>
  );
}

function Badge({ label, reduce }: { label: string; reduce: boolean }) {
  return (
    <span className="relative inline-flex h-5 shrink-0 items-center overflow-hidden rounded-full bg-[#ff8a4c]/[0.12] px-2 font-mono text-[10px] font-medium uppercase leading-none tracking-[0.08em] text-[#ffa375] shadow-[inset_0_0_0_1px_rgba(255,138,76,0.28)]">
      {label}
      {reduce ? null : (
        <motion.span
          aria-hidden="true"
          initial={{ x: "-110%" }}
          animate={{ x: "110%" }}
          transition={{ duration: 0.9, ease: EASE_IN_OUT, delay: 0.35 }}
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(100deg,transparent_25%,rgba(255,220,200,0.55)_50%,transparent_75%)] mix-blend-plus-lighter"
        />
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Demo: the strip over a minimal header silhouette, so the dismiss     */
/* collapse can be seen moving what sits beneath it.                    */
/* ------------------------------------------------------------------ */

function Demo() {
  const [open, setOpen] = useState(true);
  return (
    <div className="min-h-[420px] bg-black">
      <HeaderAnnouncement open={open} onDismiss={() => setOpen(false)} />
      <div aria-hidden="true" className="border-b border-white/[0.06]">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="size-5 text-white">
              <path d="M12 3 4 7.5v9L12 21l8-4.5v-9Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="m4 7.5 8 4.5 8-4.5M12 12v9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" opacity="0.5" />
            </svg>
            <span className="font-display text-[16px] font-semibold tracking-[-0.035em] text-white">Outpost</span>
          </div>
          <div className="hidden items-center gap-7 text-[13.5px] text-white/45 md:flex">
            <span>Incidents</span>
            <span>Status pages</span>
            <span>On-call</span>
            <span>Pricing</span>
          </div>
          <span className="flex h-8 items-center rounded-lg bg-white px-3.5 text-[13px] font-medium text-black">Sign up</span>
        </div>
      </div>
      <div aria-hidden="true" className="mx-auto max-w-[1280px] px-4 pt-14 sm:px-6">
        <div className="h-8 w-[min(440px,75%)] rounded-md bg-white/[0.05]" />
        <div className="mt-3 h-8 w-[min(300px,50%)] rounded-md bg-white/[0.035]" />
        <div className="mt-7 h-2.5 w-[min(420px,85%)] rounded-full bg-white/[0.035]" />
        <div className="mt-2.5 h-2.5 w-[min(360px,70%)] rounded-full bg-white/[0.035]" />
      </div>
      <AnimatePresence>
        {!open ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.3, duration: 0.3, ease: EASE_OUT } }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            className="mt-12 flex justify-center"
          >
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="h-9 rounded-full px-4 font-mono text-[11.5px] uppercase tracking-[0.12em] text-white/45 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] outline-none transition-[color,background-color,transform] duration-150 hover:bg-white/[0.04] hover:text-white active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-white/70"
            >
              Bring the strip back
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default Demo;
