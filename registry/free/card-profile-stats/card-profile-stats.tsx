"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type Transition,
} from "motion/react";
import { MessageCircle } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type ProfileStat = {
  label: string;
  value: number;
  /** This figure ticks up by one while the viewer follows (a follower count). */
  tracksFollow?: boolean;
};

export type ProfileStatsCardProps = {
  name?: string;
  /** Two letters for the avatar. Derived from the name when left out. */
  initials?: string;
  role?: string;
  location?: string;
  /** IANA zone for the live local time beside the location. null hides it. */
  timeZone?: string | null;
  bio?: string;
  /** The figures under the bio. true shows the defaults, false hides the row. */
  stats?: ProfileStat[] | boolean;
  /** vertical: a centred portrait card. horizontal: avatar left, actions right, stats along the foot. */
  layout?: "vertical" | "horizontal";
  /** Controlled follow state. Leave it out and the card keeps its own. */
  followed?: boolean;
  defaultFollowed?: boolean;
  onFollowChange?: (followed: boolean) => void;
  onMessage?: () => void;
  followLabel?: string;
  followingLabel?: string;
  /** Shown on hover while following, once the pointer has left and come back. */
  unfollowLabel?: string;
  /** Locale for numbers and the clock. */
  locale?: string;
  /** The one signal colour: the avatar ring and the Following check. */
  accent?: string;
  theme?: "dark" | "light";
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    card: "#0c0c0d",
    ink: "#f4f4f5",
    onInk: "#0b0b0c",
    danger: "#ff6b6b",
    spot: "rgba(255,255,255,0.05)",
    edge: "rgba(255,255,255,0.28)",
    rest: "inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.06), 0 40px 80px -44px rgba(0,0,0,0.95)",
    lifted: "inset 0 0 0 1px rgba(255,255,255,0.11), inset 0 1px 0 rgba(255,255,255,0.08), 0 56px 96px -40px rgba(0,0,0,1)",
  },
  light: {
    card: "#ffffff",
    ink: "#111113",
    onInk: "#ffffff",
    danger: "#d93636",
    spot: "rgba(17,17,19,0.035)",
    edge: "rgba(17,17,19,0.22)",
    rest: "inset 0 0 0 1px rgba(17,17,19,0.08), 0 1px 2px rgba(17,17,19,0.05), 0 40px 80px -44px rgba(17,17,19,0.3)",
    lifted: "inset 0 0 0 1px rgba(17,17,19,0.1), 0 2px 4px rgba(17,17,19,0.05), 0 56px 96px -40px rgba(17,17,19,0.38)",
  },
} as const;

const DEFAULT_ACCENT = "#ff8a4c";
const EASE = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const SPRING_UI: Transition = { type: "spring", stiffness: 500, damping: 40 };
const SPRING_SOFT = { stiffness: 180, damping: 22 };

/** The first-view timeline, in seconds: containers, then text, then figures. */
const T = {
  card: 0,
  avatar: 0.12,
  ring: 0.22,
  ringFor: 0.8,
  name: 0.2,
  meta: 0.26,
  bio: 0.32,
  stats: 0.4,
  counts: 0.52,
  countStep: 0.07,
  countFor: 0.9,
  actions: 0.46,
  fade: 0.15, // reduced motion
} as const;

const LIFT_PX = 4;
const SPOT_RADIUS = 240;
const CLOCK_TICK_MS = 30_000;

const DEFAULT_STATS: ProfileStat[] = [
  { label: "Followers", value: 12481, tracksFollow: true },
  { label: "Following", value: 318 },
  { label: "Typefaces", value: 27 },
];

/**
 * The follow icon is two strokes that morph between shapes, so the plus folds
 * into a check (and the check crosses into an x on "Unfollow") instead of swapping.
 */
const ICON_PATHS = {
  follow: ["M5 12 L19 12", "M12 5 L12 19"],
  following: ["M5 12.5 L9.5 17", "M9.5 17 L19 7"],
  unfollow: ["M7 7 L17 17", "M17 7 L7 17"],
} as const;

type FollowFace = keyof typeof ICON_PATHS;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1][0] ?? "") : (words[0][1] ?? "");
  return (first + last).toUpperCase();
}

