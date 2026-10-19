"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { animate, motion, useAnimationControls, useMotionTemplate, useMotionValue, useTransform, type Variants } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type WorkspaceLink = {
  id: string;
  label: string;
  /** A real route, or a `#id` anchor. With `onNavigate`, `#id` names the panel the tab controls. */
  href: string;
  /** A 16px icon drawn before the label. */
  icon?: ReactNode;
  /** A short count or status after the label, such as unread items. */
  badge?: string | number;
};

export type WorkspaceShellProps = {
  brand?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  links?: WorkspaceLink[];
  /** Controlled selected view. Pair with `onNavigate` for tab navigation. */
  activeId?: string;
  onNavigate?: (id: string) => void;
  contentClassName?: string;
  actions?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** A small mono heading over the rail's links, such as "Channels". */
  navLabel?: string;
  /** Pinned to the bottom of the navigation rail on wide containers: an account, a plan, a status. */
  railFooter?: ReactNode;
  /** The selection mark in the navigation. Defaults to the theme's ink. */
  accent?: string;
  theme?: "dark" | "light";
  className?: string;
};

export type WorkspacePanel = { id: string; content: ReactNode };
export type WorkspacePanelsProps = {
  activeId: string;
  panels: WorkspacePanel[];
  className?: string;
  /** Fill a fixed-height content pane; each view keeps its own scroll position. */
  fill?: boolean;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

/**
 * Exposed as `--ws-*` custom properties so content composed inside the shell
 * (cards, tables, dividers) can sit on the same surfaces without a theme prop.
 */
const PALETTE = {
  dark: {
    bg: "#09090a",
    surface: "#0f0f11",
    raised: "#161618",
    wash: "#1b1b1e",
    line: "#242427",
    ink: "#f4f4f5",
    muted: "#a1a1aa",
    faint: "#71717a",
    highlight: "rgba(255,255,255,0.06)",
    shadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 48px 120px -48px rgba(0,0,0,0.95)",
  },
  light: {
    bg: "#f7f7f6",
    surface: "#ffffff",
    raised: "#fbfbfa",
    wash: "#efeff0",
    line: "#e1e1e4",
    ink: "#171719",
    muted: "#55555e",
    faint: "#8b8b94",
    highlight: "rgba(255,255,255,0.9)",
    shadow: "0 1px 2px rgba(23,23,25,0.05), 0 40px 100px -56px rgba(23,23,25,0.35)",
  },
} as const;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;

/** One place for the choreography. Seconds unless noted. */
const MOTION = {
  rise: 8, // px
  blur: 6, // px
  enter: 0.42,
  step: 0.05,
  panel: 0.2,
  panelRise: 6, // px
  height: 0.24,
  fade: 0.12, // reduced motion
} as const;

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ws-ink)]";

/** The shell's surfaces in one place. Every colour is a `--ws-*` token, so both themes share them. */
const STYLE = {
  frame: cx(
    "@container/ws isolate flex w-full flex-col rounded-[20px] border border-[var(--ws-line)] bg-[var(--ws-bg)]",
    "text-[var(--ws-ink)] shadow-[var(--ws-shadow)] [overflow-wrap:anywhere]",
  ),
  grid: cx(
    "grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)]",
    "@3xl/ws:grid-cols-[212px_minmax(0,1fr)] @3xl/ws:grid-rows-1",
  ),
  rail: cx(
    "flex flex-col rounded-t-[19px] border-b border-[var(--ws-line)]",
    "bg-[linear-gradient(180deg,var(--ws-surface),var(--ws-bg))]",
    "@3xl/ws:rounded-tr-none @3xl/ws:rounded-bl-[19px] @3xl/ws:border-r @3xl/ws:border-b-0",
  ),
  railLabel: cx(
    "mb-2 hidden px-6 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--ws-faint)]",
    "@3xl/ws:block",
  ),
  brandMark: cx(
    "relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-[9px]",
    "border border-[var(--ws-line)] bg-[linear-gradient(180deg,var(--ws-raised),var(--ws-bg))]",
    "font-serif text-lg leading-none shadow-[inset_0_1px_0_var(--ws-highlight)]",
  ),
  hoverWash: cx(
    "absolute inset-0 rounded-[10px] bg-[var(--ws-wash)] opacity-0 transition-opacity duration-150",
    "group-hover/ws-link:opacity-60",
  ),
  selection: cx(
    "absolute inset-0 rounded-[10px] border border-[var(--ws-line)] bg-[var(--ws-raised)]",
    "shadow-[inset_0_1px_0_var(--ws-highlight),0_1px_2px_rgba(0,0,0,0.18)]",
  ),
  badge: cx(
    "relative rounded-full border border-[var(--ws-line)] bg-[var(--ws-bg)] px-1.5 py-px",
    "font-mono text-[11px] leading-4 tabular-nums text-[var(--ws-muted)]",
  ),
  header: cx(
    "relative z-20 flex shrink-0 flex-wrap items-end justify-between gap-x-6 gap-y-4",
    "border-b border-[var(--ws-line)] bg-[var(--ws-surface)] px-5 py-5 @lg/ws:px-8 @lg/ws:py-6",
    // The frame can't clip (header menus must escape it), so painted corners follow its radius.
    "@3xl/ws:rounded-tr-[19px]",
  ),
  title: cx(
    "mt-2 font-display text-[clamp(1.375rem,2.2cqi,1.75rem)] font-medium leading-[1.15]",
    "tracking-[-0.035em] text-balance",
  ),
  // Embedded drawers stay inside the content's layer, below the shell's navigation and menus.
  content: "isolate min-h-0 min-w-0 flex-1 space-y-6 overflow-auto p-4 @lg/ws:p-6 @3xl/ws:p-7",
  footer: cx(
    "shrink-0 rounded-b-[19px] border-t border-[var(--ws-line)] bg-[var(--ws-surface)] px-5 py-3.5",
    "@3xl/ws:rounded-bl-none",
    "text-[13px] leading-relaxed text-[var(--ws-muted)] @lg/ws:px-8",
  ),
} as const;

