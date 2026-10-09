"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

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

const EASE = [0.22, 1, 0.36, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;

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

const STATUS_COLOR: Record<FooterStatus, string> = { ok: "#34d399", degraded: "#fbbf24", outage: "#f87171" };
const STATUS_PERIOD: Record<FooterStatus, string> = { ok: "3.2s", degraded: "2.2s", outage: "1.4s" };

/* ------------------------------------------------------------------ */

export function FooterColumnsStatus({
  brand = { name: "Halyard", href: "#" },
  description = "Queues, cron and webhooks that retry until they land.",
  release = { version: "v4.12", label: "Durable timers are here", href: "#changelog" },
  columns = DEFAULT_COLUMNS,
  status = "ok",
  statusLabels = { ok: "All systems normal", degraded: "Degraded performance", outage: "Partial outage" },
  statusHref = "#status",
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
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState<Record<number, boolean>>({});

  const [themeState, setThemeState] = useState<FooterTheme>(defaultTheme);
  const currentTheme = theme ?? themeState;
  const pickTheme = (t: FooterTheme) => {
    if (theme === undefined) setThemeState(t);
    onThemeChange?.(t);
  };

  const [localeState, setLocaleState] = useState(defaultLocale);
  const currentLocale = locale ?? localeState;
  const pickLocale = (c: string) => {
    if (locale === undefined) setLocaleState(c);
    onLocaleChange?.(c);
  };

  // Container width decides the layout: accordion below 640px.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setCompact(e.contentRect.width < 640));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /*
   * The light. One soft radial field follows the pointer across the grid, but
   * every cell paints its own copy, clipped to its own box. The cell under the
   * pointer gets the full light; its neighbours get 38%, so each hairline reads
   * as a wall the light can't pass. The hairlines catch the light where it
   * touches them. No React state: CSS variables written from one rAF loop.
   */
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

    const tick = () => {
      const k = reduce ? 1 : 0.2;
      st.x += (st.tx - st.x) * k;
      st.y += (st.ty - st.y) * k;
      st.on += (st.target - st.on) * (reduce ? 1 : 0.12);
      grid.style.setProperty("--fcs-gx", `${st.x}px`);
      grid.style.setProperty("--fcs-gy", `${st.y}px`);
      grid.style.setProperty("--fcs-l", st.on.toFixed(3));
      let moving = Math.abs(st.target - st.on) > 0.002 || Math.abs(st.tx - st.x) > 0.3 || Math.abs(st.ty - st.y) > 0.3;
      cellRefs.current.forEach((cell, i) => {
        const b = boxes[i];
        if (!cell || !b) return;
        const lx = st.x - b.l;
        const ly = st.y - b.t;
        const inside = lx >= 0 && ly >= 0 && lx <= b.w && ly <= b.h;
        const want = (inside ? 1 : 0.32) * st.target;
        const prev = st.levels[i] ?? 0;
        const next = prev + (want - prev) * (reduce ? 1 : 0.16);
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
  }, [reduce, compact, columns.length]);

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
  const reveal = (i: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount: 0.25 },
          transition: { duration: 0.6, ease: EASE, delay: 0.06 * i },
        };

  return (
    <footer ref={rootRef} className={`@container relative border-t border-white/[0.08] bg-[#050505] text-white ${className}`}>
      <style>{`@keyframes fcs-breathe{0%,100%{transform:scale(1);opacity:.55}50%{transform:scale(2.6);opacity:0}}`}</style>
      <div className="mx-auto w-full max-w-[1280px] px-5 @2xl:px-8 @6xl:px-10">
        <div
          ref={gridRef}
          className="relative grid grid-cols-1 @2xl:grid-cols-4 @5xl:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))]"
          style={{ "--fcs-gx": "-999px", "--fcs-gy": "-999px", "--fcs-l": "0" } as CSSProperties}
        >
          {/* Frame: top and bottom hairlines run the full width; sides appear once there's a grid. */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-px h-px">
            <span className="absolute inset-0" style={gridLineLight} />
          </span>
          {/* The bottom rule runs edge to edge of the footer, not just the grid. */}
          <span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-1/2 h-px w-[100cqw] -translate-x-1/2 bg-white/[0.08]" />
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px">
            <span className="absolute inset-0" style={gridLineLight} />
          </span>
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 hidden w-px bg-white/[0.09] @2xl:block" />
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden w-px bg-white/[0.09] @2xl:block" />

          {/* Brand cell */}
          <motion.div
            ref={(el) => {
              cellRefs.current[0] = el;
            }}
            {...reveal(0)}
            className="relative px-0 pb-8 pt-9 @2xl:col-span-4 @2xl:px-8 @2xl:pb-9 @5xl:col-span-1 @5xl:pb-12 @5xl:pt-10"
            style={cellVars}
          >
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 hidden @2xl:block" style={cellLight} />
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-px bg-white/[0.09] @2xl:block @5xl:hidden">
              <span className="absolute inset-0" style={{ ...vLineLight, background: "radial-gradient(180px circle at var(--fcs-x) 100%, rgba(255,255,255,0.55), transparent 75%)" }} />
            </span>
            <div className="relative flex h-full flex-col @2xl:flex-row @2xl:items-start @2xl:justify-between @5xl:flex-col @5xl:justify-start">
              <div>
                <a
                  href={brand.href}
                  className="inline-flex items-center gap-2.5 rounded-md transition-transform duration-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70 active:scale-[0.98]"
                >
                  <HalyardMark />
                  <span className="font-display text-[18px] font-semibold tracking-[-0.025em]">{brand.name}</span>
                </a>
                <p className="mt-4 max-w-[30ch] text-pretty text-[15px] leading-[1.6] text-white/55">{description}</p>
              </div>
              {release ? (
                <a
                  href={release.href}
                  className="group mt-6 inline-flex h-8 max-w-full items-center gap-2.5 self-start rounded-full bg-white/[0.03] pl-1 pr-3 text-[13px] text-white/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09)] transition-[background-color,color,box-shadow,scale] duration-150 hover:bg-white/[0.06] hover:text-white hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 active:scale-[0.98] @2xl:mt-1 @5xl:mt-auto"
                >
                  <span className="rounded-full bg-white/[0.08] px-2 py-0.5 font-mono text-[10.5px] tracking-[0.02em] text-white/85 tabular-nums">{release.version}</span>
                  <span className="truncate">{release.label}</span>
                  <Arrow className="size-3 shrink-0 text-white/45 transition-[transform,color] duration-150 group-hover:translate-x-0.5 group-hover:text-white/80" />
                </a>
              ) : null}
            </div>
          </motion.div>

          {/* Link columns */}
          {columns.map((col, i) => (
            <motion.div
              key={col.title}
              ref={(el) => {
                cellRefs.current[i + 1] = el;
              }}
              {...reveal(i + 1)}
              className="relative @2xl:px-6 @2xl:pb-10 @2xl:pt-8 @5xl:pt-10"
              style={cellVars}
            >
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 hidden @2xl:block" style={cellLight} />
              <span aria-hidden="true" className={`pointer-events-none absolute inset-y-0 left-0 w-px bg-white/[0.09] ${i === 0 ? "hidden @5xl:block" : "hidden @2xl:block"}`}>
                <span className="absolute inset-0" style={vLineLight} />
              </span>
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/[0.09] @2xl:hidden" />
              <LinkColumn
                column={col}
                compact={compact}
                open={!!open[i]}
                onToggle={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
                reduce={reduce}
              />
            </motion.div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col gap-4 py-6 @2xl:flex-row @2xl:items-center @2xl:justify-between @2xl:gap-6 @2xl:py-5">
          <div className="flex items-center gap-5">
            <StatusPill status={status} label={statusLabels[status]} href={statusHref} reduce={reduce} />
            <p className="hidden font-mono text-[11px] uppercase tracking-[0.12em] text-white/40 @2xl:block">{copyright}</p>
          </div>
          <div className="flex items-center justify-between gap-3 @2xl:justify-end">
            <LocaleSelect locales={locales} value={currentLocale} onChange={pickLocale} reduce={reduce} compact={compact} />
            <ThemeSwitch value={currentTheme} onChange={pickTheme} compact={compact} />
          </div>
          <p className="pt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-white/40 @2xl:hidden">{copyright}</p>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */

function LinkColumn({ column, compact, open, onToggle, reduce }: { column: FooterColumn; compact: boolean; open: boolean; onToggle: () => void; reduce: boolean }) {
  const id = useId();
  const listId = `${id}-list`;
  const headId = `${id}-head`;
  const expanded = !compact || open;

  return (
    <nav aria-labelledby={headId}>
      {compact ? (
        <h3 id={headId}>
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
        </h3>
      ) : (
        <h3 id={headId} className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/40">
          {column.title}
        </h3>
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
          {column.links.map((l) => (
            <li key={l.label}>
              <a
                href={l.href}
                target={l.external ? "_blank" : undefined}
                rel={l.external ? "noreferrer" : undefined}
                className={`inline-flex max-w-full items-center gap-2 rounded-[5px] text-[14.5px] tracking-[-0.005em] text-white/60 transition-[color] duration-150 group-has-[a:hover]/list:text-white/40 group-has-[a:focus-visible]/list:text-white/40 hover:text-white! focus-visible:text-white! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 active:translate-y-px ${
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
            </li>
          ))}
        </ul>
      </motion.div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */

function StatusPill({ status, label, href, reduce }: { status: FooterStatus; label: string; href: string; reduce: boolean }) {
  const color = STATUS_COLOR[status];
  return (
    <a
      href={href}
      className="group inline-flex h-9 items-center gap-2.5 self-start rounded-full bg-white/[0.025] pl-3 pr-3.5 text-[13px] text-white/75 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09)] transition-[background-color,color,box-shadow,scale] duration-150 hover:bg-white/[0.055] hover:text-white hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 active:scale-[0.98] @2xl:h-8"
    >
      <span aria-hidden="true" className="relative flex size-2 items-center justify-center">
        <span
          className="absolute size-2 rounded-full motion-reduce:hidden"
          style={{ background: color, animation: `fcs-breathe ${STATUS_PERIOD[status]} cubic-bezier(0.65,0,0.35,1) infinite` }}
        />
        <motion.span
          className="relative size-2 rounded-full"
          initial={false}
          animate={{ backgroundColor: color, boxShadow: `0 0 10px 0 ${color}66` }}
          transition={{ duration: reduce ? 0 : 0.4, ease: EASE }}
        />
      </span>
      <span className="relative grid overflow-hidden" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={status}
            className="whitespace-nowrap"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(3px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(3px)", transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </span>
      <Arrow className="-ml-0.5 size-3 text-white/35 transition-[transform,color] duration-150 group-hover:translate-x-0.5 group-hover:text-white/70" />
    </a>
  );
}

/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */

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
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const current = locales.find((l) => l.code === value) ?? locales[0];

  const close = useCallback((focusButton: boolean) => {
    setOpen(false);
    if (focusButton) btnRef.current?.focus();
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

  const openList = () => {
    setActive(Math.max(0, locales.findIndex((l) => l.code === value)));
    setOpen(true);
  };

  const choose = (i: number) => {
    onChange(locales[i].code);
    close(true);
  };

  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(locales.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(locales.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Tab") {
      close(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={`Language: ${current.label}`}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            openList();
          }
        }}
        className={`group inline-flex items-center gap-2 rounded-full pl-3 pr-2.5 text-[13px] text-white/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09)] transition-[background-color,color,box-shadow,scale] duration-150 hover:bg-white/[0.05] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 active:scale-[0.98] ${
          open ? "bg-white/[0.06] text-white" : "bg-white/[0.025]"
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
          animate={{ rotate: open ? 180 : 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.22, ease: EASE }}
        >
          <path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.ul
            ref={listRef}
            id={`${id}-list`}
            role="listbox"
            tabIndex={-1}
            aria-label="Language"
            aria-activedescendant={`${id}-opt-${active}`}
            onKeyDown={onListKey}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: 4, scale: 0.98, transition: { duration: 0.14, ease: [0.4, 0, 1, 1] } }}
            transition={{ duration: 0.22, ease: EASE }}
            className="absolute bottom-[calc(100%+8px)] left-0 z-20 w-60 origin-bottom-left rounded-[14px] bg-[#0d0d0e] p-1.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09),inset_0_1px_0_rgba(255,255,255,0.05),0_24px_60px_-12px_rgba(0,0,0,0.9)] outline-none @2xl:left-auto @2xl:right-0 @2xl:origin-bottom-right"
          >
            {locales.map((l, i) => {
              const selected = l.code === value;
              return (
                <li
                  key={l.code}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={selected}
                  onPointerMove={() => setActive(i)}
                  onClick={() => choose(i)}
                  className={`relative flex cursor-pointer items-center gap-3 rounded-[9px] px-2.5 text-[13.5px] ${compact ? "h-11" : "h-9"} ${
                    selected ? "text-white" : "text-white/65"
                  }`}
                >
                  {i === active ? (
                    <motion.span layoutId={`${id}-hl`} transition={reduce ? { duration: 0 } : SPRING_UI} className="absolute inset-0 rounded-[9px] bg-white/[0.07]" />
                  ) : null}
                  <span className="relative flex-1 truncate">{l.label}</span>
                  <span className="relative font-mono text-[10.5px] tracking-[0.04em] text-white/35">{l.code}</span>
                  <span className="relative flex w-3.5 justify-center" aria-hidden="true">
                    {selected ? (
                      <svg viewBox="0 0 16 16" fill="none" className="size-3.5 text-white">
                        <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

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
      <path d="M8 5.5v13" stroke="#050505" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8.9 5.6 17.2 9 8.9 12.4Z" fill="#050505" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */

/** Demo: the footer at the foot of a quiet page, with a status preview switch. */
export default function FooterColumnsStatusDemo() {
  const [status, setStatus] = useState<FooterStatus>("ok");
  return (
    <div className="flex min-h-dvh flex-col justify-between bg-black">
      <div className="flex justify-center px-5 pt-10 sm:pt-14">
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
      </div>
      <FooterColumnsStatus status={status} />
    </div>
  );
}
