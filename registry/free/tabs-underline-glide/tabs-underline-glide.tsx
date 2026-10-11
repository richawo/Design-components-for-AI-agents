"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type Variants,
} from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type TabsUnderlineItem = {
  /** Stable key for the tab. It also names the demo target (`tab-<value>`), so keep it unique on the page. */
  value: string;
  label: string;
  /** A quiet number after the label. Shown only while `counts` is on. */
  count?: number;
  /** The panel shown while this tab is selected. */
  content: ReactNode;
  disabled?: boolean;
};

export type TabsActivation = "auto" | "manual";
export type TabsIndicator = "underline" | "pill";
export type TabsTheme = "dark" | "light";

export type TabsUnderlineGlideProps = {
  /** Accessible name of the tab list. */
  label?: string;
  /** The tabs and their panels. Leave out to use the built-in project console. */
  items?: TabsUnderlineItem[];
  /** How many built-in tabs to show, from 2 to 8. Ignored when `items` is given. */
  tabs?: number;
  /** Controlled selection. Update it from `onValueChange`. */
  value?: string;
  /** Starting selection when uncontrolled. */
  defaultValue?: string;
  onValueChange?: (value: string, item: TabsUnderlineItem) => void;
  /** Counts after the labels. */
  counts?: boolean;
  /**
   * Auto selects a tab as the arrow keys reach it. Manual only moves focus, and Enter or Space opens
   * the focused tab: use it when a panel is expensive to render.
   */
  activation?: TabsActivation;
  /** A 2px line under the label, or a raised pill behind the whole tab. Both glide the same way. */
  indicator?: TabsIndicator;
  /** Colour of the indicator line. Defaults to the theme's ink. The pill stays neutral. */
  accent?: string;
  theme?: TabsTheme;
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

/**
 * The indicator's two edges travel on separate springs. The edge in the direction of travel leads on
 * spring.ui and the other trails on a slightly softer spring, so the line stretches as it leaves and
 * gathers back to the label's width as it lands. Both are critically damped: nothing overshoots.
 */
const SPRING_LEAD = { type: "spring", stiffness: 500, damping: 40 } as const;
const SPRING_TRAIL = { type: "spring", stiffness: 300, damping: 34 } as const;
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

/** How far a panel slides as it cross-fades, in px, in the direction of travel. */
const PANEL_OFFSET = 6;

/** Width of an edge fade while an overflow arrow sits over it, in px. */
const FADE_WIDTH = 56;
/** Clearance kept between a scrolled-to tab and a faded edge, so neither the fade nor an arrow covers it. */
const EDGE_CLEARANCE = FADE_WIDTH + 4;
/** One arrow press scrolls this share of the visible strip, leaving the last tab as an anchor. */
const ARROW_STEP = 0.7;
const FADE_TRANSITION = "220ms cubic-bezier(0.22, 1, 0.36, 1)";

/** Tab row height: a full 44px touch target, with the line sitting on the rail at its foot. */
const TAB_HEIGHT = 44;
/** How far the pill sits inside the tab box, so it reads as a raised key rather than a block. */
const PILL_INSET = { x: 2, y: 7 } as const;

/**
 * The edge fades are a mask on the scroller rather than overlays, so the rail and the indicator fade
 * with the labels. Registering the widths as lengths lets the mask ease between states.
 */
const FADE_PROPERTIES =
  '@property --tu-fade-start{syntax:"<length>";inherits:false;initial-value:0px}' +
  '@property --tu-fade-end{syntax:"<length>";inherits:false;initial-value:0px}';
const EDGE_MASK =
  "linear-gradient(to right, transparent 0px, #000 var(--tu-fade-start), #000 calc(100% - var(--tu-fade-end)), transparent 100%)";

const THEMES = {
  dark: {
    ink: "#f4f4f5",
    muted: "#8a8a93",
    faint: "#5d5d66",
    rail: "rgb(255 255 255 / 0.08)",
    line: "rgb(255 255 255 / 0.06)",
    surface: "#18181b",
    pill: "#26262b",
    pillShadow:
      "inset 0 0 0 1px rgb(255 255 255 / 0.08), inset 0 1px 0 rgb(255 255 255 / 0.07), 0 1px 2px rgb(0 0 0 / 0.5), 0 6px 14px -6px rgb(0 0 0 / 0.7)",
    arrow: "#1f1f23",
    arrowHover: "#28282d",
    arrowShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.09), 0 4px 12px -4px rgb(0 0 0 / 0.8)",
    focus: "rgb(244 244 245 / 0.75)",
    ok: "#3dd68c",
    busy: "#f5b946",
    warn: "#f5b946",
  },
  light: {
    ink: "#18181b",
    muted: "#63636c",
    faint: "#9b9ba4",
    rail: "rgb(24 24 27 / 0.1)",
    line: "rgb(24 24 27 / 0.07)",
    surface: "#f4f4f5",
    pill: "#ffffff",
    pillShadow:
      "inset 0 0 0 1px rgb(24 24 27 / 0.07), inset 0 1px 0 #ffffff, 0 1px 2px rgb(24 24 27 / 0.1), 0 6px 14px -8px rgb(24 24 27 / 0.3)",
    arrow: "#ffffff",
    arrowHover: "#f4f4f5",
    arrowShadow: "inset 0 0 0 1px rgb(24 24 27 / 0.1), 0 4px 12px -6px rgb(24 24 27 / 0.3)",
    focus: "rgb(24 24 27 / 0.7)",
    ok: "#1f9d5c",
    busy: "#d08a00",
    warn: "#d08a00",
  },
} as const;

