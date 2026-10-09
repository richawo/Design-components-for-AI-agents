"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useReducedMotion, useTransform, type Variants } from "motion/react";

export type FooterStatus = "ok" | "degraded" | "outage";
export type FooterTheme = "system" | "light" | "dark";
export type FooterLink = {
  label: string;
  href: string;
  /** Small mono tag after the label, e.g. "New" or "4 open". */
  badge?: string;
  external?: boolean;
};
export type FooterColumn = { title: string; links: FooterLink[] };
export type FooterLocale = { code: string; label: string };

export type FooterColumnsStatusProps = {
  brand?: { name: string; href: string };
  /** One line under the brand. */
  description?: string;
  /** Optional release pill under the description. */
  release?: { version: string; label: string; href: string } | null;
  /** Exactly four reads best; three to five all lay out. */
  columns?: FooterColumn[];
  /** Drives the status pill's colour, copy and breathing speed. */
  status?: FooterStatus;
  statusLabels?: Record<FooterStatus, string>;
  statusHref?: string;
  /** 90-day uptime in percent, shown in the status pill. It counts up once the pill lands. Null hides it. */
  uptime?: number | null;
  /** Controlled theme. Omit to let the switch keep its own state. */
  theme?: FooterTheme;
  defaultTheme?: FooterTheme;
  /** The switch only reports; apply the theme yourself. */
  onThemeChange?: (theme: FooterTheme) => void;
  locales?: FooterLocale[];
  /** Controlled locale code. */
  locale?: string;
  defaultLocale?: string;
  onLocaleChange?: (code: string) => void;
  copyright?: string;
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const COLORS = {
  bg: "#050505",
  popover: "#0d0d0e",
  /** Status is the only colour in the footer, and it means something. */
  status: { ok: "#34d399", degraded: "#fbbf24", outage: "#f87171" } satisfies Record<FooterStatus, string>,
} as const;

/** Breathing period per status: calm when fine, quicker when it matters. */
const STATUS_PERIOD: Record<FooterStatus, string> = { ok: "3.2s", degraded: "2.2s", outage: "1.4s" };

const EASE = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;

/**
 * Entrance timeline, in seconds. The grid's hairlines draw first (the
 * containers), then each cell's content staggers in reading order, links
 * lightly. The bottom bar lands last; its status dot and uptime figure only
 * start once the pill itself has landed.
 */
const T = {
  frame: 0,
  divider: 0.05,
  cell: 0.08,
  cellStep: 0.06,
  item: 0.05,
  link: 0.025,
  bar: 0.5,
  barStep: 0.05,
  dot: 0.22,
  count: 0.3,
  countDur: 0.8,
  dur: 0.6,
  drawDur: 0.8,
} as const;

/** Share of a block that must be on screen before it reveals. */
const REVEAL_AMOUNT = 0.25;
/** Below this container width the columns become an accordion. */
const COMPACT_BELOW = 640;
/** Pointer light: follow rate, fade rates, and how bright neighbouring cells get. */
const LIGHT = { follow: 0.2, fadeIn: 0.12, cell: 0.16, neighbour: 0.32 } as const;

const reveal: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(8px)" },
  show: (delay: number) => ({ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: T.dur, ease: EASE, delay }, transitionEnd: { filter: "none" } }),
};
const drawX: Variants = {
  hidden: { scaleX: 0 },
  show: (delay: number) => ({ scaleX: 1, transition: { duration: T.drawDur, ease: EASE, delay } }),
};
const drawY: Variants = {
  hidden: { scaleY: 0 },
  show: (delay: number) => ({ scaleY: 1, transition: { duration: T.drawDur, ease: EASE, delay } }),
};
const pop: Variants = {
  hidden: { opacity: 0, scale: 0.4 },
  show: (delay: number) => ({ opacity: 1, scale: 1, transition: { duration: 0.45, ease: EASE, delay } }),
};
/** Reduced motion: one short fade, no transforms, blur or stagger. */
const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
};

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70";
const HAIRLINE = "pointer-events-none absolute bg-white/[0.09]";
const PILL =
  "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09)] transition-[background-color,color,box-shadow,scale] duration-150 hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] active:scale-[0.98]";

