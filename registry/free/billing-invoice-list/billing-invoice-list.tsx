"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion, type Variants } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type InvoiceStatus = "paid" | "open" | "failed";
export type InvoiceFilter = "all" | InvoiceStatus;

export type InvoiceRow = {
  id: string;
  /** ISO date the invoice was issued. */
  date: string;
  amount: number;
  status: InvoiceStatus;
};

export type InvoiceListProps = {
  invoices?: InvoiceRow[];
  /** Which status is showing. Omit it and the list keeps its own filter. */
  filter?: InvoiceFilter;
  onFilterChange?: (filter: InvoiceFilter) => void;
  /** Called when a download finishes its morph. Defaults to marking that row saved. */
  onDownload?: (invoice: InvoiceRow) => void;
  locale?: string;
  /** ISO 4217 code. */
  currency?: string;
  /** The one accent: an open invoice, and a download once it has been saved. */
  accent?: string;
  theme?: "dark" | "light";
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const DEFAULT_ACCENT = "#7dd3a8";
const EASE = [0.22, 1, 0.36, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;
/** Table from this card width up. Matches Tailwind's @md, 28rem. */
const TABLE_AT = 448;

const PALETTE = {
  dark: {
    surface: "#131317",
    raised: "#1a1a1f",
    track: "#24242b",
    line: "rgba(255,255,255,0.08)",
    ink: "#f4f4f5",
    muted: "#8a8a93",
    onAccent: "#07130d",
    shadow: "inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.05), 0 40px 80px -40px rgba(0,0,0,0.9)",
  },
  light: {
    surface: "#ffffff",
    raised: "#f6f6f7",
    track: "#ececef",
    line: "rgba(24,24,27,0.09)",
    ink: "#18181b",
    muted: "#6b6b75",
    onAccent: "#07130d",
    shadow: "inset 0 0 0 1px rgba(24,24,27,0.08), 0 1px 2px rgba(24,24,27,0.05), 0 40px 80px -40px rgba(24,24,27,0.25)",
  },
} as const;

const DEFAULT_INVOICES: InvoiceRow[] = [
  { id: "INV-1046", date: "2026-10-02", amount: 48, status: "open" },
  { id: "INV-1042", date: "2026-09-24", amount: 128, status: "paid" },
  { id: "INV-1038", date: "2026-08-24", amount: 128, status: "paid" },
  { id: "INV-1031", date: "2026-07-24", amount: 96, status: "paid" },
  { id: "INV-1019", date: "2026-06-24", amount: 96, status: "failed" },
];

const FILTERS: { value: InvoiceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "open", label: "Open" },
  { value: "failed", label: "Failed" },
];

const T = { header: 0, filter: 0.08, list: 0.16 } as const;

const reveal: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(8px)" },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: EASE, delay },
    transitionEnd: { filter: "none" },
  }),
};
const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
};

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const dayOf = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const cents = (n: number) => Math.round(n * 100) / 100;

type Formats = { money: (n: number) => string; day: (ms: number) => string };

function makeFormats(locale: string, currency: string): Formats {
  const money = new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "narrowSymbol", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const day = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  return { money: (n) => money.format(n), day: (ms) => day.format(ms) };
}