const NUMBER = new Intl.NumberFormat("en-US");

/* ------------------------------------------------------------------ */
/* Built-in panels: a small project console                            */
/* ------------------------------------------------------------------ */

type Status = "ok" | "busy" | "warn";

type PanelData =
  | { kind: "stats"; lead: string; stats: { label: string; value: number; decimals?: number; unit?: string }[]; spark: number[] }
  | { kind: "rows"; lead: string; rows: { primary: string; secondary: string; meta: string; status?: Status; mono?: boolean }[] }
  | { kind: "log"; lead: string; lines: { time: string; level: "INFO" | "WARN"; text: string }[] }
  | { kind: "bars"; lead: string; total: number; caption: string; days: { label: string; value: number }[] }
  | { kind: "meters"; lead: string; meters: { label: string; used: number; total: number; unit: string }[] };

type BuiltInTab = { value: string; label: string; count?: number; panel: PanelData };

/** Ordered so that any prefix reads as a sensible project nav: the slider takes the first n. */
const BUILT_IN: BuiltInTab[] = [
  {
    value: "overview",
    label: "Overview",
    panel: {
      kind: "stats",
      lead: "A steady week. Traffic peaked on Thursday at 14:00 UTC and nothing paged anyone.",
      stats: [
        { label: "Requests", value: 1418204 },
        { label: "p95 latency", value: 182, unit: "ms" },
        { label: "Error rate", value: 0.04, decimals: 2, unit: "%" },
      ],
      spark: [22, 28, 25, 31, 36, 34, 41, 47, 44, 52, 58, 63, 71, 66, 74, 81, 77, 69, 62, 57, 49, 44, 38, 33],
    },
  },
  {
    value: "deployments",
    label: "Deployments",
    count: 24,
    panel: {
      kind: "rows",
      lead: "Twenty-four this week, two rolled back. Production is on a3f9c21.",
      rows: [
        { primary: "Trim cold start on /api/quote", secondary: "main · a3f9c21", meta: "4m ago", status: "ok" },
        { primary: "Cache rendered images for 7 days", secondary: "perf/cache · 81bd0e4", meta: "Building", status: "busy" },
        { primary: "Revert locale fallback", secondary: "main · 5c02e7a", meta: "2h ago", status: "ok" },
      ],
    },
  },
  {
    value: "logs",
    label: "Logs",
    panel: {
      kind: "log",
      lead: "Live from lhr1 and iad1. One client is leaning on checkout.",
      lines: [
        { time: "14:02:11.084", level: "INFO", text: "GET /api/quote 200 41ms" },
        { time: "14:02:11.312", level: "INFO", text: "GET /pricing 200 12ms cache hit" },
        { time: "14:02:12.907", level: "WARN", text: "POST /api/checkout 429 rate limited" },
        { time: "14:02:13.441", level: "INFO", text: "GET /api/quote 200 38ms" },
      ],
    },
  },
  {
    value: "analytics",
    label: "Analytics",
    panel: {
      kind: "bars",
      lead: "Visitors dip at the weekend, as they have every week since launch.",
      total: 48210,
      caption: "Visitors, last 7 days",
      days: [
        { label: "Mon", value: 7120 },
        { label: "Tue", value: 7860 },
        { label: "Wed", value: 8240 },
        { label: "Thu", value: 9410 },
        { label: "Fri", value: 7930 },
        { label: "Sat", value: 3820 },
        { label: "Sun", value: 3830 },
      ],
    },
  },
  {
    value: "domains",
    label: "Domains",
    count: 3,
    panel: {
      kind: "rows",
      lead: "Two live, one waiting on a DNS record at the registrar.",
      rows: [
        { primary: "tidewell.app", secondary: "Production", meta: "Renews 12 Nov", status: "ok", mono: true },
        { primary: "www.tidewell.app", secondary: "Redirects to tidewell.app", meta: "308", status: "ok", mono: true },
        { primary: "preview.tidewell.app", secondary: "Preview branches", meta: "Pending DNS", status: "warn", mono: true },
      ],
    },
  },
  {
    value: "variables",
    label: "Variables",
    count: 18,
    panel: {
      kind: "rows",
      lead: "Eighteen variables across three environments. Values stay hidden here.",
      rows: [
        { primary: "DATABASE_URL", secondary: "Production, Preview", meta: "••••••c81e", mono: true },
        { primary: "PAYMENTS_SECRET", secondary: "Production", meta: "••••••4f2a", mono: true },
        { primary: "MAIL_API_KEY", secondary: "All environments", meta: "••••••90bd", mono: true },
      ],
    },
  },
  {
    value: "storage",
    label: "Storage",
    panel: {
      kind: "meters",
      lead: "Postgres will want a bigger plan before the end of the quarter.",
      meters: [
        { label: "Blob", used: 38.2, total: 100, unit: "GB" },
        { label: "Key value", used: 1.9, total: 5, unit: "GB" },
        { label: "Postgres", used: 8.1, total: 10, unit: "GB" },
      ],
    },
  },
  {
    value: "settings",
    label: "Settings",
    panel: {
      kind: "rows",
      lead: "Builds run on push to main. Everything else waits for a review.",
      rows: [
        { primary: "Region", secondary: "Where functions run", meta: "London, lhr1" },
        { primary: "Build command", secondary: "Runs from apps/web", meta: "pnpm build" },
        { primary: "Node", secondary: "Pinned for every build", meta: "22.11" },
      ],
    },
  },
];

