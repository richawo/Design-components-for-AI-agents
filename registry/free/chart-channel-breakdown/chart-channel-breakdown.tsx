"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  AnimatePresence,
  LayoutGroup,
  animate,
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type BreakdownChannel = {
  name: string;
  value: number;
  /** The same channel’s value in the previous period; shows a small delta. */
  previous?: number;
};

export type BreakdownPeriod = {
  key: string;
  /** Switcher label, e.g. “30D”. */
  label: string;
  /** Line under the total, e.g. “Last 30 days”. */
  caption?: string;
  channels: BreakdownChannel[];
};

export type ChartChannelBreakdownProps = {
  title?: string;
  periods?: BreakdownPeriod[];
  defaultPeriod?: string;
  onPeriodChange?: (key: string) => void;
  format?: "currency" | "number";
  currency?: string;
  locale?: string;
  /** The one accent: the leading channel’s segment and bar. Defaults to the theme’s ink. */
  accent?: string;
  theme?: "dark" | "light";
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    surface: "#111113",
    raised: "#17171a",
    line: "#232327",
    track: "#1c1c20",
    ink: "#f4f4f5",
    muted: "#a1a1aa",
    faint: "#8a8a93",
    up: "#4ade80",
    down: "#f87171",
    shadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 32px 64px -32px rgba(0,0,0,0.9)",
  },
  light: {
    surface: "#ffffff",
    raised: "#f4f4f5",
    line: "#e4e4e7",
    track: "#efeff1",
    ink: "#18181b",
    muted: "#52525b",
    faint: "#60606a",
    up: "#166534",
    down: "#b91c1c",
    shadow: "0 1px 2px rgba(24,24,27,0.04), 0 32px 64px -40px rgba(24,24,27,0.25)",
  },
} as const;

type Palette = Record<keyof (typeof PALETTE)["dark"], string>;

/** The demo’s quiet backdrop; not part of the component. */
const STAGE = "#0a0a0b";

/**
 * Channels after the leader step down a grey ramp of the ink, so rank reads as
 * lightness and the accent is spent on one thing only.
 */
const RAMP = [1, 0.62, 0.44, 0.3, 0.2, 0.14];

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;

/** One place for the choreography. Seconds unless noted. */
const MOTION = {
  rise: 12, // px
  blur: 8, // px
  block: 0.5,
  step: 0.06, // header blocks
  stripAt: 0.22, // share strip segments start growing
  stripStep: 0.05,
  grow: 0.5,
  rowsAt: 0.16,
  rowStep: 0.05,
  fillAfter: 0.22, // a row’s bar fills once the row has landed
  count: 0.75,
  numberBlur: 6, // px
  dim: 0.35, // opacity of the segments you’re not looking at
  fade: 0.15, // reduced motion
} as const;

/* ------------------------------------------------------------------ */
/* Demo data: Kiln & Co., a small ceramics shop                         */
/* ------------------------------------------------------------------ */

const DEMO_PERIODS: BreakdownPeriod[] = [
  {
    key: "7d",
    label: "7D",
    caption: "Last 7 days · a café wholesale order landed Tuesday",
    channels: [
      { name: "Online store", value: 24844, previous: 25920 },
      { name: "Instagram", value: 11342, previous: 12210 },
      { name: "Wholesale", value: 9181, previous: 5330 },
      { name: "Email", value: 6481, previous: 7490 },
      { name: "Studio shop", value: 2160, previous: 4010 },
    ],
  },
  {
    key: "30d",
    label: "30D",
    caption: "Last 30 days · 7 Sep – 6 Oct",
    channels: [
      { name: "Online store", value: 106853, previous: 98110 },
      { name: "Instagram", value: 59639, previous: 48870 },
      { name: "Email", value: 39759, previous: 37020 },
      { name: "Wholesale", value: 24850, previous: 27140 },
      { name: "Studio shop", value: 17394, previous: 15790 },
    ],
  },
  {
    key: "90d",
    label: "90D",
    caption: "Last 90 days · 9 Jul – 6 Oct",
    channels: [
      { name: "Online store", value: 310442, previous: 281300 },
      { name: "Instagram", value: 131075, previous: 118640 },
      { name: "Email", value: 103481, previous: 99820 },
      { name: "Wholesale", value: 89683, previous: 92410 },
      { name: "Studio shop", value: 55189, previous: 49270 },
    ],
  },
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
  const vars: Record<string, string> = { "--cb-accent": accent, "--cb-on-accent": inkOn(accent) };
  for (const [k, v] of Object.entries(p)) vars[`--cb-${k}`] = v;
  return vars as CSSProperties;
}