function paletteStyle(theme: "dark" | "light", accent?: string): CSSProperties {
  const p = PALETTE[theme];
  return {
    "--ws-bg": p.bg,
    "--ws-surface": p.surface,
    "--ws-raised": p.raised,
    "--ws-wash": p.wash,
    "--ws-line": p.line,
    "--ws-ink": p.ink,
    "--ws-muted": p.muted,
    "--ws-faint": p.faint,
    "--ws-highlight": p.highlight,
    "--ws-shadow": p.shadow,
    "--ws-accent": accent ?? p.ink,
    colorScheme: theme,
  } as CSSProperties;
}

/* ------------------------------------------------------------------ */
/* Hooks                                                                */
/* ------------------------------------------------------------------ */

/** Follows the OS setting live, so a change mid-session takes effect at once. */
function useLiveReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduce;
}

/** Roving focus for a tab list: arrows step and wrap, Home and End jump. */
function nextTabIndex(key: string, index: number, count: number) {
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowDown" || key === "ArrowRight") return (index + 1) % count;
  if (key === "ArrowUp" || key === "ArrowLeft") return (index - 1 + count) % count;
  return null;
}

/* ------------------------------------------------------------------ */
/* Navigation                                                           */
/* ------------------------------------------------------------------ */

type NavProps = {
  links: WorkspaceLink[];
  current?: string;
  compact: boolean;
  indicatorId: string;
  reduce: boolean;
  tabs: boolean;
  onSelect: (id: string) => void;
};

function WorkspaceNav({ links, current, compact, indicatorId, reduce, tabs, onSelect }: NavProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLElement>, index: number) => {
    const next = nextTabIndex(event.key, index, links.length);
    if (next === null) return;
    event.preventDefault();
    onSelect(links[next].id);
    event.currentTarget.closest("nav")?.querySelectorAll<HTMLElement>("[data-ws-link]")[next]?.focus();
  };

  return (
    <nav
      role={tabs ? "tablist" : undefined}
      aria-orientation={tabs ? (compact ? "horizontal" : "vertical") : undefined}
      aria-label={compact ? "Workspace sections, compact" : "Workspace sections"}
      className={
        compact
          ? "flex gap-1 overflow-x-auto px-3 [scrollbar-width:none] @3xl/ws:hidden"
          : "hidden flex-col gap-0.5 px-3 @3xl/ws:flex"
      }
    >
      {links.map((link, index) => (
        <NavItem
          key={link.id}
          link={link}
          selected={current === link.id}
          compact={compact}
          indicatorId={indicatorId}
          reduce={reduce}
          tabs={tabs}
          onSelect={() => onSelect(link.id)}
          onKeyDown={(event) => onKeyDown(event, index)}
        />
      ))}
    </nav>
  );
}

type NavItemProps = {
  link: WorkspaceLink;
  selected: boolean;
  compact: boolean;
  indicatorId: string;
  reduce: boolean;
  tabs: boolean;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
};