const DEFAULT_COLUMNS: FooterColumn[] = [
  {
    title: "Product",
    links: [
      { label: "Queues", href: "#queues" },
      { label: "Cron", href: "#cron" },
      { label: "Webhooks", href: "#webhooks" },
      { label: "Workflows", href: "#workflows", badge: "New" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Documentation", href: "#docs" },
      { label: "API reference", href: "#api" },
      { label: "CLI", href: "#cli" },
      { label: "Changelog", href: "#changelog" },
      { label: "GitHub", href: "#github", external: true },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#about" },
      { label: "Customers", href: "#customers" },
      { label: "Careers", href: "#careers", badge: "4 open" },
      { label: "Blog", href: "#blog" },
      { label: "Contact", href: "#contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms", href: "#terms" },
      { label: "Privacy", href: "#privacy" },
      { label: "DPA", href: "#dpa" },
      { label: "Sub-processors", href: "#subprocessors" },
      { label: "Security", href: "#security" },
    ],
  },
];

const DEFAULT_LOCALES: FooterLocale[] = [
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "de-DE", label: "Deutsch" },
  { code: "fr-FR", label: "Français" },
  { code: "es-MX", label: "Español (México)" },
  { code: "pt-BR", label: "Português (Brasil)" },
  { code: "ja-JP", label: "日本語" },
];

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

/** A value that is either controlled by a prop or kept here, reporting every change. */
function useControllable<V>(value: V | undefined, initial: V, onChange?: (v: V) => void) {
  const [own, setOwn] = useState(initial);
  const set = (v: V) => {
    if (value === undefined) setOwn(v);
    onChange?.(v);
  };
  return [value ?? own, set] as const;
}

/** True when the container is narrower than `below`, measured with a ResizeObserver. */
function useCompact(ref: RefObject<HTMLElement | null>, below: number) {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setCompact(e.contentRect.width < below));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, below]);
  return compact;
}

/**
 * The light. One soft radial field follows the pointer across the grid, but
 * every cell paints its own copy, clipped to its own box. The cell under the
 * pointer gets the full light; its neighbours get a third, so each hairline
 * reads as a wall the light can't pass. The hairlines catch the light where it
 * touches them. No React state: CSS variables written from one rAF loop that
 * stops as soon as everything has settled.
 */
function useCellLight(gridRef: RefObject<HTMLDivElement | null>, cellRefs: RefObject<(HTMLDivElement | null)[]>, reduce: boolean, layoutKey: string) {
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const st = { tx: 0, ty: 0, x: 0, y: 0, on: 0, target: 0, fresh: true, raf: 0, levels: [] as number[] };
    let boxes: { l: number; t: number; w: number; h: number }[] = [];
    const measure = () => {
      boxes = cellRefs.current.map((c) => (c ? { l: c.offsetLeft, t: c.offsetTop, w: c.offsetWidth, h: c.offsetHeight } : { l: 0, t: 0, w: 0, h: 0 }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(grid);

    const ease = (rate: number) => (reduce ? 1 : rate);
    const tick = () => {
      st.x += (st.tx - st.x) * ease(LIGHT.follow);
      st.y += (st.ty - st.y) * ease(LIGHT.follow);
      st.on += (st.target - st.on) * ease(LIGHT.fadeIn);
      grid.style.setProperty("--fcs-gx", `${st.x}px`);
      grid.style.setProperty("--fcs-l", st.on.toFixed(3));
      let moving = Math.abs(st.target - st.on) > 0.002 || Math.abs(st.tx - st.x) > 0.3 || Math.abs(st.ty - st.y) > 0.3;
      cellRefs.current.forEach((cell, i) => {
        const b = boxes[i];
        if (!cell || !b) return;
        const lx = st.x - b.l;
        const ly = st.y - b.t;
        const inside = lx >= 0 && ly >= 0 && lx <= b.w && ly <= b.h;
        const want = (inside ? 1 : LIGHT.neighbour) * st.target;
        const next = (st.levels[i] ?? 0) + (want - (st.levels[i] ?? 0)) * ease(LIGHT.cell);
        st.levels[i] = next;
        if (Math.abs(want - next) > 0.002) moving = true;
        cell.style.setProperty("--fcs-x", `${lx}px`);
        cell.style.setProperty("--fcs-y", `${ly}px`);
        cell.style.setProperty("--fcs-a", next.toFixed(3));
      });
      st.raf = moving ? requestAnimationFrame(tick) : 0;
    };
    const kick = () => {
      if (!st.raf) st.raf = requestAnimationFrame(tick);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = grid.getBoundingClientRect();
      st.tx = e.clientX - r.left;
      st.ty = e.clientY - r.top;
      if (st.fresh) {
        st.x = st.tx;
        st.y = st.ty;
        st.fresh = false;
      }
      st.target = 1;
      kick();
    };
    const leave = () => {
      st.target = 0;
      st.fresh = true;
      kick();
    };
    grid.addEventListener("pointermove", move);
    grid.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(st.raf);
      ro.disconnect();
      grid.removeEventListener("pointermove", move);
      grid.removeEventListener("pointerleave", leave);
    };
  }, [gridRef, cellRefs, reduce, layoutKey]);
}