/** Rank 0 wears the accent; the rest step down the ink ramp. */
const rankColor = (rank: number) =>
  rank === 0 ? "var(--cb-accent)" : `color-mix(in srgb, var(--cb-ink) ${Math.round(RAMP[Math.min(rank, RAMP.length - 1)] * 100)}%, transparent)`;

/** Entrance props for a block: rises out of a blur. Reduced motion: a short fade. */
function enter(play: boolean, delay: number, reduce: boolean) {
  if (reduce) return { initial: { opacity: 0 }, animate: { opacity: play ? 1 : 0 }, transition: { duration: MOTION.fade } };
  return {
    initial: { opacity: 0, y: MOTION.rise, filter: `blur(${MOTION.blur}px)` },
    animate: play ? { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } } : undefined,
    transition: { duration: MOTION.block, ease: EASE_OUT, delay },
  };
}

/* ------------------------------------------------------------------ */
/* Hooks                                                                */
/* ------------------------------------------------------------------ */

/** Counts from zero on first view, then between values, with a blur that clears as it lands. */
function useCountUp(value: number, play: boolean, delay: number) {
  const reduce = useReducedMotion() ?? false;
  const current = useMotionValue(0);
  const blur = useMotionValue(0);
  const landed = useRef(false);

  useEffect(() => {
    if (!play) return;
    if (reduce) {
      current.set(value);
      return;
    }
    const first = !landed.current;
    landed.current = true;
    const options = { duration: MOTION.count, ease: EASE_OUT, delay: first ? delay : 0 };
    blur.set(first ? MOTION.numberBlur : MOTION.numberBlur / 2);
    const count = animate(current, value, options);
    const settle = animate(blur, 0, options);
    return () => {
      count.stop();
      settle.stop();
    };
  }, [value, play, delay, reduce, current, blur]);

  return { current, filter: useMotionTemplate`blur(${blur}px)` };
}

/* ------------------------------------------------------------------ */
/* Pieces                                                               */
/* ------------------------------------------------------------------ */

function CountUp({ value, play, delay, format }: { value: number; play: boolean; delay: number; format: (v: number) => string }) {
  const { current, filter } = useCountUp(value, play, delay);
  const text = useTransform(current, format);
  return (
    <>
      <motion.span aria-hidden="true" style={{ filter }} className="inline-block tabular-nums">
        {text}
      </motion.span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}

function PeriodSwitch({ periods, value, onChange, layoutId }: { periods: BreakdownPeriod[]; value: string; onChange: (key: string) => void; layoutId: string }) {
  const reduce = useReducedMotion() ?? false;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, periods.findIndex((p) => p.key === value));

  const onKey = (e: ReactKeyboardEvent) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + periods.length) % periods.length;
    onChange(periods[next].key);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label="Period" onKeyDown={onKey} className="inline-flex h-9 items-center rounded-lg border border-[var(--cb-line)] bg-[var(--cb-raised)] p-[3px]">
      {periods.map((p, i) => {
        const on = i === index;
        return (
          <button
            key={p.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            data-demo={`period-${p.key}`}
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(p.key)}
            className={`relative h-full min-w-11 rounded-md px-3 font-mono text-[11.5px] font-medium tracking-[0.06em] transition-[color,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--cb-ink)] active:scale-[0.97] ${
              on ? "text-[var(--cb-ink)]" : "text-[var(--cb-faint)] hover:text-[var(--cb-ink)]"
            }`}
          >
            {on && (
              <motion.span
                layoutId={layoutId}
                transition={reduce ? { duration: 0 } : SPRING_UI}
                className="absolute inset-0 rounded-md bg-[var(--cb-surface)] shadow-[0_1px_2px_rgba(0,0,0,0.25),0_0_0_1px_var(--cb-line)]"
              />
            )}
            <span className="relative">{p.label}</span>
          </button>
        );
      })}
    </div>
  );
}

type Ranked = BreakdownChannel & { rank: number; share: number };