function makeFormatter(locale: string, target: number) {
  // Big figures go compact (1.2M); the notation is picked from the target so it never flips mid-count.
  const nf = new Intl.NumberFormat(locale, Math.abs(target) >= 100_000 ? { notation: "compact", maximumFractionDigits: 1 } : {});
  return (v: number) => nf.format(Math.round(v));
}

/** Rise from an 8px blur, once, when the card first comes into view. */
function rise(play: boolean, delay: number, reduce: boolean, y = 10) {
  if (reduce) {
    return { initial: { opacity: 0 }, animate: play ? { opacity: 1 } : { opacity: 0 }, transition: { duration: T.fade } };
  }
  return {
    initial: { opacity: 0, y, filter: "blur(8px)" },
    animate: play ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y, filter: "blur(8px)" },
    transition: { duration: 0.55, ease: EASE, delay },
  };
}

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

/** The person's local time, read only after mount so server and client agree. */
function useLocalTime(timeZone: string | null, locale: string) {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    setNow(null);
    if (!timeZone) return;
    let fmt: Intl.DateTimeFormat;
    try {
      fmt = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone });
    } catch {
      return; // an unknown zone shows nothing rather than a wrong time
    }
    const tick = () => setNow(fmt.format(new Date()));
    tick();
    const id = window.setInterval(tick, CLOCK_TICK_MS);
    return () => window.clearInterval(id);
  }, [timeZone, locale]);
  return timeZone ? now : null;
}

/* ------------------------------------------------------------------ */
/* Parts                                                               */
/* ------------------------------------------------------------------ */

/** Initials on a quiet disc, with an accent ring that draws itself in from twelve o’clock. */
function Avatar({ initials, play, reduce, className }: { initials: string; play: boolean; reduce: boolean; className: string }) {
  return (
    <motion.div {...rise(play, T.avatar, reduce, 6)} aria-hidden="true" className={`relative shrink-0 ${className}`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90 overflow-visible">
        <circle cx="50" cy="50" r="48" fill="none" stroke="var(--pc-ink)" strokeOpacity="0.08" strokeWidth="2" />
        <motion.circle
          cx="50"
          cy="50"
          r="48"
          fill="none"
          stroke="var(--pc-accent)"
          strokeWidth="2.25"
          strokeLinecap="round"
          initial={{ pathLength: reduce ? 1 : 0 }}
          animate={{ pathLength: play || reduce ? 1 : 0 }}
          transition={{ duration: reduce ? 0 : T.ringFor, ease: EASE, delay: T.ring }}
        />
      </svg>
      <div
        className="absolute inset-[9%] grid place-items-center rounded-full font-display font-medium tracking-[-0.03em] text-[length:inherit]"
        style={{
          background: "radial-gradient(120% 120% at 30% 20%, color-mix(in srgb, var(--pc-ink) 12%, var(--pc-card)), color-mix(in srgb, var(--pc-ink) 4%, var(--pc-card)) 70%)",
          boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--pc-ink) 10%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--pc-ink) 7%, transparent)",
        }}
      >
        {initials}
      </div>
    </motion.div>
  );
}

