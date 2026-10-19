"use client";

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
} from "react";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useReducedMotion, type Variants } from "motion/react";
import { ArrowDown, X } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type SortDirection = "ascending" | "descending";
export type DataTableSort = { key: string; direction: SortDirection } | null;
export type DataTableDensity = "compact" | "regular";

/**
 * How a column formats, aligns and sorts its values.
 * entity: a monogram tile and a name (the card title on narrow screens).
 * currency / number: right-aligned tabular figures (the card's value).
 * date: an ISO yyyy-mm-dd string. status: a key into `statuses`.
 */
export type DataTableColumnKind = "text" | "mono" | "entity" | "date" | "status" | "currency" | "number";

export type DataTableColumn = {
  key: string;
  header: string;
  kind?: DataTableColumnKind;
  /** Preferred width in px. Columns shrink towards minWidth to fit, and the last one takes any spare room. */
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  sortable?: boolean;
  /** Direction of the first click. Figures and dates start descending, text ascending. */
  firstSort?: SortDirection;
  /** Custom display for numeric columns, including animated values and selection totals. Sorting uses the raw numbers. */
  formatValue?: (value: number) => string;
};

export type DataTableRow = { id: string; [key: string]: string | number };

export type DataTableStatus = {
  label: string;
  tone: "positive" | "warning" | "negative" | "neutral";
  /** Sort order, lowest first when ascending. */
  rank: number;
};

export type DataTableAction = { id: string; label: string };

export type DataTableSortableProps = {
  title?: string;
  description?: string;
  columns?: DataTableColumn[];
  data?: DataTableRow[];
  /** Caps how many rows of `data` render. There is no virtualisation, so keep a page to a few hundred rows. */
  rows?: number;
  statuses?: Record<string, DataTableStatus>;
  defaultSort?: DataTableSort;
  density?: DataTableDensity;
  selectable?: boolean;
  resizable?: boolean;
  /** Pin the header and scroll the rows inside `maxHeight`. Off, the table grows to fit every row. */
  stickyHeader?: boolean;
  maxHeight?: number;
  /** Buttons on the floating selection bar. */
  bulkActions?: DataTableAction[];
  emptyLabel?: string;
  locale?: string;
  currency?: string;
  /** The one colour: selection, the resize guide and the bar's figure. */
  accent?: string;
  theme?: "dark" | "light";
  onSortChange?: (sort: DataTableSort) => void;
  onSelectionChange?: (ids: string[]) => void;
  onDensityChange?: (density: DataTableDensity) => void;
  onColumnResize?: (key: string, width: number) => void;
  onBulkAction?: (actionId: string, ids: string[]) => void;
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    stage: "#000000",
    card: "#0b0b0c",
    ink: "#f4f4f5",
    bar: "#1c1c1f",
    barInk: "#f4f4f5",
    shadow: "inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.05), 0 48px 96px -48px rgba(0,0,0,0.95)",
    barShadow: "inset 0 0 0 1px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.08), 0 18px 40px -12px rgba(0,0,0,0.85)",
    tones: { positive: "#4ade80", warning: "#fbbf24", negative: "#f87171", neutral: "#71717a" },
  },
  light: {
    stage: "#f4f4f5",
    card: "#ffffff",
    ink: "#111113",
    bar: "#111113",
    barInk: "#fafafa",
    shadow: "inset 0 0 0 1px rgba(17,17,19,0.08), 0 1px 2px rgba(17,17,19,0.05), 0 48px 96px -48px rgba(17,17,19,0.3)",
    barShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 18px 40px -12px rgba(17,17,19,0.5)",
    tones: { positive: "#16a34a", warning: "#d97706", negative: "#dc2626", neutral: "#a1a1aa" },
  },
} as const;

const DEFAULT_ACCENT = "#5e9eff";
const EASE = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;
/** Rows travel a long way when the sort flips, so a little softer than the UI spring. */
const SPRING_TRAVEL = { type: "spring", stiffness: 340, damping: 36, mass: 0.9 } as const;

const ROW_H: Record<DataTableDensity, string> = { compact: "h-9", regular: "h-[52px]" };
const HEADER_H = 40;
const SELECT_W = 48;
/** Shift + ← / → on a header resizes its column by this much. */
const KEY_RESIZE_STEP = 16;
const PAGE_STEP = 10;
/** Rows past this one enter together rather than waiting their turn. */
const STAGGER_CAP = 12;

/** One timeline, in seconds: the card, its head, the column labels, then the rows top to bottom. */
const T = { card: 0, head: 0.08, thead: 0.14, rows: 0.2, rowStep: 0.035, spot: 0.55, count: 0.1 } as const;

/* Colour helpers, written out in full so Tailwind sees every class. */
const INK = {
  90: "text-[color-mix(in_srgb,var(--dt-ink)_90%,transparent)]",
  75: "text-[color-mix(in_srgb,var(--dt-ink)_75%,transparent)]",
  60: "text-[color-mix(in_srgb,var(--dt-ink)_65%,transparent)]",
  45: "text-[color-mix(in_srgb,var(--dt-ink)_65%,transparent)]",
  38: "text-[color-mix(in_srgb,var(--dt-ink)_65%,transparent)]",
} as const;
const HAIRLINE = "border-[color-mix(in_srgb,var(--dt-ink)_7%,transparent)]";
const FOCUS_RING =
  "outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color-mix(in_srgb,var(--dt-ink)_85%,transparent)]";

/* ------------------------------------------------------------------ */
/* Demo data: a studio's last 90 days of invoices                      */
/* ------------------------------------------------------------------ */

const DEFAULT_COLUMNS: DataTableColumn[] = [
  { key: "number", header: "Invoice", kind: "mono", width: 116, minWidth: 96 },
  { key: "client", header: "Client", kind: "entity", width: 232, minWidth: 160, maxWidth: 420 },
  { key: "issued", header: "Issued", kind: "date", width: 116, minWidth: 92 },
  { key: "status", header: "Status", kind: "status", width: 124, minWidth: 104 },
  { key: "amount", header: "Amount", kind: "currency", width: 136, minWidth: 112 },
];

const DEFAULT_STATUSES: Record<string, DataTableStatus> = {
  overdue: { label: "Overdue", tone: "negative", rank: 0 },
  due: { label: "Due", tone: "warning", rank: 1 },
  draft: { label: "Draft", tone: "neutral", rank: 2 },
  paid: { label: "Paid", tone: "positive", rank: 3 },
};

const DEFAULT_ACTIONS: DataTableAction[] = [
  { id: "remind", label: "Send reminder" },
  { id: "export", label: "Export CSV" },
];

const CLIENTS = [
  "Harbour & Finch",
  "Odd Lot Coffee",
  "Ninefold Labs",
  "Marlowe Press",
  "Tessellate",
  "Brightwater Clinic",
  "Kiln & Co.",
  "Quarry Atlas",
  "Saltmarsh Records",
  "Fernhill Bakery",
  "Lumen Grid",
  "Cobalt Ferry",
  "Westbrook Hotels",
  "Foxglove Games",
  "Meridian Tea",
  "Halcyon Bikes",
  "Thistle Legal",
  "Arden Mobility",
];