/** One 100% bar: each channel’s segment grows in rank order; hovering a row lights its segment. */
function ShareStrip({ channels, focus, play }: { channels: Ranked[]; focus: string | null; play: boolean }) {
  const reduce = useReducedMotion() ?? false;
  // The rank-by-rank stagger is for first view; after that, segments retarget together.
  const [grown, setGrown] = useState(false);
  return (
    <div className="flex h-2.5 w-full gap-[3px]" aria-hidden="true">
      {channels.map((c) => (
        <motion.div
          key={c.name}
          layout={reduce ? false : "position"}
          onAnimationComplete={() => play && setGrown(true)}
          className="h-full overflow-hidden rounded-[3px]"
          style={{ flexBasis: 0 }}
          initial={{ flexGrow: reduce ? c.share : 0 }}
          animate={play ? { flexGrow: c.share, opacity: focus && focus !== c.name ? MOTION.dim : 1 } : undefined}
          transition={{
            flexGrow: reduce ? { duration: 0 } : { duration: MOTION.grow, ease: EASE_OUT, delay: grown ? 0 : MOTION.stripAt + c.rank * MOTION.stripStep },
            opacity: { duration: 0.16 },
            layout: SPRING_UI,
          }}
        >
          <div className="size-full transition-colors duration-200" style={{ background: rankColor(c.rank) }} />
        </motion.div>
      ))}
    </div>
  );
}