/** A figure that counts up from zero on first view, and rolls to any new value with a blur that clears. */
function StatValue({ value, play, delay, reduce, locale }: { value: number; play: boolean; delay: number; reduce: boolean; locale: string }) {
  const n = useMotionValue(0);
  const blur = useMotionValue(0);
  const y = useMotionValue(0);
  const format = useMemo(() => makeFormatter(locale, value), [locale, value]);
  const text = useTransform(n, format);
  const filter = useTransform(blur, (b) => (b > 0.05 ? `blur(${b}px)` : "none"));
  const first = useRef(true);
  const prev = useRef(0);

  useEffect(() => {
    if (!play) return;
    if (reduce) {
      n.set(value);
      prev.current = value;
      first.current = false;
      return;
    }
    const isFirst = first.current;
    first.current = false;
    const rising = value >= prev.current;
    prev.current = value;
    blur.set(isFirst ? 5 : 2.5);
    y.set(isFirst ? 0 : rising ? 6 : -6);
    const opts = { duration: isFirst ? T.countFor : 0.42, ease: EASE, delay: isFirst ? delay : 0 };
    const runs = [animate(n, value, opts), animate(blur, 0, opts), animate(y, 0, opts)];
    return () => runs.forEach((r) => r.stop());
  }, [value, play, reduce, delay, n, blur, y]);

  return (
    <>
      <motion.span aria-hidden="true" style={{ filter, y }} className="inline-block tabular-nums">
        {text}
      </motion.span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}

function Stats({
  stats,
  followed,
  layout,
  play,
  reduce,
  locale,
}: {
  stats: ProfileStat[];
  followed: boolean;
  layout: "vertical" | "horizontal";
  play: boolean;
  reduce: boolean;
  locale: string;
}) {
  const vertical = layout === "vertical";
  return (
    <motion.dl
      data-demo="stats"
      {...rise(play, T.stats, reduce, 8)}
      className={
        vertical
          ? "mt-6 grid rounded-[14px] py-3.5 text-center"
          : "mt-6 grid border-t pt-5 text-left [border-color:color-mix(in_srgb,var(--pc-ink)_8%,transparent)]"
      }
      style={{
        gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`,
        ...(vertical
          ? { background: "color-mix(in srgb, var(--pc-ink) 3%, transparent)", boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--pc-ink) 6%, transparent)" }
          : null),
      }}
    >
      {stats.map((s, i) => (
        <div
          key={s.label}
          className={`flex min-w-0 flex-col-reverse gap-1 ${i > 0 ? "border-l [border-color:color-mix(in_srgb,var(--pc-ink)_8%,transparent)]" : ""} ${
            vertical ? "items-center px-2" : i > 0 ? "pl-4 @md:pl-6" : "pr-4"
          }`}
        >
          <dt className="truncate font-mono text-[10.5px] uppercase tracking-[0.09em] text-[color-mix(in_srgb,var(--pc-ink)_65%,transparent)]">{s.label}</dt>
          <dd className="font-display text-[20px] font-medium leading-none tracking-[-0.03em] @md:text-[22px]">
            <StatValue
              value={s.value + (s.tracksFollow && followed ? 1 : 0)}
              play={play}
              delay={T.counts + i * T.countStep}
              reduce={reduce}
              locale={locale}
            />
          </dd>
        </div>
      ))}
    </motion.dl>
  );
}

/**
 * Follow and Following share one box: the fill drains to a hairline, the plus
 * folds into a check, and the label cross-fades in place. Every label is laid
 * out invisibly in the same cell, so the button never changes size.
 */
function FollowButton({
  followed,
  onToggle,
  name,
  labels,
  reduce,
}: {
  followed: boolean;
  onToggle: () => void;
  name: string;
  labels: Record<FollowFace, string>;
  reduce: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  // Right after following, the pointer is still on the button: don't offer "Unfollow" until it leaves.
  const [armed, setArmed] = useState(true);
  const face: FollowFace = !followed ? "follow" : hovered && armed ? "unfollow" : "following";

  const toggle = () => {
    if (!followed) setArmed(false);
    onToggle();
  };

  const [a, b] = ICON_PATHS[face];
  const iconTransition = reduce ? { duration: 0 } : { duration: 0.32, ease: [0.65, 0, 0.35, 1] as const };

  return (
    <motion.button
      type="button"
      data-demo="follow"
      aria-pressed={followed}
      aria-label={`Follow ${name}`}
      onClick={toggle}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={() => {
        setHovered(false);
        setArmed(true);
      }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.09 }}
      className={`group relative isolate grid h-11 touch-manipulation select-none place-items-center rounded-[12px] px-5 font-sans text-[14px] font-medium tracking-[-0.01em] outline-none transition-[background-color,box-shadow,color] duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-ink)] w-full`}
      style={{
        background: followed ? "color-mix(in srgb, var(--pc-ink) 5%, transparent)" : "var(--pc-ink)",
        color: face === "unfollow" ? "var(--pc-danger)" : followed ? "var(--pc-ink)" : "var(--pc-on-ink)",
        boxShadow: followed
          ? `inset 0 0 0 1px color-mix(in srgb, ${face === "unfollow" ? "var(--pc-danger)" : "var(--pc-ink)"} ${face === "unfollow" ? 40 : 14}%, transparent)`
          : "inset 0 1px 0 rgba(255,255,255,0.35), 0 1px 2px rgba(0,0,0,0.25)",
      }}
    >
      {/* The hover step on the filled state: a veil rather than a second colour. */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-150 ${followed ? "opacity-0" : "opacity-0 group-hover:opacity-100"}`}
        style={{ background: "color-mix(in srgb, var(--pc-card) 10%, transparent)" }}
      />
      <span aria-hidden="true" className="col-start-1 row-start-1 inline-flex items-center gap-2">
        <svg viewBox="0 0 24 24" className="size-4 shrink-0 overflow-visible" fill="none" strokeWidth="2" strokeLinecap="round">
          <motion.path
            initial={false}
            animate={{ d: a }}
            transition={iconTransition}
            stroke={face === "following" ? "color-mix(in srgb, var(--pc-accent) 85%, var(--pc-ink))" : "currentColor"}
          />
          <motion.path
            initial={false}
            animate={{ d: b }}
            transition={iconTransition}
            stroke={face === "following" ? "color-mix(in srgb, var(--pc-accent) 85%, var(--pc-ink))" : "currentColor"}
          />
        </svg>
        <span className="grid">
          {(Object.keys(labels) as FollowFace[]).map((k) => (
            <span key={k} className="invisible col-start-1 row-start-1 whitespace-nowrap">
              {labels[k]}
            </span>
          ))}
          <AnimatePresence initial={false}>
            <motion.span
              key={face}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(3px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: -6, filter: "blur(3px)", transition: { duration: 0.14, ease: EASE_IN } }}
              transition={{ duration: 0.24, ease: EASE }}
              className="col-start-1 row-start-1 whitespace-nowrap text-left"
            >
              {labels[face]}
            </motion.span>
          </AnimatePresence>
        </span>
      </span>
    </motion.button>
  );
}

