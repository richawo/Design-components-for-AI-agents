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
} from "react";
import { motion, useReducedMotion } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export type ThemeToggleProps = {
  /** The chosen mode. "system" follows the operating system. */
  mode?: ThemeMode;
  onModeChange?: (mode: ThemeMode) => void;
  /** "icon" is a single sun/moon button; "segmented" adds System. */
  variant?: "icon" | "segmented";
  /** Wipe the new theme across the page in a circle from the control (View Transitions). */
  reveal?: boolean;
  /** Reveal duration in ms. */
  revealMs?: number;
  /** The surface the control sits on, so its own chrome matches. Defaults to the resolved theme. */
  surface?: ResolvedTheme;
  size?: "sm" | "md";
  /** Segmented only: show the words beside the glyphs. Icon-only segments keep their names for assistive tech. */
  labels?: boolean;
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

const INK = {
  dark: { ink: "#ededef", soft: "#a0a0a8", wash: "rgba(255,255,255,0.06)", well: "rgba(255,255,255,0.04)", hair: "rgba(255,255,255,0.09)", pill: "rgba(255,255,255,0.1)", ring: "#ededef" },
  light: { ink: "#111113", soft: "#6b6b73", wash: "rgba(0,0,0,0.05)", well: "rgba(0,0,0,0.035)", hair: "rgba(0,0,0,0.08)", pill: "#ffffff", ring: "#111113" },
} as const;

/** cubic-bezier(0.2, 0, 0, 1): fast out of the gate, long settle, no overshoot. */
const SNAPPY = "cubic-bezier(0.2,0,0,1)";
const GLYPH_MS = 450;
/** A host that ignores onModeChange must not hold the view transition forever. */
const COMMIT_TIMEOUT_MS = 320;
/** Scopes the snapshot overrides to our own reveal, so other view transitions on the page keep theirs. */
const REVEAL_CLASS = "tt-revealing";
const SIZE = { sm: { button: 32, segment: 28 }, md: { button: 36, segment: 32 } } as const;

const OPTIONS: { mode: ThemeMode; label: string }[] = [
  { mode: "light", label: "Light" },
  { mode: "system", label: "System" },
  { mode: "dark", label: "Dark" },
];

/* ------------------------------------------------------------------ */
/* Hooks                                                                */
/* ------------------------------------------------------------------ */

function useSystemTheme(): ResolvedTheme {
  const [theme, setTheme] = useState<ResolvedTheme>("dark");
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setTheme(query.matches ? "dark" : "light");
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return theme;
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => Promise<void>) => { ready: Promise<void>; finished: Promise<void> };
};

/**
 * Runs a theme change inside a view transition and clips the new snapshot to
 * a circle that grows from `origin` to the farthest corner. The update promise
 * resolves when React has committed the new theme (see `settle`), so the
 * browser captures the right "after" frame without flushSync.
 */