const demoId = (id: string) => id.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function InvoiceList({
  invoices = DEFAULT_INVOICES,
  filter: filterProp,
  onFilterChange,
  onDownload,
  locale = "en-GB",
  currency = "USD",
  accent = DEFAULT_ACCENT,
  theme = "dark",
  className = "",
}: InvoiceListProps) {
  const reduce = !!useReducedMotion();
  const headingId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const inView = useInView(rootRef, { once: true, amount: 0.2 });
  const p = PALETTE[theme];
  const f = useMemo(() => makeFormats(locale, currency), [locale, currency]);
  const [wide, setWide] = useState(true);
  const [local, setLocal] = useState<InvoiceFilter>("all");
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const filter = filterProp ?? local;

  const rows = useMemo(
    () => [...invoices].filter((inv) => Number.isFinite(dayOf(inv.date))).sort((a, b) => dayOf(b.date) - dayOf(a.date)),
    [invoices],
  );
  const counts: Record<InvoiceFilter, number> = {
    all: rows.length,
    paid: rows.filter((r) => r.status === "paid").length,
    open: rows.filter((r) => r.status === "open").length,
    failed: rows.filter((r) => r.status === "failed").length,
  };
  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const openTotal = cents(rows.filter((r) => r.status === "open").reduce((sum, r) => sum + r.amount, 0));

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const apply = () => setWide(el.offsetWidth >= TABLE_AT);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const choose = (next: InvoiceFilter) => {
    if (filterProp === undefined) setLocal(next);
    onFilterChange?.(next);
  };
  const save = (invoice: InvoiceRow) => {
    setSaved((current) => (current[invoice.id] ? current : { ...current, [invoice.id]: true }));
    onDownload?.(invoice);
  };

  const vars = {
    "--inv-surface": p.surface,
    "--inv-raised": p.raised,
    "--inv-track": p.track,
    "--inv-line": p.line,
    "--inv-ink": p.ink,
    "--inv-muted": p.muted,
    "--inv-accent": accent,
    "--inv-on-accent": p.onAccent,
    "--inv-accent-text": theme === "dark" ? accent : `color-mix(in oklch, ${accent} 45%, ${p.ink})`,
    "--inv-shadow": p.shadow,
  } as CSSProperties;
  const v = (variants: Variants) => (reduce ? fade : variants);

  return (
    <motion.section
      ref={rootRef}
      aria-labelledby={headingId}
      style={vars}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      className={`@container relative w-full max-w-[560px] rounded-[20px] bg-(--inv-surface) p-5 text-(--inv-ink) shadow-(--inv-shadow) @sm:p-7 ${className}`}
    >
      <motion.header variants={v(reveal)} custom={T.header}>
        <p className="font-mono text-[11px] font-medium tracking-[0.08em] text-(--inv-muted) uppercase">Billing</p>
        <h3 id={headingId} className="mt-2 font-display text-[22px] leading-[1.1] font-semibold tracking-[-0.025em]">
          Invoices
        </h3>
        <p className="mt-1.5 text-[13.5px] text-(--inv-muted)">
          {counts.open === 0 ? (
            "Nothing open"
          ) : (
            <>
              {counts.open} open · <span className="text-(--inv-accent-text) tabular-nums">{f.money(openTotal)}</span>
            </>
          )}
        </p>
      </motion.header>

      <motion.div variants={v(reveal)} custom={T.filter} className="mt-6">
        <Filter value={filter} counts={counts} onChange={choose} reduce={reduce} />
      </motion.div>

      <motion.div variants={v(reveal)} custom={T.list} className="mt-5">
        <ListHeight reduce={reduce}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${filter}-${wide ? "table" : "cards"}`}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: reduce ? 0.12 : 0.22, ease: EASE }}
            >
              {shown.length === 0 ? (
                <p className="py-8 text-center text-[14px] text-(--inv-muted)">{filter === "all" ? "No invoices yet." : `No ${filter} invoices.`}</p>
              ) : wide ? (
                <InvoiceTable rows={shown} f={f} saved={saved} onSave={save} reduce={reduce} />
              ) : (
                <InvoiceCards rows={shown} f={f} saved={saved} onSave={save} reduce={reduce} />
              )}
            </motion.div>
          </AnimatePresence>
        </ListHeight>
        <p className="mt-3 text-right font-mono text-[11px] text-(--inv-muted) tabular-nums">
          {shown.length} of {rows.length}
        </p>
      </motion.div>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* Filter                                                              */
/* ------------------------------------------------------------------ */

function Filter({ value, counts, onChange, reduce }: { value: InvoiceFilter; counts: Record<InvoiceFilter, number>; onChange: (v: InvoiceFilter) => void; reduce: boolean }) {
  const pillId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next = e.key === "Home" ? 0 : e.key === "End" ? FILTERS.length - 1 : (i + step + FILTERS.length) % FILTERS.length;
    onChange(FILTERS[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label="Filter invoices" className="grid grid-cols-4 rounded-full bg-(--inv-raised) p-1 shadow-[inset_0_0_0_1px_var(--inv-line)]">
      {FILTERS.map((o, i) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            data-demo={`filter-${o.value}`}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={`relative flex h-9 items-center justify-center gap-1 rounded-full text-[12.5px] font-medium whitespace-nowrap focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--inv-ink) ${on ? "text-(--inv-ink)" : "text-(--inv-muted) hover:text-(--inv-ink)"}`}
          >
            {on && <motion.span layoutId={pillId} aria-hidden="true" className="absolute inset-0 rounded-full bg-(--inv-track) shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" transition={reduce ? { duration: 0 } : SPRING_UI} />}
            <span className="relative">{o.label}</span>
            <span className={`relative font-mono text-[11px] tabular-nums ${on ? "text-(--inv-muted)" : ""}`}>{counts[o.value]}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rows                                                                */
/* ------------------------------------------------------------------ */

function InvoiceTable({ rows, f, saved, onSave, reduce }: { rows: InvoiceRow[]; f: Formats; saved: Record<string, boolean>; onSave: (invoice: InvoiceRow) => void; reduce: boolean }) {
  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">Invoices</caption>
      <thead>
        <tr className="font-mono text-[11px] font-medium tracking-[0.08em] text-(--inv-muted) uppercase">
          <th scope="col" className="pb-2 font-medium">Invoice</th>
          <th scope="col" className="pb-2 font-medium">Issued</th>
          <th scope="col" className="pb-2 font-medium">Status</th>
          <th scope="col" className="pb-2 text-right font-medium">Amount</th>
          <th scope="col" className="pb-2">
            <span className="sr-only">Download</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((inv) => (
          <tr key={inv.id} className="border-t border-(--inv-line) transition-colors duration-150 hover:bg-(--inv-raised)/70">
            <th scope="row" className="py-3 pr-3 text-[14px] font-medium">
              {inv.id}
            </th>
            <td className="py-3 pr-3 text-[13.5px] text-(--inv-muted) tabular-nums">{f.day(dayOf(inv.date))}</td>
            <td className="py-3 pr-3">
              <Status status={inv.status} />
            </td>
            <td className="py-3 pr-3 text-right text-[14px] font-medium tabular-nums">{f.money(inv.amount)}</td>
            <td className="py-1.5 text-right">
              <DownloadButton invoice={inv} saved={!!saved[inv.id]} onSave={() => onSave(inv)} reduce={reduce} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function InvoiceCards({ rows, f, saved, onSave, reduce }: { rows: InvoiceRow[]; f: Formats; saved: Record<string, boolean>; onSave: (invoice: InvoiceRow) => void; reduce: boolean }) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((inv) => (
        <li key={inv.id} className="rounded-[14px] px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--inv-line)] transition-colors duration-150 hover:bg-(--inv-raised)/70">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium">{inv.id}</p>
              <p className="mt-0.5 text-[13px] text-(--inv-muted) tabular-nums">{f.day(dayOf(inv.date))}</p>
              <div className="mt-2">
                <Status status={inv.status} />
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <p className="text-[15px] font-medium tabular-nums">{f.money(inv.amount)}</p>
              <DownloadButton invoice={inv} saved={!!saved[inv.id]} onSave={() => onSave(inv)} reduce={reduce} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Status({ status }: { status: InvoiceStatus }) {
  if (status === "open") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] text-(--inv-accent-text)">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-(--inv-accent)" />
        Open
      </span>
    );
  }
  if (status === "failed") return <span className="text-[13px] font-medium">Failed</span>;
  return <span className="text-[13px] text-(--inv-muted)">Paid</span>;
}

function DownloadButton({ invoice, saved, onSave, reduce }: { invoice: InvoiceRow; saved: boolean; onSave: () => void; reduce: boolean }) {
  return (
    <motion.button
      type="button"
      data-demo={`download-${demoId(invoice.id)}`}
      aria-label={saved ? `${invoice.id} saved` : `Download ${invoice.id}`}
      onClick={onSave}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      className={`grid size-11 place-items-center rounded-[12px] transition-[background-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--inv-ink) ${saved ? "bg-(--inv-accent) text-(--inv-on-accent)" : "text-(--inv-ink) shadow-[inset_0_0_0_1px_var(--inv-line)] hover:bg-(--inv-raised)"}`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={saved ? "saved" : "download"} initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: reduce ? 1 : 0.8, transition: { duration: 0.12 } }} transition={{ duration: 0.18, ease: EASE }}>
          {saved ? <CheckIcon reduce={reduce} /> : <DownloadIcon />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 2.5v7" />
      <path d="M5.2 7.2 8 10l2.8-2.8" />
      <path d="M3.5 13.5h9" />
    </svg>
  );
}

function CheckIcon({ reduce }: { reduce: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <motion.path d="M3.5 8.4 6.4 11.2 12.5 4.8" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduce ? 0 : 0.32, ease: EASE }} />
    </svg>
  );
}

/** Eases the list to the height of the rows the filter left behind. */
function ListHeight({ children, reduce }: { children: ReactNode; reduce: boolean }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => setHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <motion.div initial={false} animate={{ height }} transition={{ duration: reduce ? 0 : 0.32, ease: EASE }} className="overflow-hidden">
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                */
/* ------------------------------------------------------------------ */

/** The invoice list on a quiet stage. The filter is demo state, so Customize can jump to one and the chips keep working. */
export default function InvoiceListDemo({ filter: forced, ...overrides }: Partial<InvoiceListProps> = {}) {
  const [filter, setFilter] = useState<InvoiceFilter>(forced ?? "all");
  useEffect(() => {
    if (forced) setFilter(forced);
  }, [forced]);
  return (
    <div className={`flex min-h-dvh w-full items-center justify-center px-4 py-14 sm:px-8 ${overrides.theme === "light" ? "bg-[#f4f4f5]" : "bg-[#060607]"}`}>
      <InvoiceList {...overrides} filter={filter} onFilterChange={setFilter} />
    </div>
  );
}