function MessageButton({ name, onMessage, reduce }: { name: string; onMessage?: () => void; reduce: boolean }) {
  return (
    <motion.button
      type="button"
      data-demo="message"
      aria-label={`Message ${name.split(/\s+/)[0] || name}`}
      onClick={onMessage}
      whileTap={reduce ? undefined : { scale: 0.96 }}
      transition={{ duration: 0.09 }}
      className="group grid size-11 shrink-0 touch-manipulation place-items-center rounded-[12px] outline-none transition-[background-color,box-shadow] duration-150 ease-out hover:bg-[color-mix(in_srgb,var(--pc-ink)_7%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-ink)]"
      style={{ boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--pc-ink) 12%, transparent)" }}
    >
      <MessageCircle
        aria-hidden="true"
        className="size-[18px] text-[color-mix(in_srgb,var(--pc-ink)_70%,transparent)] transition-[color,translate] duration-150 group-hover:-translate-y-px group-hover:text-[var(--pc-ink)]"
        strokeWidth={1.75}
      />
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function ProfileStatsCard({
  name = "Mara Okonkwo",
  initials,
  role = "Type designer",
  location = "Lisbon, PT",
  timeZone = "Europe/Lisbon",
  bio = "Draws letters for screens people read at 2am. Currently losing an argument with the lowercase g of a grotesque.",
  stats = true,
  layout = "vertical",
  followed: followedProp,
  defaultFollowed = false,
  onFollowChange,
  onMessage,
  followLabel = "Follow",
  followingLabel = "Following",
  unfollowLabel = "Unfollow",
  locale = "en-US",
  accent = DEFAULT_ACCENT,
  theme = "dark",
  className = "",
}: ProfileStatsCardProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId();
  const palette = PALETTE[theme];
  const ref = useRef<HTMLElement>(null);
  const play = useInView(ref, { once: true, amount: 0.3 });

  const [ownFollowed, setOwnFollowed] = useState(defaultFollowed);
  const followed = followedProp ?? ownFollowed;
  const [said, setSaid] = useState("");
  const previousFollowed = useRef(followed);
  useEffect(() => {
    if (previousFollowed.current !== followed) {
      setSaid(followed ? `You’re following ${name}.` : `You unfollowed ${name}.`);
      previousFollowed.current = followed;
    }
  }, [followed, name]);
  const toggle = () => {
    const next = !followed;
    if (followedProp === undefined) setOwnFollowed(next);
    onFollowChange?.(next);
  };

  const list = stats === true ? DEFAULT_STATS : stats === false ? [] : stats;
  const time = useLocalTime(timeZone, locale);
  const vertical = layout === "vertical";
  const labels = { follow: followLabel, following: followingLabel, unfollow: unfollowLabel };

  /* Pointer light and lift: a spotlight follows the pointer and the card rises a few px. */
  const mx = useMotionValue(-SPOT_RADIUS);
  const my = useMotionValue(-SPOT_RADIUS);
  const spotOpacity = useSpring(0, { stiffness: 260, damping: 30 });
  const lift = useSpring(0, SPRING_SOFT);
  const spot = useMotionTemplate`radial-gradient(${SPOT_RADIUS}px circle at ${mx}px ${my}px, var(--pc-spot), transparent 70%)`;
  const edge = useMotionTemplate`radial-gradient(${SPOT_RADIUS * 0.8}px circle at ${mx}px ${my}px, var(--pc-edge), transparent 70%)`;
  const [hovered, setHovered] = useState(false);

  const onMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - r.left);
    my.set(e.clientY - r.top);
  };
  const onEnter = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    onMove(e);
    setHovered(true);
    spotOpacity.set(1);
    if (!reduce) lift.set(-LIFT_PX);
  };
  const onLeave = () => {
    setHovered(false);
    spotOpacity.set(0);
    lift.set(0);
  };

  const vars = {
    "--pc-card": palette.card,
    "--pc-ink": palette.ink,
    "--pc-on-ink": palette.onInk,
    "--pc-danger": palette.danger,
    "--pc-spot": palette.spot,
    "--pc-edge": palette.edge,
    "--pc-accent": accent,
  } as CSSProperties;

  const meta = (
    <motion.p
      {...rise(play, T.meta, reduce, 8)}
      className={`mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] uppercase tracking-[0.08em] text-[color-mix(in_srgb,var(--pc-ink)_65%,transparent)] ${
        vertical ? "justify-center" : ""
      }`}
    >
      <span>{role}</span>
      {location && (
        <>
          <span aria-hidden="true" className="opacity-50">
            /
          </span>
          <span>{location}</span>
        </>
      )}
      {timeZone && (
        <>
          <span aria-hidden="true" className="opacity-50">
            /
          </span>
          {/* Reserve the clock’s width before mount so nothing shifts when it appears. */}
          <span className="tabular-nums text-[color-mix(in_srgb,var(--pc-ink)_65%,transparent)]">
            {time ? (
              <>
                <span className="sr-only">Local time </span>
                {time}
              </>
            ) : (
              <span className="invisible">00:00</span>
            )}
          </span>
        </>
      )}
    </motion.p>
  );

  const nameEl = (
    <motion.h3
      id={`${uid}-name`}
      {...rise(play, T.name, reduce, 10)}
      className={`font-serif font-normal leading-[1.02] tracking-[-0.015em] ${vertical ? "mt-5 text-[34px]" : "text-[28px] @lg:text-[32px]"}`}
    >
      {name}
    </motion.h3>
  );

  const bioEl = bio ? (
    <motion.p
      {...rise(play, T.bio, reduce, 10)}
      className={`text-[14.5px] leading-[1.6] text-[color-mix(in_srgb,var(--pc-ink)_66%,transparent)] ${
        vertical ? "mx-auto mt-4 max-w-[34ch] text-balance" : "mt-4 max-w-[54ch] text-pretty"
      }`}
    >
      {bio}
    </motion.p>
  ) : null;

  /** One set of actions per card. `grow` is the Follow slot's sizing: full width, or its own width from a breakpoint. */
  const actions = (extra: string, grow: string) => (
    <motion.div {...rise(play, T.actions, reduce, 8)} className={`flex items-center gap-2 ${extra}`}>
      <div className={`min-w-0 ${grow}`}>
        <FollowButton followed={followed} onToggle={toggle} name={name} labels={labels} reduce={reduce} />
      </div>
      <MessageButton name={name} onMessage={onMessage} reduce={reduce} />
    </motion.div>
  );

  const avatarInitials = (initials ?? initialsOf(name)).slice(0, 2);

  return (
    <div className={`@container w-full font-sans antialiased ${vertical ? "max-w-[380px]" : "max-w-[640px]"} ${className}`} style={vars}>
      <motion.div {...rise(play, T.card, reduce, 16)} style={{ y: lift }}>
        <article
          ref={ref}
          data-demo="card"
          aria-labelledby={`${uid}-name`}
          onPointerEnter={onEnter}
          onPointerMove={onMove}
          onPointerLeave={onLeave}
          className={`relative isolate overflow-hidden rounded-[22px] transition-shadow duration-300 ease-out ${vertical ? "p-6 text-center @sm:p-7" : "p-6 @lg:p-7"}`}
          style={{ background: "var(--pc-card)", color: "var(--pc-ink)", boxShadow: hovered && !reduce ? palette.lifted : palette.rest }}
        >
          {/* Pointer spotlight on the surface, and a brighter copy masked to the 1px edge. */}
          <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit]" style={{ background: spot, opacity: spotOpacity }} />
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[inherit] p-px [mask-composite:exclude] [mask:linear-gradient(#000_0_0)_content-box,linear-gradient(#000_0_0)] [-webkit-mask-composite:xor]"
            style={{ background: edge, opacity: spotOpacity }}
          />

          {vertical ? (
            <>
              <Avatar initials={avatarInitials} play={play} reduce={reduce} className="mx-auto size-[88px] text-[27px]" />
              {nameEl}
              {meta}
              {bioEl}
              {list.length > 0 && <Stats stats={list} followed={followed} layout={layout} play={play} reduce={reduce} locale={locale} />}
              {actions("mt-5", "flex-1")}
            </>
          ) : (
            <>
              {/* One grid, two arrangements: narrow puts the actions under the bio; from @lg they sit top right. */}
              <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-x-4 @lg:grid-cols-[84px_minmax(0,1fr)_auto] @lg:items-start @lg:gap-x-6">
                <Avatar initials={avatarInitials} play={play} reduce={reduce} className="col-start-1 row-start-1 size-16 text-[20px] @lg:row-span-2 @lg:size-[84px] @lg:text-[25px]" />
                <div className="col-start-2 row-start-1 min-w-0 @lg:pt-1.5">
                  {nameEl}
                  {meta}
                </div>
                <div className="col-span-2 col-start-1 row-start-2 @lg:col-span-2 @lg:col-start-2">{bioEl}</div>
                {actions("col-span-2 col-start-1 row-start-3 mt-5 @lg:col-span-1 @lg:col-start-3 @lg:row-start-1 @lg:mt-0 @lg:pt-1", "flex-1 @lg:flex-none")}
              </div>
              {list.length > 0 && <Stats stats={list} followed={followed} layout={layout} play={play} reduce={reduce} locale={locale} />}
            </>
          )}

          <span className="sr-only" role="status" aria-live="polite">
            {said}
          </span>
        </article>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                */
/* ------------------------------------------------------------------ */

/**
 * One card on a quiet stage. The follow state lives here, so the Customize
 * panel can set it and the card’s own button keeps working.
 */
export default function ProfileStatsCardDemo({ followed: forced, ...overrides }: Partial<ProfileStatsCardProps> = {}) {
  const [followed, setFollowed] = useState(forced ?? false);
  useEffect(() => {
    if (forced !== undefined) setFollowed(forced);
  }, [forced]);

  return (
    <div className={`flex min-h-dvh w-full items-center justify-center px-4 py-14 sm:px-8 ${overrides.theme === "light" ? "bg-[#f4f4f5]" : "bg-black"}`}>
      <ProfileStatsCard {...overrides} followed={followed} onFollowChange={setFollowed} />
    </div>
  );
}