/** mulberry32: the same "random" ledger on the server and in every browser. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** "Today" for the demo ledger, fixed so statuses read the same on every visit. */
const LEDGER_TODAY = Date.UTC(2026, 9, 2);
const DAY_MS = 86_400_000;

function buildInvoices(count: number): DataTableRow[] {
  const rand = seeded(2084);
  return Array.from({ length: count }, (_, i) => {
    const daysAgo = Math.round(i * 2.25 + rand() * 1.8);
    const issued = new Date(LEDGER_TODAY - daysAgo * DAY_MS).toISOString().slice(0, 10);
    // Skewed towards small jobs, with the odd big retainer; priced in fives, sometimes with cents.
    const amount = Math.round((640 + rand() ** 2.2 * 46_000) / 5) * 5 + (rand() < 0.28 ? 0.5 : 0);
    const roll = rand();
    const status = i < 2 ? "draft" : daysAgo < 30 ? (roll < 0.2 ? "paid" : "due") : roll < 0.2 ? "overdue" : "paid";
    return {
      id: `inv-${2084 - i}`,
      number: `INV-${2084 - i}`,
      client: CLIENTS[(i * 7 + Math.floor(rand() * 3)) % CLIENTS.length],
      issued,
      status,
      amount,
    };
  });
}

const DEFAULT_INVOICES = buildInvoices(40);

/* ------------------------------------------------------------------ */
/* Pure helpers                                                        */
/* ------------------------------------------------------------------ */

const isFigure = (kind: DataTableColumnKind | undefined) => kind === "currency" || kind === "number";
const firstDirection = (col: DataTableColumn): SortDirection =>
  col.firstSort ?? (isFigure(col.kind) || col.kind === "date" ? "descending" : "ascending");

function initials(name: string) {
  const words = name.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
  return (words[0]?.[0] ?? "") + (words[1]?.[0] ?? "");
}

function compareRows(a: DataTableRow, b: DataTableRow, col: DataTableColumn, statuses: Record<string, DataTableStatus>, collator: Intl.Collator) {
  const x = a[col.key];
  const y = b[col.key];
  if (col.kind === "status") return (statuses[String(x)]?.rank ?? 99) - (statuses[String(y)]?.rank ?? 99);
  if (typeof x === "number" && typeof y === "number") return x - y;
  return collator.compare(String(x ?? ""), String(y ?? ""));
}

type Layout = { template: string; total: number; widths: Record<string, number> };

/**
 * Columns the person resized keep their width. The rest share what is left of the container,
 * shrinking towards their minimum (never growing past their preference); the last column takes
 * any spare room so figures sit on the right edge. If it still doesn't fit, the table scrolls.
 */
function computeLayout(columns: DataTableColumn[], selectable: boolean, container: number, user: Record<string, number>): Layout {
  const selectW = selectable ? SELECT_W : 0;
  const pref = (c: DataTableColumn) => c.width ?? 140;
  const sumUser = columns.reduce((s, c) => s + (user[c.key] ?? 0), 0);
  const sumFree = columns.reduce((s, c) => s + (user[c.key] == null ? pref(c) : 0), 0);
  const fit = container > 0 && sumFree > 0 ? Math.min(1, Math.max(0, (container - selectW - sumUser) / sumFree)) : 1;
  const widths: Record<string, number> = {};
  for (const c of columns) widths[c.key] = user[c.key] ?? Math.max(c.minWidth ?? 80, Math.round(pref(c) * fit));
  const tracks = columns.map((c, i) => (i === columns.length - 1 ? `minmax(${widths[c.key]}px,1fr)` : `${widths[c.key]}px`));
  if (selectable) tracks.unshift(`${SELECT_W}px`);
  return { template: tracks.join(" "), total: selectW + columns.reduce((s, c) => s + widths[c.key], 0), widths };
}

function splitAmount(fmt: Intl.NumberFormat, n: number): [string, string] {
  const parts = fmt.formatToParts(n);
  const cut = parts.findIndex((p) => p.type === "decimal");
  if (cut < 0) return [parts.map((p) => p.value).join(""), ""];
  return [
    parts
      .slice(0, cut)
      .map((p) => p.value)
      .join(""),
    parts
      .slice(cut)
      .map((p) => p.value)
      .join(""),
  ];
}

function inkOn(hex: string) {
  const v = hex.replace("#", "");
  const full = v.length === 3 ? [...v].map((c) => c + c).join("") : v.slice(0, 6);
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#0a0a0b" : "#ffffff";
}

/** useLayoutEffect in the browser, useEffect on the server (no warning). */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Keeps the latest value of a prop or state in a ref, for stable handlers. */
function useLatest<V>(value: V) {
  const ref = useRef(value);
  useIsoLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

type Formatters = { money: Intl.NumberFormat; number: Intl.NumberFormat; date: Intl.DateTimeFormat; count: Intl.NumberFormat };

function useFormatters(locale: string, currency: string): Formatters {
  return useMemo(
    () => ({
      money: new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      number: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }),
      date: new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }),
      count: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
    }),
    [locale, currency],
  );
}

/* ------------------------------------------------------------------ */
/* Motion                                                              */
/* ------------------------------------------------------------------ */

/** Rise out of a blur; `custom` is the start time. The filter is dropped at rest. */
const rise: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(6px)" },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: EASE, delay },
    transitionEnd: { filter: "none" },
  }),
};
const cardIn: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(8px)" },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: EASE, delay },
    transitionEnd: { filter: "none" },
  }),
};
const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
};

/**
 * A figure that counts to its value (from zero on first view, from where it was after that)
 * by writing straight to two spans: no React render per frame. The fraction is set quieter.
 */
