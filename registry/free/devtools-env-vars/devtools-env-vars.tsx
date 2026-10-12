"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactElement } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type EnvName = "production" | "preview" | "development";

export type EnvVar = {
  key: string;
  /** True for secrets. Public values (NEXT_PUBLIC_, log level) stay readable. */
  sensitive: boolean;
  /** Relative time, e.g. "6d ago". */
  updated: string;
  /** Which environments currently hold the variable. */
  scopes: Record<EnvName, boolean>;
  /** Stored per environment, including ones that are switched off, so a scope can come back. */
  values: Record<EnvName, string>;
};

export type EnvVarsProps = {
  /** Project name in the header. */
  project?: string;
  /** Variables to edit. Defaults to a ledgerline sample. */
  variables?: EnvVar[];
  /** Which environment is on screen. The switcher changes it too. */
  environment?: EnvName;
  /** Mask secrets until their reveal control is pressed. */
  mask?: boolean;
  density?: "compact" | "comfortable";
  theme?: "dark" | "light";
  /** The one accent: the project dot, a new key in a paste, and the redeploy mark. */
  accent?: string;
  /** Called with the next variable list after a scope edit or an import. */
  onChange?: (variables: EnvVar[]) => void;
  /** Called once a redeploy finishes. */
  onRedeploy?: (environment: EnvName) => void;
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const DEFAULT_ACCENT = "#7cc4ff";
const EASE = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const UI_SPRING = { type: "spring", stiffness: 500, damping: 40 } as const;

const ENVS = ["production", "preview", "development"] as const;
const ENV_LABEL: Record<EnvName, string> = { production: "Production", preview: "Preview", development: "Development" };
const ENV_SHORT: Record<EnvName, string> = { production: "Prod", preview: "Prev", development: "Dev" };

const PALETTE = {
  dark: {
    stage: "#000000",
    surface: "#0d0d0f",
    well: "#09090a",
    raised: "rgba(255,255,255,0.045)",
    ink: "#ededef",
    muted: "#98989a",
    faint: "#7d7d80",
    line: "rgba(255,255,255,0.08)",
    lineStrong: "rgba(255,255,255,0.16)",
    warn: "#f5b452",
    err: "#f07c80",
    ok: "#5fc284",
    shadow: "inset 0 0 0 1px rgba(255,255,255,0.07), inset 0 1px 0 rgba(255,255,255,0.05), 0 40px 80px -40px rgba(0,0,0,0.9)",
  },
  light: {
    stage: "#f4f4f5",
    surface: "#ffffff",
    well: "#fafafa",
    raised: "rgba(17,17,19,0.045)",
    ink: "#17171a",
    muted: "#5d5d5f",
    faint: "#6f6f72",
    line: "rgba(17,17,19,0.09)",
    lineStrong: "rgba(17,17,19,0.18)",
    warn: "#a8620a",
    err: "#c2353b",
    ok: "#23884a",
    shadow: "inset 0 0 0 1px rgba(17,17,19,0.08), 0 1px 2px rgba(17,17,19,0.05), 0 40px 80px -40px rgba(17,17,19,0.25)",
  },
} as const;

type Theme = keyof typeof PALETTE;

function paletteVars(theme: Theme, accent: string): CSSProperties {
  return {
    "--ev-surface": PALETTE[theme].surface,
    "--ev-well": PALETTE[theme].well,
    "--ev-raised": PALETTE[theme].raised,
    "--ev-ink": PALETTE[theme].ink,
    "--ev-muted": PALETTE[theme].muted,
    "--ev-faint": PALETTE[theme].faint,
    "--ev-line": PALETTE[theme].line,
    "--ev-line-strong": PALETTE[theme].lineStrong,
    "--ev-warn": PALETTE[theme].warn,
    "--ev-err": PALETTE[theme].err,
    "--ev-ok": PALETTE[theme].ok,
    "--ev-accent": accent,
    "--ev-accent-ink": theme === "light" ? `color-mix(in oklab, ${accent} 62%, #000)` : accent,
  } as CSSProperties;
}

/* ------------------------------------------------------------------ */
/* Sample                                                              */
/* ------------------------------------------------------------------ */

const DEFAULT_VARS: EnvVar[] = [
  {
    key: "DATABASE_URL",
    sensitive: true,
    updated: "2h ago",
    scopes: { production: true, preview: true, development: true },
    values: {
      production: "postgres://ledger:9f3c1a@db.ledgerline.dev:5432/ledger",
      preview: "postgres://ledger:9f3c1a@db-preview.ledgerline.dev:5432/ledger",
      development: "postgres://ledger:dev@localhost:5432/ledger",
    },
  },
  {
    key: "STRIPE_SECRET_KEY",
    sensitive: true,
    updated: "6d ago",
    scopes: { production: true, preview: true, development: true },
    values: {
      production: "sk_live_51Lr9vQ2xK8f4aN3p",
      preview: "sk_test_51Lr9vQ2xK8f4aN3p",
      development: "sk_test_51Lr9vQ2xK8f4aN3p",
    },
  },
  {
    key: "STRIPE_WEBHOOK_SECRET",
    sensitive: true,
    updated: "6d ago",
    scopes: { production: true, preview: true, development: false },
    values: {
      production: "whsec_8f3a91c0e2b74d11",
      preview: "whsec_22c0aa91e4b7d0f3",
      development: "whsec_local_4c91aa",
    },
  },
  {
    key: "RESEND_API_KEY",
    sensitive: true,
    updated: "12d ago",
    scopes: { production: true, preview: false, development: true },
    values: {
      production: "re_8Hq2Lm4nP9kX",
      preview: "re_test_preview_22",
      development: "re_test_local_19",
    },
  },
  {
    key: "NEXT_PUBLIC_APP_URL",
    sensitive: false,
    updated: "3d ago",
    scopes: { production: true, preview: true, development: true },
    values: {
      production: "https://app.ledgerline.dev",
      preview: "https://preview.ledgerline.dev",
      development: "http://localhost:3000",
    },
  },
  {
    key: "LOG_LEVEL",
    sensitive: false,
    updated: "1d ago",
    scopes: { production: true, preview: true, development: true },
    values: { production: "info", preview: "debug", development: "debug" },
  },
  {
    key: "SENTRY_DSN",
    sensitive: true,
    updated: "18d ago",
    scopes: { production: false, preview: true, development: true },
    values: {
      production: "https://a1b2c3d4@o448.ingest.sentry.io/4512",
      preview: "https://a1b2c3d4@o448.ingest.sentry.io/4512",
      development: "https://a1b2c3d4@o448.ingest.sentry.io/4512",
    },
  },
];

const KEY_RE = /^[A-Z_][A-Z0-9_]*$/;
const PLAIN_KEYS = new Set(["LOG_LEVEL", "NODE_ENV", "DEBUG_SQL"]);

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Show the shape of a secret and hide the part that authenticates. */
function maskValue(value: string): string {
  const db = /^(postgres(?:ql)?:\/\/)([^:@/]+):([^@]+)@(.+)$/.exec(value);
  if (db) return `${db[1]}${db[2]}:••••@${db[4].replace(/:\d+(?=\/|$)/, "")}`;
  const userinfo = /^(https?:\/\/)([^@/]+)@(.+)$/.exec(value);
  if (userinfo) return `${userinfo[1]}••••@${userinfo[3]}`;
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

function isSensitive(key: string) {
  if (key.startsWith("NEXT_PUBLIC_")) return false;
  if (PLAIN_KEYS.has(key)) return false;
  return true;
}

type Verdict = "new" | "duplicate" | "invalid";
type ParsedLine = { key: string; value?: string; status: Verdict; reason: string };

/**
 * Parse a .env paste. The last line with no `=` is still being typed, so it
 * stays quiet; every other unfinished line is an invalid key.
 */
function parseEnv(text: string, existing: Set<string>): ParsedLine[] {
  const seen = new Set<string>();
  const lines = text.split("\n");
  const out: ParsedLine[] = [];
  lines.forEach((raw, index) => {
    let line = raw.trim();
    if (!line || line.startsWith("#")) return;
    if (line.startsWith("export ")) line = line.slice(7).trim();
    const eq = line.indexOf("=");
    if (eq <= 0) {
      if (index === lines.length - 1) return;
      out.push({ key: line || raw.trim(), status: "invalid", reason: "missing a value" });
      return;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    if (!KEY_RE.test(key)) {
      out.push({ key: key || "—", status: "invalid", reason: "keys are A–Z, digits and underscores" });
      return;
    }
    if (!value) {
      out.push({ key, status: "invalid", reason: "missing a value" });
      return;
    }
    if (seen.has(key)) {
      out.push({ key, value, status: "duplicate", reason: "repeated in this paste" });
      return;
    }
    seen.add(key);
    if (existing.has(key)) {
      out.push({ key, value, status: "duplicate", reason: "already set, left unchanged" });
      return;
    }
    out.push({ key, value, status: "new", reason: "will be added" });
  });
  return out;
}

function blankValues(): Record<EnvName, string> {
  return { production: "", preview: "", development: "" };
}

/** Prefer a wrap after the scheme or the credentials, so a host stays whole. */
function SoftText({ text }: { text: string }) {
  const out: ReactElement[] = [];
  const re = /(:\/\/|@|\/)/g;
  let last = 0;
  let k = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    const end = m[0] === "/" ? at : at + m[0].length;
    out.push(<span key={k}>{text.slice(last, end)}</span>);
    out.push(<wbr key={`b${k}`} />);
    k += 1;
    last = m[0] === "/" ? at : end;
  }
  out.push(<span key={k}>{text.slice(last)}</span>);
  return out;
}

function Count({ value, reduce }: { value: number; reduce: boolean }) {
  const [shown, setShown] = useState(reduce ? value : 0);
  const from = useRef(reduce ? value : 0);
  useEffect(() => {
    if (reduce || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = from.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / 420);
      const e = 1 - (1 - t) ** 3;
      const next = start + (value - start) * e;
      from.current = next;
      setShown(Math.round(next));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce]);
  return <span className="tabular-nums">{shown}</span>;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function EnvVars({
  project = "ledgerline",
  variables,
  environment: environmentProp = "production",
  mask = true,
  density = "comfortable",
  theme = "dark",
  accent = DEFAULT_ACCENT,
  onChange,
  onRedeploy,
  className = "",
}: EnvVarsProps) {
  const reduce = !!useReducedMotion();
  const uid = useId();
  const seed = useMemo(() => variables ?? DEFAULT_VARS, [variables]);
  const [rows, setRows] = useState<EnvVar[]>(seed);
  const [environment, setEnvironment] = useState<EnvName>(environmentProp);
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [pending, setPending] = useState(0);
  const [phase, setPhase] = useState<"idle" | "deploying" | "done">("idle");
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const deployTimer = useRef(0);

  useEffect(() => setEnvironment(environmentProp), [environmentProp]);
  useEffect(() => {
    setRows(seed);
    setPending(0);
    setPhase("idle");
    setRevealed(new Set());
    setFresh(new Set());
  }, [seed]);
  useEffect(() => () => window.clearTimeout(deployTimer.current), []);

  const existing = useMemo(() => new Set(rows.map((v) => v.key)), [rows]);
  const parsed = useMemo(() => parseEnv(importText, existing), [importText, existing]);
  const counts = useMemo(() => {
    const c: Record<EnvName, number> = { production: 0, preview: 0, development: 0 };
    for (const v of rows) for (const env of ENVS) if (v.scopes[env]) c[env] += 1;
    return c;
  }, [rows]);

  const here = rows.filter((v) => v.scopes[environment]);
  const elsewhere = rows.filter((v) => !v.scopes[environment]);
  const added = parsed.filter((p) => p.status === "new").length;
  const invalid = parsed.filter((p) => p.status === "invalid").length;
  const duplicates = parsed.filter((p) => p.status === "duplicate").length;
  const reveal = useMemo(() => entrance(reduce), [reduce]);
  const rowPad = density === "compact" ? "py-2 @lg:py-1.5" : "py-3 @lg:py-2.5";

  const commit = (next: EnvVar[], delta: number, arrived?: string[]) => {
    setRows(next);
    setPending((n) => n + delta);
    setPhase("idle");
    if (arrived?.length) setFresh(new Set(arrived));
    onChange?.(next);
  };

  const toggleScope = (key: string, env: EnvName) => {
    const next = rows.map((v) => {
      if (v.key !== key) return v;
      const on = !v.scopes[env];
      const values = { ...v.values };
      if (on && !values[env]) {
        values[env] = ENVS.map((name) => v.values[name]).find(Boolean) ?? "";
      }
      return { ...v, scopes: { ...v.scopes, [env]: on }, values };
    });
    commit(next, 1);
  };

  const applyImport = () => {
    const freshRows = parsed.filter((p): p is ParsedLine & { key: string; value: string } => p.status === "new" && !!p.value);
    if (!freshRows.length) return;
    const arrived = freshRows.map((p) => p.key);
    const next = [
      ...rows,
      ...freshRows.map((p) => ({
        key: p.key,
        sensitive: isSensitive(p.key),
        updated: "just now",
        scopes: { production: environment === "production", preview: environment === "preview", development: environment === "development" },
        values: { ...blankValues(), [environment]: p.value },
      })),
    ];
    commit(next, freshRows.length, arrived);
    setImportText("");
    setImportOpen(false);
  };

  const redeploy = () => {
    if (phase === "deploying" || pending === 0) return;
    setPhase("deploying");
    window.clearTimeout(deployTimer.current);
    deployTimer.current = window.setTimeout(() => {
      setPending(0);
      setPhase("done");
      onRedeploy?.(environment);
      deployTimer.current = window.setTimeout(() => setPhase("idle"), reduce ? 400 : 1400);
    }, reduce ? 160 : 880);
  };

  const summary = [
    added ? `${added} new` : "",
    duplicates ? `${duplicates} duplicate${duplicates === 1 ? "" : "s"}` : "",
    invalid ? `${invalid} invalid` : "",
  ].filter(Boolean).join(" · ");

  return (
    <motion.section
      aria-label={`Environment variables for ${project}`}
      className={`@container w-full max-w-[920px] overflow-hidden rounded-[20px] font-sans text-(--ev-ink) ${className}`}
      style={{ ...paletteVars(theme, accent), background: PALETTE[theme].surface, boxShadow: PALETTE[theme].shadow }}
      initial="hidden"
      animate="shown"
      variants={reveal}
      custom={0}
    >
      <motion.header variants={reveal} custom={1} className="flex items-center justify-between gap-3 px-5 pt-5 @xl:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="size-2 shrink-0 rounded-full" style={{ background: "var(--ev-accent)" }} aria-hidden="true" />
          <h2 className="truncate font-mono text-[12.5px] tracking-[0.01em]">{project}</h2>
        </div>
        <p className="shrink-0 font-mono text-[11px] text-(--ev-faint)">
          <Count value={counts[environment]} reduce={reduce} /> in {ENV_LABEL[environment].toLowerCase()}
        </p>
      </motion.header>

      <motion.div variants={reveal} custom={2} className="flex flex-col gap-2 px-5 pt-4 @2xl:flex-row @2xl:items-center @2xl:justify-between @xl:px-6">
        <div role="radiogroup" aria-label="Environment" className="flex min-w-0 gap-0.5">
          {ENVS.map((env) => {
            const active = environment === env;
            return (
              <button
                key={env}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setEnvironment(env)}
                className={`relative inline-flex h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[8px] px-2 text-[12.5px] whitespace-nowrap transition-[color,transform] duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ev-ink) @lg:flex-none @lg:px-3 @2xl:h-8 ${active ? "text-(--ev-ink)" : "text-(--ev-muted) hover:text-(--ev-ink)"}`}
              >
                {active && (
                  <motion.span
                    layoutId={`${uid}-env`}
                    transition={reduce ? { duration: 0 } : UI_SPRING}
                    className="absolute inset-0 rounded-[8px]"
                    style={{ background: "var(--ev-raised)", boxShadow: "inset 0 0 0 1px var(--ev-line-strong)" }}
                  />
                )}
                <span className="relative @lg:hidden">{ENV_SHORT[env]}</span>
                <span className="relative hidden @lg:inline">{ENV_LABEL[env]}</span>
                <span className="relative font-mono text-[11px] text-(--ev-faint) tabular-nums">{counts[env]}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          data-demo="import"
          aria-expanded={importOpen}
          onClick={() => setImportOpen((open) => !open)}
          className="inline-flex h-11 w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[10px] px-3 text-[13px] whitespace-nowrap transition-[color,transform] duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ev-ink) @2xl:h-8 @2xl:w-auto"
          style={{ background: "var(--ev-raised)", boxShadow: "inset 0 0 0 1px var(--ev-line)", color: importOpen ? "var(--ev-ink)" : "var(--ev-muted)" }}
        >
          <PasteIcon />
          {importOpen ? "Close import" : "Import .env"}
        </button>
      </motion.div>

      <div className="px-5 pt-4 pb-5 @xl:px-6 @xl:pb-6">
        <AnimatePresence initial={false}>
          {importOpen && (
            <motion.div
              key="import"
              initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0, transition: { duration: 0.18, ease: EASE_IN } }}
              transition={{ duration: reduce ? 0.12 : 0.32, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="mb-3 rounded-[14px] p-3" style={{ background: "var(--ev-well)", boxShadow: "inset 0 0 0 1px var(--ev-line)" }}>
                <label htmlFor={`${uid}-import`} className="mb-2 block font-mono text-[11px] text-(--ev-faint)">
                  Paste a .env — new keys land in {ENV_LABEL[environment].toLowerCase()} only
                </label>
                <textarea
                  id={`${uid}-import`}
                  data-demo="import-field"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
                    if (e.key === "Escape") setImportOpen(false);
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      applyImport();
                    }
                  }}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  rows={3}
                  placeholder={"STRIPE_SECRET_KEY=sk_live_…\nLOG_LEVEL=debug"}
                  className="w-full resize-none bg-transparent font-mono text-[12.5px] leading-[1.55] text-(--ev-ink) outline-none placeholder:text-(--ev-faint) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--ev-ink)"
                />
                <AnimatePresence initial={false}>
                  {parsed.length > 0 && (
                    <motion.ul
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: reduce ? 0.12 : 0.22, ease: EASE }}
                      className="mt-2 flex flex-col gap-1 border-t border-(--ev-line) pt-2"
                      aria-live="polite"
                    >
                      {parsed.map((line, i) => (
                        <li key={`${line.status}-${line.key}-${i}`} className="flex flex-col gap-0.5 font-mono text-[12px] @lg:flex-row @lg:items-baseline @lg:justify-between @lg:gap-3">
                          <span className="min-w-0 truncate text-(--ev-ink)">{line.key}</span>
                          <span className="min-w-0 text-(--ev-faint) @lg:shrink-0">
                            <StatusWord status={line.status} />
                            <span> · {line.reason}</span>
                          </span>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
                <div className="mt-3 flex flex-col gap-2 @lg:flex-row @lg:items-center @lg:justify-between">
                  <p className="font-mono text-[11px] text-(--ev-faint)" aria-live="polite">
                    {summary || "Duplicates are skipped. Invalid keys are not written."}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setImportText("");
                        setImportOpen(false);
                      }}
                      className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-[9px] px-3 text-[13px] text-(--ev-muted) transition-[color,transform] duration-150 hover:text-(--ev-ink) active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ev-ink) @lg:h-8 @lg:flex-none"
                    >
                      Discard
                    </button>
                    <button
                      type="button"
                      onClick={applyImport}
                      disabled={added === 0}
                      className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-[9px] px-3.5 text-[13px] font-medium transition-transform duration-100 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ev-ink) disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 @lg:h-8 @lg:flex-none"
                      style={{ background: "var(--ev-ink)", color: "var(--ev-surface)" }}
                    >
                      {added ? `Add ${added}` : "Add"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="overflow-hidden rounded-[14px] @lg:max-h-[28rem] @lg:overflow-y-auto" style={{ background: "var(--ev-well)", boxShadow: "inset 0 0 0 1px var(--ev-line)" }}>
          <ol aria-label={`Variables for ${ENV_LABEL[environment]}`}>
            {here.map((v) => (
              <Row
                key={v.key}
                variable={v}
                environment={environment}
                mask={mask}
                revealed={revealed.has(v.key)}
                fresh={fresh.has(v.key)}
                rowPad={rowPad}
                reduce={reduce}
                onToggleScope={toggleScope}
                onToggleReveal={() =>
                  setRevealed((prev) => {
                    const next = new Set(prev);
                    if (next.has(v.key)) next.delete(v.key);
                    else next.add(v.key);
                    return next;
                  })
                }
              />
            ))}
            {elsewhere.length > 0 && (
              <li className="px-3.5 pt-3 pb-1 font-mono text-[11px] tracking-[0.04em] text-(--ev-faint) @lg:px-4">
                Not in {ENV_LABEL[environment].toLowerCase()}
              </li>
            )}
            {elsewhere.map((v) => (
              <Row
                key={v.key}
                variable={v}
                environment={environment}
                mask={mask}
                revealed={revealed.has(v.key)}
                fresh={fresh.has(v.key)}
                rowPad={rowPad}
                reduce={reduce}
                onToggleScope={toggleScope}
                onToggleReveal={() =>
                  setRevealed((prev) => {
                    const next = new Set(prev);
                    if (next.has(v.key)) next.delete(v.key);
                    else next.add(v.key);
                    return next;
                  })
                }
              />
            ))}
          </ol>
        </div>

        <AnimatePresence initial={false}>
          {(pending > 0 || phase === "done") && (
            <motion.div
              key="banner"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(3px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6, transition: { duration: 0.16, ease: EASE_IN } }}
              transition={{ duration: reduce ? 0.12 : 0.28, ease: EASE }}
              className="mt-3 flex flex-col gap-3 rounded-[12px] px-3.5 py-3 @lg:flex-row @lg:items-center @lg:justify-between"
              style={{ background: "var(--ev-raised)", boxShadow: "inset 0 0 0 1px var(--ev-line)" }}
              aria-live="polite"
            >
              <p className="flex items-center gap-2.5 text-[13.5px] leading-snug">
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: phase === "done" ? "var(--ev-ok)" : "var(--ev-accent)" }} aria-hidden="true" />
                {phase === "done" ? (
                  <span>Deployed to {ENV_LABEL[environment].toLowerCase()}.</span>
                ) : (
                  <span>
                    Redeploy {ENV_LABEL[environment].toLowerCase()} to pick up {pending} {pending === 1 ? "change" : "changes"}.
                  </span>
                )}
              </p>
              {phase !== "done" && (
                <button
                  type="button"
                  data-demo="redeploy"
                  onClick={redeploy}
                  disabled={phase === "deploying"}
                  className="inline-flex h-11 min-w-[7.5rem] cursor-pointer items-center justify-center gap-2 rounded-[10px] px-3.5 text-[13px] font-medium transition-transform duration-100 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ev-ink) disabled:cursor-default disabled:active:scale-100 @lg:h-8"
                  style={{ background: "var(--ev-ink)", color: "var(--ev-surface)" }}
                >
                  {phase === "deploying" ? <Spinner /> : "Redeploy"}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* Parts                                                               */
/* ------------------------------------------------------------------ */

function Row({
  variable,
  environment,
  mask,
  revealed,
  fresh,
  rowPad,
  reduce,
  onToggleScope,
  onToggleReveal,
}: {
  variable: EnvVar;
  environment: EnvName;
  mask: boolean;
  revealed: boolean;
  fresh: boolean;
  rowPad: string;
  reduce: boolean;
  onToggleScope: (key: string, env: EnvName) => void;
  onToggleReveal: () => void;
}) {
  const setHere = variable.scopes[environment];
  const raw = variable.values[environment];
  const hidden = variable.sensitive && mask && !revealed && setHere && !!raw;
  const shown = !setHere ? "Not set" : !raw ? "Empty" : hidden ? maskValue(raw) : raw;

  return (
    <motion.li
      layout={!reduce}
      initial={fresh && !reduce ? { opacity: 0, y: 8, filter: "blur(3px)" } : false}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
      transition={reduce ? { duration: 0.12 } : { layout: UI_SPRING, duration: 0.28, ease: EASE }}
      className={`border-b border-(--ev-line) px-3.5 last:border-b-0 @lg:px-4 ${rowPad}`}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1 gap-y-2 @lg:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_2rem_auto] @lg:gap-x-3">
        <div className="col-span-2 flex min-w-0 items-baseline justify-between gap-3 @lg:col-span-1 @lg:block">
          <div className="truncate font-mono text-[12.5px]">{variable.key}</div>
          <div className="shrink-0 font-mono text-[11px] text-(--ev-faint) @lg:mt-0.5">
            {variable.sensitive ? "secret" : "plain"} · {variable.updated}
          </div>
        </div>
        <div className="min-w-0">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={`${environment}:${hidden}:${shown}`}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: reduce ? 0.12 : 0.2, ease: EASE }}
              className={`block font-mono text-[12.5px] leading-[1.45] ${setHere && !hidden ? "text-(--ev-ink)" : "text-(--ev-faint)"}`}
            >
              <SoftText text={shown} />
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="flex size-11 items-center justify-center @lg:size-8">
          {variable.sensitive && setHere && mask && (
            <button
              type="button"
              data-demo={variable.key === "STRIPE_SECRET_KEY" ? "reveal-stripe" : undefined}
              aria-pressed={revealed}
              aria-label={revealed ? `Hide ${variable.key}` : `Reveal ${variable.key}`}
              onClick={onToggleReveal}
              className="inline-flex size-11 cursor-pointer items-center justify-center rounded-[9px] text-(--ev-muted) transition-[color,transform,background-color] duration-150 hover:bg-(--ev-raised) hover:text-(--ev-ink) active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ev-ink) @lg:size-8"
            >
              <EyeIcon off={revealed} />
            </button>
          )}
        </div>
        <div className="col-span-2 grid grid-cols-3 gap-1 @lg:col-span-1 @lg:flex" role="group" aria-label={`Scopes for ${variable.key}`}>
          {ENVS.map((env) => {
            const on = variable.scopes[env];
            return (
              <button
                key={env}
                type="button"
                data-demo={variable.key === "SENTRY_DSN" && env === "production" ? "scope-production-sentry" : undefined}
                aria-pressed={on}
                aria-label={`${ENV_LABEL[env]} ${on ? "on" : "off"} for ${variable.key}`}
                onClick={() => onToggleScope(variable.key, env)}
                className={`inline-flex h-11 cursor-pointer items-center justify-center rounded-[8px] px-2 text-[12px] whitespace-nowrap transition-[color,transform,background-color] duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ev-ink) @lg:h-8 @lg:px-2.5 ${on ? "text-(--ev-ink)" : "text-(--ev-faint) hover:text-(--ev-muted)"}`}
                style={on ? { background: "var(--ev-raised)", boxShadow: "inset 0 0 0 1px var(--ev-line-strong)" } : undefined}
              >
                {ENV_SHORT[env]}
              </button>
            );
          })}
        </div>
      </div>
    </motion.li>
  );
}

function StatusWord({ status }: { status: Verdict }) {
  const color = status === "invalid" ? "var(--ev-err)" : status === "duplicate" ? "var(--ev-warn)" : "var(--ev-accent-ink)";
  return <span style={{ color }}>{status}</span>;
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M1.75 8S4.1 4.75 8 4.75 14.25 8 14.25 8 11.9 11.25 8 11.25 1.75 8 1.75 8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="1.7" stroke="currentColor" strokeWidth="1.4" />
      {off && <path d="M3.25 12.75 12.75 3.25" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />}
    </svg>
  );
}

function PasteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 2.75h4a1 1 0 0 1 1 1V5H5V3.75a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.4" />
      <rect x="3.25" y="4.75" width="9.5" height="8.5" rx="1.25" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="animate-spin">
      <circle cx="8" cy="8" r="5.25" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.6" />
      <path d="M8 2.75a5.25 5.25 0 0 1 5.25 5.25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
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

/** Environment variables for ledgerline, on a quiet stage. */
export default function EnvVarsDemo(overrides: Partial<EnvVarsProps> = {}) {
  const theme: Theme = overrides.theme ?? "dark";
  return (
    <div className="flex min-h-dvh w-full items-center justify-center px-4 py-8 sm:px-8" style={{ background: PALETTE[theme].stage }}>
      <EnvVars {...overrides} theme={theme} />
    </div>
  );
}