function NavItem({ link, selected, compact, indicatorId, reduce, tabs, onSelect, onKeyDown }: NavItemProps) {
  const className = cx(
    "group/ws-link relative flex shrink-0 items-center gap-3 rounded-[10px] text-left text-sm",
    "transition-[color,transform] duration-150 active:scale-[0.98] motion-reduce:active:scale-100",
    compact ? "min-h-11 px-3" : "min-h-10 px-3",
    selected ? "text-[var(--ws-ink)]" : "text-[var(--ws-muted)] hover:text-[var(--ws-ink)]",
    FOCUS_RING,
  );

  const body = (
    <>
      {!selected && <span aria-hidden="true" className={STYLE.hoverWash} />}
      {selected && <SelectionMark compact={compact} layoutId={indicatorId} reduce={reduce} />}
      {link.icon && (
        <span aria-hidden="true" className="relative grid size-4 shrink-0 place-items-center [&>svg]:size-4">
          {link.icon}
        </span>
      )}
      <span className="relative min-w-0 flex-1 truncate font-medium tracking-[-0.01em]">{link.label}</span>
      {link.badge !== undefined && link.badge !== "" && <span className={STYLE.badge}>{link.badge}</span>}
    </>
  );

  if (tabs) {
    return (
      <button
        type="button"
        role="tab"
        data-ws-link=""
        data-demo={`nav-${link.id}`}
        aria-selected={selected}
        aria-controls={link.href.startsWith("#") ? link.href.slice(1) : undefined}
        tabIndex={selected ? 0 : -1}
        className={className}
        onClick={onSelect}
        onKeyDown={onKeyDown}
      >
        {body}
      </button>
    );
  }
  return (
    <a
      href={link.href}
      data-ws-link=""
      data-demo={`nav-${link.id}`}
      aria-current={selected ? "location" : undefined}
      className={className}
      onClick={onSelect}
    >
      {body}
    </a>
  );
}

/** The raised pill behind the selected link. It travels between links on `spring.ui`. */
function SelectionMark({ compact, layoutId, reduce }: { compact: boolean; layoutId: string; reduce: boolean }) {
  const transition = reduce ? { duration: 0 } : SPRING_UI;
  if (compact) {
    return (
      <motion.span
        aria-hidden="true"
        layoutId={layoutId}
        transition={transition}
        className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-[var(--ws-accent)]"
      />
    );
  }
  return (
    <motion.span aria-hidden="true" layoutId={layoutId} transition={transition} className={STYLE.selection}>
      <span className="absolute inset-y-2.5 left-0 w-0.5 rounded-full bg-[var(--ws-accent)]" />
    </motion.span>
  );
}

