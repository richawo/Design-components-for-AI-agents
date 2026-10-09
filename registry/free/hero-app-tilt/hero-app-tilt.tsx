"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";

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
};

export type HeroAppTiltProps = {
  eyebrow?: string;
  /** Headline. The `muted` substring is set at 45% white. */
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
  /** Starting tilt in degrees. The window flattens to 0 as it scrolls into place. */
  tilt?: number;
};

const ease = [0.22, 1, 0.36, 1] as const;
const ACCENT = "#f2c46d";

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
};

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
  tilt = 22,
}: HeroAppTiltProps) {
  const reduce = !!useReducedMotion();
  const frameRef = useRef<HTMLDivElement>(null);
  const i = headline.indexOf(muted);
  const pre = muted && i >= 0 ? headline.slice(0, i) : headline;
  const post = muted && i >= 0 ? headline.slice(i + muted.length) : "";

  // Progress runs from "frame top enters the viewport" to "frame top reaches 20%".
  // If the frame is already partly in view on load, rescale so it still starts
  // fully tilted and flattens over the scroll that is actually available.
  const { scrollYProgress } = useScroll({ target: frameRef, offset: ["start end", "start 20%"] });
  const raw = useMotionValue(reduce ? 1 : 0);
  const progress = useSpring(raw, { stiffness: 170, damping: 32, mass: 0.5 });
  const p0 = useRef(0);
  const first = useRef(true);
  const update = useCallback(() => {
    const v = scrollYProgress.get();
    const k = reduce ? 1 : Math.max(0, Math.min(1, (v - p0.current) / (1 - p0.current)));
    raw.set(k);
    if (first.current) {
      first.current = false;
      progress.jump(k);
    }
  }, [reduce, raw, progress, scrollYProgress]);
  useMotionValueEvent(scrollYProgress, "change", update);
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const measure = () => {
      // Measure the untransformed position: offsetTop chain, not the tilted box.
      let top = 0;
      for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) top += n.offsetTop;
      const vh = window.innerHeight;
      p0.current = Math.max(0, Math.min(0.85, (vh - top) / (vh * 0.8)));
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
  }, [update]);
  const p = reduce ? raw : progress;

  const rotateX = useTransform(p, (v) => (1 - v) * tilt);
  const scale = useTransform(p, [0, 1], [0.94, 1]);
  const y = useTransform(p, [0, 1], [24, 0]);
  const spot = useTransform(p, [0, 1], [0.22, 1]);
  const edge = useTransform(p, [0, 0.6, 1], [0.15, 0.4, 1]);

  return (
    <section aria-label="Introduction" className="@container relative isolate overflow-hidden bg-black text-white">
      <div className="mx-auto flex max-w-[1240px] flex-col items-center px-5 pt-20 text-center @md:px-8 @3xl:pt-28">
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="inline-flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-white/50"
        >
          <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: ACCENT }} />
          {eyebrow}
        </motion.p>
        <motion.h1
          initial={reduce ? false : { opacity: 0, y: 16, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.8, ease, delay: 0.08 }}
          className="mt-6 max-w-[15ch] text-balance font-display text-[clamp(2.6rem,1.1rem+5.4cqw,5.75rem)] font-semibold leading-[0.97] tracking-[-0.055em]"
        >
          {pre}
          {pre !== headline ? <span className="text-white/45">{muted}</span> : null}
          {post}
        </motion.h1>
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease, delay: 0.16 }}
          className="mt-6 max-w-[50ch] text-pretty text-[16px] leading-[1.6] text-white/60 @md:text-[17px]"
        >
          {body}
        </motion.p>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease, delay: 0.24 }}
          className="mt-9 flex w-full flex-col items-stretch gap-2.5 @md:w-auto @md:flex-row @md:items-center @md:gap-3"
        >
          <a
            href={primary.href}
            className="group inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-6 text-[15px] font-medium tracking-[-0.01em] text-black transition-[background-color,scale] duration-150 ease-out hover:bg-[#ececec] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white active:scale-[0.97] active:duration-75"
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-4 transition-transform duration-150 ease-out group-hover:translate-y-0.5">
              <path d="M8 2.5v8m0 0L4.5 7M8 10.5 11.5 7M3 13.5h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {primary.label}
          </a>
          <a
            href={secondary.href}
            className="group inline-flex h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-5 text-[15px] font-medium tracking-[-0.01em] text-white/75 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] transition-[color,background-color,box-shadow,scale] duration-150 ease-out hover:bg-white/[0.04] hover:text-white hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.24)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white active:scale-[0.97] active:duration-75"
          >
            {secondary.label}
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-3.5 transition-transform duration-150 ease-out group-hover:translate-x-0.5">
              <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </motion.div>
      </div>

      {/* Stage: perspective, spotlight and the bottom fade. */}
      <div className="relative mx-auto mt-14 max-w-[1240px] px-3 @md:mt-20 @md:px-8">
        <motion.div
          aria-hidden="true"
          style={{ opacity: spot }}
          className="pointer-events-none absolute inset-x-0 -top-44 h-[620px] bg-[radial-gradient(46%_48%_at_50%_40%,rgba(255,255,255,0.2),rgba(255,255,255,0.06)_42%,transparent_70%)]"
        />
        <div
          className="relative [mask-image:linear-gradient(to_bottom,#000_52%,transparent_96%)]"
          style={{ perspective: "1200px" }}
        >
          <motion.div
            ref={frameRef}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.9, ease, delay: 0.3 }}
            style={{ rotateX, scale, y, transformOrigin: "50% 0%" }}
            className="relative will-change-transform"
          >
            <AppWindow
              edge={edge}
              product={product}
              account={account}
              folders={folders}
              labels={labels}
              listTitle={listTitle}
              threads={threads}
              selected={selected}
              message={message}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The app window, drawn in markup                                     */