function Figure({
  value,
  format,
  run,
  delay = 0,
  reduce,
  fractionClassName = "",
}: {
  value: number;
  format: (n: number) => [string, string];
  run: boolean;
  delay?: number;
  reduce: boolean;
  fractionClassName?: string;
}) {
  const mv = useMotionValue(0);
  const whole = useRef<HTMLSpanElement>(null);
  const frac = useRef<HTMLSpanElement>(null);
  const formatRef = useLatest(format);

  useIsoLayoutEffect(() => {
    const paint = (n: number) => {
      const [w, f] = formatRef.current(n);
      if (whole.current) whole.current.textContent = w;
      if (frac.current) frac.current.textContent = f;
    };
    paint(mv.get());
    return mv.on("change", paint);
  }, [mv, formatRef, format]);

  useEffect(() => {
    if (!run) return;
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: 0.6, ease: EASE, delay });
    return () => controls.stop();
  }, [run, value, reduce, delay, mv]);

  const [w0, f0] = format(0);
  return (
    <>
      <span ref={whole}>{w0}</span>
      {f0 !== "" && (
        <span ref={frac} className={fractionClassName}>
          {f0}
        </span>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Small parts                                                         */
/* ------------------------------------------------------------------ */

function Checkmark({ state }: { state: "on" | "off" | "mixed" }) {
  return (
    <span
      aria-hidden="true"
      className={`relative grid size-4 place-items-center rounded-[5px] transition-[background-color,box-shadow] duration-150 ${
        state === "off"
          ? "shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--dt-ink)_26%,transparent)] group-hover/check:shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--dt-ink)_48%,transparent)]"
          : "bg-[var(--dt-accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
      }`}
    >
      <svg viewBox="0 0 16 16" className="size-3.5 text-[var(--dt-on-accent)]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <motion.path
          d={state === "mixed" ? "M4.5 8h7" : "M4 8.4l2.6 2.6L12 5.4"}
          initial={false}
          animate={{ pathLength: state === "off" ? 0 : 1, opacity: state === "off" ? 0 : 1 }}
          transition={{ pathLength: { duration: 0.22, ease: EASE }, opacity: { duration: 0.08 } }}
        />
      </svg>
    </span>
  );
}

function StatusCell({ status, tone }: { status: DataTableStatus | undefined; tone: string }) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 text-[13.5px] ${INK[75]}`}>
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: tone, boxShadow: `0 0 0 3px color-mix(in srgb, ${tone} 16%, transparent)` }} />
      <span className="truncate">{status?.label ?? "Unknown"}</span>
    </span>
  );
}

function EntityCell({ name }: { name: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        className={`grid size-6 shrink-0 place-items-center rounded-[7px] bg-[color-mix(in_srgb,var(--dt-ink)_7%,transparent)] font-mono text-[9.5px] font-semibold tracking-[0.02em] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--dt-ink)_8%,transparent)] ${INK[75]}`}
      >
        {initials(name)}
      </span>
      <span className={`truncate text-[14px] font-medium tracking-[-0.005em] ${INK[90]}`}>{name}</span>
    </span>
  );
}

function DensitySwitch({ value, onChange, uid }: { value: DataTableDensity; onChange: (d: DataTableDensity) => void; uid: string }) {
  const options: DataTableDensity[] = ["compact", "regular"];
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const next = value === "compact" ? "regular" : "compact";
    onChange(next);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label="Row density"
      className="inline-grid shrink-0 grid-cols-2 rounded-[10px] bg-[color-mix(in_srgb,var(--dt-ink)_4%,transparent)] p-[3px] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--dt-ink)_7%,transparent)]"
    >
      {options.map((d) => {
        const on = d === value;
        return (
          <button
            key={d}
            ref={(el) => {
              refs.current[d] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            data-demo={`density-${d}`}
            onClick={() => onChange(d)}
            onKeyDown={onKey}
            className={`[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 relative h-8 min-w-[76px] rounded-[7px] px-3 text-[12.5px] font-medium capitalize transition-[color,transform] duration-150 active:scale-[0.97] ${FOCUS_RING} ${
              on ? "text-[var(--dt-ink)]" : `${INK[45]} hover:text-[color-mix(in_srgb,var(--dt-ink)_80%,transparent)]`
            }`}
          >
            {on && (
              <motion.span
                layoutId={`${uid}-density`}
                transition={SPRING_UI}
                aria-hidden="true"
                className="absolute inset-0 rounded-[7px] bg-[color-mix(in_srgb,var(--dt-ink)_10%,transparent)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--dt-ink)_8%,transparent)]"
              />
            )}
            <span className="relative">{d}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Row                                                                 */
/* ------------------------------------------------------------------ */

type CardSlot = "title" | "value" | "meta";

/** Classes that fold a row into a card under 520px of container width. */
const CARD = {
  row: "@max-[520px]:flex @max-[520px]:h-auto @max-[520px]:flex-wrap @max-[520px]:items-center @max-[520px]:pb-3 @max-[520px]:pt-1",
  select: "@max-[520px]:order-0 @max-[520px]:h-11 @max-[520px]:w-11",
  title: "@max-[520px]:order-1 @max-[520px]:h-11 @max-[520px]:min-w-0 @max-[520px]:flex-1 @max-[520px]:px-0",
  value: "@max-[520px]:order-2 @max-[520px]:h-11 @max-[520px]:pl-3 @max-[520px]:pr-4",
  meta: "@max-[520px]:order-4 @max-[520px]:h-auto @max-[520px]:px-0 @max-[520px]:pr-4 @max-[520px]:text-[12.5px]",
  break: "hidden @max-[520px]:order-3 @max-[520px]:block @max-[520px]:h-0 @max-[520px]:basis-full",
  indent: "hidden @max-[520px]:order-3 @max-[520px]:block @max-[520px]:w-11 @max-[520px]:shrink-0",
  noIndent: "hidden @max-[520px]:order-3 @max-[520px]:block @max-[520px]:w-4 @max-[520px]:shrink-0",
} as const;

type RowProps = {
  row: DataTableRow;
  index: number;
  columns: DataTableColumn[];
  slots: CardSlot[];
  selectable: boolean;
  selected: boolean;
  density: DataTableDensity;
  activeCol: number;
  revealed: boolean;
  delay: number;
  reduce: boolean;
  fmt: Formatters;
  statuses: Record<string, DataTableStatus>;
  tones: Record<DataTableStatus["tone"], string>;
  sortedKey: string | null;
  registerRow: (index: number, el: HTMLElement | null) => void;
  registerCell: (key: string, el: HTMLElement | null) => void;
  onCheckDown: (e: ReactPointerEvent<HTMLElement>, index: number) => void;
  onCheckMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onCheckUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onCheckClick: (index: number) => void;
  onRowClick: (e: ReactMouseEvent<HTMLElement>, index: number) => void;
};

const Row = memo(function Row({
  row,
  index,
  columns,
  slots,
  selectable,
  selected,
  density,
  activeCol,
  revealed,
  delay,
  reduce,
  fmt,
  statuses,
  tones,
  sortedKey,
  registerRow,
  registerCell,
  onCheckDown,
  onCheckMove,
  onCheckUp,
  onCheckClick,
  onRowClick,
}: RowProps) {
  const r = index + 1;
  const offset = selectable ? 1 : 0;
  const tab = (c: number) => (activeCol === c ? 0 : -1);
  const money = useCallback((n: number) => splitAmount(fmt.money, n), [fmt]);
  const plain = useCallback((n: number): [string, string] => [fmt.number.format(n), ""], [fmt]);

  const renderValue = (col: DataTableColumn): ReactNode => {
    const v = row[col.key];
    switch (col.kind) {
      case "entity":
        return <EntityCell name={String(v)} />;
      case "mono":
        return <span className={`truncate font-mono text-[12.5px] tracking-[0.01em] ${INK[60]}`}>{v}</span>;
      case "date":
        return (
          <time dateTime={String(v)} className={`truncate text-[13.5px] tabular-nums ${INK[75]}`}>
            {fmt.date.format(new Date(`${v}T00:00:00Z`))}
          </time>
        );
      case "status": {
        const s = statuses[String(v)];
        return <StatusCell status={s} tone={tones[s?.tone ?? "neutral"]} />;
      }
      case "currency":
      case "number":
        return (
          <span className={`whitespace-nowrap text-[14px] font-medium tabular-nums tracking-[-0.01em] ${INK[90]}`}>
            <span className="sr-only">{col.formatValue ? col.formatValue(Number(v)) : col.kind === "currency" ? fmt.money.format(Number(v)) : fmt.number.format(Number(v))}</span>
            <span aria-hidden="true">
              <Figure
                value={Number(v)}
                format={col.formatValue ? (n): [string, string] => [col.formatValue!(n), ""] : col.kind === "currency" ? money : plain}
                run={revealed}
                delay={delay + T.count}
                reduce={reduce}
                fractionClassName={INK[38]}
              />
            </span>
          </span>
        );
      default:
        return <span className={`truncate text-[14px] ${INK[90]}`}>{v}</span>;
    }
  };

  return (
    <motion.div
      ref={(el: HTMLDivElement | null) => registerRow(index, el)}
      role="row"
      aria-rowindex={r + 1}
      aria-selected={selectable ? selected : undefined}
      data-selected={selected}
      layout={reduce ? false : "position"}
      transition={{ layout: SPRING_TRAVEL }}
      variants={reduce ? fade : rise}
      custom={delay}
      exit={{ opacity: 0, transition: { duration: 0.16, ease: EASE_IN } }}
      onClick={(e: ReactMouseEvent<HTMLDivElement>) => onRowClick(e, index)}
      className={`relative grid [grid-template-columns:var(--dt-cols)] border-b ${HAIRLINE} ${ROW_H[density]} transition-[background-color,height] duration-150 hover:bg-[color-mix(in_srgb,var(--dt-ink)_3%,transparent)] data-[selected=true]:bg-[color-mix(in_srgb,var(--dt-accent)_11%,transparent)] data-[selected=true]:hover:bg-[color-mix(in_srgb,var(--dt-accent)_15%,transparent)] ${CARD.row}`}
    >
      {selectable && (
        <div role="gridcell" aria-colindex={1} className={`flex items-center justify-center ${CARD.select}`}>
          <span
            ref={(el) => registerCell(`${r}:0`, el)}
            role="checkbox"
            aria-checked={selected}
            aria-label={`Select ${row[columns.find((c) => c.kind === "entity")?.key ?? columns[0].key]} ${row[columns.find((c) => c.kind === "mono")?.key ?? "id"] ?? ""}`.trim()}
            tabIndex={tab(0)}
            data-cell={`${r}:0`}
            data-demo={`select-${r}`}
            onPointerDown={(e) => onCheckDown(e, index)}
            onPointerMove={onCheckMove}
            onPointerUp={onCheckUp}
            onPointerCancel={onCheckUp}
            onClick={(e) => {
              e.stopPropagation();
              onCheckClick(index);
            }}
            className={`group/check grid size-11 cursor-pointer touch-none place-items-center rounded-[10px] ${FOCUS_RING}`}
          >
            <Checkmark state={selected ? "on" : "off"} />
          </span>
        </div>
      )}
      {columns.map((col, i) => {
        const c = i + offset;
        const slot = slots[i];
        const right = isFigure(col.kind);
        return (
          <div
            key={col.key}
            ref={(el) => registerCell(`${r}:${c}`, el)}
            role="gridcell"
            aria-colindex={c + 1}
            tabIndex={tab(c)}
            data-cell={`${r}:${c}`}
            data-sorted={sortedKey === col.key || undefined}
            className={`flex min-w-0 items-center px-3 ${right ? "justify-end text-right" : ""} ${FOCUS_RING} ${CARD[slot]}`}
          >
            {renderValue(col)}
          </div>
        );
      })}
      <span aria-hidden="true" className={CARD.break} />
      <span aria-hidden="true" className={selectable ? CARD.indent : CARD.noIndent} />
    </motion.div>
  );
});

/* ------------------------------------------------------------------ */
/* Table                                                               */
/* ------------------------------------------------------------------ */

type Cell = { r: number; c: number };
type Sweep = { start: number; last: number; mode: "add" | "remove"; base: Set<string> };
type Drag = { key: string; min: number; max: number; startX: number; startW: number; width: number };

export function DataTableSortable(props: DataTableSortableProps) {
  if (props.columns?.length === 0) {
    const p = PALETTE[props.theme ?? "dark"];
    return <section className={`w-full rounded-[20px] p-6 font-sans ${props.className ?? ""}`} style={{ background: p.card, color: p.ink, boxShadow: p.shadow }}><h2 className="text-base font-medium">{props.title ?? "Data table"}</h2><p role="status" className="mt-2 text-sm">{props.emptyLabel ?? "No columns to display."}</p></section>;
  }
  return <SortableTableWithColumns {...props} />;
}

function SortableTableWithColumns({
  title = "Invoices",
  description = "Ferro Studio · last 90 days",
  columns = DEFAULT_COLUMNS,
  data = DEFAULT_INVOICES,
  rows,
  statuses = DEFAULT_STATUSES,
  defaultSort = { key: "issued", direction: "descending" },
  density: densityProp = "regular",
  selectable = true,
  resizable = true,
  stickyHeader = true,
  maxHeight = 440,
  bulkActions = DEFAULT_ACTIONS,
  emptyLabel = "No invoices yet. The first one always feels the best.",
  locale = "en-US",
  currency = "USD",
  accent = DEFAULT_ACCENT,
  theme = "dark",
  onSortChange,
  onSelectionChange,
  onDensityChange,
  onColumnResize,
  onBulkAction,
  className = "",
}: DataTableSortableProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId();
  const palette = PALETTE[theme];
  const fmt = useFormatters(locale, currency);
  const collator = useMemo(() => new Intl.Collator(locale, { numeric: true, sensitivity: "base" }), [locale]);

  const rootRef = useRef<HTMLElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const guideLabelRef = useRef<HTMLSpanElement>(null);
  const revealed = useInView(rootRef, { once: true, amount: 0.2 });

  /* ---------- state ---------- */
  const [sort, setSort] = useState<DataTableSort>(defaultSort);
  const [density, setDensity] = useState<DataTableDensity>(densityProp);
  useEffect(() => setDensity(densityProp), [densityProp]);
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [userWidths, setUserWidths] = useState<Record<string, number>>({});
  const [containerW, setContainerW] = useState(0);
  const [active, setActive] = useState<Cell>({ r: 1, c: 0 });
  const [scrolled, setScrolled] = useState(false);
  const [resizingKey, setResizingKey] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // Rows that mount after the first reveal (the rows slider, new data) fade in without the stagger.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!revealed) return;
    const id = window.setTimeout(() => setSettled(true), 1700);
    return () => window.clearTimeout(id);
  }, [revealed]);

  /* ---------- derived ---------- */
  const visible = useMemo(() => (rows == null ? data : data.slice(0, Math.max(0, rows))), [data, rows]);
  const sortCol = sort ? columns.find((c) => c.key === sort.key) ?? null : null;
  const sorted = useMemo(() => {
    if (!sortCol || !sort) return visible;
    const sign = sort.direction === "ascending" ? 1 : -1;
    return visible
      .map((row, i) => ({ row, i }))
      .sort((a, b) => compareRows(a.row, b.row, sortCol, statuses, collator) * sign || a.i - b.i)
      .map((x) => x.row);
  }, [visible, sortCol, sort, statuses, collator]);

  const offset = selectable ? 1 : 0;
  const colCount = columns.length + offset;
  const layout = useMemo(() => computeLayout(columns, selectable, containerW, userWidths), [columns, selectable, containerW, userWidths]);
  const slots = useMemo<CardSlot[]>(() => {
    const title = Math.max(0, columns.findIndex((c) => c.kind === "entity" || c.kind === "text"));
    let value = -1;
    columns.forEach((c, i) => {
      if (isFigure(c.kind)) value = i;
    });
    return columns.map((_, i) => (i === title ? "title" : i === value ? "value" : "meta"));
  }, [columns]);
  const selectedRows = useMemo(() => sorted.filter((r) => selection.has(r.id)), [sorted, selection]);
  const figureColumn = [...columns].reverse().find((c) => isFigure(c.kind));
  const figureKey = figureColumn?.key;
  const selectedSum = figureKey ? selectedRows.reduce((s, r) => s + Number(r[figureKey] ?? 0), 0) : 0;
  const allState: "on" | "off" | "mixed" = selectedRows.length === 0 ? "off" : selectedRows.length === sorted.length ? "on" : "mixed";

  const tones = palette.tones;
  const vars = {
    "--dt-card": palette.card,
    "--dt-ink": palette.ink,
    "--dt-accent": accent,
    "--dt-on-accent": inkOn(accent),
    "--dt-bar": palette.bar,
    "--dt-bar-ink": palette.barInk,
    "--dt-shadow": palette.shadow,
    "--dt-bar-shadow": palette.barShadow,
    "--dt-max-h": `${maxHeight}px`,
  } as CSSProperties;

  /* ---------- refs the handlers read ---------- */
  const sortedRef = useLatest(sorted);
  const selectionRef = useLatest(selection);
  const activeRef = useLatest(active);
  const callbacks = useLatest({ onSelectionChange, onColumnResize, onSortChange });
  const anchor = useRef<string | null>(null);
  const sweep = useRef<Sweep | null>(null);
  const swallowClick = useRef(false);
  const drag = useRef<Drag | null>(null);
  const focusPending = useRef(false);
  const rowEls = useRef(new Map<number, HTMLElement>());
  const cellEls = useRef(new Map<string, HTMLElement>());
  const headEls = useRef(new Map<string, HTMLElement>());

  const registerRow = useCallback((i: number, el: HTMLElement | null) => {
    if (el) rowEls.current.set(i, el);
    else rowEls.current.delete(i);
  }, []);
  const registerCell = useCallback((key: string, el: HTMLElement | null) => {
    if (el) cellEls.current.set(key, el);
    else cellEls.current.delete(key);
  }, []);

  /* ---------- container width ---------- */
  useIsoLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerW(el.clientWidth));
    ro.observe(el);
    setContainerW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  /* ---------- selection ---------- */
  const commit = useCallback(
    (next: Set<string>) => {
      selectionRef.current = next;
      setSelection(next);
      callbacks.current.onSelectionChange?.([...next]);
      setAnnouncement(next.size ? `${next.size} selected` : "Selection cleared");
    },
    [selectionRef, callbacks],
  );

  const rangeIds = useCallback(
    (from: number, to: number) =>
      sortedRef.current.slice(Math.min(from, to), Math.max(from, to) + 1).map((r) => r.id),
    [sortedRef],
  );

  const applyRange = useCallback(
    (base: Set<string>, from: number, to: number, mode: "add" | "remove") => {
      const next = new Set(base);
      for (const id of rangeIds(from, to)) {
        if (mode === "add") next.add(id);
        else next.delete(id);
      }
      return next;
    },
    [rangeIds],
  );

  const indexOf = useCallback((id: string | null) => (id ? sortedRef.current.findIndex((r) => r.id === id) : -1), [sortedRef]);

  const toggleRow = useCallback(
    (index: number) => {
      const row = sortedRef.current[index];
      if (!row) return;
      const next = new Set(selectionRef.current);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      anchor.current = row.id;
      commit(next);
    },
    [sortedRef, selectionRef, commit],
  );

  const selectRangeTo = useCallback(
    (index: number) => {
      const from = indexOf(anchor.current);
      commit(applyRange(selectionRef.current, from < 0 ? index : from, index, "add"));
    },
    [indexOf, applyRange, selectionRef, commit],
  );

  const toggleAll = useCallback(() => {
    const ids = sortedRef.current.map((r) => r.id);
    const all = ids.every((id) => selectionRef.current.has(id));
    commit(all ? new Set() : new Set(ids));
  }, [sortedRef, selectionRef, commit]);

  /** Which row is under the pointer, clamped to the first and last. */
  const rowAtY = useCallback((y: number) => {
    let best = -1;
    let bestDist = Infinity;
    for (const [i, el] of rowEls.current) {
      const r = el.getBoundingClientRect();
      if (y >= r.top && y < r.bottom) return i;
      const d = Math.min(Math.abs(y - r.top), Math.abs(y - r.bottom));
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }, []);

  // Press on a checkbox and sweep across others to (de)select the run; shift-click extends from the anchor.
  const onCheckDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>, index: number) => {
      if (e.button !== 0) return;
      swallowClick.current = true;
      setActive({ r: index + 1, c: 0 });
      if (e.shiftKey && anchor.current) {
        e.preventDefault();
        selectRangeTo(index);
        return;
      }
      const id = sortedRef.current[index]?.id;
      if (!id) return;
      const mode = selectionRef.current.has(id) ? "remove" : "add";
      const base = new Set(selectionRef.current);
      sweep.current = { start: index, last: index, mode, base };
      commit(applyRange(base, index, index, mode));
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [sortedRef, selectionRef, commit, applyRange, selectRangeTo],
  );

  const onCheckMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const s = sweep.current;
      if (!s) return;
      const i = rowAtY(e.clientY);
      if (i < 0 || i === s.last) return;
      s.last = i;
      commit(applyRange(s.base, s.start, i, s.mode));
    },
    [rowAtY, commit, applyRange],
  );

  const onCheckUp = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const s = sweep.current;
      if (!s) return;
      anchor.current = sortedRef.current[s.start]?.id ?? null;
      sweep.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    },
    [sortedRef],
  );

  // Pointer presses are handled on pointerdown; this catches clicks from assistive tech.
  const onCheckClick = useCallback(
    (index: number) => {
      if (swallowClick.current) {
        swallowClick.current = false;
        return;
      }
      toggleRow(index);
    },
    [toggleRow],
  );

  const onRowClick = useCallback(
    (e: ReactMouseEvent<HTMLElement>, index: number) => {
      if (!selectable || !e.shiftKey) return;
      e.preventDefault();
      window.getSelection()?.removeAllRanges();
      selectRangeTo(index);
    },
    [selectable, selectRangeTo],
  );

  /* ---------- sorting ---------- */
  const sortBy = useCallback(
    (col: DataTableColumn) => {
      const first = firstDirection(col);
      const flip: SortDirection = first === "ascending" ? "descending" : "ascending";
      const next: DataTableSort =
        sort?.key !== col.key ? { key: col.key, direction: first } : sort.direction === first ? { key: col.key, direction: flip } : null;
      setSort(next);
      callbacks.current.onSortChange?.(next);
      setAnnouncement(next ? `Sorted by ${col.header}, ${next.direction}` : "Sort cleared");
    },
    [sort, callbacks],
  );

  /* ---------- spotlight on the sorted column, and the resize guide ---------- */
  const spotX = useMotionValue(0);
  const spotW = useMotionValue(0);
  const spotO = useMotionValue(0);
  const guideX = useMotionValue(0);
  const spotPlaced = useRef(false);

  const measureSpot = useCallback(
    (instant: boolean) => {
      const el = sort ? headEls.current.get(sort.key) : undefined;
      if (!el || !el.offsetWidth) {
        animate(spotO, 0, { duration: reduce ? 0 : 0.2 });
        return;
      }
      const x = el.offsetLeft;
      const w = el.offsetWidth;
      if (instant || reduce || !spotPlaced.current) {
        spotX.set(x);
        spotW.set(w);
      } else {
        animate(spotX, x, SPRING_UI);
        animate(spotW, w, SPRING_UI);
      }
      spotPlaced.current = true;
      if (revealed) animate(spotO, 1, { duration: reduce ? 0.15 : 0.4, ease: EASE, delay: settled || reduce ? 0 : T.spot });
    },
    [sort, reduce, revealed, settled, spotX, spotW, spotO],
  );
  useIsoLayoutEffect(() => measureSpot(false), [measureSpot, layout.template, containerW]);

  const placeGuide = useCallback(
    (key: string, width: number) => {
      const el = headEls.current.get(key);
      if (el) guideX.set(el.offsetLeft + el.offsetWidth);
      if (guideLabelRef.current) guideLabelRef.current.textContent = `${Math.round(width)}px`;
    },
    [guideX],
  );

  /* ---------- column resizing ---------- */
  const widthOf = useCallback((key: string) => headEls.current.get(key)?.offsetWidth ?? layout.widths[key] ?? 0, [layout.widths]);

  const resizeTo = useCallback(
    (col: DataTableColumn, width: number) => {
      const w = Math.round(Math.min(col.maxWidth ?? 560, Math.max(col.minWidth ?? 80, width)));
      setUserWidths((u) => ({ ...u, [col.key]: w }));
      callbacks.current.onColumnResize?.(col.key, w);
      setAnnouncement(`${col.header} column ${w} pixels wide`);
    },
    [callbacks],
  );

  const onResizeDown = (e: ReactPointerEvent<HTMLElement>, col: DataTableColumn) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startW = widthOf(col.key);
    drag.current = { key: col.key, min: col.minWidth ?? 80, max: col.maxWidth ?? 560, startX: e.clientX, startW, width: startW };
    e.currentTarget.setPointerCapture(e.pointerId);
    setResizingKey(col.key);
    placeGuide(col.key, startW);
  };

  const onResizeMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    const grid = gridRef.current;
    if (!d || !grid) return;
    const w = Math.round(Math.min(d.max, Math.max(d.min, d.startW + e.clientX - d.startX)));
    if (w === d.width) return;
    d.width = w;
    // Live resize writes the template straight to the grid: no React render per pointer move.
    const live = computeLayout(columns, selectable, containerW, { ...userWidths, [d.key]: w });
    grid.style.setProperty("--dt-cols", live.template);
    grid.style.setProperty("--dt-min", `${live.total}px`);
    placeGuide(d.key, w);
    measureSpot(true);
  };

  const onResizeUp = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setResizingKey(null);
    const col = columns.find((c) => c.key === d.key);
    if (col && d.width !== d.startW) resizeTo(col, d.width);
  };

  const resetWidth = (col: DataTableColumn) => {
    setUserWidths((u) => {
      const next = { ...u };
      delete next[col.key];
      return next;
    });
    setAnnouncement(`${col.header} column reset`);
  };

  /* ---------- keyboard grid ---------- */
  const moveTo = useCallback(
    (r: number, c: number) => {
      focusPending.current = true;
      setActive({ r, c });
    },
    [],
  );

  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    const el = cellEls.current.get(`${active.r}:${active.c}`);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  // Keep the roving position on the grid when rows or columns come and go.
  useEffect(() => {
    setActive((a) => {
      const r = Math.min(a.r, sorted.length);
      const c = Math.min(a.c, colCount - 1);
      return r === a.r && c === a.c ? a : { r, c };
    });
  }, [sorted.length, colCount]);

  const onGridFocus = (e: ReactFocusEvent<HTMLDivElement>) => {
    const at = (e.target as HTMLElement).dataset.cell;
    if (!at) return;
    const [r, c] = at.split(":").map(Number);
    const a = activeRef.current;
    if (a.r !== r || a.c !== c) setActive({ r, c });
  };

  const onGridKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const { r, c } = activeRef.current;
    const maxR = sortedRef.current.length;
    const maxC = colCount - 1;
    const mod = e.metaKey || e.ctrlKey;
    const dataCol = c - offset >= 0 ? columns[c - offset] : undefined;
    let nr = r;
    let nc = c;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowLeft": {
        const dir = e.key === "ArrowRight" ? 1 : -1;
        if (e.shiftKey && r === 0 && resizable && dataCol && c - offset < columns.length - 1) {
          e.preventDefault();
          resizeTo(dataCol, widthOf(dataCol.key) + dir * KEY_RESIZE_STEP);
          return;
        }
        nc = Math.min(maxC, Math.max(0, c + dir));
        break;
      }
      case "ArrowDown":
      case "ArrowUp": {
        nr = Math.min(maxR, Math.max(0, r + (e.key === "ArrowDown" ? 1 : -1)));
        if (e.shiftKey && selectable && r >= 1 && nr >= 1) {
          if (!anchor.current) anchor.current = sortedRef.current[r - 1]?.id ?? null;
          selectRangeTo(nr - 1);
        }
        break;
      }
      case "Home":
        nc = 0;
        if (mod) nr = Math.min(1, maxR);
        break;
      case "End":
        nc = maxC;
        if (mod) nr = maxR;
        break;
      case "PageDown":
        nr = Math.min(maxR, r + PAGE_STEP);
        break;
      case "PageUp":
        nr = Math.max(r > 0 ? 1 : 0, r - PAGE_STEP);
        break;
      case " ":
        if (!selectable) return;
        if (r >= 1) toggleRow(r - 1);
        else if (c === 0) toggleAll();
        else return; // let a header's sort button take Space
        e.preventDefault();
        return;
      case "Escape":
        if (!selectionRef.current.size) return;
        commit(new Set());
        e.preventDefault();
        return;
      case "a":
      case "A":
        if (!mod || !selectable) return;
        e.preventDefault();
        commit(new Set(sortedRef.current.map((x) => x.id)));
        return;
      default:
        return;
    }
    e.preventDefault();
    moveTo(nr, nc);
  };

  /* ---------- bulk actions ---------- */
  const barVisible = selectable && selectedRows.length > 0;
  const money = useCallback((n: number): [string, string] =>
    figureColumn?.formatValue ? [figureColumn.formatValue(n), ""] : splitAmount(fmt.money, n),
  [fmt, figureColumn]);
  const count = useCallback((n: number): [string, string] => [fmt.count.format(n), ""], [fmt]);

  /* ---------- render ---------- */
  const sortableCols = columns.filter((c) => c.sortable !== false);
  const rowDelay = (i: number) => (settled ? 0 : T.rows + Math.min(i, STAGGER_CAP) * T.rowStep);
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;

  const sortArrow = (col: DataTableColumn, on: boolean) => (
    <motion.span
      aria-hidden="true"
      initial={false}
      animate={{ rotate: on && sort?.direction === "ascending" ? 180 : 0 }}
      transition={reduce ? { duration: 0 } : SPRING_UI}
      className={`inline-grid shrink-0 place-items-center transition-opacity duration-150 ${on ? "opacity-100" : "opacity-0 group-hover/sort:opacity-40"}`}
    >
      <ArrowDown className="size-3" strokeWidth={2.25} />
    </motion.span>
  );

  return (
    <motion.section
      ref={rootRef}
      aria-labelledby={titleId}
      aria-describedby={descId}
      style={vars}
      variants={reduce ? fade : cardIn}
      custom={T.card}
      initial="hidden"
      animate={revealed ? "show" : "hidden"}
      className={`@container relative w-full max-w-[1040px] overflow-hidden rounded-[16px] bg-[var(--dt-card)] font-sans text-[var(--dt-ink)] [box-shadow:var(--dt-shadow)] ${className}`}
    >
      {/* Head */}
      <motion.div variants={reduce ? fade : rise} custom={T.head} className={`flex items-center justify-between gap-4 border-b px-4 py-4 @[640px]:px-5 ${HAIRLINE}`}>
        <div className="min-w-0">
          <h2 id={titleId} className="font-display text-[17px] font-semibold leading-tight tracking-[-0.02em]">
            {title}
            <span className={`ml-2 font-mono text-[11px] font-normal tracking-[0.04em] tabular-nums ${INK[38]}`}>{sorted.length}</span>
          </h2>
          <p id={descId} className={`mt-1 truncate text-[13px] leading-snug ${INK[45]}`}>
            {description}
          </p>
        </div>
        <DensitySwitch
          uid={uid}
          value={density}
          onChange={(d) => {
            setDensity(d);
            onDensityChange?.(d);
          }}
        />
      </motion.div>

      {/* Narrow containers lose the column header, so sorting moves here. */}
      <motion.div
        variants={reduce ? fade : rise}
        custom={T.thead}
        className={`hidden items-center gap-1 overflow-x-auto border-b px-3 py-2 [scrollbar-width:none] @max-[520px]:flex ${HAIRLINE}`}
        role="group"
        aria-label="Sort by"
      >
        <span className={`mr-1 shrink-0 font-mono text-[10.5px] uppercase tracking-[0.08em] ${INK[38]}`}>Sort</span>
        {sortableCols.map((col) => {
          const on = sort?.key === col.key;
          return (
            <button
              key={col.key}
              type="button"
              aria-pressed={on}
              onClick={() => sortBy(col)}
              className={`[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 group/sort inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[8px] px-2.5 text-[12.5px] font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.97] ${FOCUS_RING} ${
                on ? "bg-[color-mix(in_srgb,var(--dt-ink)_8%,transparent)] text-[var(--dt-ink)]" : `${INK[45]} hover:text-[color-mix(in_srgb,var(--dt-ink)_80%,transparent)]`
              }`}
            >
              {col.header}
              {sortArrow(col, on)}
            </button>
          );
        })}
      </motion.div>

      {/* Table */}
      <div
        ref={scrollerRef}
        onScroll={(e) => {
          const s = e.currentTarget.scrollTop > 0;
          if (s !== scrolled) setScrolled(s);
        }}
        style={{ scrollPaddingTop: HEADER_H }}
        className={`relative overflow-x-auto [scrollbar-color:color-mix(in_srgb,var(--dt-ink)_18%,transparent)_transparent] [scrollbar-width:thin] ${
          stickyHeader ? "max-h-[var(--dt-max-h)] overflow-y-auto overscroll-contain" : ""
        }`}
      >
        <div
          ref={gridRef}
          role="grid"
          aria-labelledby={titleId}
          aria-describedby={descId}
          aria-rowcount={sorted.length + 1}
          aria-colcount={colCount}
          aria-multiselectable={selectable || undefined}
          onKeyDown={onGridKeyDown}
          onFocus={onGridFocus}
          style={{ "--dt-cols": layout.template, "--dt-min": `${layout.total}px` } as CSSProperties}
          className="relative min-w-[var(--dt-min)] @max-[520px]:min-w-0"
        >
          {/* The sorted column carries a faint spotlight that glides to the next one. */}
          <motion.div
            aria-hidden="true"
            style={{ x: spotX, width: spotW, opacity: spotO }}
            className="pointer-events-none absolute inset-y-0 left-0 z-0 bg-[color-mix(in_srgb,var(--dt-ink)_3.5%,transparent)] shadow-[inset_1px_0_0_color-mix(in_srgb,var(--dt-ink)_5%,transparent),inset_-1px_0_0_color-mix(in_srgb,var(--dt-ink)_5%,transparent)] @max-[520px]:hidden"
          />
          {resizable && (
            <motion.div
              aria-hidden="true"
              style={{ x: guideX }}
              className={`pointer-events-none absolute inset-y-0 left-0 z-30 w-px bg-[var(--dt-accent)] transition-opacity duration-150 @max-[520px]:hidden ${resizingKey ? "opacity-100" : "opacity-0"}`}
            />
          )}

          {/* Header row */}
          <motion.div
            role="rowgroup"
            variants={reduce ? fade : rise}
            custom={T.thead}
            className={`${stickyHeader ? "sticky top-0" : "relative"} z-20 @max-[520px]:hidden`}
          >
            <div
              role="row"
              aria-rowindex={1}
              data-scrolled={stickyHeader && scrolled}
              className={`grid h-10 [grid-template-columns:var(--dt-cols)] border-b bg-[var(--dt-card)] transition-shadow duration-200 data-[scrolled=true]:shadow-[0_14px_24px_-18px_rgba(0,0,0,0.75)] ${HAIRLINE}`}
            >
              {selectable && (
                <div role="columnheader" aria-colindex={1} className="flex items-center justify-center">
                  <span
                    ref={(el) => registerCell("0:0", el)}
                    role="checkbox"
                    aria-checked={allState === "on" ? true : allState === "mixed" ? "mixed" : false}
                    aria-label="Select all rows"
                    tabIndex={active.r === 0 && active.c === 0 ? 0 : -1}
                    data-cell="0:0"
                    data-demo="select-all"
                    onClick={toggleAll}
                    className={`group/check grid size-10 cursor-pointer place-items-center rounded-[10px] ${FOCUS_RING}`}
                  >
                    <Checkmark state={allState} />
                  </span>
                </div>
              )}
              {columns.map((col, i) => {
                const c = i + offset;
                const on = sort?.key === col.key;
                const right = isFigure(col.kind);
                const sortable = col.sortable !== false;
                const last = i === columns.length - 1;
                const tab = active.r === 0 && active.c === c ? 0 : -1;
                const label = (
                  <span className={`truncate font-mono text-[11px] uppercase tracking-[0.08em] transition-colors duration-150 ${on ? "text-[var(--dt-ink)]" : INK[45]}`}>
                    {col.header}
                  </span>
                );
                return (
                  <div
                    key={col.key}
                    ref={(el) => {
                      if (el) headEls.current.set(col.key, el);
                      else headEls.current.delete(col.key);
                    }}
                    role="columnheader"
                    aria-colindex={c + 1}
                    aria-sort={sortable ? (on && sort ? sort.direction : "none") : undefined}
                    className="relative flex min-w-0 items-center"
                  >
                    {sortable ? (
                      <button
                        ref={(el) => registerCell(`0:${c}`, el)}
                        type="button"
                        tabIndex={tab}
                        data-cell={`0:${c}`}
                        data-demo={`sort-${col.key}`}
                        onClick={() => sortBy(col)}
                        className={`[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 group/sort flex h-full w-full min-w-0 items-center gap-1.5 px-3 transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--dt-ink)_3%,transparent)] active:translate-y-px ${
                          right ? "flex-row-reverse justify-start" : ""
                        } ${FOCUS_RING}`}
                      >
                        {label}
                        {sortArrow(col, on)}
                      </button>
                    ) : (
                      <span
                        ref={(el) => registerCell(`0:${c}`, el)}
                        tabIndex={tab}
                        data-cell={`0:${c}`}
                        className={`flex h-full w-full items-center px-3 ${right ? "justify-end" : ""} ${FOCUS_RING}`}
                      >
                        {label}
                      </span>
                    )}
                    {resizable && !last && (
                      <ResizeHandle
                        col={col}
                        width={layout.widths[col.key]}
                        active={resizingKey === col.key}
                        onPointerDown={(e) => onResizeDown(e, col)}
                        onPointerMove={onResizeMove}
                        onPointerUp={onResizeUp}
                        onDoubleClick={() => resetWidth(col)}
                        labelRef={resizingKey === col.key ? guideLabelRef : undefined}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Body */}
          <div role="rowgroup" className="relative z-10 transition-[padding] duration-300" style={{ paddingBottom: barVisible ? 68 : 0 }}>
            <AnimatePresence>
              {sorted.map((row, i) => (
                <Row
                  key={row.id}
                  row={row}
                  index={i}
                  columns={columns}
                  slots={slots}
                  selectable={selectable}
                  selected={selection.has(row.id)}
                  density={density}
                  activeCol={active.r === i + 1 ? active.c : -1}
                  revealed={revealed}
                  delay={rowDelay(i)}
                  reduce={reduce}
                  fmt={fmt}
                  statuses={statuses}
                  tones={tones}
                  sortedKey={sort?.key ?? null}
                  registerRow={registerRow}
                  registerCell={registerCell}
                  onCheckDown={onCheckDown}
                  onCheckMove={onCheckMove}
                  onCheckUp={onCheckUp}
                  onCheckClick={onCheckClick}
                  onRowClick={onRowClick}
                />
              ))}
            </AnimatePresence>
            {sorted.length === 0 && (
              <div role="row">
                <div role="gridcell" className={`px-5 py-12 text-center text-[14px] ${INK[45]}`}>
                  {emptyLabel}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating selection bar */}
      <AnimatePresence>
        {barVisible && (
          <motion.div
            key="bar"
            role="region"
            aria-label="Selected rows"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: reduce ? 0.15 : 0.32, ease: EASE } }}
            exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: 10, filter: "blur(3px)", transition: { duration: 0.2, ease: EASE_IN } }}
            className="absolute inset-x-3 bottom-3 z-40 mx-auto flex h-12 w-fit max-w-[calc(100%-24px)] items-center gap-1 rounded-[13px] bg-[var(--dt-bar)] pl-4 pr-1.5 text-[var(--dt-bar-ink)] [box-shadow:var(--dt-bar-shadow)]"
          >
            <span className="flex shrink-0 items-baseline gap-1.5 text-[13.5px] tabular-nums">
              <span className="font-semibold">
                <Figure value={selectedRows.length} format={count} run reduce={reduce} />
              </span>
              <span className="text-[color-mix(in_srgb,var(--dt-bar-ink)_65%,transparent)]">selected</span>
            </span>
            {figureKey && (
              <>
                <span aria-hidden="true" className="mx-2.5 h-5 w-px shrink-0 bg-[color-mix(in_srgb,var(--dt-bar-ink)_14%,transparent)]" />
                <span className="flex shrink-0 items-baseline gap-2 text-[13.5px] font-medium tabular-nums">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-[color-mix(in_srgb,var(--dt-bar-ink)_65%,transparent)] @max-[520px]:hidden">Total</span>
                  <span className="text-[color-mix(in_srgb,var(--dt-accent)_70%,var(--dt-bar-ink))]">
                    <Figure value={selectedSum} format={money} run reduce={reduce} fractionClassName="opacity-55" />
                  </span>
                </span>
              </>
            )}
            <span aria-hidden="true" className="mx-1.5 h-5 w-px shrink-0 bg-[color-mix(in_srgb,var(--dt-bar-ink)_14%,transparent)] @max-[520px]:hidden" />
            {bulkActions.map((a, i) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onBulkAction?.(a.id, selectedRows.map((r) => r.id))}
                className={`[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 h-9 shrink-0 rounded-[9px] px-3 text-[13px] font-medium text-[color-mix(in_srgb,var(--dt-bar-ink)_85%,transparent)] transition-[background-color,color,transform] duration-150 hover:bg-[color-mix(in_srgb,var(--dt-bar-ink)_8%,transparent)] hover:text-[var(--dt-bar-ink)] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--dt-bar-ink)] ${
                  i > 0 ? "@max-[520px]:hidden" : "@max-[420px]:hidden"
                }`}
              >
                {a.label}
              </button>
            ))}
            <button
              type="button"
              aria-label="Clear selection"
              onClick={() => commit(new Set())}
              className="[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 grid size-9 shrink-0 place-items-center rounded-[9px] text-[color-mix(in_srgb,var(--dt-bar-ink)_65%,transparent)] transition-[background-color,color,transform] duration-150 hover:bg-[color-mix(in_srgb,var(--dt-bar-ink)_8%,transparent)] hover:text-[var(--dt-bar-ink)] active:scale-[0.95] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--dt-bar-ink)]"
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </motion.section>
  );
}

function ResizeHandle({
  col,
  width,
  active,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onDoubleClick,
  labelRef,
}: {
  col: DataTableColumn;
  width: number;
  active: boolean;
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onDoubleClick: () => void;
  labelRef?: Ref<HTMLSpanElement>;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${col.header} column. With the header focused, Shift and the arrow keys resize it.`}
      aria-valuenow={width}
      aria-valuemin={col.minWidth ?? 80}
      aria-valuemax={col.maxWidth ?? 560}
      data-demo={`resize-${col.key}`}
      data-active={active}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      className="group/handle absolute -right-[6px] top-0 z-10 flex h-full w-[12px] cursor-col-resize touch-none justify-center"
    >
      <span
        aria-hidden="true"
        className="mt-[13px] h-[14px] w-px bg-[color-mix(in_srgb,var(--dt-ink)_14%,transparent)] transition-[background-color,height,margin] duration-150 group-hover/handle:mt-[8px] group-hover/handle:h-[24px] group-hover/handle:bg-[color-mix(in_srgb,var(--dt-ink)_55%,transparent)] group-data-[active=true]/handle:mt-0 group-data-[active=true]/handle:h-full group-data-[active=true]/handle:bg-[var(--dt-accent)]"
      />
      {active && (
        <span
          ref={labelRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[calc(100%+6px)] -translate-x-1/2 whitespace-nowrap rounded-[6px] bg-[var(--dt-accent)] px-1.5 py-0.5 font-mono text-[10.5px] font-medium tabular-nums text-[var(--dt-on-accent)]"
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                */
/* ------------------------------------------------------------------ */

export default function DataTableSortableDemo(overrides: Partial<DataTableSortableProps> = {}) {
  const theme = overrides.theme ?? "dark";
  return (
    <div className="flex min-h-dvh w-full items-start justify-center px-4 py-12 sm:px-8 sm:py-16" style={{ backgroundColor: PALETTE[theme].stage }}>
      <DataTableSortable rows={14} {...overrides} />
    </div>
  );
}