function ChannelRow({
  channel,
  maxShare,
  play,
  format,
  focused,
  onFocusChange,
}: {
  channel: Ranked;
  maxShare: number;
  play: boolean;
  format: (v: number) => string;
  focused: boolean;
  onFocusChange: (on: boolean) => void;
}) {
  const reduce = useReducedMotion() ?? false;
  // The row lands at its rank on first view; a period switch re-sorts with a layout spring instead.
  const landAt = MOTION.rowsAt + channel.rank * MOTION.rowStep;
  const change = channel.previous ? (channel.value - channel.previous) / channel.previous : null;
  const rising = (change ?? 0) >= 0;
  const [filled, setFilled] = useState(false);
  const Arrow = rising ? ArrowUpRight : ArrowDownRight;

  return (
    <motion.li
      layout={reduce ? false : "position"}
      transition={{ layout: SPRING_UI }}
      data-demo={`row-${channel.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}
      onPointerEnter={(e) => e.pointerType === "mouse" && onFocusChange(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && onFocusChange(false)}
      onClick={() => onFocusChange(!focused)}
      className="relative -mx-2 cursor-default rounded-lg px-2 py-3 transition-colors duration-150 hover:bg-[var(--cb-raised)]"
    >
      <motion.div {...enter(play, landAt, reduce)}>
        <div className="flex items-baseline gap-3 text-[14px]">
          <span className="relative h-4 w-5 shrink-0 overflow-hidden font-mono text-[11px] text-[var(--cb-faint)]" aria-hidden="true">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={channel.rank}
                className="absolute inset-0"
                initial={reduce ? { opacity: 0 } : { y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reduce ? { opacity: 0 } : { y: -10, opacity: 0 }}
                transition={{ duration: 0.24, ease: EASE_OUT }}
              >
                {String(channel.rank + 1).padStart(2, "0")}
              </motion.span>
            </AnimatePresence>
          </span>
          <span className="min-w-0 flex-1 truncate font-medium text-[var(--cb-ink)]">{channel.name}</span>
          {change !== null && (
            <span
              className={`hidden shrink-0 items-center gap-0.5 text-[12px] transition-colors duration-200 @sm:inline-flex ${rising ? "text-[var(--cb-up)]" : "text-[var(--cb-down)]"}`}
            >
              <Arrow className="size-3" strokeWidth={2.25} aria-hidden="true" />
              <span className="sr-only">{rising ? "up" : "down"}</span>
              <CountUp value={Math.abs(change * 100)} play={play} delay={landAt + 0.1} format={(v) => `${Math.round(v)}%`} />
            </span>
          )}
          <span className="shrink-0 font-medium text-[var(--cb-ink)]">
            <CountUp value={channel.value} play={play} delay={landAt + 0.06} format={format} />
          </span>
          <span className="w-[3.4ch] shrink-0 text-right text-[12px] text-[var(--cb-faint)]">
            <CountUp value={channel.share * 100} play={play} delay={landAt + 0.06} format={(v) => `${Math.round(v)}%`} />
          </span>
        </div>
        <div className="ml-8 mt-2.5 h-1 overflow-hidden rounded-full bg-[var(--cb-track)]" aria-hidden="true">
          <motion.div
            className="h-full origin-left rounded-full transition-colors duration-200"
            style={{ background: rankColor(channel.rank) }}
            initial={{ scaleX: reduce ? channel.share / maxShare : 0 }}
            animate={play ? { scaleX: channel.share / maxShare } : undefined}
            onAnimationComplete={() => play && setFilled(true)}
            transition={reduce ? { duration: 0 } : { duration: 0.55, ease: EASE_OUT, delay: filled ? 0 : landAt + MOTION.fillAfter }}
          />
        </div>
      </motion.div>
    </motion.li>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function ChartChannelBreakdown({
  title = "Revenue by channel",
  periods = DEMO_PERIODS,
  defaultPeriod = "30d",
  onPeriodChange,
  format = "currency",
  currency = "USD",
  locale = "en-US",
  accent,
  theme = "dark",
  className = "",
}: ChartChannelBreakdownProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const root = useRef<HTMLElement>(null);
  const play = useInView(root, { once: true, amount: 0.25 });
  const palette = PALETTE[theme];
  const [periodKey, setPeriodKey] = useState(defaultPeriod);
  const [focus, setFocus] = useState<string | null>(null);
  const period = periods.find((p) => p.key === periodKey) ?? periods[0];

  const formatValue = useMemo(() => {
    const nf = new Intl.NumberFormat(locale, { ...(format === "currency" ? { style: "currency", currency } : {}), maximumFractionDigits: 0 });
    return (v: number) => nf.format(v);
  }, [format, currency, locale]);

  const { ranked, total, maxShare } = useMemo(() => {
    const channels = period?.channels ?? [];
    const sum = channels.reduce((s, c) => s + c.value, 0) || 1;
    const sorted = [...channels].sort((a, b) => b.value - a.value).map((c, rank) => ({ ...c, rank, share: c.value / sum }));
    return { ranked: sorted, total: sum, maxShare: sorted[0]?.share || 1 };
  }, [period]);

  if (!period) return null;

  const choosePeriod = (key: string) => {
    setPeriodKey(key);
    setFocus(null);
    onPeriodChange?.(key);
  };

  return (
    <section
      ref={root}
      aria-labelledby={`${uid}-title`}
      style={cssVars(palette, accent ?? palette.ink)}
      className={`@container w-full font-sans text-[var(--cb-ink)] antialiased [font-feature-settings:'tnum'] ${className}`}
    >
      <motion.div {...enter(play, 0, reduce)} className="rounded-[14px] border border-[var(--cb-line)] bg-[var(--cb-surface)] p-4 shadow-[var(--cb-shadow)] @md:p-6">
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <motion.h2 id={`${uid}-title`} {...enter(play, MOTION.step, reduce)} className="text-[14px] font-medium text-[var(--cb-muted)]">
              {title}
            </motion.h2>
            <motion.p {...enter(play, MOTION.step * 2, reduce)} className="mt-2 font-display text-[clamp(1.6rem,1.2rem+2cqi,2.2rem)] font-semibold leading-none tracking-[-0.04em]">
              <CountUp value={total} play={play} delay={MOTION.step * 2} format={formatValue} />
            </motion.p>
          </div>
          {periods.length > 1 && (
            <motion.div {...enter(play, MOTION.step, reduce)}>
              <PeriodSwitch periods={periods} value={period.key} onChange={choosePeriod} layoutId={`${uid}-period`} />
            </motion.div>
          )}
        </header>
        <motion.div {...enter(play, MOTION.step * 3, reduce)} className="relative mt-2 h-5 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={period.key}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(3px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(3px)", transition: { duration: 0.14 } }}
              transition={{ duration: reduce ? MOTION.fade : 0.24, ease: EASE_OUT }}
              className="truncate text-[13px] text-[var(--cb-faint)]"
            >
              {period.caption}
            </motion.p>
          </AnimatePresence>
        </motion.div>

        <LayoutGroup id={uid}>
          <div className="mt-5">
            <ShareStrip channels={ranked} focus={focus} play={play} />
          </div>
          <ul className="mt-4" aria-label={`${title}, ${period.caption ?? period.label}`}>
            {ranked.map((c) => (
              <ChannelRow
                key={c.name}
                channel={c}
                maxShare={maxShare}
                play={play}
                format={formatValue}
                focused={focus === c.name}
                onFocusChange={(on) => setFocus(on ? c.name : null)}
              />
            ))}
          </ul>
        </LayoutGroup>
      </motion.div>
    </section>
  );
}

/** The first accent swatch (#f4f4f5) stands for "theme ink", so it maps to the component default and reads correctly on both themes. */
const THEME_INK_SWATCH = "#f4f4f5";

export default function ChartChannelBreakdownDemo(overrides: Partial<ChartChannelBreakdownProps> = {}) {
  const light = overrides.theme === "light";
  const { accent, ...rest } = overrides;
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-16 sm:px-8" style={{ background: light ? "#e9e9ec" : STAGE }}>
      <div className="w-full max-w-[520px]">
        <ChartChannelBreakdown {...rest} accent={accent === THEME_INK_SWATCH ? undefined : accent} />
      </div>
    </div>
  );
}