function BrandMark({ brand }: { brand: string }) {
  const initial = brand.trim().slice(0, 1).toUpperCase() || "N";
  return (
    <span aria-hidden="true" className={STYLE.brandMark}>
      {initial}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                               */
/* ------------------------------------------------------------------ */

function WorkspaceHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  reduce,
}: Pick<WorkspaceShellProps, "eyebrow" | "title" | "subtitle" | "actions"> & { reduce: boolean }) {
  const entry = useAnimationControls();
  const hasEyebrow = Boolean(eyebrow);
  const hasActions = Boolean(actions);
  useLayoutEffect(() => {
    entry.stop();
    if (reduce) entry.set({ opacity: 1, y: 0, filter: "none" });
    else {
      entry.set({ opacity: 0, y: MOTION.rise, filter: `blur(${MOTION.blur}px)` });
      void entry.start((index: number) => ({
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        transitionEnd: { filter: "none" },
        transition: { duration: MOTION.enter, ease: EASE_OUT, delay: index * MOTION.step },
      }));
    }
    return () => entry.stop();
  }, [entry, reduce, title, subtitle, hasEyebrow, hasActions]);

  const enter = (index: number) => ({
    custom: index,
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: MOTION.rise, filter: `blur(${MOTION.blur}px)` },
    animate: entry,
  });

  return (
    <header className={STYLE.header}>
      <div className="min-w-0 max-w-full">
        {eyebrow && (
          <motion.p {...enter(0)} className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--ws-muted)]">
            {eyebrow}
          </motion.p>
        )}
        {/* Keep animation subscribers mounted when a view changes its heading. */}
        <motion.h2 {...enter(1)} className={STYLE.title}>
          {title}
        </motion.h2>
        {subtitle && (
          <motion.p
            {...enter(2)}
            className="mt-1.5 max-w-[78ch] text-sm leading-relaxed text-[var(--ws-muted)] text-pretty"
          >
            {subtitle}
          </motion.p>
        )}
      </div>
      {actions && (
        <motion.div {...enter(2)} className="flex max-w-full flex-wrap items-center gap-2">
          {actions}
        </motion.div>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* WorkspaceShell                                                       */
/* ------------------------------------------------------------------ */

/** A container-responsive application frame. Links point at real routes, anchors or tab panels. */
export function WorkspaceShell({
  brand = "Northstar",
  eyebrow = "Workspace",
  title = "Overview",
  subtitle,
  links = [],
  activeId,
  onNavigate,
  contentClassName = "",
  actions,
  children,
  footer,
  railFooter,
  navLabel,
  accent,
  theme = "dark",
  className = "",
}: WorkspaceShellProps) {
  const reduce = useLiveReducedMotion();
  const uid = useId();
  const [active, setActive] = useState<string | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const focused = useRef<HTMLElement | null>(null);
  const tabs = Boolean(onNavigate);

  useEffect(() => {
    const shell = frame.current;
    if (!shell) return;
    const doc = shell.ownerDocument;
    const retireOutside = (event: PointerEvent) => {
      if (event.isPrimary && event.button === 0 && !shell.contains(event.target as Node)) focused.current = null;
    };
    const retireWindow = () => { focused.current = null; };
    doc.addEventListener("pointerdown", retireOutside, true);
    doc.defaultView?.addEventListener("blur", retireWindow);
    return () => {
      doc.removeEventListener("pointerdown", retireOutside, true);
      doc.defaultView?.removeEventListener("blur", retireWindow);
    };
  }, []);

  const preferred = activeId ?? active;
  const current = links.some((link) => link.id === preferred) ? (preferred ?? undefined) : links[0]?.id;

  // A content action can retire the focused panel. Hand focus to its visible
  // navigation tab after child panels have applied inert, including scope changes.
  useLayoutEffect(() => {
    if (!tabs || !focused.current?.closest("[data-workspace-panel][inert]")) return;
    const shell = frame.current;
    const doc = shell?.ownerDocument;
    if (!shell || !doc?.hasFocus()) return;
    const owner = doc.activeElement;
    if (owner && owner !== doc.body && !shell.contains(owner)) return;
    const target = [...shell.querySelectorAll<HTMLElement>('[role="tab"]')].find(
      (tab) => tab.dataset.demo === `nav-${current}` && tab.getClientRects().length,
    );
    target?.focus({ preventScroll: true });
  });

  const navigate = (id: string) => {
    setActive(id);
    onNavigate?.(id);
  };

  const nav = (compact: boolean) => (
    <WorkspaceNav
      links={links}
      current={current}
      compact={compact}
      indicatorId={`${uid}-${compact ? "strip" : "rail"}`}
      reduce={reduce}
      tabs={tabs}
      onSelect={navigate}
    />
  );

  return (
    <div
      ref={frame}
      onFocusCapture={(event) => {
        focused.current = event.target as HTMLElement;
      }}
      onBlurCapture={(event) => {
        // Retiring an inert panel can blur to the body with no related target.
        // Explicit outside focus belongs to the host and must never be reclaimed.
        const next = event.relatedTarget as Node | null;
        if (next && !event.currentTarget.contains(next)) focused.current = null;
      }}
      style={paletteStyle(theme, accent)}
      className={cx(STYLE.frame, className)}
    >
      <div className={STYLE.grid}>
        <aside className={STYLE.rail}>
          <div className="flex min-h-16 items-center gap-3 px-5 @3xl/ws:min-h-[76px] @3xl/ws:px-6">
            <BrandMark brand={brand} />
            <span className="min-w-0 truncate text-sm font-medium tracking-[-0.01em]">{brand}</span>
          </div>
          {links.length > 0 && (
            <>
              {navLabel && <p className={STYLE.railLabel}>{navLabel}</p>}
              {nav(false)}
            </>
          )}
          {railFooter && (
            <div className="mt-auto hidden border-t border-[var(--ws-line)] px-6 py-5 text-sm @3xl/ws:block">
              {railFooter}
            </div>
          )}
        </aside>
        <div className="flex min-h-0 min-w-0 flex-col">
          {links.length > 0 && (
            <div className="border-b border-[var(--ws-line)] bg-[var(--ws-surface)] @3xl/ws:hidden">{nav(true)}</div>
          )}
          <WorkspaceHeader eyebrow={eyebrow} title={title} subtitle={subtitle} actions={actions} reduce={reduce} />
          <div className={cx(STYLE.content, contentClassName)}>{children}</div>
          {footer && <footer className={STYLE.footer}>{footer}</footer>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* WorkspacePanels                                                      */
/* ------------------------------------------------------------------ */

/** Keeps every view mounted so drafts survive a switch, and animates the measured height, never the text. */
export function WorkspacePanels({ activeId, panels, className = "", fill = false }: WorkspacePanelsProps) {
  const reduce = useLiveReducedMotion();
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const [height, setHeight] = useState<number | "auto">("auto");
  const [moving, setMoving] = useState(false);
  const resize = useAnimationControls();

  const valid = panels.filter(
    (panel, index) => panel.id && panels.findIndex((other) => other.id === panel.id) === index,
  );
  const current = valid.find((panel) => panel.id === activeId)?.id ?? valid[0]?.id;

  useLayoutEffect(() => {
    if (fill) return;
    const node = current ? nodes.current.get(current) : undefined;
    if (!node) {
      setHeight(0);
      return;
    }
    const measure = () => setHeight(node.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [current, fill]);

  useLayoutEffect(() => {
    const target = { height: fill ? "100%" : height };
    resize.stop();
    if (reduce) {
      resize.set(target);
      setMoving(false);
    } else void resize.start(target, { duration: MOTION.height, ease: EASE_OUT });
    return () => resize.stop();
  }, [resize, reduce, fill, height]);

  return (
    <motion.div
      initial={false}
      animate={resize}
      onAnimationStart={() => setMoving(true)}
      onAnimationComplete={() => setMoving(false)}
      style={{ overflow: fill || moving ? "hidden" : "visible" }}
      className={`relative ${className}`}
    >
      {valid.map((panel) => (
        <RetainedPanel
          key={panel.id}
          panel={panel}
          active={panel.id === current}
          reduce={reduce}
          fill={fill}
          bind={(node) => {
            if (node) nodes.current.set(panel.id, node);
            else nodes.current.delete(panel.id);
          }}
        />
      ))}
    </motion.div>
  );
}

type RetainedPanelProps = {
  panel: WorkspacePanel;
  active: boolean;
  reduce: boolean;
  fill: boolean;
  bind: (node: HTMLDivElement | null) => void;
};

/** Inert and hidden from assistive technology the moment it retires; hidden visually once its fade ends. */
function RetainedPanel({ panel, active, reduce, fill, bind }: RetainedPanelProps) {
  const [exiting, setExiting] = useState(active);
  useLayoutEffect(() => {
    if (active) setExiting(true);
  }, [active]);

  return (
    <motion.div
      ref={bind}
      data-workspace-panel={panel.id}
      inert={!active}
      aria-hidden={!active || undefined}
      initial={false}
      animate={{ opacity: active ? 1 : 0, y: active || reduce ? 0 : MOTION.panelRise }}
      transition={{ duration: reduce ? MOTION.fade : MOTION.panel, ease: EASE_OUT }}
      onAnimationComplete={() => {
        if (!active) setExiting(false);
      }}
      style={{
        display: active || exiting ? "block" : "none",
        position: active ? "relative" : "absolute",
        insetInline: 0,
        top: 0,
        pointerEvents: active ? "auto" : "none",
      }}
      className={`motion-reduce:!transform-none ${fill ? "h-full min-h-0 overflow-auto" : ""}`}
    >
      {panel.content}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Demo: Northstar, a small design studio                               */
/* ------------------------------------------------------------------ */

type Stage = "Briefing" | "In design" | "In review" | "Handoff";
type Project = {
  id: string;
  name: string;
  client: string;
  owner: string;
  stage: Stage;
  due: string;
  /** Share of the budgeted hours already logged, 0–1. */
  burn: number;
};
type Metric = { label: string; value: number; decimals?: number; note: string; trend: number[] };
type Activity = { time: string; who: string; did: string; what: string };

function project(
  ...[id, name, client, owner, stage, due, burn]: [string, string, string, string, Stage, string, number]
) {
  return { id, name, client, owner, stage, due, burn } satisfies Project;
}

const PROJECTS: Project[] = [
  project("halden", "Halden Coast House", "Brightwater Homes", "Alex Morgan", "In review", "Thu 16 Oct", 0.82),
  project("fieldnote", "Fieldnote 3.0 launch", "Fieldnote", "Noor Ali", "In design", "Mon 20 Oct", 0.46),
  project("mira", "AW26 lookbook", "Atelier Mira", "Casey Jones", "Handoff", "Fri 17 Oct", 0.94),
  project("kestrel", "Partner portal", "Kestrel Bank", "Sam Chen", "Briefing", "Wed 29 Oct", 0.12),
  project("oakline", "Annual report 2026", "Oakline Trust", "Noor Ali", "In design", "Tue 4 Nov", 0.31),
];

const METRICS: Metric[] = [
  { label: "Active projects", value: 12, note: "3 started this month", trend: [7, 8, 8, 9, 10, 9, 11, 12] },
  { label: "Due this week", value: 4, note: "2 waiting on client feedback", trend: [2, 5, 3, 6, 4, 3, 5, 4] },
  { label: "Hours logged", value: 186.5, decimals: 1, note: "of 240 planned", trend: [18, 26, 31, 22, 35, 28, 14, 12] },
];

const ACTIVITY: Activity[] = [
  { time: "09:42", who: "Noor Ali", did: "shared", what: "Fieldnote 3.0 — onboarding flow v4" },
  { time: "09:18", who: "Alex Morgan", did: "resolved 6 comments on", what: "Halden Coast House — planning set" },
  { time: "08:55", who: "Casey Jones", did: "exported", what: "AW26 lookbook — print PDF, 48 pp" },
  { time: "Yesterday", who: "Sam Chen", did: "booked a kickoff for", what: "Kestrel Bank partner portal" },
];

const DEMO_LINKS = (uid: string): WorkspaceLink[] => [
  { id: "overview", label: "Overview", href: `#${uid}-overview`, icon: <IconGrid /> },
  { id: "projects", label: "Projects", href: `#${uid}-projects`, icon: <IconStack />, badge: PROJECTS.length },
  { id: "activity", label: "Activity", href: `#${uid}-activity`, icon: <IconPulse />, badge: 4 },
];

const VIEW_TITLES: Record<string, { title: string; subtitle: string }> = {
  overview: {
    title: "Monday, 13 October",
    subtitle: "Four deliveries this week. Halden and the lookbook need sign-off first.",
  },
  projects: {
    title: "Projects",
    subtitle: "Five in flight across four clients, sorted by the next date that matters.",
  },
  activity: {
    title: "Activity",
    subtitle: "What changed since you were last here, newest first.",
  },
};

/** Each view's blocks rise in reading order every time it is opened, then reset once it has faded out. */
const viewVariants: Variants = {
  hidden: { opacity: 0, y: MOTION.rise, filter: `blur(${MOTION.blur}px)`, transition: { delay: 0.25, duration: 0 } },
  shown: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: MOTION.enter, ease: EASE_OUT, delay: 0.08 + i * MOTION.step },
  }),
};
/** Opacity only. Transform and blur are set, not animated, so a preference change mid-entrance leaves nothing stuck. */
const reducedVariants: Variants = {
  hidden: { opacity: 0, y: 0, filter: "none", transition: { delay: 0.25, duration: 0 } },
  shown: { opacity: 1, y: 0, filter: "none", transition: { duration: MOTION.fade } },
};

/** The demo reads the live motion preference once and shares it with every block, figure and meter. */
const ReduceContext = createContext(false);

function useStagger() {
  return useContext(ReduceContext) ? reducedVariants : viewVariants;
}

function Block({ i, className = "", children }: { i: number; className?: string; children: ReactNode }) {
  return (
    <motion.div custom={i} variants={useStagger()} className={className}>
      {children}
    </motion.div>
  );
}

const DEMO_STYLE = {
  card: "rounded-2xl border border-[var(--ws-line)] bg-[var(--ws-surface)] shadow-[inset_0_1px_0_var(--ws-highlight)]",
  avatar: cx(
    "grid size-7 shrink-0 place-items-center rounded-full border border-[var(--ws-line)] bg-[var(--ws-raised)]",
    "text-[11px] font-medium text-[var(--ws-muted)] shadow-[inset_0_1px_0_var(--ws-highlight)]",
  ),
  deskRow: cx(
    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-5 py-4",
    "@2xl/ws:grid-cols-[minmax(0,1fr)_8rem_minmax(0,11rem)]",
  ),
  tableHead: cx(
    "hidden border-b border-[var(--ws-line)] px-5 py-3 font-mono text-xs text-[var(--ws-faint)]",
    "@3xl/ws:grid @3xl/ws:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_7.5rem_6.5rem_minmax(0,9rem)] @3xl/ws:gap-4",
  ),
  tableRow: cx(
    "grid grid-cols-2 items-center gap-x-4 gap-y-3 px-5 py-4 [&>*:first-child]:col-span-2",
    "@3xl/ws:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_7.5rem_6.5rem_minmax(0,9rem)]",
    "@3xl/ws:[&>*:first-child]:col-span-1",
  ),
  primary: cx(
    "inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-[var(--ws-ink)] px-4 text-sm font-medium",
    "text-[var(--ws-bg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-[transform,opacity] duration-150",
    "hover:opacity-90 active:scale-[0.97]",
    FOCUS_RING,
  ),
} as const;

/** Counts from zero, or from the previous value, with tabular figures and a blur that clears as it lands. */
function CountUp({ value, decimals = 0, play }: { value: number; decimals?: number; play: boolean }) {
  const reduce = useContext(ReduceContext);
  const count = useMotionValue(0);
  const blur = useMotionValue(0);
  const text = useTransform(count, (v) =>
    v.toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
  );
  const filter = useMotionTemplate`blur(${blur}px)`;

  useEffect(() => {
    if (!play) {
      // Reset after the view has faded out, so the next visit counts up again.
      const reset = setTimeout(() => count.set(0), 260);
      return () => clearTimeout(reset);
    }
    if (reduce) {
      count.set(value);
      blur.set(0);
      return;
    }
    blur.set(4);
    const options = { duration: 0.9, ease: EASE_OUT, delay: 0.2 };
    const counting = animate(count, value, options);
    const clearing = animate(blur, 0, options);
    return () => {
      counting.stop();
      clearing.stop();
    };
  }, [play, value, reduce, count, blur]);

  return <motion.span style={{ filter }}>{text}</motion.span>;
}

function Sparkline({ points, play }: { points: number[]; play: boolean }) {
  const reduce = useContext(ReduceContext);
  const max = Math.max(...points);
  const min = Math.min(...points);
  const d = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 26 - ((v - min) / (max - min || 1)) * 22;
      return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg aria-hidden="true" viewBox="0 0 100 28" preserveAspectRatio="none" className="h-7 w-24 overflow-visible">
      <motion.path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={false}
        animate={play ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
        transition={
          play && !reduce ? { duration: 0.8, ease: EASE_OUT, delay: 0.35 } : { duration: 0, delay: play ? 0 : 0.25 }
        }
      />
    </svg>
  );
}

/** Fills only once its row has landed. */
function Meter({ value, play, delay }: { value: number; play: boolean; delay: number }) {
  const reduce = useContext(ReduceContext);
  const high = value >= 0.9;
  return (
    <span className="relative block h-1 w-full overflow-hidden rounded-full bg-[var(--ws-wash)]">
      <motion.span
        className={`absolute inset-y-0 left-0 rounded-full ${high ? "bg-[var(--ws-ink)]" : "bg-[var(--ws-muted)]"}`}
        initial={false}
        animate={{ width: play ? `${Math.round(value * 100)}%` : "0%" }}
        transition={
          play && !reduce ? { duration: 0.6, ease: EASE_OUT, delay } : { duration: 0, delay: play ? 0 : 0.25 }
        }
      />
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
  return (
    <span aria-hidden="true" className={DEMO_STYLE.avatar}>
      {initials}
    </span>
  );
}

function StagePill({ stage }: { stage: Stage }) {
  const strong = stage === "In review" || stage === "Handoff";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${
        strong ? "border-[var(--ws-ink)]/25 text-[var(--ws-ink)]" : "border-[var(--ws-line)] text-[var(--ws-muted)]"
      }`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${strong ? "bg-[var(--ws-accent)]" : "bg-current"}`} />
      {stage}
    </span>
  );
}

function OverviewView({ uid, active }: { uid: string; active: boolean }) {
  return (
    <motion.section
      id={`${uid}-overview`}
      role="tabpanel"
      aria-label="Overview"
      initial="hidden"
      animate={active ? "shown" : "hidden"}
      className="space-y-5"
    >
      <div className="grid gap-3 @2xl/ws:grid-cols-3">
        {METRICS.map((metric, i) => (
          <Block key={metric.label} i={i} className={`${DEMO_STYLE.card} p-5`}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm text-[var(--ws-muted)]">{metric.label}</h3>
              <span className="text-[var(--ws-faint)]">
                <Sparkline points={metric.trend} play={active} />
              </span>
            </div>
            <p className="mt-4 font-display text-[2.5rem] font-medium leading-none tracking-[-0.04em] tabular-nums">
              <CountUp value={metric.value} decimals={metric.decimals} play={active} />
            </p>
            <p className="mt-3 text-[13px] text-[var(--ws-muted)]">{metric.note}</p>
          </Block>
        ))}
      </div>
      <Block i={3} className={`${DEMO_STYLE.card} overflow-hidden`}>
        <div className="flex items-baseline justify-between gap-4 border-b border-[var(--ws-line)] px-5 py-4">
          <h3 className="text-[15px] font-medium tracking-[-0.01em]">On the desk this week</h3>
          <p className="font-mono text-xs text-[var(--ws-muted)]">Hours used</p>
        </div>
        <ul className="divide-y divide-[var(--ws-line)]">
          {PROJECTS.slice(0, 4).map((project, i) => (
            <li key={project.id} className={DEMO_STYLE.deskRow}>
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={project.owner} />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium tracking-[-0.01em]">{project.name}</p>
                  <p className="truncate text-[13px] text-[var(--ws-muted)]">
                    {project.client} · due {project.due}
                  </p>
                </div>
              </div>
              <div className="justify-self-end @2xl/ws:justify-self-start">
                <StagePill stage={project.stage} />
              </div>
              <div className="col-span-2 flex items-center gap-3 @2xl/ws:col-span-1">
                <Meter value={project.burn} play={active} delay={0.45 + i * 0.06} />
                <span className="w-9 shrink-0 text-right font-mono text-xs tabular-nums text-[var(--ws-muted)]">
                  {Math.round(project.burn * 100)}%
                </span>
              </div>
            </li>
          ))}
        </ul>
      </Block>
    </motion.section>
  );
}

function ProjectsView({ uid, active }: { uid: string; active: boolean }) {
  const stagger = useStagger();
  return (
    <motion.section
      id={`${uid}-projects`}
      role="tabpanel"
      aria-label="Projects"
      initial="hidden"
      animate={active ? "shown" : "hidden"}
      className={`${DEMO_STYLE.card} overflow-hidden`}
    >
      <motion.div custom={0} variants={stagger} aria-hidden="true" className={DEMO_STYLE.tableHead}>
        <span>Project</span>
        <span>Owner</span>
        <span>Stage</span>
        <span>Due</span>
        <span>Hours used</span>
      </motion.div>
      <ul className="divide-y divide-[var(--ws-line)]">
        {PROJECTS.map((project, i) => (
          <motion.li key={project.id} custom={i + 1} variants={stagger} className={DEMO_STYLE.tableRow}>
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-medium tracking-[-0.01em]">{project.name}</h3>
              <p className="truncate text-[13px] text-[var(--ws-muted)]">{project.client}</p>
            </div>
            <p className="flex min-w-0 items-center gap-2 text-sm text-[var(--ws-muted)]">
              <Avatar name={project.owner} />
              <span className="truncate">{project.owner}</span>
            </p>
            <div>
              <StagePill stage={project.stage} />
            </div>
            <p className="font-mono text-xs tabular-nums text-[var(--ws-muted)]">{project.due}</p>
            <div className="flex items-center gap-3">
              <Meter value={project.burn} play={active} delay={0.4 + i * 0.06} />
              <span className="w-9 shrink-0 text-right font-mono text-xs tabular-nums text-[var(--ws-muted)]">
                {Math.round(project.burn * 100)}%
              </span>
            </div>
          </motion.li>
        ))}
      </ul>
    </motion.section>
  );
}

function ActivityView({ uid, active }: { uid: string; active: boolean }) {
  const stagger = useStagger();
  return (
    <motion.section
      id={`${uid}-activity`}
      role="tabpanel"
      aria-label="Activity"
      initial="hidden"
      animate={active ? "shown" : "hidden"}
      className={`${DEMO_STYLE.card} px-5 py-2`}
    >
      <ol className="relative">
        {ACTIVITY.map((item, i) => (
          <motion.li
            key={item.time + item.who}
            custom={i}
            variants={stagger}
            className="relative grid grid-cols-[auto_minmax(0,1fr)] gap-4 py-4"
          >
            {i < ACTIVITY.length - 1 && (
              <span aria-hidden="true" className="absolute top-12 bottom-0 left-3.5 w-px bg-[var(--ws-line)]" />
            )}
            <Avatar name={item.who} />
            <div className="min-w-0">
              <p className="text-[15px] leading-relaxed text-[var(--ws-muted)]">
                <span className="font-medium text-[var(--ws-ink)]">{item.who}</span> {item.did}{" "}
                <span className="text-[var(--ws-ink)]">{item.what}</span>
              </p>
              <p className="mt-1 font-mono text-xs text-[var(--ws-faint)]">{item.time}</p>
            </div>
          </motion.li>
        ))}
      </ol>
    </motion.section>
  );
}

function IconGrid() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4}>
      <rect x="2" y="2" width="5" height="5" rx="1.2" />
      <rect x="9" y="2" width="5" height="5" rx="1.2" />
      <rect x="2" y="9" width="5" height="5" rx="1.2" />
      <rect x="9" y="9" width="5" height="5" rx="1.2" />
    </svg>
  );
}

function IconStack() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinejoin="round">
      <path d="M8 2 14 5 8 8 2 5Z" />
      <path d="M2 8.2 8 11.2 14 8.2" />
      <path d="M2 11.2 8 14.2 14 11.2" />
    </svg>
  );
}

