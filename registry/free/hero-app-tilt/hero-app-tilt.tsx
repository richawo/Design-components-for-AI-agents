"use client";

import { useCallback, useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
  type Variants,
} from "motion/react";

type Link = { label: string; href: string };

export type TiltThread = {
  from: string;
  initials: string;
  subject: string;
  preview: string;
  time: string;
  unread?: boolean;
  /** Tern has a reply ready for this one. */
  drafted?: boolean;
};

export type TiltFolder = { label: string; count?: number; icon: "reply" | "read" | "ignore" | "inbox" | "sent" | "draft" | "snooze" };

export type TiltMessage = {
  subject: string;
  from: string;
  fromEmail: string;
  to: string;
  time: string;
  body: string[];
  /** The reply Tern drafted, one paragraph per entry. */
  draft: string[];
  /** File attached to the draft. */
  attachment?: string;
};

export type HeroAppTiltProps = {
  eyebrow?: string;
  /** Headline. The `muted` substring is set at 45% ink. */
  headline?: string;
  muted?: string;
  body?: string;
  primary?: Link;
  secondary?: Link;
  /** App window content */
  product?: string;
  account?: { name: string; initials: string };
  folders?: TiltFolder[];
  labels?: string[];
  listTitle?: string;
  threads?: TiltThread[];
  /** Index of the open thread in `threads`. */
  selected?: number;
  message?: TiltMessage;
  /** Overnight summary in the sidebar: how many mails were triaged, and how many of those are done. */
  overnight?: { triaged: number; done: number };
  /** Starting tilt in degrees. The window flattens to 0 as it scrolls into place. */
  tilt?: number;
  /** The one signal colour: things Tern prepared for you (Draft marks, the draft label, the overnight meter). */
  accent?: string;
  /** Black stage (default) or a daylight grey one. */
  theme?: "dark" | "light";
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    page: "#000000",
    window: "#0a0a0b",
    ink: "#ffffff",
    onInk: "#000000",
    avatar: "#1d1d20",
    spot: "rgba(255,255,255,0.2)",
    edge: "rgba(255,255,255,0.55)",
    shadow: "0 0 0 1px rgba(255,255,255,0.09), 0 50px 140px -30px rgba(0,0,0,0.9), 0 30px 60px -30px rgba(0,0,0,0.8)",
  },
  light: {
    page: "#ececee",
    window: "#ffffff",
    ink: "#0b0b0c",
    onInk: "#ffffff",
    avatar: "#ececef",
    spot: "rgba(255,255,255,0.95)",
    edge: "rgba(255,255,255,1)",
    shadow: "0 0 0 1px rgba(11,11,12,0.08), 0 50px 120px -40px rgba(11,11,12,0.35), 0 24px 48px -24px rgba(11,11,12,0.2)",
  },
} as const;

/** Gold: the colour of "Tern did this for you". */
const DEFAULT_ACCENT = "#f2c46d";
const EASE = [0.22, 1, 0.36, 1] as const;

/** Scroll smoothing for the flatten. Soft enough to hide wheel steps, firm enough to never lag a flick. */
const FLATTEN_SPRING = { stiffness: 170, damping: 32, mass: 0.5 } as const;

/**
 * One timeline, in seconds. Copy first (eyebrow → headline → body → actions),
 * then the window (shell → chrome → sidebar → list rows → message → draft),
 * then the figures count and the overnight meter fills once its card has landed.
 * The window's part is relative to the moment it scrolls into view.
 */
const T = {
  eyebrow: 0,
  headline: 0.06,
  line: 0.07,
  body: 0.2,
  actions: 0.26,
  step: 0.05,
  dur: 0.6,
  // Window, relative to its own reveal
  shell: 0.28,
  chrome: 0.38,
  nav: 0.44,
  navStep: 0.025,
  list: 0.46,
  row: 0.52,
  rowStep: 0.045,
  subject: 0.54,
  message: 0.6,
  draft: 0.72,
  draftText: 0.8,
  count: 0.5,
  countDur: 0.7,
  meter: 0.92,
  meterDur: 0.7,
} as const;