function builtInItems(tabs: number): TabsUnderlineItem[] {
  const total = Number.isFinite(tabs) ? Math.min(8, Math.max(2, Math.round(tabs))) : 6;
  return BUILT_IN.slice(0, total).map((tab) => ({
    value: tab.value,
    label: tab.label,
    count: tab.count,
    content: <ConsolePanel data={tab.panel} />,
  }));
}

/** The next enabled index from `from` in `direction`, wrapping at the ends as the tabs pattern does. */
function nextEnabled(items: TabsUnderlineItem[], from: number, direction: 1 | -1): number {
  const total = items.length;
  for (let step = 1; step <= total; step++) {
    const index = (((from + direction * step) % total) + total) % total;
    if (!items[index].disabled) return index;
  }
  return from;
}

/* ------------------------------------------------------------------ */
/* The indicator                                                       */
/* ------------------------------------------------------------------ */

type Span = { left: number; right: number };

/**
 * Two motion values for the indicator's edges. The first placement jumps; every later one glides with
 * the leading edge on spring.ui and the trailing edge a beat behind. A second pick mid-flight carries
 * the current velocity, so the line turns around instead of finishing its trip first.
 */
function useGlidingSpan(reduce: boolean) {
  const left = useMotionValue(0);
  const right = useMotionValue(0);
  const width = useTransform([left, right], ([start, end]: number[]) => Math.max(0, end - start));
  const placed = useRef(false);
  const [visible, setVisible] = useState(false);

  const moveTo = useCallback(
    (target: Span) => {
      if (!placed.current || reduce) {
        left.jump(target.left);
        right.jump(target.right);
        placed.current = true;
        setVisible(true);
        return;
      }
      if (left.get() === target.left && right.get() === target.right) return;
      const forward = target.left + target.right > left.get() + right.get();
      animate(left, target.left, forward ? SPRING_TRAIL : SPRING_LEAD);
      animate(right, target.right, forward ? SPRING_LEAD : SPRING_TRAIL);
    },
    [left, right, reduce],
  );

  return { x: left, width, visible, moveTo };
}

/* ------------------------------------------------------------------ */
/* The tabs                                                            */
/* ------------------------------------------------------------------ */