/* ------------------------------------------------------------------ */

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

function Avatar({ initials, k, size = 32 }: { initials: string; k: number; size?: number }) {
  // Quiet tinted greys, never a rainbow.
  const tones = ["#2b2621", "#20262b", "#26232b", "#222823", "#2b2224", "#24252a"];
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-medium text-white/80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
      style={{ width: size, height: size, background: tones[k % tones.length], fontSize: size * 0.36, letterSpacing: "0.02em" }}
    >
      {initials}
    </span>
  );
}

function AppWindow({
  edge,
  product,
  account,
  folders,
  labels,
  listTitle,
  threads,
  selected,
  message,
}: {
  edge: MotionValue<number>;
  product: string;
  account: { name: string; initials: string };
  folders: TiltFolder[];
  labels: string[];
  listTitle: string;
  threads: TiltThread[];
  selected: number;
  message: TiltMessage;
}) {
  const replyCount = folders[0]?.count ?? threads.length;
  return (
    <figure
      aria-label={`${product} app: the ${listTitle} list with ${threads.length} threads, and a reply drafted for “${message.subject}”.`}
      role="img"
      className="@container/win relative overflow-hidden rounded-[14px] bg-[#0a0a0b] text-left shadow-[0_0_0_1px_rgba(255,255,255,0.09),0_50px_140px_-30px_rgba(0,0,0,0.9),0_30px_60px_-30px_rgba(0,0,0,0.8)] @3xl:rounded-[18px]"
    >
      {/* Edge light along the top, brightening as the window flattens. */}
      <motion.span
        aria-hidden="true"
        style={{ opacity: edge }}
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.55)_30%,rgba(255,255,255,0.55)_70%,transparent)]"
      />

      {/* Title bar */}
      <div className="flex h-11 items-center gap-3 border-b border-white/[0.07] px-4">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="size-[11px] rounded-full bg-white/[0.14]" />
          <span className="size-[11px] rounded-full bg-white/[0.14]" />
          <span className="size-[11px] rounded-full bg-white/[0.14]" />
        </div>
        <div className="mx-auto flex h-7 w-full max-w-[340px] items-center gap-2 rounded-[8px] bg-white/[0.045] px-2.5 text-[12px] text-white/35 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
          <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
            <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.4" fill="none" />
            <path d="m10.2 10.2 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <span className="truncate">Search or jump to…</span>
          <span className="ml-auto hidden font-mono text-[10.5px] text-white/30 @md/win:inline">⌘K</span>
        </div>
        <Avatar initials={account.initials} k={5} size={24} />
      </div>

      <div className="flex h-[440px] @xl/win:h-[520px] @4xl/win:h-[600px]">
        {/* Sidebar */}
        <aside className="hidden w-[212px] shrink-0 flex-col border-r border-white/[0.07] px-3 py-4 @4xl/win:flex">
          <div className="flex items-center gap-2 px-2">
            <span className="grid size-6 place-items-center rounded-[7px] bg-white text-black" aria-hidden="true">
              <svg viewBox="0 0 16 16" className="size-3.5">
                <path d="M2.5 9.5c2.2-.2 4-1.4 5.5-4 1.5 2.6 3.3 3.8 5.5 4-2.6.6-4.4 1.6-5.5 3.5-1.1-1.9-2.9-2.9-5.5-3.5Z" fill="currentColor" />
              </svg>
            </span>
            <span className="text-[14px] font-semibold tracking-[-0.02em] text-white/90">{product}</span>
          </div>
          <div className="mt-4 flex h-8 items-center justify-between rounded-[8px] bg-white/[0.06] px-2.5 text-[12.5px] text-white/80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
            Compose
            <span className="font-mono text-[10.5px] text-white/35">C</span>
          </div>
          <p className="mt-5 px-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/30">Triage</p>
          <ul className="mt-2 space-y-0.5">
            {folders.map((f, k) => (
              <li key={f.label}>
                {k === 3 ? <div className="mx-2 my-2.5 h-px bg-white/[0.06]" /> : null}
                <div className={`flex h-8 items-center gap-2.5 rounded-[7px] px-2 text-[13px] ${k === 0 ? "bg-white/[0.07] text-white" : "text-white/55"}`}>
                  <FolderIcon name={f.icon} />
                  <span className="truncate">{f.label}</span>
                  {f.count != null ? <span className={`ml-auto text-[11.5px] tabular-nums ${k === 0 ? "text-white/70" : "text-white/30"}`}>{f.count}</span> : null}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 px-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/30">Labels</p>
          <ul className="mt-2 space-y-0.5">
            {labels.map((l, k) => (
              <li key={l} className="flex h-8 items-center gap-2.5 px-2 text-[13px] text-white/55">
                <span className="size-2 rounded-[3px]" style={{ background: `rgba(255,255,255,${0.5 - k * 0.12})` }} />
                {l}
              </li>
            ))}
          </ul>
          <div className="mt-auto rounded-[10px] bg-white/[0.03] p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
            <p className="text-[12px] leading-[1.45] text-white/70">
              Overnight: <span className="text-white">{threads.filter((t) => t.drafted).length} drafts</span> ready, 208 ignored.
            </p>
            <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.07]">
              <div className="h-full w-[72%] rounded-full" style={{ background: ACCENT }} />
            </div>
          </div>
        </aside>

        {/* List */}
        <section className="flex w-full min-w-0 flex-col border-white/[0.07] @2xl/win:w-[340px] @2xl/win:shrink-0 @2xl/win:border-r @5xl/win:w-[372px]">
          <div className="flex h-12 items-center gap-2 border-b border-white/[0.07] px-4">
            <h2 className="text-[14px] font-semibold tracking-[-0.015em] text-white/90">{listTitle}</h2>
            <span className="text-[12px] tabular-nums text-white/35">{replyCount}</span>
            <div className="ml-auto flex rounded-[7px] bg-white/[0.04] p-0.5 text-[11.5px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]">
              <span className="rounded-[5px] bg-white/[0.09] px-2 py-0.5 text-white/85">All</span>
              <span className="px-2 py-0.5 text-white/40">Drafted</span>
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-hidden">
            {threads.map((t, k) => {
              const on = k === selected;
              return (
                <li key={t.subject} className={`relative flex gap-3 border-b border-white/[0.05] px-4 py-3 ${on ? "bg-white/[0.055]" : ""}`}>
                  {on ? <span className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-white/80" /> : null}
                  <Avatar initials={t.initials} k={k} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className={`truncate text-[13px] ${t.unread ? "font-semibold text-white" : "font-medium text-white/70"}`}>{t.from}</span>
                      {t.unread ? <span className="size-1.5 shrink-0 translate-y-[-1px] rounded-full bg-white/80" /> : null}
                      <span className="ml-auto shrink-0 text-[11.5px] tabular-nums text-white/35">{t.time}</span>
                    </div>
                    <p className={`mt-0.5 truncate text-[12.5px] ${t.unread ? "text-white/85" : "text-white/60"}`}>{t.subject}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-[12px] text-white/35">{t.preview}</p>
                      {t.drafted ? (
                        <span className="shrink-0 rounded-[5px] px-1.5 py-px font-mono text-[9.5px] uppercase tracking-[0.1em]" style={{ color: ACCENT, background: "rgba(242,196,109,0.1)" }}>
                          Draft
                        </span>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Detail */}
        <article className="hidden min-w-0 flex-1 flex-col @2xl/win:flex">
          <div className="flex h-12 items-center gap-1 border-b border-white/[0.07] px-5 text-white/40">
            {["Archive", "Snooze", "Label"].map((a) => (
              <span key={a} className="rounded-[6px] px-2 py-1 text-[12px]">
                {a}
              </span>
            ))}
            <span className="ml-auto font-mono text-[11px] tabular-nums text-white/30">1 of {replyCount}</span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-5 @4xl/win:px-8 @4xl/win:py-6">
            <h3 className="text-[19px] font-semibold leading-[1.25] tracking-[-0.025em] text-white @4xl/win:text-[21px]">{message.subject}</h3>
            <div className="mt-4 flex items-center gap-3">
              <Avatar initials={threads[selected]?.initials ?? "··"} k={selected} size={34} />
              <div className="min-w-0 text-[12.5px] leading-[1.4]">
                <p className="truncate text-white/85">
                  {message.from} <span className="text-white/35">&lt;{message.fromEmail}&gt;</span>
                </p>
                <p className="text-white/35">to {message.to}</p>
              </div>
              <span className="ml-auto shrink-0 text-[11.5px] text-white/35">{message.time}</span>
            </div>
            <div className="mt-5 max-w-[60ch] space-y-3 text-[13.5px] leading-[1.65] text-white/70">
              {message.body.map((b) => (
                <p key={b}>{b}</p>
              ))}
            </div>

            <div className="mt-6 rounded-[12px] bg-white/[0.035] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] @4xl/win:p-5">
              <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em]" style={{ color: ACCENT }}>
                <span className="size-1.5 rounded-full" style={{ background: ACCENT }} />
                Drafted by {product} · in your voice
              </div>
              <div className="mt-3 space-y-2.5 text-[13.5px] leading-[1.65] text-white/85">
                {message.draft.map((d) => (
                  <p key={d}>{d}</p>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className="inline-flex h-8 items-center gap-2 rounded-[8px] bg-white px-3 text-[12.5px] font-medium text-black">
                  Send
                  <span className="font-mono text-[10.5px] text-black/45">⌘↵</span>
                </span>
                <span className="inline-flex h-8 items-center rounded-[8px] px-3 text-[12.5px] text-white/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]">Edit</span>
                <span className="ml-auto hidden text-[11.5px] text-white/35 @3xl/win:inline">Attached: Northwind_order_40.pdf</span>
              </div>
            </div>
          </div>
        </article>
      </div>
    </figure>
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