/** Rise 12px out of an 8px blur; `custom` is the start time in seconds. */
const reveal: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(8px)" },
  show: (delay: number) => ({ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: T.dur, ease: EASE, delay }, transitionEnd: { filter: "none" } }),
};
/** Inside the window: a shorter rise and blur, the content is small. */
const settle: Variants = {
  hidden: { opacity: 0, y: 8, filter: "blur(6px)" },
  show: (delay: number) => ({ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease: EASE, delay }, transitionEnd: { filter: "none" } }),
};
/** The window shell: no transform here, the scroll owns that. */
const shellIn: Variants = {
  hidden: { opacity: 0, filter: "blur(8px)" },
  show: (delay: number) => ({ opacity: 1, filter: "blur(0px)", transition: { duration: 0.7, ease: EASE, delay }, transitionEnd: { filter: "none" } }),
};
/** Indicator bars draw from their own end. */
const drawY: Variants = {
  hidden: { scaleY: 0 },
  show: (delay: number) => ({ scaleY: 1, transition: { duration: 0.45, ease: EASE, delay } }),
};
/** Reduced motion: one short fade for everything. */
const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
};

// A small type scale for the app, so the window reads as one product.
const TYPE = {
  meta: "font-mono text-[10px] uppercase tracking-[0.16em]",
  small: "text-[11.5px]",
  ui: "text-[12.5px]",
  row: "text-[13px]",
  prose: "text-[13.5px] leading-[1.65]",
} as const;
const HAIRLINE = "border-(--at-ink)/[0.07]";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--at-ink)";

type Pick = (variants: Variants) => Variants;

/** The first folders are Tern's triage buckets; the rest are ordinary mail folders. */
const TRIAGE_FOLDERS = 3;

/* ------------------------------------------------------------------ */
/* Defaults                                                            */
/* ------------------------------------------------------------------ */

const DEFAULT_THREADS: TiltThread[] = [
  { from: "Priya Raman", initials: "PR", subject: "Re: Renewal — 40 seats, not 25", preview: "Finance signed off this morning. Can we get the new order form before Friday?", time: "8:12", unread: true, drafted: true },
  { from: "Jonas Lindqvist", initials: "JL", subject: "Offer letter, final round", preview: "He said yes on the call. Just needs the start date and the equity table.", time: "7:48", unread: true, drafted: true },
  { from: "Halcyon Capital", initials: "HC", subject: "Q3 update — two quick questions", preview: "Loved the churn chart. What changed in August, and is it repeatable?", time: "7:05", drafted: true },
  { from: "Maya Okafor", initials: "MO", subject: "Podcast: 30 mins next week?", preview: "We’re doing an episode on small teams with big customers and thought of you.", time: "Yesterday" },
  { from: "Northwind Ops", initials: "NO", subject: "Invoice #4471 overdue", preview: "Friendly nudge: this one slipped past its due date on the 3rd.", time: "Yesterday", drafted: true },
  { from: "Theo Marchetti", initials: "TM", subject: "Design crit notes", preview: "Three things on the onboarding flow, none of them urgent. Mostly praise.", time: "Mon" },
  { from: "Ines Duarte", initials: "ID", subject: "Lisbon offsite — venue shortlist", preview: "Two options left. One has a terrace, the other has working Wi-Fi.", time: "Mon" },
];

const DEFAULT_FOLDERS: TiltFolder[] = [
  { label: "Reply", count: 12, icon: "reply" },
  { label: "Read later", count: 31, icon: "read" },
  { label: "Ignored", count: 208, icon: "ignore" },
  { label: "Inbox", icon: "inbox" },
  { label: "Drafts", count: 9, icon: "draft" },
  { label: "Snoozed", icon: "snooze" },
  { label: "Sent", icon: "sent" },
];