function useCircularReveal(enabled: boolean, durationMs: number) {
  const reduce = useReducedMotion();
  const pending = useRef<(() => void) | null>(null);

  const settle = useCallback(() => {
    pending.current?.();
    pending.current = null;
  }, []);

  const run = useCallback(
    (origin: { x: number; y: number }, update: () => void) => {
      const doc = document as ViewTransitionDocument;
      if (!enabled || !doc.startViewTransition) {
        update();
        return;
      }
      document.documentElement.classList.add(REVEAL_CLASS);
      const transition = doc.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            const timer = window.setTimeout(resolve, COMMIT_TIMEOUT_MS);
            pending.current = () => {
              window.clearTimeout(timer);
              resolve();
            };
            update();
          }),
      );
      transition.ready
        .then(() => {
          const radius = Math.hypot(Math.max(origin.x, window.innerWidth - origin.x), Math.max(origin.y, window.innerHeight - origin.y));
          const keyframes = reduce
            ? { opacity: [0, 1] }
            : { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${radius}px at ${origin.x}px ${origin.y}px)`] };
          document.documentElement.animate(keyframes, {
            duration: reduce ? 150 : durationMs,
            easing: "cubic-bezier(0.65, 0, 0.35, 1)",
            pseudoElement: "::view-transition-new(root)",
          });
        })
        .catch(() => {
          /* A newer transition interrupted this one. */
        });
      const cleanup = () => document.documentElement.classList.remove(REVEAL_CLASS);
      transition.finished.then(cleanup, cleanup);
    },
    [enabled, durationMs, reduce],
  );

  return { run, settle };
}

/* ------------------------------------------------------------------ */
/* Glyphs                                                               */
/* ------------------------------------------------------------------ */

const RAYS = Array.from({ length: 8 }, (_, i) => i * 45);

function Sun({ shown }: { shown: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      {RAYS.map((deg, i) => (
        <g key={deg} transform={`rotate(${deg} 12 12)`}>
          {/* Rays extend one after another as the sun arrives. */}
          <path
            d="M12 2.6v2.1"
            className="tt-ray"
            style={{ transform: shown ? "scale(1)" : "scale(0)", transitionDelay: shown ? `${120 + i * 28}ms` : "0ms" }}
          />
        </g>
      ))}
    </svg>
  );
}

function Moon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19.6 14.4A8 8 0 1 1 9.6 4.4a6.4 6.4 0 0 0 10 10Z" />
    </svg>
  );
}

function Monitor() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="11.5" rx="2.2" />
      <path d="M9 20h6M12 16v4" />
    </svg>
  );
}

/** Sun and moon share one box and cross-rotate: the leaver turns away and shrinks, the arriver turns in. */
function SunMoon({ dark }: { dark: boolean }) {
  const face = (shown: boolean, away: number): CSSProperties => ({
    opacity: shown ? 1 : 0,
    transform: shown ? "rotate(0deg) scale(1)" : `rotate(${away}deg) scale(0.5)`,
  });
  return (
    <span aria-hidden="true" className="relative block size-[18px]">
      <span className="tt-face absolute inset-0 grid place-items-center" style={face(!dark, -90)}>
        <Sun shown={!dark} />
      </span>
      <span className="tt-face absolute inset-0 grid place-items-center" style={face(dark, 90)}>
        <Moon />
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function ThemeToggle({
  mode: modeProp,
  onModeChange,
  variant = "icon",
  reveal = true,
  revealMs = 560,
  surface,
  size = "md",
  labels = true,
  className = "",
}: ThemeToggleProps) {
  const reduce = useReducedMotion();
  const system = useSystemTheme();
  const [ownMode, setOwnMode] = useState<ThemeMode>("dark");
  const mode = modeProp ?? ownMode;
  const resolved: ResolvedTheme = mode === "system" ? system : mode;
  const ink = INK[surface ?? resolved];
  const { run, settle } = useCircularReveal(reveal, revealMs);
  const pillId = useId();
  const groupRef = useRef<HTMLDivElement>(null);

  // The theme has committed: let the view transition capture its new frame.
  useLayoutEffect(() => {
    settle();
  }, [resolved, mode, settle]);

  const choose = useCallback(
    (next: ThemeMode, from: HTMLElement | null) => {
      if (next === mode) return;
      const r = from?.getBoundingClientRect();
      const origin = r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth / 2, y: 0 };
      const apply = () => {
        if (modeProp === undefined) setOwnMode(next);
        onModeChange?.(next);
      };
      const nextResolved = next === "system" ? system : next;
      // Picking System while it already matches the screen changes nothing visible: skip the wipe.
      if (nextResolved === resolved) apply();
      else run(origin, apply);
    },
    [mode, modeProp, onModeChange, run, system, resolved],
  );

  const vars = { "--tt-ink": ink.ink, "--tt-soft": ink.soft, "--tt-wash": ink.wash, "--tt-ring": ink.ring } as CSSProperties;

  if (variant === "icon") {
    const dark = resolved === "dark";
    const label = dark ? "Switch to light theme" : "Switch to dark theme";
    return (
      <span className={`inline-flex ${className}`} style={vars}>
        <style>{CSS}</style>
        <button
          type="button"
          data-demo="toggle"
          aria-label={label}
          title={label}
          aria-pressed={dark}
          onClick={(e) => choose(dark ? "light" : "dark", e.currentTarget)}
          className="tt-button group relative grid place-items-center rounded-[10px]"
          style={{ width: SIZE[size].button, height: SIZE[size].button }}
        >
          <span aria-hidden="true" className="tt-halo pointer-events-none absolute inset-0 rounded-[10px]" />
          <span className="tt-glyph relative">
            <SunMoon dark={dark} />
          </span>
        </button>
      </span>
    );
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    const at = OPTIONS.findIndex((o) => o.mode === mode);
    let next = -1;
    if (step) next = (at + step + OPTIONS.length) % OPTIONS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = OPTIONS.length - 1;
    if (next < 0) return;
    event.preventDefault();
    const target = groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next] ?? null;
    target?.focus();
    choose(OPTIONS[next].mode, target);
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label="Theme"
      onKeyDown={onKeyDown}
      className={`relative inline-flex rounded-[11px] p-[3px] ${className}`}
      style={{ ...vars, background: ink.well, boxShadow: `inset 0 0 0 1px ${ink.hair}` }}
    >
      <style>{CSS}</style>
      {OPTIONS.map((o) => {
        const selected = o.mode === mode;
        return (
          <button
            key={o.mode}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            aria-label={labels ? undefined : o.label}
            title={labels ? undefined : o.label}
            data-demo={`mode-${o.mode}`}
            onClick={(e) => choose(o.mode, e.currentTarget)}
            className={`tt-seg group relative flex items-center justify-center gap-1.5 rounded-[8px] font-medium ${size === "sm" ? "text-[12.5px]" : "text-[13px]"}`}
            style={{ color: selected ? ink.ink : ink.soft, height: SIZE[size].segment, paddingInline: labels ? (size === "sm" ? 10 : 12) : 0, width: labels ? undefined : SIZE[size].segment + 6 }}
          >
            {selected && (
              <motion.span
                layoutId={`${pillId}-pill`}
                aria-hidden="true"
                className="absolute inset-0 rounded-[8px]"
                style={{
                  background: ink.pill,
                  boxShadow: surface === "light" || (!surface && resolved === "light")
                    ? "0 1px 2px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06)"
                    : "inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 2px rgba(0,0,0,0.4)",
                }}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <span className="tt-glyph relative grid size-4 place-items-center">
              {o.mode === "light" ? (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  {RAYS.map((deg) => (
                    <path key={deg} d="M12 2.6v2.1" transform={`rotate(${deg} 12 12)`} />
                  ))}
                </svg>
              ) : o.mode === "dark" ? (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19.6 14.4A8 8 0 1 1 9.6 4.4a6.4 6.4 0 0 0 10 10Z" />
                </svg>
              ) : (
                <Monitor />
              )}
            </span>
            {labels && <span className="relative">{o.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

// The ring has no transition so it appears the instant focus arrives; the
// glyph lifts and presses like every other icon control.
const CSS = `
.tt-button, .tt-seg { color: var(--tt-soft); transition: color 140ms ease, transform 90ms ease; -webkit-tap-highlight-color: transparent; }
.tt-button:hover, .tt-seg:hover { color: var(--tt-ink); }
.tt-button:active { transform: scale(0.94); }
.tt-seg:active .tt-glyph { transform: scale(0.9); }
.tt-button:focus-visible, .tt-seg:focus-visible { outline: 2px solid var(--tt-ring); outline-offset: 2px; transition: none; }
.tt-halo { opacity: 0; background: radial-gradient(circle, var(--tt-wash), transparent 72%), var(--tt-wash); transition: opacity 160ms ease; }
.tt-button:hover .tt-halo { opacity: 1; }
.tt-glyph { transition: transform 180ms ${SNAPPY}; }
.tt-button:hover .tt-glyph { transform: translateY(-1px) scale(1.06); }
.tt-button:active .tt-glyph { transform: scale(0.92); transition-duration: 90ms; }
.tt-face { transition: opacity ${GLYPH_MS}ms ${SNAPPY}, transform ${GLYPH_MS}ms ${SNAPPY}; }
.tt-ray { transform-box: fill-box; transform-origin: 50% 100%; transition: transform 260ms ${SNAPPY}; }
html.${REVEAL_CLASS}::view-transition-old(root), html.${REVEAL_CLASS}::view-transition-new(root) { animation: none; mix-blend-mode: normal; }
@media (prefers-reduced-motion: reduce) {
  .tt-face, .tt-ray, .tt-glyph { transition: opacity 150ms ease !important; transform: none !important; }
}
`;

/* ------------------------------------------------------------------ */
/* Demo                                                                 */
/* ------------------------------------------------------------------ */

type DemoStage = {
  /** Stage only: jump the preview to a mode. */
  set?: ThemeMode;
};

const STAGE = {
  dark: { bg: "#08080a", card: "#0f0f11", ink: "#ededef", soft: "#8b8b93", hair: "rgba(255,255,255,0.08)", bar: "rgba(255,255,255,0.08)" },
  light: { bg: "#f6f6f4", card: "#ffffff", ink: "#111113", soft: "#6b6b73", hair: "rgba(0,0,0,0.08)", bar: "rgba(0,0,0,0.07)" },
} as const;

type ThemeToggleDemoProps = Partial<ThemeToggleProps> & DemoStage;

export default function ThemeToggleDemo({ set, mode: modeOverride, ...overrides }: ThemeToggleDemoProps = {}) {
  const [mode, setMode] = useState<ThemeMode>(modeOverride ?? "dark");
  const system = useSystemTheme();
  useEffect(() => {
    if (set) setMode(set);
  }, [set]);
  useEffect(() => {
    if (modeOverride) setMode(modeOverride);
  }, [modeOverride]);
  const resolved: ResolvedTheme = mode === "system" ? system : mode;
  const s = STAGE[resolved];

  return (
    <div className="@container min-h-[460px] w-full font-sans" style={{ background: s.bg, color: s.ink, colorScheme: resolved }}>
      <header className="flex h-14 items-center justify-between border-b px-4 @md:px-6" style={{ borderColor: s.hair }}>
        <span className="font-display text-[15px] font-semibold tracking-[-0.03em]">Margin</span>
        <div className="flex items-center gap-1">
          <span className="mr-2 hidden font-mono text-[11px] uppercase tracking-[0.08em] @sm:inline" style={{ color: s.soft }}>
            {mode === "system" ? `System · ${resolved}` : resolved}
          </span>
          <ThemeToggle {...overrides} variant="icon" mode={mode} onModeChange={setMode} />
        </div>
      </header>
      <div className="mx-auto flex max-w-[560px] flex-col gap-6 px-5 py-10 @md:py-14">
        <article className="rounded-[16px] border p-5 @md:p-6" style={{ background: s.card, borderColor: s.hair, boxShadow: resolved === "dark" ? "inset 0 1px 0 rgba(255,255,255,0.04)" : "0 1px 2px rgba(0,0,0,0.04)" }}>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em]" style={{ color: s.soft }}>
            Reading · 6 min
          </p>
          <h3 className="mt-2 font-display text-[22px] font-semibold leading-[1.15] tracking-[-0.03em]">Night mode is a promise about 2 a.m.</h3>
          <p className="mt-3 max-w-[52ch] text-[15px] leading-[1.6]" style={{ color: s.soft }}>
            Whoever opens your app in the dark has already decided how bright the world should be. Respect it, remember it, and make the switch feel like turning a lamp, not flipping a breaker.
          </p>
          <div className="mt-5 flex gap-1.5" aria-hidden="true">
            {[68, 44, 56].map((w) => (
              <span key={w} className="h-1.5 rounded-full" style={{ width: `${w}px`, background: s.bar }} />
            ))}
          </div>
        </article>
        <div className="flex flex-col items-start gap-2 @sm:flex-row @sm:items-center @sm:justify-between">
          <span className="text-[13.5px]" style={{ color: s.soft }}>
            Appearance
          </span>
          <ThemeToggle {...overrides} variant="segmented" mode={mode} onModeChange={setMode} />
        </div>
      </div>
    </div>
  );
}