function IconPulse() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
      <path d="M1.5 8.5h3l2-5 3 9 2-4h3" strokeLinejoin="round" />
    </svg>
  );
}

function DemoAccount() {
  return (
    <div className="flex items-center gap-3">
      <Avatar name="Rosa Lind" />
      <div className="min-w-0">
        <p className="truncate font-medium">Rosa Lind</p>
        <p className="truncate text-[13px] text-[var(--ws-muted)]">Studio lead</p>
      </div>
    </div>
  );
}

function DemoAction() {
  return (
    <button type="button" className={DEMO_STYLE.primary}>
      <span aria-hidden="true" className="text-base leading-none">
        +
      </span>
      New project
    </button>
  );
}

export default function WorkspaceShellDemo(overrides: Partial<WorkspaceShellProps> = {}) {
  const uid = useId().replace(/:/g, "");
  const reduce = useLiveReducedMotion();
  const [view, setView] = useState("overview");
  const copy = VIEW_TITLES[view] ?? VIEW_TITLES.overview;
  const stage = overrides.theme === "light" ? "bg-[#ececec]" : "bg-[#050505]";

  return (
    <ReduceContext.Provider value={reduce}>
      <main className={`min-h-screen p-3 sm:p-6 ${stage}`}>
        <WorkspaceShell
          brand="Northstar"
          eyebrow="Studio workspace"
          title={copy.title}
          subtitle={copy.subtitle}
          links={DEMO_LINKS(uid)}
          activeId={view}
          onNavigate={setView}
          actions={<DemoAction />}
          railFooter={<DemoAccount />}
          navLabel="Studio"
          footer="All changes saved · Synced with Northstar Cloud at 09:42"
          className="h-[820px]"
          {...overrides}
        >
          <WorkspacePanels
            fill
            activeId={view}
            panels={[
              { id: "overview", content: <OverviewView uid={uid} active={view === "overview"} /> },
              { id: "projects", content: <ProjectsView uid={uid} active={view === "projects"} /> },
              { id: "activity", content: <ActivityView uid={uid} active={view === "activity"} /> },
            ]}
          />
        </WorkspaceShell>
      </main>
    </ReduceContext.Provider>
  );
}