const DEFAULT_MESSAGE: TiltMessage = {
  subject: "Re: Renewal — 40 seats, not 25",
  from: "Priya Raman",
  fromEmail: "priya@northwind.co",
  to: "Mara Ellison",
  time: "Today, 8:12",
  body: [
    "Hi Mara — finance signed off this morning, so we’d like to go to 40 seats instead of 25 for the renewal.",
    "Could you send the updated order form before Friday? Our fiscal year closes on the 31st and I’d love this off my plate.",
  ],
  draft: [
    "Hi Priya, great news, thank you. I’ve updated the order form to 40 seats at the same per-seat rate and attached it here.",
    "If you can sign by Thursday we’ll have the new seats live on Monday morning.",
  ],
  attachment: "Northwind_order_40.pdf",
};

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function HeroAppTilt({
  eyebrow = "Tern 2.4 · Now on Windows",
  headline = "Your inbox, triaged before coffee.",
  muted = "before coffee.",
  body = "Tern reads the overnight pile, sorts it into Reply, Read later and Ignored, and drafts the boring answers in your voice. You just press send.",
  primary = { label: "Download for Mac", href: "#download" },
  secondary = { label: "See how triage works", href: "#triage" },
  product = "Tern",
  account = { name: "Mara Ellison", initials: "ME" },
  folders = DEFAULT_FOLDERS,
  labels = ["Customers", "Hiring", "Investors"],
  listTitle = "Reply",
  threads = DEFAULT_THREADS,
  selected = 0,
  message = DEFAULT_MESSAGE,
  overnight = { triaged: 251, done: 182 },
  tilt = 22,
  accent = DEFAULT_ACCENT,
  theme = "dark",
}: HeroAppTiltProps) {
  const reduce = !!useReducedMotion();
  const frameRef = useRef<HTMLDivElement>(null);
  // The window has its own trigger: on phones it starts below the fold.
  const windowInView = useInView(frameRef, { once: true, amount: 0.15 });
  const p = PALETTE[theme];
  const vars = {
    "--at-page": p.page,
    "--at-window": p.window,
    "--at-ink": p.ink,
    "--at-on-ink": p.onInk,
    "--at-avatar": p.avatar,
    "--at-edge": p.edge,
    "--at-shadow": p.shadow,
    "--at-accent": accent,
  } as CSSProperties;
  const v: Pick = (variants) => (reduce ? fade : variants);

  const flat = useScrollFlatten(frameRef, reduce);
  const rotateX = useTransform(flat, (k) => (1 - k) * tilt);
  const scale = useTransform(flat, [0, 1], [0.94, 1]);
  const y = useTransform(flat, [0, 1], [24, 0]);
  const spot = useTransform(flat, [0, 1], [0.22, 1]);
  const edge = useTransform(flat, [0, 0.6, 1], [0.15, 0.4, 1]);

  return (
    <motion.section
      aria-label="Introduction"
      style={vars}
      initial="hidden"
      animate="show"
      className="@container relative isolate overflow-hidden bg-(--at-page) text-(--at-ink)"
    >
      <div className="mx-auto flex max-w-[1240px] flex-col items-center px-5 pt-20 text-center @md:px-8 @3xl:pt-28">
        <motion.p variants={v(reveal)} custom={T.eyebrow} className="inline-flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-(--at-ink)/55">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-(--at-accent)" />
          {eyebrow}
        </motion.p>
        <Headline text={headline} muted={muted} variants={v(reveal)} />
        <motion.p variants={v(reveal)} custom={T.body} className="mt-6 max-w-[50ch] text-pretty text-[16px] leading-[1.6] text-(--at-ink)/60 @md:text-[17px]">
          {body}
        </motion.p>
        <div className="mt-9 flex w-full flex-col items-stretch gap-2.5 @md:w-auto @md:flex-row @md:items-center @md:gap-3">
          <motion.div variants={v(reveal)} custom={T.actions} className="flex flex-col">
            <PrimaryLink link={primary} />
          </motion.div>
          <motion.div variants={v(reveal)} custom={T.actions + T.step} className="flex flex-col">
            <SecondaryLink link={secondary} />
          </motion.div>
        </div>
      </div>

      {/* Stage: perspective, spotlight and the bottom fade. */}
      <div className="relative mx-auto mt-14 max-w-[1240px] px-3 @md:mt-20 @md:px-8">
        <motion.div
          aria-hidden="true"
          style={{ opacity: spot, background: `radial-gradient(46% 48% at 50% 40%, ${p.spot}, transparent 70%)` }}
          className="pointer-events-none absolute inset-x-0 -top-44 h-[620px]"
        />
        <div className="relative [mask-image:linear-gradient(to_bottom,#000_52%,transparent_96%)] [perspective:1200px]">
          <motion.div ref={frameRef} style={{ rotateX, scale, y, transformOrigin: "50% 0%" }} className="relative will-change-transform">
            <motion.div initial="hidden" animate={windowInView ? "show" : "hidden"}>
              <motion.div variants={v(shellIn)} custom={T.shell}>
                <AppWindow
                  edge={edge}
                  active={windowInView}
                  reduce={reduce}
                  v={v}
                  product={product}
                  account={account}
                  folders={folders}
                  labels={labels}
                  listTitle={listTitle}
                  threads={threads}
                  selected={selected}
                  message={message}
                  overnight={overnight}
                />
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

/**
 * 0 (tilted) → 1 (flat) as `ref` scrolls from the bottom of the viewport to
 * 20% from the top. A hero is usually already part-way in view on load, so the
 * range is rescaled from wherever it starts: it always opens fully tilted and
 * flattens over the scroll that actually exists.
 */
function useScrollFlatten(ref: RefObject<HTMLElement | null>, reduce: boolean): MotionValue<number> {
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "start 20%"] });
  const raw = useMotionValue(reduce ? 1 : 0);
  const smooth = useSpring(raw, FLATTEN_SPRING);
  const start = useRef(0);
  const first = useRef(true);

  const update = useCallback(() => {
    const v = scrollYProgress.get();
    const k = reduce ? 1 : Math.max(0, Math.min(1, (v - start.current) / (1 - start.current)));
    raw.set(k);
    // No spring on the very first value, or the window would visibly swing into its start pose.
    if (first.current) {
      first.current = false;
      smooth.jump(k);
    }
  }, [reduce, raw, smooth, scrollYProgress]);
  useMotionValueEvent(scrollYProgress, "change", update);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      // The untransformed position (offsetTop chain), not the tilted box.
      let top = 0;
      for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) top += n.offsetTop;
      const vh = window.innerHeight;
      // Capped at 0.85 so a window that starts almost fully in view still has a little flatten left.
      start.current = Math.max(0, Math.min(0.85, (vh - top) / (vh * 0.8)));
      update();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.documentElement);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref, update]);

  return reduce ? raw : smooth;
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

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */

/** The headline in two parts that land one after the other; the muted part is set at 45% ink. */
function Headline({ text, muted, variants }: { text: string; muted: string; variants: Variants }) {
  const i = muted ? text.indexOf(muted) : -1;
  const parts = (i < 0 ? [{ text, dim: false }] : [{ text: text.slice(0, i), dim: false }, { text: muted, dim: true }, { text: text.slice(i + muted.length), dim: false }]).filter(
    (part) => part.text.trim(),
  );
  return (
    <h1 className="mt-6 max-w-[15ch] text-balance font-display text-[clamp(2.6rem,1.1rem+5.4cqw,5.75rem)] font-semibold leading-[0.97] tracking-[-0.055em]">
      {parts.map((part, k) => (
        <span key={k}>
          {/* Inline-blocks swallow edge spaces, so the gap between parts is written out explicitly. */}
          {k > 0 && (/\s$/.test(parts[k - 1].text) || /^\s/.test(part.text)) ? " " : null}
          <motion.span variants={variants} custom={T.headline + k * T.line} className={`inline-block text-balance ${part.dim ? "text-(--at-ink)/45" : ""}`}>
            {part.text.trim()}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}

function PrimaryLink({ link }: { link: Link }) {
  return (
    <a
      href={link.href}
      className={`group inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-(--at-ink) px-6 text-[15px] font-medium tracking-[-0.01em] text-(--at-on-ink) transition-[background-color,scale] duration-150 ease-out hover:bg-(--at-ink)/90 active:scale-[0.97] active:duration-75 ${FOCUS}`}
    >
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-4 transition-transform duration-150 ease-out group-hover:translate-y-0.5">
        <path d="M8 2.5v8m0 0L4.5 7M8 10.5 11.5 7M3 13.5h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {link.label}
    </a>
  );
}

function SecondaryLink({ link }: { link: Link }) {
  return (
    <a
      href={link.href}
      className={`group inline-flex h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-5 text-[15px] font-medium tracking-[-0.01em] text-(--at-ink)/75 ring-1 ring-inset ring-(--at-ink)/15 transition-[color,background-color,box-shadow,scale] duration-150 ease-out hover:bg-(--at-ink)/[0.04] hover:text-(--at-ink) hover:ring-(--at-ink)/25 active:scale-[0.97] active:duration-75 ${FOCUS}`}
    >
      {link.label}
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-3.5 transition-transform duration-150 ease-out group-hover:translate-x-0.5">
        <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* The app window, drawn in markup                                     */
/* ------------------------------------------------------------------ */

type AppWindowProps = {
  edge: MotionValue<number>;
  active: boolean;
  reduce: boolean;
  v: Pick;
  product: string;
  account: { name: string; initials: string };
  folders: TiltFolder[];
  labels: string[];
  listTitle: string;
  threads: TiltThread[];
  selected: number;
  message: TiltMessage;
  overnight: { triaged: number; done: number };
};

function AppWindow({ edge, active, reduce, v, product, account, folders, labels, listTitle, threads, selected, message, overnight }: AppWindowProps) {
  const replyCount = folders[0]?.count ?? threads.length;
  const drafted = threads.filter((t) => t.drafted).length;
  return (
    <figure
      aria-label={`${product} app: the ${listTitle} list with ${threads.length} threads, and a reply drafted for “${message.subject}”.`}
      role="img"
      className="@container/win relative overflow-hidden rounded-[14px] bg-(--at-window) text-left shadow-(--at-shadow) @3xl:rounded-[18px]"
    >
      {/* Edge light along the top, brightening as the window flattens. */}
      <motion.span
        aria-hidden="true"
        style={{ opacity: edge, background: "linear-gradient(90deg, transparent, var(--at-edge) 30%, var(--at-edge) 70%, transparent)" }}
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px"
      />
      <TitleBar account={account} v={v} />
      <div className="flex h-[440px] @xl/win:h-[520px] @4xl/win:h-[600px]">
        <Sidebar product={product} folders={folders} labels={labels} drafted={drafted} overnight={overnight} active={active} reduce={reduce} v={v} />
        <ThreadList title={listTitle} count={replyCount} threads={threads} selected={selected} active={active} reduce={reduce} v={v} />
        <MessagePane message={message} product={product} initials={threads[selected]?.initials ?? "··"} position={`1 of ${replyCount}`} v={v} />
      </div>
    </figure>
  );
}

function TitleBar({ account, v }: { account: { name: string; initials: string }; v: Pick }) {
  return (
    <motion.div variants={v(settle)} custom={T.chrome} className={`flex h-11 items-center gap-3 border-b px-4 ${HAIRLINE}`}>
      <div className="flex gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((k) => (
          <span key={k} className="size-[11px] rounded-full bg-(--at-ink)/[0.14]" />
        ))}
      </div>
      <div className={`mx-auto flex h-7 w-full max-w-[340px] items-center gap-2 rounded-lg bg-(--at-ink)/[0.045] px-2.5 text-[12px] text-(--at-ink)/40 ring-1 ring-inset ring-(--at-ink)/5`}>
        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
          <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.4" fill="none" />
          <path d="m10.2 10.2 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <span className="truncate">Search or jump to…</span>
        <span className="ml-auto hidden font-mono text-[10.5px] text-(--at-ink)/30 @md/win:inline">⌘K</span>
      </div>
      <Avatar initials={account.initials} size={24} />
    </motion.div>
  );
}

function Sidebar({
  product,
  folders,
  labels,
  drafted,
  overnight,
  active,
  reduce,
  v,
}: {
  product: string;
  folders: TiltFolder[];
  labels: string[];
  drafted: number;
  overnight: { triaged: number; done: number };
  active: boolean;
  reduce: boolean;
  v: Pick;
}) {
  // Items land top to bottom on one clock: brand, compose, triage, summary, folders, labels.
  let k = 0;
  const next = () => T.nav + k++ * T.navStep;
  const triage = folders.slice(0, TRIAGE_FOLDERS);
  const rest = folders.slice(TRIAGE_FOLDERS);
  const folderRow = (f: TiltFolder, i: number) => (
    <FolderRow key={f.label} folder={f} on={i === 0} delay={next()} active={active} reduce={reduce} v={v} />
  );
  return (
    <aside className={`hidden w-53 shrink-0 flex-col border-r px-3 py-4 @4xl/win:flex ${HAIRLINE}`}>
      <motion.div variants={v(settle)} custom={next()} className="flex items-center gap-2 px-2">
        <span className="grid size-6 place-items-center rounded-[7px] bg-(--at-ink) text-(--at-on-ink)" aria-hidden="true">
          <svg viewBox="0 0 16 16" className="size-3.5">
            <path d="M2.5 9.5c2.2-.2 4-1.4 5.5-4 1.5 2.6 3.3 3.8 5.5 4-2.6.6-4.4 1.6-5.5 3.5-1.1-1.9-2.9-2.9-5.5-3.5Z" fill="currentColor" />
          </svg>
        </span>
        <span className="text-[14px] font-semibold tracking-[-0.02em] text-(--at-ink)/90">{product}</span>
      </motion.div>
      <motion.div variants={v(settle)} custom={next()} className={`mt-4 flex h-8 items-center justify-between rounded-lg bg-(--at-ink)/[0.06] px-2.5 ${TYPE.ui} text-(--at-ink)/80 ring-1 ring-inset ring-(--at-ink)/[0.06]`}>
        Compose
        <span className="font-mono text-[10.5px] text-(--at-ink)/35">C</span>
      </motion.div>
      <motion.p variants={v(settle)} custom={next()} className={`mt-5 px-2 ${TYPE.meta} text-(--at-ink)/35`}>
        Triage
      </motion.p>
      <ul className="mt-2 space-y-0.5">{triage.map(folderRow)}</ul>
      {/* The summary sits with the triage it describes, high enough to stay clear of the window's bottom fade. */}
      <OvernightCard drafted={drafted} overnight={overnight} delay={next()} active={active} reduce={reduce} v={v} />
      {rest.length ? (
        <>
          <motion.div variants={v(settle)} custom={next()} className="mx-2 my-3 h-px bg-(--at-ink)/[0.06]" />
          <ul className="space-y-0.5">{rest.map((f, i) => folderRow(f, i + TRIAGE_FOLDERS))}</ul>
        </>
      ) : null}
      <motion.p variants={v(settle)} custom={next()} className={`mt-5 px-2 ${TYPE.meta} text-(--at-ink)/35`}>
        Labels
      </motion.p>
      <ul className="mt-2 space-y-0.5">
        {labels.map((l, i) => (
          <motion.li key={l} variants={v(settle)} custom={next()} className={`flex h-8 items-center gap-2.5 px-2 ${TYPE.row} text-(--at-ink)/55`}>
            {/* Labels are told apart by weight of grey, not by hue. */}
            <span className="size-2 rounded-[3px] bg-(--at-ink)" style={{ opacity: 0.5 - i * 0.12 }} />
            {l}
          </motion.li>
        ))}
      </ul>
    </aside>
  );
}

function FolderRow({ folder: f, on, delay, active, reduce, v }: { folder: TiltFolder; on: boolean; delay: number; active: boolean; reduce: boolean; v: Pick }) {
  return (
    <motion.li variants={v(settle)} custom={delay}>
      <div className={`flex h-8 items-center gap-2.5 rounded-[7px] px-2 ${TYPE.row} ${on ? "bg-(--at-ink)/[0.07] text-(--at-ink)" : "text-(--at-ink)/55"}`}>
        <FolderIcon name={f.icon} />
        <span className="truncate">{f.label}</span>
        {f.count != null ? (
          <CountUp value={f.count} active={active} reduce={reduce} delay={delay + 0.08} className={`ml-auto ${TYPE.small} ${on ? "text-(--at-ink)/70" : "text-(--at-ink)/35"}`} />
        ) : null}
      </div>
    </motion.li>
  );
}

/** The summary card. Its meter fills only after the card (and the rest of the window) has landed. */
function OvernightCard({
  drafted,
  overnight,
  delay,
  active,
  reduce,
  v,
}: {
  drafted: number;
  overnight: { triaged: number; done: number };
  delay: number;
  active: boolean;
  reduce: boolean;
  v: Pick;
}) {
  const fill = useProgress(active, reduce, T.meter, T.meterDur);
  const share = overnight.triaged > 0 ? overnight.done / overnight.triaged : 0;
  const scaleX = useTransform(fill, (t) => t * share);
  return (
    <motion.div variants={v(settle)} custom={delay} className="mt-3 rounded-[10px] bg-(--at-ink)/[0.03] p-3 ring-1 ring-inset ring-(--at-ink)/[0.06]">
      <p className={`text-[12px] leading-[1.45] text-(--at-ink)/70`}>
        Overnight: <span className="text-(--at-ink)">{drafted} drafts</span> ready,{" "}
        <CountUp value={overnight.done} active={active} reduce={reduce} delay={T.meter} duration={T.meterDur} /> of {overnight.triaged} sorted.
      </p>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-(--at-ink)/[0.07]">
        <motion.div style={{ scaleX }} className="h-full origin-left rounded-full bg-(--at-accent)" />
      </div>
    </motion.div>
  );
}

function ThreadList({
  title,
  count,
  threads,
  selected,
  active,
  reduce,
  v,
}: {
  title: string;
  count: number;
  threads: TiltThread[];
  selected: number;
  active: boolean;
  reduce: boolean;
  v: Pick;
}) {
  return (
    <section className={`flex w-full min-w-0 flex-col @2xl/win:w-85 @2xl/win:shrink-0 @2xl/win:border-r @5xl/win:w-93 ${HAIRLINE}`}>
      <motion.div variants={v(settle)} custom={T.list} className={`flex h-12 items-center gap-2 border-b px-4 ${HAIRLINE}`}>
        <h2 className="text-[14px] font-semibold tracking-[-0.015em] text-(--at-ink)/90">{title}</h2>
        <CountUp value={count} active={active} reduce={reduce} delay={T.count} className="text-[12px] text-(--at-ink)/35" />
        <div className={`ml-auto flex rounded-[7px] bg-(--at-ink)/[0.04] p-0.5 ${TYPE.small} ring-1 ring-inset ring-(--at-ink)/5`}>
          <span className="rounded-[5px] bg-(--at-ink)/[0.09] px-2 py-0.5 text-(--at-ink)/85">All</span>
          <span className="px-2 py-0.5 text-(--at-ink)/40">Drafted</span>
        </div>
      </motion.div>
      <ul className="min-h-0 flex-1 overflow-hidden">
        {threads.map((t, k) => (
          <ThreadRow key={t.subject} thread={t} on={k === selected} delay={T.row + k * T.rowStep} v={v} />
        ))}
      </ul>
    </section>
  );
}

function ThreadRow({ thread: t, on, delay, v }: { thread: TiltThread; on: boolean; delay: number; v: Pick }) {
  return (
    <motion.li variants={v(settle)} custom={delay} className={`relative flex gap-3 border-b border-(--at-ink)/5 px-4 py-3 ${on ? "bg-(--at-ink)/[0.055]" : ""}`}>
      {on ? <motion.span variants={v(drawY)} custom={delay + 0.15} className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-(--at-ink)/80" /> : null}
      <Avatar initials={t.initials} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={`truncate ${TYPE.row} ${t.unread ? "font-semibold text-(--at-ink)" : "font-medium text-(--at-ink)/70"}`}>{t.from}</span>
          {t.unread ? <span className="size-1.5 shrink-0 -translate-y-px rounded-full bg-(--at-ink)/80" /> : null}
          <span className={`ml-auto shrink-0 ${TYPE.small} tabular-nums text-(--at-ink)/40`}>{t.time}</span>
        </div>
        <p className={`mt-0.5 truncate ${TYPE.ui} ${t.unread ? "text-(--at-ink)/85" : "text-(--at-ink)/60"}`}>{t.subject}</p>
        <div className="mt-1 flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-[12px] text-(--at-ink)/40">{t.preview}</p>
          {t.drafted ? <DraftMark /> : null}
        </div>
      </div>
    </motion.li>
  );
}

/** Accent dot + ink label: legible on either theme, and the colour stays a marker, not a fill. */
function DraftMark() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-[5px] bg-(--at-ink)/[0.05] px-1.5 py-px font-mono text-[9.5px] uppercase tracking-[0.1em] text-(--at-ink)/70">
      <span className="size-1 rounded-full bg-(--at-accent)" />
      Draft
    </span>
  );
}

function MessagePane({ message, product, initials, position, v }: { message: TiltMessage; product: string; initials: string; position: string; v: Pick }) {
  return (
    <article className="hidden min-w-0 flex-1 flex-col @2xl/win:flex">
      <motion.div variants={v(settle)} custom={T.list} className={`flex h-12 items-center gap-1 border-b px-5 text-(--at-ink)/45 ${HAIRLINE}`}>
        {["Archive", "Snooze", "Label"].map((a) => (
          <span key={a} className="rounded-md px-2 py-1 text-[12px]">
            {a}
          </span>
        ))}
        <span className="ml-auto font-mono text-[11px] tabular-nums text-(--at-ink)/35">{position}</span>
      </motion.div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-5 @4xl/win:px-8 @4xl/win:py-6">
        <motion.h3 variants={v(settle)} custom={T.subject} className="text-[19px] font-semibold leading-[1.25] tracking-[-0.025em] @4xl/win:text-[21px]">
          {message.subject}
        </motion.h3>
        <motion.div variants={v(settle)} custom={T.subject + T.step} className="mt-4 flex items-center gap-3">
          <Avatar initials={initials} size={34} />
          <div className={`min-w-0 ${TYPE.ui} leading-[1.4]`}>
            <p className="truncate text-(--at-ink)/85">
              {message.from} <span className="text-(--at-ink)/40">&lt;{message.fromEmail}&gt;</span>
            </p>
            <p className="text-(--at-ink)/40">to {message.to}</p>
          </div>
          <span className={`ml-auto shrink-0 ${TYPE.small} text-(--at-ink)/40`}>{message.time}</span>
        </motion.div>
        <div className={`mt-5 max-w-[60ch] space-y-3 ${TYPE.prose} text-(--at-ink)/70`}>
          {message.body.map((b, k) => (
            <motion.p key={b} variants={v(settle)} custom={T.message + k * T.step}>
              {b}
            </motion.p>
          ))}
        </div>
        <DraftCard message={message} product={product} v={v} />
      </div>
    </article>
  );
}

function DraftCard({ message, product, v }: { message: TiltMessage; product: string; v: Pick }) {
  return (
    <motion.div variants={v(settle)} custom={T.draft} className="mt-6 rounded-xl bg-(--at-ink)/[0.035] p-4 ring-1 ring-inset ring-(--at-ink)/[0.08] @4xl/win:p-5">
      <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-(--at-ink)/60">
        <span className="size-1.5 rounded-full bg-(--at-accent)" />
        Drafted by {product} · in your voice
      </div>
      <div className={`mt-3 space-y-2.5 ${TYPE.prose} text-(--at-ink)/85`}>
        {message.draft.map((d, k) => (
          <motion.p key={d} variants={v(settle)} custom={T.draftText + k * T.step}>
            {d}
          </motion.p>
        ))}
      </div>
      <motion.div variants={v(settle)} custom={T.draftText + message.draft.length * T.step} className="mt-4 flex items-center gap-2">
        <span className={`inline-flex h-8 items-center gap-2 rounded-lg bg-(--at-ink) px-3 ${TYPE.ui} font-medium text-(--at-on-ink)`}>
          Send
          <span className="font-mono text-[10.5px] opacity-50">⌘↵</span>
        </span>
        <span className={`inline-flex h-8 items-center rounded-lg px-3 ${TYPE.ui} text-(--at-ink)/70 ring-1 ring-inset ring-(--at-ink)/[0.12]`}>Edit</span>
        {message.attachment ? <span className={`ml-auto hidden ${TYPE.small} text-(--at-ink)/40 @3xl/win:inline`}>Attached: {message.attachment}</span> : null}
      </motion.div>
    </motion.div>
  );
}

/** Counts up from zero with tabular figures and a light blur that clears as it lands. */
function CountUp({
  value,
  active,
  reduce,
  delay,
  duration = T.countDur,
  className = "",
}: {
  value: number;
  active: boolean;
  reduce: boolean;
  delay: number;
  duration?: number;
  className?: string;
}) {
  const p = useProgress(active, reduce, delay, duration);
  const text = useTransform(p, (t) => String(Math.round(t * value)));
  const filter = useTransform(p, (t) => `blur(${((1 - t) * 3).toFixed(2)}px)`);
  return (
    <motion.span className={`inline-block tabular-nums ${className}`} style={reduce ? undefined : { filter }}>
      {text}
    </motion.span>
  );
}

function Avatar({ initials, size = 32 }: { initials: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-(--at-avatar) font-medium text-(--at-ink)/80 ring-1 ring-inset ring-(--at-ink)/[0.08]"
      style={{ width: size, height: size, fontSize: size * 0.36, letterSpacing: "0.02em" }}
    >
      {initials}
    </span>
  );
}

function FolderIcon({ name }: { name: TiltFolder["icon"] }) {
  const common = { stroke: "currentColor", strokeWidth: 1.4, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<TiltFolder["icon"], ReactNode> = {
    reply: <path d="M6.5 4 3 7.5 6.5 11M3 7.5h6.5a3.5 3.5 0 0 1 3.5 3.5v1" {...common} />,
    read: <path d="M3 4.5h10M3 8h10M3 11.5h6" {...common} />,
    ignore: (
      <>
        <circle cx="8" cy="8" r="5" {...common} />
        <path d="m4.6 11.4 6.8-6.8" {...common} />
      </>
    ),
    inbox: <path d="M2.5 9.5 4 4h8l1.5 5.5M2.5 9.5V12h11V9.5M2.5 9.5h3.2l.8 1.5h3l.8-1.5h3.2" {...common} />,
    draft: <path d="M10.5 3.5 12.5 5.5 6 12H4v-2zM9 5l2 2" {...common} />,
    snooze: (
      <>
        <circle cx="8" cy="8.5" r="4.5" {...common} />
        <path d="M8 6.5v2l1.5 1M4 3 2.8 4.2M12 3l1.2 1.2" {...common} />
      </>
    ),
    sent: <path d="M13.5 2.5 2.5 7l4.5 1.5L8.5 13zM7 8.5l3-3" {...common} />,
  };
  return (
    <svg viewBox="0 0 16 16" className="size-[15px] shrink-0" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

/** Demo: the hero plus a little runway below it, so there is room to scroll the window flat. */
export default function HeroAppTiltDemo() {
  return (
    <div className="bg-black">
      <HeroAppTilt />
      <div aria-hidden="true" className="h-[45vh]" />
    </div>
  );
}
