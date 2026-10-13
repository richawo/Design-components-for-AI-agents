"use client";

import { useEffect, useId, useState, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

export type WorkspaceLink = { id: string; label: string; href: string };
export type WorkspaceShellProps = {
  brand?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  links?: WorkspaceLink[];
  activeId?: string;
  onNavigate?: (id: string) => void;
  contentClassName?: string;
  actions?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  theme?: "dark" | "light";
  className?: string;
};

function useLiveReducedMotion() {
  const initial = useReducedMotion();
  const [reduce, setReduce] = useState(!!initial);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduce;
}

/** A container-responsive frame; links point at actual host routes or section anchors. */
export function WorkspaceShell({ brand = "Northstar", eyebrow = "Workspace", title = "Overview", subtitle, links = [], activeId, onNavigate, contentClassName = "", actions, children, footer, theme = "dark", className = "" }: WorkspaceShellProps) {
  const reduce = useLiveReducedMotion();
  const [active, setActive] = useState<string | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const focused = useRef<HTMLElement | null>(null);
  const style = {
    "--ws-bg": theme === "dark" ? "#09090a" : "#f7f7f5",
    "--ws-surface": theme === "dark" ? "#101012" : "#ffffff",
    "--ws-ink": theme === "dark" ? "#f4f4f5" : "#171719",
    "--ws-muted": theme === "dark" ? "#a1a1aa" : "#55555e",
    "--ws-line": theme === "dark" ? "#262629" : "#dedee2",
    "--ws-wash": theme === "dark" ? "#1b1b1e" : "#ededee",
    colorScheme: theme,
  } as CSSProperties;
  const preferred = activeId ?? active;
  const current = links.some(link => link.id === preferred) ? preferred : links[0]?.id;
  // A content action can retire the focused panel. Hand focus to its visible
  // navigation tab after child panels have applied inert, including scope changes.
  useLayoutEffect(() => {
    if (!onNavigate || !focused.current?.closest("[data-workspace-panel][inert]")) return;
    const shell = frame.current;
    const doc = shell?.ownerDocument;
    if (!shell || !doc?.hasFocus()) return;
    if (doc.activeElement !== doc.body && doc.activeElement && !shell.contains(doc.activeElement)) return;
    const target = [...(frame.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])].find(button => button.dataset.demo === `nav-${current}` && button.getClientRects().length);
    target?.focus({ preventScroll: true });
  });
  const navigate = (id: string) => { setActive(id); onNavigate?.(id); };
  const nav = (mobile: boolean) => <nav role={onNavigate ? "tablist" : undefined} aria-orientation={onNavigate ? (mobile ? "horizontal" : "vertical") : undefined} aria-label={mobile ? "Workspace sections, compact" : "Workspace sections"} className={mobile ? "flex gap-1 overflow-x-auto px-3 py-2 @3xl/ws:hidden" : "hidden flex-col gap-1 px-3 @3xl/ws:flex"}>
    {links.map((link, index) => {
      const selected = current === link.id;
      const classes = `flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors hover:bg-[var(--ws-wash)] hover:text-[var(--ws-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ws-ink)] ${selected ? "bg-[var(--ws-wash)] text-[var(--ws-ink)]" : "text-[var(--ws-muted)]"}`;
      const label = <><span aria-hidden="true" className="size-1 rounded-full bg-current opacity-60"/>{link.label}</>;
      return onNavigate ? <button key={link.id} type="button" role="tab" aria-selected={selected} aria-controls={link.href.startsWith("#") ? link.href.slice(1) : undefined} tabIndex={selected ? 0 : -1} data-demo={`nav-${link.id}`} className={classes} onClick={() => navigate(link.id)} onKeyDown={event => {
        const step = ["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : ["ArrowUp", "ArrowLeft"].includes(event.key) ? -1 : 0;
        if (!step && !["Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? links.length - 1 : (index + step + links.length) % links.length;
        navigate(links[next].id);
        event.currentTarget.closest("nav")?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
      }}>{label}</button> : <a key={link.id} href={link.href} data-demo={`nav-${link.id}`} aria-current={selected ? "location" : undefined} onClick={() => navigate(link.id)} className={classes}>{label}</a>;
    })}
  </nav>;
  return <div ref={frame} onFocusCapture={event => { focused.current = event.target as HTMLElement; }} onBlurCapture={event => {
    // Retiring an inert panel can blur to the body with no related target.
    // Explicit outside focus belongs to the host and must never be reclaimed.
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node)) focused.current = null;
  }} style={style} className={`@container/ws isolate w-full rounded-2xl border border-[var(--ws-line)] bg-[var(--ws-bg)] text-[var(--ws-ink)] [overflow-wrap:anywhere] ${className}`}>
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] @3xl/ws:grid-cols-[188px_minmax(0,1fr)] @3xl/ws:grid-rows-1">
      <aside className="rounded-t-[15px] border-b border-[var(--ws-line)] bg-[var(--ws-surface)] @3xl/ws:rounded-tr-none @3xl/ws:rounded-bl-[15px] @3xl/ws:border-r @3xl/ws:border-b-0">
        <div className="flex min-h-[76px] items-center gap-3 px-6 @3xl/ws:mb-6"><span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg border border-[var(--ws-line)] font-serif text-xl">{brand.trim().slice(0,1).toUpperCase()||"N"}</span><span className="text-sm font-medium tracking-tight">{brand}</span></div>
        {links.length > 0 && nav(false)}
        <p className="mt-8 hidden px-6 pb-6 font-mono text-[10px] leading-relaxed uppercase tracking-[.13em] text-[var(--ws-muted)] @3xl/ws:block">{eyebrow}</p>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-col">
        {links.length > 0 && <div className="border-b border-[var(--ws-line)] bg-[var(--ws-surface)] @3xl/ws:hidden">{nav(true)}</div>}
        <motion.header initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? .12 : .32 }} className="motion-reduce:!transform-none relative z-20 flex shrink-0 flex-wrap items-end justify-between gap-5 border-b border-[var(--ws-line)] px-5 py-7 @lg/ws:px-8 @lg/ws:py-8">
          <div className="min-w-0"><p className="font-mono text-[10px] uppercase tracking-[.16em] text-[var(--ws-muted)]">{eyebrow}</p><h2 className="mt-3 font-display text-[clamp(1.8rem,3.3cqi,2.5rem)] font-medium leading-[1.08] tracking-[-.045em]">{title}</h2>{subtitle&&<p className="mt-3 max-w-[62ch] text-sm leading-[1.75] text-[var(--ws-muted)]">{subtitle}</p>}</div>
          {actions && <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>}
        </motion.header>
        <div className={`min-h-0 min-w-0 flex-1 space-y-6 overflow-auto p-4 @lg/ws:p-6 @3xl/ws:p-7 ${contentClassName}`}>{children}</div>
        {footer && <footer className="shrink-0 border-t border-[var(--ws-line)] px-5 py-4 text-xs leading-relaxed text-[var(--ws-muted)] @lg/ws:px-8">{footer}</footer>}
      </div>
    </div>
  </div>;
}