export function TabsUnderlineGlide({
  label = "Project",
  items,
  tabs = 6,
  value,
  defaultValue,
  onValueChange,
  counts = true,
  activation = "auto",
  indicator = "underline",
  accent,
  theme = "dark",
  className = "",
}: TabsUnderlineGlideProps) {
  const reduce = !!useReducedMotion();
  const baseId = useId();
  const list = items ?? builtInItems(tabs);
  const [internal, setInternal] = useState<string | undefined>(defaultValue ?? list[0]?.value);

  const current = value ?? internal;
  const firstEnabled = list.findIndex((item) => !item.disabled);
  const matched = list.findIndex((item) => item.value === current && !item.disabled);
  const selectedIndex = matched >= 0 ? matched : firstEnabled;
  const selected = list[selectedIndex];

  // The panel slides in the direction the selection travelled. Derived during render from the previous
  // index, so a controlled value and an internal one both get the right direction.
  const [travel, setTravel] = useState({ index: selectedIndex, direction: 1 as 1 | -1 });
  if (travel.index !== selectedIndex) {
    setTravel({ index: selectedIndex, direction: selectedIndex > travel.index ? 1 : -1 });
  }

  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const labels = useRef<Array<HTMLSpanElement | null>>([]);
  const scroller = useRef<HTMLDivElement | null>(null);
  const strip = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  const span = useGlidingSpan(reduce);
  const { moveTo } = span;

  const readEdges = useCallback(() => {
    const box = scroller.current;
    if (!box) return;
    const start = box.scrollLeft > 1;
    const end = box.scrollLeft + box.clientWidth < box.scrollWidth - 1;
    setEdges((previous) => (previous.start === start && previous.end === end ? previous : { start, end }));
  }, []);

  // The underline spans the label only, so it reads as underlining a word. The pill takes the whole tab.
  const measure = useCallback(() => {
    const button = buttons.current[selectedIndex];
    const text = labels.current[selectedIndex];
    if (!button || !text) return;
    if (indicator === "pill") {
      moveTo({ left: button.offsetLeft + PILL_INSET.x, right: button.offsetLeft + button.offsetWidth - PILL_INSET.x });
    } else {
      const start = button.offsetLeft + text.offsetLeft;
      moveTo({ left: start, right: start + text.offsetWidth });
    }
  }, [selectedIndex, indicator, moveTo]);

  // Brings a tab inside the visible strip, clear of both arrows. A pick scrolls smoothly; a resize snaps.
  const reveal = useCallback((index: number, behavior: ScrollBehavior) => {
    const box = scroller.current;
    const button = buttons.current[index];
    if (!box || !button) return;
    const left = button.offsetLeft;
    const right = left + button.offsetWidth;
    const view = box.clientWidth;
    let target: number | null = null;
    if (left < box.scrollLeft + EDGE_CLEARANCE) target = left - EDGE_CLEARANCE;
    else if (right > box.scrollLeft + view - EDGE_CLEARANCE) target = right - view + EDGE_CLEARANCE;
    if (target !== null) box.scrollTo({ left: Math.max(0, target), behavior });
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, list.length, counts, items]);

  useEffect(() => {
    reveal(selectedIndex, reduce ? "auto" : "smooth");
  }, [reveal, selectedIndex, reduce]);

  // Fonts loading, counts appearing and the column narrowing all change geometry without a scroll.
  useEffect(() => {
    const box = scroller.current;
    const inner = strip.current;
    if (!box || !inner) return;
    const observer = new ResizeObserver(() => {
      readEdges();
      measure();
      reveal(selectedIndex, "auto");
    });
    observer.observe(box);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [readEdges, measure, reveal, selectedIndex]);

  const choose = (index: number) => {
    const item = list[index];
    if (!item || item.disabled || index === selectedIndex) return;
    if (value === undefined) setInternal(item.value);
    onValueChange?.(item.value, item);
  };

  // Tabs keys: arrows move focus (and select, in auto), Home and End jump to the ends. In manual,
  // Enter and Space open the focused tab through the native button's click.
  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    const enabled = list.flatMap((item, i) => (item.disabled ? [] : [i]));
    let target: number | undefined;
    switch (event.key) {
      case "ArrowRight":
        target = nextEnabled(list, index, 1);
        break;
      case "ArrowLeft":
        target = nextEnabled(list, index, -1);
        break;
      case "Home":
        target = enabled[0];
        break;
      case "End":
        target = enabled[enabled.length - 1];
        break;
      default:
        return;
    }
    if (target === undefined) return;
    event.preventDefault();
    if (activation === "auto") choose(target);
    buttons.current[target]?.focus();
  };

  const step = (direction: 1 | -1) => {
    const box = scroller.current;
    if (!box) return;
    box.scrollBy({ left: direction * box.clientWidth * ARROW_STEP, behavior: reduce ? "auto" : "smooth" });
  };

  if (list.length === 0 || !selected) return null;

  const palette = THEMES[theme];
  const ink = accent ?? palette.ink;

  const vars = {
    "--tu-ink": palette.ink,
    "--tu-muted": palette.muted,
    "--tu-faint": palette.faint,
    "--tu-rail": palette.rail,
    "--tu-line": palette.line,
    "--tu-surface": palette.surface,
    "--tu-pill": palette.pill,
    "--tu-pill-shadow": palette.pillShadow,
    "--tu-arrow": palette.arrow,
    "--tu-arrow-hover": palette.arrowHover,
    "--tu-arrow-shadow": palette.arrowShadow,
    "--tu-focus": palette.focus,
    "--tu-ok": palette.ok,
    "--tu-busy": palette.busy,
    "--tu-warn": palette.warn,
    "--tu-indicator": ink,
  } as CSSProperties;

  const fades = {
    "--tu-fade-start": edges.start ? `${FADE_WIDTH}px` : "0px",
    "--tu-fade-end": edges.end ? `${FADE_WIDTH}px` : "0px",
    maskImage: EDGE_MASK,
    WebkitMaskImage: EDGE_MASK,
    transition: reduce ? "none" : `--tu-fade-start ${FADE_TRANSITION}, --tu-fade-end ${FADE_TRANSITION}`,
  } as CSSProperties;

  const direction = travel.direction;
  const panelMotion: Variants = reduce
    ? {
        enter: { opacity: 0 },
        center: { opacity: 1, transition: { duration: 0.15 } },
        exit: { opacity: 0, transition: { duration: 0.1 } },
      }
    : {
        enter: (dir: number) => ({ opacity: 0, x: PANEL_OFFSET * dir, filter: "blur(3px)" }),
        center: { opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: 0.26, ease: EASE_OUT } },
        exit: (dir: number) => ({
          opacity: 0,
          x: -PANEL_OFFSET * dir,
          filter: "blur(3px)",
          transition: { duration: 0.17, ease: EASE_IN },
        }),
      };

  const tabId = (item: TabsUnderlineItem) => `${baseId}-tab-${item.value}`;
  const panelId = (item: TabsUnderlineItem) => `${baseId}-panel-${item.value}`;

  return (
    <div className={`@container w-full ${className}`} style={vars}>
      <style>{FADE_PROPERTIES}</style>

      {/* The tab row. The rail runs the full width beneath the scroller, so it never fades away. */}
      <div className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-(--tu-rail)" />
        <div
          ref={scroller}
          onScroll={readEdges}
          className="relative overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={fades}
        >
          <div
            ref={strip}
            role="tablist"
            aria-label={label}
            aria-orientation="horizontal"
            data-activation={activation}
            className="relative flex w-max min-w-full items-stretch gap-0.5 @md:gap-1"
          >
            {span.visible ? (
              indicator === "pill" ? (
                <motion.span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 rounded-[9px]"
                  style={{
                    x: span.x,
                    width: span.width,
                    top: PILL_INSET.y,
                    bottom: PILL_INSET.y,
                    backgroundColor: "var(--tu-pill)",
                    boxShadow: "var(--tu-pill-shadow)",
                  }}
                />
              ) : (
                <motion.span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 left-0 z-10 h-[2px] rounded-full bg-(--tu-indicator)"
                  style={{ x: span.x, width: span.width }}
                />
              )
            ) : null}

            {list.map((item, index) => {
              const active = index === selectedIndex;
              return (
                <button
                  key={item.value}
                  ref={(node) => {
                    buttons.current[index] = node;
                  }}
                  id={tabId(item)}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={active ? panelId(item) : undefined}
                  tabIndex={active ? 0 : -1}
                  disabled={item.disabled}
                  data-demo={`tab-${item.value}`}
                  onClick={() => choose(index)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  onFocus={() => reveal(index, reduce ? "auto" : "smooth")}
                  style={{ height: TAB_HEIGHT }}
                  className={`group relative flex shrink-0 items-center rounded-[10px] px-2.5 text-[14px] font-medium tracking-[-0.01em] whitespace-nowrap transition-[color] duration-150 ease-out focus-visible:outline-2 focus-visible:-outline-offset-[6px] focus-visible:outline-(--tu-focus) enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 @md:px-3.5 ${
                    active ? "text-(--tu-ink)" : "text-(--tu-muted) enabled:hover:text-(--tu-ink)"
                  }`}
                >
                  {/* The press lives on the label, so the indicator beneath never sits in a scaled box. */}
                  <span className="flex items-center transition-transform duration-[90ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-enabled:group-active:scale-[0.97]">
                    <span
                      ref={(node) => {
                        labels.current[index] = node;
                      }}
                    >
                      {item.label}
                    </span>
                    {counts && item.count !== undefined ? (
                      <span
                        className={`ml-1.5 text-[12.5px] font-normal tabular-nums transition-[color] duration-150 ease-out ${
                          active ? "text-(--tu-muted)" : "text-(--tu-faint)"
                        }`}
                      >
                        {NUMBER.format(item.count)}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <OverflowArrow side="start" shown={edges.start} reduce={reduce} onStep={() => step(-1)} />
        <OverflowArrow side="end" shown={edges.end} reduce={reduce} onStep={() => step(1)} />
      </div>

      {/* Panels cross-fade with a 6px slide in the direction of travel. popLayout lifts the leaving
          panel out of flow, so the arriving one takes its place without the area doubling in height. */}
      <div className="relative">
        <AnimatePresence initial={false} mode="popLayout" custom={direction}>
          <motion.div
            key={selected.value}
            id={panelId(selected)}
            role="tabpanel"
            aria-labelledby={tabId(selected)}
            tabIndex={0}
            custom={direction}
            variants={panelMotion}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full rounded-[10px] pt-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--tu-focus)"
          >
            {selected.content}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overflow arrows                                                     */
/* ------------------------------------------------------------------ */

/**
 * An arrow over each faded edge while more tabs lie past it. They are pointer and touch affordances
 * only: keyboard users move through the tabs with the arrow keys, which scroll the strip themselves,
 * so the arrows stay out of the tab order and out of the accessibility tree.
 */
function OverflowArrow({
  side,
  shown,
  reduce,
  onStep,
}: {
  side: "start" | "end";
  shown: boolean;
  reduce: boolean;
  onStep: () => void;
}) {
  const start = side === "start";
  const Icon = start ? ChevronLeft : ChevronRight;
  const nudge = start ? -4 : 4;
  return (
    <AnimatePresence initial={false}>
      {shown ? (
        <motion.button
          key={side}
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          data-demo={`scroll-${side}`}
          onClick={onStep}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: nudge }}
          animate={{ opacity: 1, x: 0, transition: { duration: reduce ? 0.12 : 0.2, ease: EASE_OUT } }}
          exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, x: nudge, transition: { duration: 0.14, ease: EASE_IN } }}
          style={{ height: TAB_HEIGHT }}
          className={`group absolute top-0 z-20 grid w-10 cursor-pointer place-items-center ${start ? "left-0 justify-items-start" : "right-0 justify-items-end"}`}
        >
          <span className="grid size-7 place-items-center rounded-full bg-(--tu-arrow) text-(--tu-muted) shadow-(--tu-arrow-shadow) transition-[background-color,color,scale] duration-150 ease-out group-hover:bg-(--tu-arrow-hover) group-hover:text-(--tu-ink) group-active:scale-[0.94]">
            <Icon
              aria-hidden="true"
              className={`size-4 stroke-[2] transition-transform duration-150 ease-out ${start ? "group-hover:-translate-x-px" : "group-hover:translate-x-px"}`}
            />
          </span>
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* Console panels: every view lands in order, text then figures        */
/* ------------------------------------------------------------------ */

/** Tweens a figure up from zero once its panel is on screen, landing exactly on the value. */
function useCountUp(target: number, run: boolean, reduce: boolean, delay: number) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!run) return;
    if (reduce) {
      setShown(target);
      return;
    }
    const counter = animate(0, target, { duration: 0.7, delay, ease: EASE_OUT, onUpdate: setShown });
    return () => counter.stop();
  }, [target, run, reduce, delay]);
  return shown;
}

const STAGGER = 0.05;

function ConsolePanel({ data }: { data: PanelData }) {
  const reduce = !!useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  const rise: Variants = reduce
    ? { hidden: { opacity: 0 }, shown: { opacity: 1, transition: { duration: 0.15 } } }
    : {
        hidden: { opacity: 0, y: 10, filter: "blur(6px)" },
        shown: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.42, ease: EASE_OUT } },
      };
  const group: Variants = { hidden: {}, shown: { transition: { staggerChildren: reduce ? 0 : STAGGER } } };

  return (
    <motion.div
      ref={ref}
      variants={group}
      initial="hidden"
      animate={inView ? "shown" : "hidden"}
      className="flex min-h-[212px] flex-col gap-4"
    >
      <motion.p variants={rise} className="max-w-[56ch] text-[15px] leading-[1.55] text-pretty text-(--tu-muted)">
        {data.lead}
      </motion.p>
      {data.kind === "stats" ? <StatsBody data={data} rise={rise} run={inView} reduce={reduce} /> : null}
      {data.kind === "rows" ? <RowsBody data={data} rise={rise} /> : null}
      {data.kind === "log" ? <LogBody data={data} rise={rise} /> : null}
      {data.kind === "bars" ? <BarsBody data={data} rise={rise} run={inView} reduce={reduce} /> : null}
      {data.kind === "meters" ? <MetersBody data={data} rise={rise} run={inView} reduce={reduce} /> : null}
    </motion.div>
  );
}

type BodyProps<K extends PanelData["kind"]> = { data: Extract<PanelData, { kind: K }>; rise: Variants };
type LiveBodyProps<K extends PanelData["kind"]> = BodyProps<K> & { run: boolean; reduce: boolean };

function Figure({ value, decimals = 0, unit, run, reduce, delay }: { value: number; decimals?: number; unit?: string; run: boolean; reduce: boolean; delay: number }) {
  const shown = useCountUp(value, run, reduce, delay);
  const text = new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(shown);
  return (
    <span className="font-display text-[clamp(1.375rem,4.2cqi,1.75rem)] leading-none font-semibold tracking-[-0.03em] text-(--tu-ink) tabular-nums">
      {text}
      {unit ? <span className="ml-0.5 text-[0.6em] font-medium tracking-normal text-(--tu-muted)">{unit}</span> : null}
    </span>
  );
}

function StatsBody({ data, rise, run, reduce }: LiveBodyProps<"stats">) {
  const peak = Math.max(...data.spark);
  return (
    <>
      <motion.dl variants={rise} className="grid grid-cols-3 gap-3 @md:gap-6">
        {data.stats.map((stat, i) => (
          <div key={stat.label} className="flex min-w-0 flex-col gap-2">
            <dt className="truncate font-mono text-[10.5px] tracking-[0.12em] text-(--tu-faint) uppercase">{stat.label}</dt>
            <dd>
              <Figure value={stat.value} decimals={stat.decimals} unit={stat.unit} run={run} reduce={reduce} delay={0.12 + i * STAGGER} />
            </dd>
          </div>
        ))}
      </motion.dl>
      <motion.div variants={rise} aria-hidden="true" className="flex h-12 items-end gap-[3px]">
        {data.spark.map((point, i) => (
          <motion.span
            key={i}
            className="flex-1 origin-bottom rounded-[2px] bg-(--tu-ink)"
            style={{ height: `${(point / peak) * 100}%`, opacity: 0.16 + (point / peak) * 0.5 }}
            initial={{ scaleY: reduce ? 1 : 0 }}
            animate={{ scaleY: run || reduce ? 1 : 0 }}
            transition={{ duration: 0.5, delay: 0.3 + i * 0.012, ease: EASE_OUT }}
          />
        ))}
      </motion.div>
    </>
  );
}

function RowsBody({ data, rise }: BodyProps<"rows">) {
  return (
    <ul className="flex flex-col">
      {data.rows.map((row) => (
        <motion.li
          key={row.primary}
          variants={rise}
          className="flex items-center gap-3 border-t border-(--tu-line) py-3 first:border-t-0 first:pt-0"
        >
          {row.status ? (
            <span
              aria-hidden="true"
              className="size-[7px] shrink-0 rounded-full"
              style={{ backgroundColor: `var(--tu-${row.status})` }}
            />
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={`truncate text-(--tu-ink) ${row.mono ? "font-mono text-[13px]" : "text-[14px] font-medium tracking-[-0.01em]"}`}>
              {row.primary}
            </span>
            <span className="truncate text-[13px] text-(--tu-muted)">{row.secondary}</span>
          </div>
          <span className="shrink-0 font-mono text-[12px] text-(--tu-muted) tabular-nums">
            {row.status === "busy" ? <span className="sr-only">Status: </span> : null}
            {row.meta}
          </span>
        </motion.li>
      ))}
    </ul>
  );
}

function LogBody({ data, rise }: BodyProps<"log">) {
  return (
    <ol className="flex flex-col overflow-hidden rounded-[10px] bg-(--tu-surface) py-2 font-mono text-[12px] leading-[1.9] ring-1 ring-inset ring-(--tu-line)">
      {data.lines.map((line) => (
        <motion.li key={line.time} variants={rise} className="flex min-w-0 gap-3 px-3.5 whitespace-nowrap">
          <span className="shrink-0 text-(--tu-faint) tabular-nums">{line.time}</span>
          <span className="w-9 shrink-0" style={{ color: line.level === "WARN" ? "var(--tu-warn)" : "var(--tu-muted)" }}>
            {line.level}
          </span>
          <span className="min-w-0 truncate text-(--tu-ink)">{line.text}</span>
        </motion.li>
      ))}
    </ol>
  );
}

function BarsBody({ data, rise, run, reduce }: LiveBodyProps<"bars">) {
  const peak = Math.max(...data.days.map((day) => day.value));
  const total = useCountUp(data.total, run, reduce, 0.12);
  return (
    <motion.figure variants={rise} className="flex flex-col gap-3">
      <figcaption className="flex items-baseline justify-between gap-4">
        <span className="font-mono text-[10.5px] tracking-[0.12em] text-(--tu-faint) uppercase">{data.caption}</span>
        <span className="font-display text-[20px] font-semibold tracking-[-0.03em] text-(--tu-ink) tabular-nums">{NUMBER.format(Math.round(total))}</span>
      </figcaption>
      <div className="grid h-[92px] grid-cols-7 items-end gap-2 @md:gap-3">
        {data.days.map((day, i) => (
          <div key={day.label} className="flex h-full flex-col items-stretch justify-end gap-1.5">
            <motion.span
              aria-hidden="true"
              className="origin-bottom rounded-[4px] bg-(--tu-ink)"
              style={{ height: `${(day.value / peak) * 72}px`, opacity: day.value === peak ? 0.72 : 0.26 }}
              initial={{ scaleY: reduce ? 1 : 0 }}
              animate={{ scaleY: run || reduce ? 1 : 0 }}
              transition={{ duration: 0.55, delay: 0.28 + i * 0.045, ease: EASE_OUT }}
            />
            <span className="text-center font-mono text-[10.5px] text-(--tu-faint)">
              <span className="sr-only">{`${NUMBER.format(day.value)} visitors on `}</span>
              {day.label}
            </span>
          </div>
        ))}
      </div>
    </motion.figure>
  );
}

function MetersBody({ data, rise, run, reduce }: LiveBodyProps<"meters">) {
  return (
    <ul className="flex flex-col gap-4">
      {data.meters.map((meter, i) => {
        const share = meter.used / meter.total;
        return (
          <motion.li key={meter.label} variants={rise} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-4 text-[14px]">
              <span className="font-medium tracking-[-0.01em] text-(--tu-ink)">{meter.label}</span>
              <span className="font-mono text-[12px] text-(--tu-muted) tabular-nums">
                {meter.used} / {meter.total} {meter.unit}
              </span>
            </div>
            <div
              role="meter"
              aria-label={`${meter.label} used`}
              aria-valuemin={0}
              aria-valuemax={meter.total}
              aria-valuenow={meter.used}
              className="h-1.5 overflow-hidden rounded-full bg-(--tu-line)"
            >
              <motion.span
                className="block h-full origin-left rounded-full"
                style={{ width: `${share * 100}%`, backgroundColor: share > 0.75 ? "var(--tu-warn)" : "var(--tu-ink)" }}
                initial={{ scaleX: reduce ? 1 : 0 }}
                animate={{ scaleX: run || reduce ? 1 : 0 }}
                transition={{ duration: 0.6, delay: 0.32 + i * 0.06, ease: EASE_OUT }}
              />
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Demo: a project console, narrowed into a column so the arrows show  */
/* ------------------------------------------------------------------ */

/** The width the demo narrows its column to, in px: narrow enough that most tabs sit past the edge. */
const NARROW_WIDTH = 300;

const STAGE_DARK = {
  "--stage-bg": "#09090b",
  "--stage-card": "#0f0f11",
  "--stage-ring": "rgb(255 255 255 / 0.08)",
  "--stage-line": "rgb(255 255 255 / 0.07)",
  "--stage-muted": "#8a8a93",
  "--stage-ink": "#f4f4f5",
  "--stage-shadow": "0 30px 80px -36px rgb(0 0 0 / 0.8)",
} as CSSProperties;

const STAGE_LIGHT = {
  "--stage-bg": "#ececee",
  "--stage-card": "#fbfbfb",
  "--stage-ring": "rgb(24 24 27 / 0.08)",
  "--stage-line": "rgb(24 24 27 / 0.08)",
  "--stage-muted": "#63636c",
  "--stage-ink": "#18181b",
  "--stage-shadow": "0 30px 80px -40px rgb(24 24 27 / 0.3)",
} as CSSProperties;

const HINTS: Record<TabsActivation, string> = {
  auto: "← → switch tabs",
  manual: "← → move · Enter opens",
};

export default function TabsUnderlineGlideDemo({
  tabs = 6,
  counts = true,
  activation = "auto",
  indicator = "underline",
  theme = "dark",
  ...overrides
}: Partial<TabsUnderlineGlideProps> = {}) {
  const reduce = !!useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const inView = useInView(cardRef, { once: true, amount: 0.3 });
  const [picked, setPicked] = useState("overview");
  const [narrow, setNarrow] = useState(false);

  const stage = theme === "dark" ? STAGE_DARK : STAGE_LIGHT;
  const rise: Variants = reduce
    ? { hidden: { opacity: 0 }, shown: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 12, filter: "blur(8px)" }, shown: { opacity: 1, y: 0, filter: "blur(0px)" } };
  const landing = inView ? "shown" : "hidden";
  const enter = (delay: number) => ({ duration: reduce ? 0.15 : 0.5, ease: EASE_OUT, delay: reduce ? 0 : delay });

  return (
    <div className="flex min-h-dvh items-center justify-center bg-(--stage-bg) px-4 py-10 sm:p-10" style={stage}>
      <motion.div
        ref={cardRef}
        variants={rise}
        initial="hidden"
        animate={landing}
        transition={enter(0)}
        className="w-full max-w-[680px] rounded-[20px] bg-(--stage-card) px-4 pt-5 pb-4 ring-1 ring-inset ring-(--stage-ring) shadow-(--stage-shadow) sm:px-7 sm:pt-7"
      >
        <motion.header
          variants={rise}
          initial="hidden"
          animate={landing}
          transition={enter(0.06)}
          className="flex items-end justify-between gap-4 pb-3"
        >
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="font-mono text-[11px] tracking-[0.12em] text-(--stage-muted) uppercase">Tidewell / Production</span>
            <h2 className="truncate font-display text-[clamp(1.5rem,5vw,1.875rem)] leading-none font-semibold tracking-[-0.04em] text-(--stage-ink)">
              tidewell-web
            </h2>
          </div>
          <span className="hidden shrink-0 font-mono text-[11px] tracking-[0.12em] text-(--stage-muted) uppercase sm:inline">lhr1 · iad1</span>
        </motion.header>

        <motion.div variants={rise} initial="hidden" animate={landing} transition={enter(0.14)}>
          {/* The column narrows under the tabs, so the strip overflows and the arrows arrive. */}
          <motion.div
            initial={false}
            animate={{ width: narrow ? NARROW_WIDTH : "100%" }}
            transition={{ duration: reduce ? 0 : 0.42, ease: EASE_IN_OUT }}
            className="max-w-full"
          >
            <TabsUnderlineGlide
              label="Project sections"
              tabs={tabs}
              counts={counts}
              activation={activation}
              indicator={indicator}
              theme={theme}
              value={picked}
              onValueChange={(next) => setPicked(next)}
              {...overrides}
            />
          </motion.div>
        </motion.div>

        <motion.footer
          variants={rise}
          initial="hidden"
          animate={landing}
          transition={enter(0.24)}
          className="mt-4 flex items-center justify-between gap-4 border-t border-(--stage-line) pt-3"
        >
          <button
            type="button"
            data-demo="narrow"
            aria-pressed={narrow}
            onClick={() => setNarrow((on) => !on)}
            className="-ml-2 min-h-11 rounded-md px-2 font-mono text-[11px] tracking-[0.12em] text-(--stage-muted) uppercase transition-[color,scale] duration-150 ease-out hover:text-(--stage-ink) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--stage-ink) active:scale-[0.97] aria-pressed:text-(--stage-ink)"
          >
            {narrow ? "Full width" : "Narrow column"}
          </button>
          <span className="truncate font-mono text-[11px] tracking-[0.08em] text-(--stage-muted)">{HINTS[activation]}</span>
        </motion.footer>
      </motion.div>
    </div>
  );
}
