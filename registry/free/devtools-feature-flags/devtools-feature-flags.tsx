"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type FlagEnv = "production" | "preview" | "development";

export type FlagRule = {
  id: string;
  /** A clause that reads as part of a sentence, without a capital or a full stop. */
  text: string;
  on: boolean;
};

export type Flag = {
  key: string;
  name: string;
  description: string;
  owner: string;
  environments: Record<FlagEnv, boolean>;
  /** 0–100. */
  rollout: number;
  rules: FlagRule[];
};

export type FeatureFlagsProps = {
  project?: string;
  flags?: Flag[];
  /** Which flag is open. The list changes it too. */
  flag?: string;
  /** Rollout of the open flag. The slider changes it too. */
  rollout?: number;
  /** Show the targeting sentences. */
  showRules?: boolean;
  density?: "compact" | "comfortable";
  theme?: "dark" | "light";
  /** The one accent: the open flag’s edge, the rollout fill, and a served verdict. */
  accent?: string;
  onChange?: (flags: Flag[]) => void;
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const DEFAULT_ACCENT = "#7cc4ff";
const EASE = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const UI_SPRING = { type: "spring", stiffness: 500, damping: 40 } as const;

const ENVS: FlagEnv[] = ["production", "preview", "development"];
const ENV_LABEL: Record<FlagEnv, string> = { production: "Production", preview: "Preview", development: "Development" };

const PALETTE = {
  dark: {
    stage: "#000000",
    surface: "#0d0d0f",
    well: "#09090a",
    raised: "rgba(255,255,255,0.045)",
    ink: "#ededef",
    muted: "#98989a",
    faint: "#939399",
    line: "rgba(255,255,255,0.08)",
    lineStrong: "rgba(255,255,255,0.16)",
    track: "rgba(255,255,255,0.1)",
    err: "#f07c80",
    shadow: "inset 0 0 0 1px rgba(255,255,255,0.07), inset 0 1px 0 rgba(255,255,255,0.05), 0 40px 80px -40px rgba(0,0,0,0.9)",
  },
  light: {
    stage: "#f4f4f5",
    surface: "#ffffff",
    well: "#fafafa",
    raised: "rgba(17,17,19,0.045)",
    ink: "#17171a",
    muted: "#5d5d5f",
    faint: "#62626b",
    line: "rgba(17,17,19,0.09)",
    lineStrong: "rgba(17,17,19,0.18)",
    track: "rgba(17,17,19,0.1)",
    err: "#c2353b",
    shadow: "inset 0 0 0 1px rgba(17,17,19,0.08), 0 1px 2px rgba(17,17,19,0.05), 0 40px 80px -40px rgba(17,17,19,0.25)",
  },
} as const;

type Theme = keyof typeof PALETTE;

function paletteVars(theme: Theme, accent: string): CSSProperties {
  const p = PALETTE[theme];
  return {
    "--ff-surface": p.surface,
    "--ff-well": p.well,
    "--ff-raised": p.raised,
    "--ff-ink": p.ink,
    "--ff-muted": p.muted,
    "--ff-faint": p.faint,
    "--ff-line": p.line,
    "--ff-line-strong": p.lineStrong,
    "--ff-track": p.track,
    "--ff-err": p.err,
    "--ff-accent": accent,
    "--ff-accent-ink": theme === "light" ? `color-mix(in oklab, ${accent} 62%, #000)` : accent,
  } as CSSProperties;
}

/* ------------------------------------------------------------------ */
/* Sample                                                              */
/* ------------------------------------------------------------------ */

const SAMPLE = { name: "Northwind Ltd", bucket: 41 };

const DEFAULT_FLAGS: Flag[] = [
  {
    key: "new-checkout",
    name: "New checkout",
    description: "The single-page checkout, with saved cards and tax worked out before pay.",
    owner: "Mara Chen",
    environments: { production: true, preview: true, development: true },
    rollout: 25,
    rules: [
      { id: "plan", text: "the organisation is on the Team plan", on: true },
      { id: "region", text: "the request is served from London or Frankfurt", on: true },
    ],
  },
  {
    key: "invoice-pdf-v2",
    name: "Invoice PDF",
    description: "Regenerates invoice PDFs in the new type, with the payment link in the footer.",
    owner: "Jonah Adeyemi",
    environments: { production: true, preview: true, development: true },
    rollout: 100,
    rules: [{ id: "all", text: "every organisation", on: true }],
  },
  {
    key: "usage-forecast",
    name: "Usage forecast",
    description: "Shows the forecast cone on the billing page before the period ends.",
    owner: "Priya Shah",
    environments: { production: false, preview: true, development: true },
    rollout: 100,
    rules: [
      { id: "staff", text: "the member is staff", on: true },
      { id: "beta", text: "the request carries the beta header", on: false },
    ],
  },
  {
    key: "strict-idempotency",
    name: "Strict idempotency",
    description: "Rejects a repeated Idempotency-Key that arrives with a different body.",
    owner: "Elena Voss",
    environments: { production: false, preview: false, development: true },
    rollout: 50,
    rules: [{ id: "post", text: "the call is a POST to /v1/charges", on: true }],
  },
];

/* ------------------------------------------------------------------ */
/* Verdict                                                             */
/* ------------------------------------------------------------------ */

function clause(rules: FlagRule[]) {
  const on = rules.filter((r) => r.on);
  if (!on.length) return "";
  if (on.length === 1) return on[0].text;
  return `${on.slice(0, -1).map((r) => r.text).join(", ")} and ${on[on.length - 1].text}`;
}

function verdict(flag: Flag, killed: boolean): { tone: "accent" | "muted" | "err"; text: string } {
  if (killed) return { tone: "err", text: `${SAMPLE.name} is not served. The flag is killed.` };
  if (!flag.environments.production) return { tone: "muted", text: `${SAMPLE.name} is not served. The flag is off in production.` };
  const active = flag.rules.filter((r) => r.on);
  if (!active.length) return { tone: "muted", text: `${SAMPLE.name} is not served. No targeting rule is on.` };
  if (flag.rollout <= 0) return { tone: "muted", text: `${SAMPLE.name} is not served. The rollout is 0%.` };
  if (SAMPLE.bucket >= flag.rollout) {
    return { tone: "muted", text: `${SAMPLE.name} falls outside the ${flag.rollout}% rollout, so the flag is off.` };
  }
  return { tone: "accent", text: `${SAMPLE.name} is served.` };
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function FeatureFlags({
  project = "ledgerline",
  flags: flagsProp,
  flag: flagProp = "new-checkout",
  rollout: rolloutProp = 25,
  showRules = true,
  density = "comfortable",
  theme = "dark",
  accent = DEFAULT_ACCENT,
  onChange,
  className = "",
}: FeatureFlagsProps) {
  const reduce = !!useReducedMotion();
  const seed = useMemo(() => flagsProp ?? DEFAULT_FLAGS, [flagsProp]);
  const [flags, setFlags] = useState<Flag[]>(seed);
  const [selected, setSelected] = useState(flagProp);
  const [killed, setKilled] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const snapshot = useRef<Flag | null>(null);
  const rolloutSeen = useRef(rolloutProp);
  const reveal = useMemo(() => entrance(reduce), [reduce]);

  useEffect(() => {
    setSelected(flagProp);
    setAsking(false);
  }, [flagProp]);
  useEffect(() => {
    setFlags(seed);
    setKilled(null);
    setAsking(false);
    snapshot.current = null;
  }, [seed]);
  // The rollout control edits the open flag. It does not reset the others when you switch flags.
  useEffect(() => {
    if (rolloutSeen.current === rolloutProp) return;
    rolloutSeen.current = rolloutProp;
    setFlags((prev) => prev.map((f) => (f.key === selected ? { ...f, rollout: clamp(rolloutProp) } : f)));
    if (killed === selected) setKilled(null);
  }, [rolloutProp, selected, killed]);

  const current = flags.find((f) => f.key === selected) ?? flags[0];
  const rowPad = density === "compact" ? "py-2" : "py-3";

  const commit = (next: Flag[]) => {
    setFlags(next);
    onChange?.(next);
  };

  const patch = (key: string, edit: (flag: Flag) => Flag) => {
    commit(flags.map((f) => (f.key === key ? edit(f) : f)));
    if (killed === key) setKilled(null);
  };

  const confirmKill = () => {
    if (!current) return;
    snapshot.current = current;
    patch(current.key, (f) => ({
      ...f,
      rollout: 0,
      environments: { production: false, preview: false, development: false },
    }));
    setKilled(current.key);
    setAsking(false);
  };

  const undoKill = () => {
    const previous = snapshot.current;
    if (!previous) return;
    commit(flags.map((f) => (f.key === previous.key ? previous : f)));
    setKilled(null);
    snapshot.current = null;
  };

  return (
    <motion.section
      aria-label={`Feature flags for ${project}`}
      className={`@container w-full max-w-[920px] overflow-hidden rounded-[20px] font-sans text-(--ff-ink) ${className}`}
      style={{ ...paletteVars(theme, accent), background: PALETTE[theme].surface, boxShadow: PALETTE[theme].shadow }}
      initial="hidden"
      animate="shown"
      variants={reveal}
      custom={0}
    >
      <motion.header variants={reveal} custom={1} className="flex items-center justify-between gap-3 px-5 pt-5 @xl:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="size-2 shrink-0 rounded-full" style={{ background: "var(--ff-accent)" }} aria-hidden="true" />
          <h2 className="truncate font-mono text-[12.5px] tracking-[0.01em]">{project}</h2>
        </div>
        <p className="shrink-0 font-mono text-[11px] text-(--ff-faint) tabular-nums">{flags.length} flags</p>
      </motion.header>

      <motion.div variants={reveal} custom={2} className="px-5 pt-4 pb-5 @xl:px-6 @xl:pb-6">
        <div className="overflow-hidden rounded-[14px]" style={{ background: "var(--ff-well)", boxShadow: "inset 0 0 0 1px var(--ff-line)" }}>
          <ul aria-label="Flags">
            {flags.map((flag) => {
              const open = flag.key === current?.key;
              const isKilled = killed === flag.key;
              return (
                <li key={flag.key} className="border-b border-(--ff-line) last:border-b-0">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => {
                      setSelected(flag.key);
                      setAsking(false);
                    }}
                    className={`flex w-full cursor-pointer items-center justify-between gap-3 px-3.5 text-left transition-colors duration-150 hover:bg-(--ff-raised) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--ff-ink) @lg:px-4 ${rowPad} ${open ? "bg-(--ff-raised)" : ""}`}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        {open && <span className="h-3.5 w-[2px] shrink-0 rounded-full" style={{ background: "var(--ff-accent)" }} aria-hidden="true" />}
                        <span className="truncate text-[14px] tracking-[-0.01em]">{flag.name}</span>
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[11px] text-(--ff-faint)">{flag.key}</span>
                    </span>
                    <span className="shrink-0 text-right font-mono text-[12px] tabular-nums">
                      {isKilled ? <span style={{ color: "var(--ff-err)" }}>Killed</span> : <span className="text-(--ff-muted)">{flag.rollout}%</span>}
                      <span className="mt-0.5 block text-[11px] text-(--ff-faint)">{envSummary(flag)}</span>
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {open && current && (
                      <motion.div
                        key={current.key}
                        initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                        exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0, transition: { duration: 0.18, ease: EASE_IN } }}
                        transition={{ duration: reduce ? 0.12 : 0.32, ease: EASE }}
                        className="overflow-hidden"
                      >
                        <Detail
                          flag={current}
                          killed={isKilled}
                          asking={asking}
                          showRules={showRules}
                          reduce={reduce}
                          onEnv={(env) => patch(current.key, (f) => ({ ...f, environments: { ...f.environments, [env]: !f.environments[env] } }))}
                          onRollout={(rollout) => patch(current.key, (f) => ({ ...f, rollout }))}
                          onRule={(id) => patch(current.key, (f) => ({ ...f, rules: f.rules.map((r) => (r.id === id ? { ...r, on: !r.on } : r)) }))}
                          onAsk={() => setAsking(true)}
                          onCancel={() => setAsking(false)}
                          onKill={confirmKill}
                          onUndo={undoKill}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </div>
      </motion.div>
    </motion.section>
  );
}

function envSummary(flag: Flag) {
  const on = ENVS.filter((env) => flag.environments[env]);
  if (!on.length) return "Off everywhere";
  if (on.length === 3) return "All environments";
  return on.map((env) => ENV_LABEL[env]).join(", ");
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/* ------------------------------------------------------------------ */
/* Detail                                                              */
/* ------------------------------------------------------------------ */

function Detail({
  flag,
  killed,
  asking,
  showRules,
  reduce,
  onEnv,
  onRollout,
  onRule,
  onAsk,
  onCancel,
  onKill,
  onUndo,
}: {
  flag: Flag;
  killed: boolean;
  asking: boolean;
  showRules: boolean;
  reduce: boolean;
  onEnv: (env: FlagEnv) => void;
  onRollout: (n: number) => void;
  onRule: (id: string) => void;
  onAsk: () => void;
  onCancel: () => void;
  onKill: () => void;
  onUndo: () => void;
}) {
  const said = clause(flag.rules);
  const result = verdict(flag, killed);
  const tone = result.tone === "accent" ? "var(--ff-accent-ink)" : result.tone === "err" ? "var(--ff-err)" : "var(--ff-muted)";

  return (
    <div className={`border-t border-(--ff-line) px-3.5 pt-3 pb-4 @lg:px-4 ${killed ? "opacity-100" : ""}`}>
      <p className="max-w-[62ch] text-[13.5px] leading-[1.5] text-(--ff-muted)">{flag.description}</p>
      <p className="mt-1 font-mono text-[11px] text-(--ff-faint)">Owned by {flag.owner}</p>

      <div className="mt-4 flex flex-col @lg:flex-row @lg:flex-wrap @lg:gap-x-1" role="group" aria-label="Environments">
        {ENVS.map((env) => (
          <Switch
            key={env}
            on={flag.environments[env]}
            disabled={killed}
            label={ENV_LABEL[env]}
            reduce={reduce}
            demo={flag.key === "new-checkout" && env === "production" ? "env-production" : undefined}
            onToggle={() => onEnv(env)}
          />
        ))}
      </div>

      <div className={`mt-4 ${killed ? "pointer-events-none opacity-40" : ""}`}>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[13px]">Rollout</span>
          <span className="font-mono text-[13px] tabular-nums text-(--ff-ink)">{flag.rollout}%</span>
        </div>
        <Rollout value={flag.rollout} disabled={killed} onChange={onRollout} />
      </div>

      {showRules && (
        <div className="mt-4">
          <p className="text-[13.5px] leading-[1.55]">
            {said ? (
              <>
                Served when <span className="text-(--ff-ink)">{said}</span>.
              </>
            ) : (
              <span className="text-(--ff-muted)">No targeting rule is on.</span>
            )}
          </p>
          <ul className="mt-2 flex flex-col gap-1" aria-label="Targeting rules">
            {flag.rules.map((rule) => (
              <li key={rule.id}>
                <Switch
                  on={rule.on}
                  disabled={killed}
                  label={rule.text}
                  reduce={reduce}
                  strike={!rule.on}
                  demo={flag.key === "new-checkout" && rule.id === "region" ? "rule-region" : undefined}
                  onToggle={() => onRule(rule.id)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 font-mono text-[12px] leading-[1.5]" style={{ color: tone }} aria-live="polite">
        {result.text}
      </p>

      <div className="mt-4 flex flex-col gap-2 border-t border-(--ff-line) pt-3 @lg:flex-row @lg:items-center @lg:justify-between">
        <p className="text-[12.5px] leading-snug text-(--ff-muted)">{killed ? "Off in every environment." : "Turns the flag off in every environment."}</p>
        <div className="flex w-full gap-2 @lg:w-auto">
          {killed ? (
            <QuietButton onClick={onUndo}>Undo</QuietButton>
          ) : asking ? (
            <>
              <QuietButton onClick={onCancel}>Cancel</QuietButton>
              <button
                type="button"
                data-demo="kill-confirm"
                onClick={onKill}
                className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-[9px] px-3.5 text-[13px] font-medium transition-transform duration-100 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ff-ink) @lg:h-8 @lg:flex-none"
                style={{ background: "var(--ff-ink)", color: "var(--ff-surface)" }}
              >
                Kill now
              </button>
            </>
          ) : (
            <button
              type="button"
              data-demo={flag.key === "new-checkout" ? "kill" : undefined}
              onClick={onAsk}
              className="inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-[9px] px-3.5 text-[13px] transition-[color,transform] duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ff-ink) @lg:h-8 @lg:w-auto"
              style={{ color: "var(--ff-err)", boxShadow: "inset 0 0 0 1px var(--ff-line-strong)" }}
            >
              Kill
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Switch({
  on,
  label,
  disabled,
  reduce,
  strike,
  demo,
  onToggle,
}: {
  on: boolean;
  label: string;
  disabled?: boolean;
  reduce: boolean;
  strike?: boolean;
  demo?: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      data-demo={demo}
      disabled={disabled}
      onClick={onToggle}
      className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left transition-[background-color,transform] duration-150 hover:bg-(--ff-raised) enabled:active:scale-[0.98] motion-reduce:enabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ff-ink) disabled:cursor-not-allowed disabled:opacity-40 @lg:min-h-10 @lg:w-fit @lg:justify-start @lg:px-2.5"
    >
      <span className={`min-w-0 text-[13px] leading-snug ${strike ? "text-(--ff-faint) line-through decoration-(--ff-line-strong)" : on ? "text-(--ff-ink)" : "text-(--ff-muted)"}`}>{label}</span>
      <span className="relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150" style={{ background: on ? "var(--ff-ink)" : "var(--ff-track)" }} aria-hidden="true">
        <motion.span
          className="absolute top-0.5 left-0.5 size-4 rounded-full"
          animate={{ x: on ? 16 : 0 }}
          transition={reduce ? { duration: 0 } : UI_SPRING}
          style={{ background: on ? "var(--ff-surface)" : "var(--ff-muted)" }}
        />
      </span>
    </button>
  );
}

function Rollout({ value, disabled, onChange }: { value: number; disabled: boolean; onChange: (n: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef(false);

  const fromClient = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || box.width <= 0) return;
    onChange(clamp(((clientX - box.left) / box.width) * 100));
  };

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    drag.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    fromClient(e.clientX);
  };

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label="Rollout percentage"
      aria-disabled={disabled || undefined}
      data-demo="rollout"
      onPointerDown={down}
      onPointerMove={(e) => {
        if (drag.current && e.currentTarget.hasPointerCapture(e.pointerId)) fromClient(e.clientX);
      }}
      onPointerUp={() => {
        drag.current = false;
      }}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          onChange(clamp(value + (e.shiftKey ? 10 : 5)));
        }
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          onChange(clamp(value - (e.shiftKey ? 10 : 5)));
        }
        if (e.key === "Home") onChange(0);
        if (e.key === "End") onChange(100);
      }}
      className={`group relative h-11 touch-pan-y rounded-[8px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ff-ink) ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span className="absolute top-1/2 right-0 left-0 h-1.5 -translate-y-1/2 rounded-full" style={{ background: "var(--ff-track)" }} />
      <span className="absolute top-1/2 left-0 h-1.5 -translate-y-1/2 rounded-full" style={{ width: `${value}%`, background: "var(--ff-accent)" }} />
      <span
        className={`absolute top-1/2 size-4 -translate-y-1/2 rounded-full transition-[scale,box-shadow] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${disabled ? "" : "group-hover:shadow-[0_0_0_6px_color-mix(in_srgb,var(--ff-ink)_16%,transparent)] group-active:scale-[1.12] group-active:shadow-[0_0_0_7px_color-mix(in_srgb,var(--ff-ink)_22%,transparent)] motion-reduce:group-active:scale-100"}`}
        style={{ left: `clamp(0px, calc(${value}% - 8px), calc(100% - 16px))`, background: "var(--ff-ink)" }}
      />
    </div>
  );
}

function QuietButton({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-[9px] px-3 text-[13px] text-(--ff-muted) transition-[color,transform] duration-150 hover:text-(--ff-ink) active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ff-ink) @lg:h-8 @lg:flex-none"
    >
      {children}
    </button>
  );
}

function entrance(reduce: boolean): Variants {
  return {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(6px)" },
    shown: (index: number) => ({
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transitionEnd: { filter: "none" },
      transition: reduce ? { duration: 0.15 } : { duration: 0.56, ease: EASE, delay: 0.06 + index * 0.06 },
    }),
  };
}

/** Feature flags for ledgerline, on a quiet stage. */
export default function FeatureFlagsDemo(overrides: Partial<FeatureFlagsProps> = {}) {
  const theme: Theme = overrides.theme ?? "dark";
  return (
    <div className="flex min-h-dvh w-full items-center justify-center px-4 py-8 sm:px-8" style={{ background: PALETTE[theme].stage }}>
      <FeatureFlags {...overrides} theme={theme} />
    </div>
  );
}