export default function WorkspaceShellDemo(overrides: Partial<WorkspaceShellProps> = {}) {
  const uid = useId().replace(/:/g, "");
  return <main className="min-h-screen bg-[#050505] p-3 sm:p-6"><WorkspaceShell brand="Northstar" eyebrow="Studio workspace" title="Monday, considered." subtitle="A quiet place to review today's work and find the next useful action." links={[{id:"overview",label:"Overview",href:`#${uid}-overview`},{id:"projects",label:"Projects",href:`#${uid}-projects`},{id:"activity",label:"Activity",href:`#${uid}-activity`}]} footer="Northstar Studio · 12 October 2026" {...overrides}>
    <section id={`${uid}-overview`} className="grid scroll-mt-5 gap-3 sm:grid-cols-3">{[["Active projects","12"],["Due this week","4"],["Reviews ready","3"]].map(([label,value])=><div key={label} className="rounded-xl border border-[var(--ws-line)] bg-[var(--ws-surface)] p-5"><h3 className="text-xs text-[var(--ws-muted)]">{label}</h3><p className="mt-3 text-3xl font-medium tracking-tight">{value}</p></div>)}</section>
    <section id={`${uid}-projects`} className="scroll-mt-5 rounded-xl border border-[var(--ws-line)] bg-[var(--ws-surface)] p-5"><h3 className="text-sm font-medium">On the desk</h3><div className="mt-4 divide-y divide-[var(--ws-line)]">{[["Autumn collection","Design review","Alex Morgan"],["Partner portal","Ready for handoff","Noor Ali"],["October report","In progress","Casey Jones"]].map(([name,state,owner])=><div key={name} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"><span>{name}</span><span className="text-xs text-[var(--ws-muted)]">{state} · {owner}</span></div>)}</div></section>
    <section id={`${uid}-activity`} className="scroll-mt-5 rounded-xl border border-[var(--ws-line)] bg-[var(--ws-surface)] p-5"><h3 className="text-sm font-medium">Recent activity</h3><p className="mt-4 text-sm leading-relaxed text-[var(--ws-muted)]">09:42 · Noor shared the partner portal for review.</p><p className="mt-3 text-sm leading-relaxed text-[var(--ws-muted)]">09:18 · Alex updated the autumn collection notes.</p></section>
  </WorkspaceShell></main>;
}

export type WorkspacePanel = { id: string; content: ReactNode };
export type WorkspacePanelsProps = { activeId: string; panels: WorkspacePanel[]; className?: string; fill?: boolean };

/** Keep drafts mounted while the visible view changes without scaling its text. */
export function WorkspacePanels({ activeId, panels, className = "", fill = false }: WorkspacePanelsProps) {
  const reduce = useLiveReducedMotion();
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const [height, setHeight] = useState<number | "auto">("auto");
  const valid = panels.filter((panel, index) => panel.id && panels.findIndex(other => other.id === panel.id) === index);
  const current = valid.find(panel => panel.id === activeId)?.id ?? valid[0]?.id;
  useLayoutEffect(() => {
    if (fill) return;
    const node = current ? nodes.current.get(current) : undefined;
    if (!node) { setHeight(0); return; }
    const measure = () => setHeight(node.offsetHeight);
    measure();const observer = new ResizeObserver(measure);observer.observe(node);
    return () => observer.disconnect();
  }, [current, fill]);
  const [moving, setMoving] = useState(false);
  return <motion.div initial={false} animate={{ height: fill ? "100%" : height }} onAnimationStart={() => setMoving(true)} onAnimationComplete={() => setMoving(false)} transition={{ duration: reduce ? 0 : .24, ease: [.22, 1, .36, 1] }} style={{ overflow: fill || moving ? "hidden" : "visible" }} className={`relative ${className}`}>
    {valid.map(panel => <RetainedWorkspacePanel key={panel.id} panel={panel} active={panel.id === current} reduce={!!reduce} fill={fill} bind={node => { if (node) nodes.current.set(panel.id, node); else nodes.current.delete(panel.id); }} />)}
  </motion.div>;
}
function RetainedWorkspacePanel({ panel, active, reduce, fill, bind }: { panel: WorkspacePanel; active: boolean; reduce: boolean; fill: boolean; bind: (node: HTMLDivElement | null) => void }) {
  const [exiting, setExiting] = useState(active);
  useLayoutEffect(() => { if (active) setExiting(true); }, [active]);
  return <motion.div ref={bind} data-workspace-panel={panel.id} inert={!active} aria-hidden={!active || undefined} initial={false} animate={{ opacity: active ? 1 : 0, y: active || reduce ? 0 : 6 }} transition={{ duration: reduce ? .1 : .2 }} onAnimationComplete={() => { if (!active) setExiting(false); }} style={{ display: active || exiting ? "block" : "none", position: active ? "relative" : "absolute", insetInline: 0, top: 0, pointerEvents: active ? "auto" : "none" }} className={`motion-reduce:!transform-none ${fill ? "h-full min-h-0 overflow-auto" : ""}`}>{panel.content}</motion.div>;
}