/**
 * Listbox popover behaviour: open/close, the active option, keyboard
 * (arrows, Home/End, Enter/Space, Escape, Tab), outside click, and focus
 * handed to the list on open and back to the trigger on close.
 */
function useListbox(count: number, selectedIndex: number, onChoose: (i: number) => void) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const close = useCallback((focusTrigger: boolean) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onDown);
    listRef.current?.focus();
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, close]);

  const show = () => {
    setActive(Math.max(0, selectedIndex));
    setOpen(true);
  };
  const choose = (i: number) => {
    onChoose(i);
    close(true);
  };
  const KEYS: Record<string, () => void> = {
    ArrowDown: () => setActive((a) => Math.min(count - 1, a + 1)),
    ArrowUp: () => setActive((a) => Math.max(0, a - 1)),
    Home: () => setActive(0),
    End: () => setActive(count - 1),
    Enter: () => choose(active),
    " ": () => choose(active),
    Escape: () => close(true),
  };
  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === "Tab") return close(false);
    const act = KEYS[e.key];
    if (!act) return;
    e.preventDefault();
    act();
  };
  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    show();
  };
  const toggle = () => (open ? close(false) : show());

  return { open, active, setActive, wrapRef, triggerRef, listRef, toggle, choose, onListKey, onTriggerKey };
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function FooterColumnsStatus({
  brand = { name: "Halyard", href: "#" },
  description = "Queues, cron and webhooks that retry until they land.",
  release = { version: "v4.12", label: "Durable timers are here", href: "#changelog" },
  columns = DEFAULT_COLUMNS,
  status = "ok",
  statusLabels = { ok: "All systems normal", degraded: "Degraded performance", outage: "Partial outage" },
  statusHref = "#status",
  uptime = 99.98,
  theme,
  defaultTheme = "system",
  onThemeChange,
  locales = DEFAULT_LOCALES,
  locale,
  defaultLocale = "en-GB",
  onLocaleChange,
  copyright = "© 2026 Halyard Labs, Inc.",
  className = "",
}: FooterColumnsStatusProps) {
  const reduce = !!useReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [currentTheme, pickTheme] = useControllable(theme, defaultTheme, onThemeChange);
  const [currentLocale, pickLocale] = useControllable(locale, defaultLocale, onLocaleChange);
  const compact = useCompact(rootRef, COMPACT_BELOW);
  useCellLight(gridRef, cellRefs, reduce, `${compact}-${columns.length}`);

  const clock = useRef<number | null>(null);
  const gridAt = useReveal(gridRef, T.frame, clock);
  const barAt = useReveal(barRef, T.bar, clock);
  const gridShown = gridAt !== null;
  const at = (start: number | null, offset: number) => (start ?? 0) + offset;
  const v = reduce ? fade : reveal;
  const drawH = reduce ? fade : drawX;
  const drawV = reduce ? fade : drawY;
  const cellDelay = (i: number) => at(gridAt, T.cell + i * T.cellStep);

  const cellLight: CSSProperties = {
    background: "radial-gradient(400px circle at var(--fcs-x) var(--fcs-y), rgba(255,255,255,0.1), rgba(255,255,255,0.045) 32%, rgba(255,255,255,0.012) 58%, transparent 75%)",
    opacity: "var(--fcs-a)",
  };
  const vLineLight: CSSProperties = {
    background: "radial-gradient(150px circle at var(--fcs-x) var(--fcs-y), rgba(255,255,255,0.5), transparent 75%)",
    opacity: "var(--fcs-l)",
  };
  const gridLineLight: CSSProperties = {
    background: "radial-gradient(220px circle at var(--fcs-gx) 0px, rgba(255,255,255,0.5), transparent 75%)",
    opacity: "var(--fcs-l)",
  };
  const cellVars = { "--fcs-x": "-999px", "--fcs-y": "-999px", "--fcs-a": "0" } as CSSProperties;
  const cellRef = (i: number) => (el: HTMLDivElement | null) => {
    cellRefs.current[i] = el;
  };

  return (
    <footer ref={rootRef} style={{ background: COLORS.bg }} className={`@container relative text-white ${className}`}>
      <style>{`@keyframes fcs-breathe{0%,100%{transform:scale(1);opacity:.55}50%{transform:scale(2.6);opacity:0}}`}</style>
      <div className="mx-auto w-full max-w-[1280px] px-5 @2xl:px-8 @6xl:px-10">
        <motion.div
          ref={gridRef}
          initial="hidden"
          animate={gridShown ? "show" : "hidden"}
          className="relative grid grid-cols-1 @2xl:grid-cols-4 @6xl:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))]"
          style={{ "--fcs-gx": "-999px", "--fcs-l": "0" } as CSSProperties}
        >
          {/* Frame. Top and bottom rules run edge to edge of the footer; the sides appear once there's a grid. */}
          <motion.span aria-hidden="true" variants={drawH} custom={at(gridAt, T.frame)} className="pointer-events-none absolute left-1/2 top-0 h-px w-[100cqw] -translate-x-1/2 bg-white/[0.08]" />
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-px h-px">
            <span className="absolute inset-0" style={gridLineLight} />
          </span>
          <motion.span aria-hidden="true" variants={drawH} custom={at(gridAt, T.frame)} className="pointer-events-none absolute bottom-0 left-1/2 h-px w-[100cqw] -translate-x-1/2 bg-white/[0.08]" />
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px">
            <span className="absolute inset-0" style={gridLineLight} />
          </span>
          <motion.span aria-hidden="true" variants={drawV} custom={at(gridAt, T.frame)} className={`${HAIRLINE} inset-y-0 left-0 hidden w-px origin-top @2xl:block`} />
          <motion.span aria-hidden="true" variants={drawV} custom={at(gridAt, T.frame)} className={`${HAIRLINE} inset-y-0 right-0 hidden w-px origin-top @2xl:block`} />

          {/* Brand cell */}
          <div ref={cellRef(0)} className="relative px-0 pb-8 pt-9 @2xl:col-span-4 @2xl:px-8 @2xl:pb-9 @6xl:col-span-1 @6xl:pb-12 @6xl:pt-10" style={cellVars}>
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 hidden @2xl:block" style={cellLight} />
            <motion.span aria-hidden="true" variants={drawH} custom={at(gridAt, T.divider)} className={`${HAIRLINE} inset-x-0 bottom-0 hidden h-px origin-left @2xl:block @6xl:hidden`}>
              <span className="absolute inset-0" style={{ ...vLineLight, background: "radial-gradient(180px circle at var(--fcs-x) 100%, rgba(255,255,255,0.55), transparent 75%)" }} />
            </motion.span>
            <BrandBlock brand={brand} description={description} release={release} delay={cellDelay(0)} reduce={reduce} />
          </div>

          {/* Link columns */}
          {columns.map((col, i) => (
            <div key={col.title} ref={cellRef(i + 1)} className="relative @2xl:px-6 @2xl:pb-10 @2xl:pt-8 @6xl:pt-10" style={cellVars}>
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 hidden @2xl:block" style={cellLight} />
              <motion.span
                aria-hidden="true"
                variants={drawV}
                custom={at(gridAt, T.divider + (i + 1) * T.cellStep)}
                className={`${HAIRLINE} inset-y-0 left-0 w-px origin-top ${i === 0 ? "hidden @6xl:block" : "hidden @2xl:block"}`}
              >
                <span className="absolute inset-0" style={vLineLight} />
              </motion.span>
              <motion.span aria-hidden="true" variants={drawH} custom={cellDelay(i + 1)} className={`${HAIRLINE} inset-x-0 top-0 h-px origin-left @2xl:hidden`} />
              <LinkColumn
                column={col}
                compact={compact}
                open={!!open[i]}
                onToggle={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
                shown={gridShown}
                delay={cellDelay(i + 1)}
                reduce={reduce}
              />
            </div>
          ))}
        </motion.div>

        {/* Bottom bar: lands last. */}
        <motion.div
          ref={barRef}
          initial="hidden"
          animate={barAt === null ? "hidden" : "show"}
          className="flex flex-col gap-4 py-6 @2xl:flex-row @2xl:items-center @2xl:justify-between @2xl:gap-6 @2xl:py-5"
        >
          <div className="flex items-center gap-5">
            <motion.div variants={v} custom={at(barAt, 0)}>
              <StatusPill status={status} label={statusLabels[status]} href={statusHref} uptime={uptime} start={barAt} reduce={reduce} />
            </motion.div>
            <motion.p variants={v} custom={at(barAt, T.barStep)} className="hidden font-mono text-[11px] uppercase tracking-[0.12em] text-white/40 @2xl:block">
              {copyright}
            </motion.p>
          </div>
          <div className="flex items-center justify-between gap-3 @2xl:justify-end">
            <motion.div variants={v} custom={at(barAt, T.barStep * 2)}>
              <LocaleSelect locales={locales} value={currentLocale} onChange={pickLocale} reduce={reduce} compact={compact} />
            </motion.div>
            <motion.div variants={v} custom={at(barAt, T.barStep * 3)}>
              <ThemeSwitch value={currentTheme} onChange={pickTheme} compact={compact} />
            </motion.div>
          </div>
          <motion.p variants={v} custom={at(barAt, T.barStep * 4)} className="pt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-white/40 @2xl:hidden">
            {copyright}
          </motion.p>
        </motion.div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Grid cells                                                          */
/* ------------------------------------------------------------------ */

function BrandBlock({
  brand,
  description,
  release,
  delay,
  reduce,
}: Pick<FooterColumnsStatusProps, "description" | "release"> & { brand: { name: string; href: string }; delay: number; reduce: boolean }) {
  const v = reduce ? fade : reveal;
  return (
    <div className="relative flex h-full flex-col @2xl:flex-row @2xl:items-start @2xl:justify-between @6xl:flex-col @6xl:justify-start">
      <div>
        <a href={brand.href} className={`inline-flex items-center gap-2.5 rounded-md transition-transform duration-100 active:scale-[0.98] ${FOCUS} focus-visible:outline-offset-4`}>
          <motion.span variants={reduce ? fade : pop} custom={delay} className="flex">
            <HalyardMark />
          </motion.span>
          <motion.span variants={v} custom={delay + T.item} className="font-display text-[18px] font-semibold tracking-[-0.025em]">
            {brand.name}
          </motion.span>
        </a>
        <motion.p variants={v} custom={delay + T.item * 2} className="mt-4 max-w-[30ch] text-pretty text-[15px] leading-[1.6] text-white/55">
          {description}
        </motion.p>
      </div>
      {release ? (
        <motion.a
          href={release.href}
          variants={v}
          custom={delay + T.item * 3}
          className={`group mt-6 inline-flex h-8 max-w-full items-center gap-2.5 self-start rounded-full bg-white/[0.03] pl-1 pr-3 text-[13px] text-white/70 hover:bg-white/[0.06] hover:text-white ${PILL} ${FOCUS} @2xl:mt-1 @6xl:mt-auto`}
        >
          <span className="rounded-full bg-white/[0.08] px-2 py-0.5 font-mono text-[10.5px] tracking-[0.02em] text-white/85 tabular-nums">{release.version}</span>
          <span className="truncate">{release.label}</span>
          <Arrow className="size-3 shrink-0 text-white/45 transition-[transform,color] duration-150 group-hover:translate-x-0.5 group-hover:text-white/80" />
        </motion.a>
      ) : null}
    </div>
  );
}

/**
 * One link column. A full list on wide containers, a disclosure row below 640px.
 * The accordion's own height animation would cut off variant inheritance, so
 * the links take their reveal state explicitly.
 */
function LinkColumn({
  column,
  compact,
  open,
  onToggle,
  shown,
  delay,
  reduce,
}: {
  column: FooterColumn;
  compact: boolean;
  open: boolean;
  onToggle: () => void;
  shown: boolean;
  delay: number;
  reduce: boolean;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const headId = `${id}-head`;
  const expanded = !compact || open;
  const v = reduce ? fade : reveal;

  return (
    <nav aria-labelledby={headId}>
      {compact ? (
        <motion.h3 id={headId} variants={v} custom={delay}>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={onToggle}
            className="group flex h-14 w-full items-center justify-between text-left font-mono text-[12px] uppercase tracking-[0.14em] text-white/70 transition-[color,scale] duration-100 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white/70 active:scale-[0.99]"
          >
            {column.title}
            <span aria-hidden="true" className="relative flex size-5 items-center justify-center">
              <span className="absolute h-px w-3 bg-current" />
              <motion.span
                className="absolute h-3 w-px bg-current"
                initial={false}
                animate={{ rotate: open ? 90 : 0, opacity: open ? 0 : 1 }}
                transition={reduce ? { duration: 0 } : { duration: 0.28, ease: EASE }}
              />
            </span>
          </button>
        </motion.h3>
      ) : (
        <motion.h3 id={headId} variants={v} custom={delay} className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">
          {column.title}
        </motion.h3>
      )}
      <motion.div
        id={listId}
        initial={false}
        animate={expanded ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
        transition={reduce ? { duration: 0 } : { height: { duration: 0.36, ease: EASE }, opacity: { duration: expanded ? 0.3 : 0.18, ease: EASE } }}
        inert={!expanded}
        className={compact ? "overflow-hidden" : ""}
      >
        <ul className={`group/list ${compact ? "grid grid-cols-2 gap-x-4 pb-5" : "mt-5 space-y-0.5"}`}>
          {column.links.map((l, i) => (
            <motion.li key={l.label} variants={v} custom={delay + T.item + i * T.link} initial="hidden" animate={shown ? "show" : "hidden"}>
              <a
                href={l.href}
                target={l.external ? "_blank" : undefined}
                rel={l.external ? "noreferrer" : undefined}
                className={`inline-flex max-w-full items-center gap-2 rounded-[5px] text-[14.5px] tracking-[-0.005em] text-white/60 transition-[color] duration-150 group-has-[a:hover]/list:text-white/40 group-has-[a:focus-visible]/list:text-white/40 hover:text-white! focus-visible:text-white! active:translate-y-px ${FOCUS} ${
                  compact ? "min-h-11" : "min-h-8"
                }`}
              >
                <span className="truncate">{l.label}</span>
                {l.external ? (
                  <span aria-hidden="true" className="-ml-0.5 text-[11px] opacity-60">
                    ↗
                  </span>
                ) : null}
                {l.badge ? (
                  <span className="shrink-0 rounded-full bg-white/[0.05] px-1.5 py-px font-mono text-[10px] uppercase tracking-[0.06em] text-white/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
                    {l.badge}
                  </span>
                ) : null}
                {l.external ? <span className="sr-only">(opens in a new tab)</span> : null}
              </a>
            </motion.li>
          ))}
        </ul>
      </motion.div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Bottom bar                                                          */
/* ------------------------------------------------------------------ */

/**
 * The status pill. Once it has landed, the dot pops in and starts breathing
 * (only while on screen) and the uptime figure counts up from zero.
 */
function StatusPill({
  status,
  label,
  href,
  uptime,
  start,
  reduce,
}: {
  status: FooterStatus;
  label: string;
  href: string;
  uptime: number | null;
  start: number | null;
  reduce: boolean;
}) {
  const color = COLORS.status[status];
  const ref = useRef<HTMLAnchorElement>(null);
  const onScreen = useInView(ref);
  const count = useMotionValue(0);
  const figure = useTransform(count, (n) => `${n.toFixed(2)}%`);
  const filter = useTransform(count, (n) => `blur(${(1 - Math.min(1, n / Math.max(1, uptime ?? 1))) * 3}px)`);

  useEffect(() => {
    if (start === null || uptime === null) return;
    if (reduce) {
      count.jump(uptime);
      return;
    }
    const controls = animate(count, uptime, { duration: T.countDur, delay: start + T.count, ease: EASE });
    return () => controls.stop();
  }, [start, uptime, reduce, count]);

  return (
    <a
      ref={ref}
      href={href}
      className={`group inline-flex h-9 items-center gap-2.5 self-start rounded-full bg-white/[0.025] pl-3 pr-3.5 text-[13px] text-white/75 hover:bg-white/[0.055] hover:text-white ${PILL} ${FOCUS} @2xl:h-8`}
    >
      <motion.span aria-hidden="true" variants={reduce ? fade : pop} custom={(start ?? 0) + T.dot} className="relative flex size-2 items-center justify-center">
        {!reduce ? (
          <span
            className="absolute size-2 rounded-full"
            style={{
              background: color,
              // Longhands only: React warns when a shorthand and a longhand change together.
              animationName: "fcs-breathe",
              animationDuration: STATUS_PERIOD[status],
              animationTimingFunction: "cubic-bezier(0.65,0,0.35,1)",
              animationIterationCount: "infinite",
              animationPlayState: onScreen ? "running" : "paused",
            }}
          />
        ) : null}
        <motion.span
          className="relative size-2 rounded-full"
          initial={false}
          animate={{ backgroundColor: color, boxShadow: `0 0 10px 0 ${color}66` }}
          transition={{ duration: reduce ? 0 : 0.4, ease: EASE }}
        />
      </motion.span>
      <span className="relative grid overflow-hidden" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={status}
            className="whitespace-nowrap"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(3px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(3px)", transition: { duration: 0.18, ease: EASE_IN } }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </span>
      {uptime !== null ? (
        <span className="flex items-center gap-2.5 font-mono text-[11px] text-white/45">
          <span aria-hidden="true" className="h-3 w-px bg-white/[0.12]" />
          <motion.span className="inline-block tabular-nums" style={{ filter }} aria-hidden="true">
            {figure}
          </motion.span>
          <span className="sr-only">{`${uptime.toFixed(2)}% uptime over 90 days`}</span>
        </span>
      ) : null}
      <Arrow className="-ml-0.5 size-3 text-white/35 transition-[transform,color] duration-150 group-hover:translate-x-0.5 group-hover:text-white/70" />
    </a>
  );
}

const THEMES: { value: FooterTheme; label: string; icon: ReactNode }[] = [
  {
    value: "system",
    label: "System",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="size-[15px]" aria-hidden="true">
        <rect x="2" y="3" width="12" height="8.5" rx="1.6" stroke="currentColor" strokeWidth="1.3" />
        <path d="M6 13.5h4M8 11.5v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "light",
    label: "Light",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="size-[15px]" aria-hidden="true">
        <circle cx="8" cy="8" r="2.6" stroke="currentColor" strokeWidth="1.3" />
        <path
          d="M8 1.8v1.4M8 12.8v1.4M14.2 8h-1.4M3.2 8H1.8M12.4 3.6l-1 1M4.6 11.4l-1 1M12.4 12.4l-1-1M4.6 4.6l-1-1"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Dark",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="size-[15px]" aria-hidden="true">
        <path d="M13.2 9.6A5.4 5.4 0 0 1 6.4 2.8a5.4 5.4 0 1 0 6.8 6.8Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    ),
  },
];

/** Three-way theme radiogroup with roving tabindex; the thumb glides between options. */
function ThemeSwitch({ value, onChange, compact }: { value: FooterTheme; onChange: (t: FooterTheme) => void; compact: boolean }) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const n = (i + dir + THEMES.length) % THEMES.length;
    onChange(THEMES[n].value);
    refs.current[n]?.focus();
  };
  return (
    <div role="radiogroup" aria-label="Theme" className="flex items-center rounded-full bg-white/[0.025] p-[3px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09)]">
      {THEMES.map((t, i) => {
        const on = value === t.value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={t.label}
            title={t.label}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={`relative flex items-center justify-center rounded-full transition-[color,scale] duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/70 active:scale-[0.94] ${
              compact ? "size-11" : "size-[30px]"
            } ${on ? "text-white" : "text-white/45 hover:text-white/85"}`}
          >
            {on ? (
              <motion.span
                layoutId={`${id}-thumb`}
                transition={SPRING_UI}
                className="absolute inset-0 rounded-full bg-white/[0.1] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12),inset_0_1px_0_rgba(255,255,255,0.1),0_1px_2px_rgba(0,0,0,0.6)]"
              />
            ) : null}
            <span className="relative">{t.icon}</span>
          </button>
        );
      })}
    </div>
  );
}

function LocaleSelect({
  locales,
  value,
  onChange,
  reduce,
  compact,
}: {
  locales: FooterLocale[];
  value: string;
  onChange: (code: string) => void;
  reduce: boolean;
  compact: boolean;
}) {
  const id = useId();
  const selected = locales.findIndex((l) => l.code === value);
  const current = locales[selected] ?? locales[0];
  const lb = useListbox(locales.length, selected, (i) => onChange(locales[i].code));

  return (
    <div ref={lb.wrapRef} className="relative">
      <button
        ref={lb.triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={lb.open}
        aria-controls={`${id}-list`}
        aria-label={`Language: ${current.label}`}
        onClick={lb.toggle}
        onKeyDown={lb.onTriggerKey}
        className={`group inline-flex items-center gap-2 rounded-full pl-3 pr-2.5 text-[13px] text-white/70 hover:bg-white/[0.05] hover:text-white ${PILL} ${FOCUS} ${
          lb.open ? "bg-white/[0.06] text-white" : "bg-white/[0.025]"
        } ${compact ? "h-[50px]" : "h-9"}`}
      >
        <svg viewBox="0 0 16 16" fill="none" className="size-[15px] text-white/50" aria-hidden="true">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
          <path d="M2 8h12M8 2c1.7 1.7 2.5 3.7 2.5 6S9.7 12.3 8 14M8 2C6.3 3.7 5.5 5.7 5.5 8s.8 4.3 2.5 6" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        <span className="whitespace-nowrap">{current.label}</span>
        <motion.svg
          viewBox="0 0 16 16"
          fill="none"
          className="size-3 text-white/40"
          aria-hidden="true"
          initial={false}
          animate={{ rotate: lb.open ? 180 : 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.22, ease: EASE }}
        >
          <path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {lb.open ? (
          <motion.ul
            ref={lb.listRef}
            id={`${id}-list`}
            role="listbox"
            tabIndex={-1}
            aria-label="Language"
            aria-activedescendant={`${id}-opt-${lb.active}`}
            onKeyDown={lb.onListKey}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: 4, scale: 0.98, transition: { duration: 0.14, ease: EASE_IN } }}
            transition={{ duration: 0.22, ease: EASE }}
            style={{ background: COLORS.popover }}
            className="absolute bottom-[calc(100%+8px)] left-0 z-20 w-60 origin-bottom-left rounded-[14px] p-1.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09),inset_0_1px_0_rgba(255,255,255,0.05),0_24px_60px_-12px_rgba(0,0,0,0.9)] outline-none @2xl:left-auto @2xl:right-0 @2xl:origin-bottom-right"
          >
            {locales.map((l, i) => (
              <LocaleOption
                key={l.code}
                id={`${id}-opt-${i}`}
                locale={l}
                selected={l.code === value}
                active={i === lb.active}
                highlightId={`${id}-hl`}
                compact={compact}
                reduce={reduce}
                onHover={() => lb.setActive(i)}
                onPick={() => lb.choose(i)}
              />
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function LocaleOption({
  id,
  locale,
  selected,
  active,
  highlightId,
  compact,
  reduce,
  onHover,
  onPick,
}: {
  id: string;
  locale: FooterLocale;
  selected: boolean;
  active: boolean;
  highlightId: string;
  compact: boolean;
  reduce: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  return (
    <li
      id={id}
      role="option"
      aria-selected={selected}
      onPointerMove={onHover}
      onClick={onPick}
      className={`relative flex cursor-pointer items-center gap-3 rounded-[9px] px-2.5 text-[13.5px] ${compact ? "h-11" : "h-9"} ${selected ? "text-white" : "text-white/65"}`}
    >
      {active ? <motion.span layoutId={highlightId} transition={reduce ? { duration: 0 } : SPRING_UI} className="absolute inset-0 rounded-[9px] bg-white/[0.07]" /> : null}
      <span className="relative flex-1 truncate">{locale.label}</span>
      <span className="relative font-mono text-[10.5px] tracking-[0.04em] text-white/35">{locale.code}</span>
      <span className="relative flex w-3.5 justify-center" aria-hidden="true">
        {selected ? (
          <svg viewBox="0 0 16 16" fill="none" className="size-3.5 text-white">
            <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A pennant on a halyard: the line that raises the flag. */
function HalyardMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden="true">
      <rect width="24" height="24" rx="7" fill="#f4f4f5" />
      <path d="M8 5.5v13" stroke={COLORS.bg} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.9 5.6 17.2 9 8.9 12.4Z" fill={COLORS.bg} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                */
/* ------------------------------------------------------------------ */

/** Demo: the footer at the foot of a quiet page, with a status preview switch above it. */
export default function FooterColumnsStatusDemo() {
  const [status, setStatus] = useState<FooterStatus>("ok");
  return (
    <div className="flex min-h-dvh flex-col justify-between bg-black">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="flex justify-center px-5 pb-10 pt-8">
        <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-white/35">
          <span>Preview status</span>
          <div className="flex rounded-full p-0.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
            {(["ok", "degraded", "outage"] as const).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={status === s}
                onClick={() => setStatus(s)}
                className={`relative h-8 rounded-full px-3 uppercase tracking-[0.14em] transition-[color] duration-150 focus-visible:outline-2 focus-visible:outline-white/60 active:translate-y-px ${
                  status === s ? "text-white/85" : "hover:text-white/70"
                }`}
              >
                {status === s ? <motion.span layoutId="fcs-demo-pill" transition={SPRING_UI} className="absolute inset-0 rounded-full bg-white/[0.07]" /> : null}
                <span className="relative">{s}</span>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
      <FooterColumnsStatus status={status} />
    </div>
  );
}
