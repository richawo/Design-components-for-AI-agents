"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Kind = "k" | "n" | "s" | "c" | "d" | "t" | "p";
type Tok = { kind: Kind; text: string };
type Mark = "+" | "-" | " ";

export type CodeFile = {
  id: string;
  name: string;
  lines: string[];
  highlight?: number[];
  diff?: { mark: "+" | "-" | " "; text: string }[];
};

export type CodeBlockProps = {
  /** Files to display. Omit for the example snippets; an empty array shows an empty state. */
  files?: CodeFile[];
  onFileChange?: (id: string) => void;
  emptyMessage?: string;
  copyErrorMessage?: string;
  /** Which file is open. The tabs change it too. */
  file?: string;
  /** Show the file as a diff. */
  diff?: boolean;
  theme?: "dark" | "light";
  /** The one accent: the tab rule, a highlighted line, and names in the code. */
  accent?: string;
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const DEFAULT_ACCENT = "#7cc4ff";
const EASE = [0.22, 1, 0.36, 1] as const;
const UI_SPRING = { type: "spring", stiffness: 500, damping: 40 } as const;
const KEYWORDS = new Set(["import", "from", "export", "function", "const", "return", "if", "new", "async", "await"]);

const PALETTE = {
  dark: {
    stage: "#000000",
    surface: "#0d0d0f",
    well: "#09090a",
    ink: "#ededef",
    muted: "#98989a",
    faint: "#7d7d80",
    line: "rgba(255,255,255,0.08)",
    lineStrong: "rgba(255,255,255,0.16)",
    ok: "#5fc284",
    err: "#f07c80",
    shadow: "inset 0 0 0 1px rgba(255,255,255,0.07), inset 0 1px 0 rgba(255,255,255,0.05), 0 40px 80px -40px rgba(0,0,0,0.9)",
  },
  light: {
    stage: "#f4f4f5",
    surface: "#ffffff",
    well: "#fafafa",
    ink: "#17171a",
    muted: "#5d5d5f",
    faint: "#6f6f72",
    line: "rgba(17,17,19,0.09)",
    lineStrong: "rgba(17,17,19,0.18)",
    ok: "#1d7a40",
    err: "#c2353b",
    shadow: "inset 0 0 0 1px rgba(17,17,19,0.08), 0 1px 2px rgba(17,17,19,0.05), 0 40px 80px -40px rgba(17,17,19,0.25)",
  },
} as const;

type Theme = keyof typeof PALETTE;

function paletteVars(theme: Theme, accent: string): CSSProperties {
  const p = PALETTE[theme];
  return {
    "--cb-surface": p.surface,
    "--cb-well": p.well,
    "--cb-ink": p.ink,
    "--cb-muted": p.muted,
    "--cb-faint": p.faint,
    "--cb-line": p.line,
    "--cb-line-strong": p.lineStrong,
    "--cb-ok": p.ok,
    "--cb-err": p.err,
    "--cb-accent": accent,
    "--cb-accent-ink": theme === "light" ? `color-mix(in oklab, ${accent} 62%, #000)` : accent,
  } as CSSProperties;
}

const COLOR: Record<Kind, string> = {
  k: "var(--cb-muted)",
  n: "var(--cb-accent-ink)",
  s: "var(--cb-ink)",
  c: "var(--cb-faint)",
  d: "var(--cb-accent-ink)",
  t: "var(--cb-ink)",
  p: "var(--cb-muted)",
};

/* ------------------------------------------------------------------ */
/* Sample                                                              */
/* ------------------------------------------------------------------ */

const VERIFY = [
  'import { createHmac, timingSafeEqual } from "node:crypto";',
  "",
  "// Reject a signature older than five minutes.",
  "export function verifyWebhook(raw: string, header: string, secret: string) {",
  "  const [t, v1] = readSignature(header);",
  "  if (Date.now() / 1000 - Number(t) > 300) return false;",
  "  const mac = createHmac(\"sha256\", secret).update(`${t}.${raw}`).digest();",
  "  const given = Buffer.from(v1, \"hex\");",
  "  return given.length === mac.length && timingSafeEqual(given, mac);",
  "}",
];

const HANDLER = [
  'import { verifyWebhook } from "./verify";',
  "",
  "export async function POST(request: Request) {",
  "  const raw = await request.text();",
  '  const header = request.headers.get("ledgerline-signature") ?? "";',
  "  const ok = verifyWebhook(raw, header, secret());",
  '  if (!ok) return new Response("invalid signature", { status: 400 });',
  '  return new Response("ok");',
  "}",
];

const VERIFY_DIFF: { mark: Mark; text: string }[] = [
  { mark: " ", text: 'import { createHmac, timingSafeEqual } from "node:crypto";' },
  { mark: " ", text: "" },
  { mark: "-", text: "export function verifyWebhook(raw: string, header: string) {" },
  { mark: "-", text: "  const mac = createHmac(\"sha256\", process.env.STRIPE_WEBHOOK_SECRET).update(raw).digest(\"hex\");" },
  { mark: "-", text: "  return mac === header;" },
  { mark: "+", text: "export function verifyWebhook(raw: string, header: string, secret: string) {" },
  { mark: "+", text: "  const [t, v1] = readSignature(header);" },
  { mark: "+", text: "  if (Date.now() / 1000 - Number(t) > 300) return false;" },
  { mark: "+", text: "  const mac = createHmac(\"sha256\", secret).update(`${t}.${raw}`).digest();" },
  { mark: "+", text: "  const given = Buffer.from(v1, \"hex\");" },
  { mark: "+", text: "  return given.length === mac.length && timingSafeEqual(given, mac);" },
  { mark: " ", text: "}" },
];

const HANDLER_DIFF: { mark: Mark; text: string }[] = [
  { mark: " ", text: 'import { verifyWebhook } from "./verify";' },
  { mark: " ", text: "" },
  { mark: " ", text: "export async function POST(request: Request) {" },
  { mark: " ", text: "  const raw = await request.text();" },
  { mark: "-", text: "  const ok = request.headers.get(\"stripe-signature\") === process.env.STRIPE_WEBHOOK_SECRET;" },
  { mark: "+", text: '  const header = request.headers.get("ledgerline-signature") ?? "";' },
  { mark: "+", text: "  const ok = verifyWebhook(raw, header, secret());" },
  { mark: " ", text: '  if (!ok) return new Response("invalid signature", { status: 400 });' },
  { mark: " ", text: '  return new Response("ok");' },
  { mark: " ", text: "}" },
];

const FILES = {
  verify: { name: "verify.ts", lines: VERIFY, highlight: [6, 9] as number[], diff: VERIFY_DIFF },
  handler: { name: "handler.ts", lines: HANDLER, highlight: [6] as number[], diff: HANDLER_DIFF },
} as const;

const DEMO_FILES: CodeFile[] = Object.entries(FILES).map(([id, file]) => ({ id, ...file }));

function lex(line: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const push = (kind: Kind, text: string) => {
    if (text) out.push({ kind, text });
  };
  while (i < line.length) {
    if (line.startsWith("//", i)) {
      push("c", line.slice(i));
      break;
    }
    const quote = line[i];
    if (quote === '"' || quote === "'" || quote === "`") {
      let j = i + 1;
      while (j < line.length && line[j] !== quote) {
        if (line[j] === "\\") j += 1;
        j += 1;
      }
      push("s", line.slice(i, Math.min(line.length, j + 1)));
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(line[i]) && (i === 0 || !/[A-Za-z_]/.test(line[i - 1]))) {
      let j = i;
      while (j < line.length && /[0-9]/.test(line[j])) j += 1;
      push("d", line.slice(i, j));
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[A-Za-z0-9_]/.test(line[j])) j += 1;
      const word = line.slice(i, j);
      push(line[j] === "(" ? "n" : KEYWORDS.has(word) ? "k" : "t", word);
      i = j;
      continue;
    }
    push("p", line[i]);
    i += 1;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function CodeBlock(props: CodeBlockProps) {
  if (props.files?.length === 0) {
    const p = PALETTE[props.theme ?? "dark"];
    return <section className={`w-full rounded-[20px] p-6 font-sans ${props.className ?? ""}`} style={{ background: p.surface, color: p.muted }}><p role="status">{props.emptyMessage ?? "No files to show."}</p></section>;
  }
  return <CodeBlockWithFiles {...props} />;
}

function CodeBlockWithFiles({ files = DEMO_FILES, file: fileProp = "verify", onFileChange, copyErrorMessage = "Couldn't copy. Select the code and copy it manually.", diff: diffProp = false, theme = "dark", accent = DEFAULT_ACCENT, className = "" }: CodeBlockProps) {
  const reduce = !!useReducedMotion();
  const uid = useId();
  const reveal = useMemo(() => entrance(reduce), [reduce]);
  const [file, setFile] = useState(fileProp);
  const [diff, setDiff] = useState(diffProp);
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const copyRun = useRef(0);

  useEffect(() => setFile(fileProp), [fileProp]);
  useEffect(() => setDiff(diffProp), [diffProp]);
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(id);
  }, [copied]);

  const current = files.find((entry) => entry.id === file) ?? files[0];
  const activeIndex = files.indexOf(current);
  const changedRows = current.diff ?? current.lines.map((text) => ({ mark: " " as Mark, text }));
  const rows = diff ? changedRows.map((row) => ({ mark: row.mark, text: row.text, hl: false })) : current.lines.map((text, index) => ({ mark: " " as Mark, text, hl: (current.highlight ?? []).includes(index + 1) }));
  const source = (diff ? changedRows.filter((row) => row.mark !== "-").map((row) => row.text) : current.lines).join("\n");

  useEffect(() => {
    copyRun.current++;
    setCopied(false);
    setCopying(false);
    setCopyError(false);
    return () => { copyRun.current++; };
  }, [source]);

  const copy = async () => {
    const run = ++copyRun.current;
    setCopied(false);
    setCopyError(false);
    setCopying(true);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(source);
      if (run === copyRun.current) setCopied(true);
    } catch {
      if (run === copyRun.current) setCopyError(true);
    } finally {
      if (run === copyRun.current) setCopying(false);
    }
  };

  const chooseFile = (id: string) => {
    copyRun.current++;
    setFile(id);
    setCopied(false);
    setCopyError(false);
    setCopying(false);
    onFileChange?.(id);
  };

  return (
    <motion.section
      aria-label={`Code, ${current.name}`}
      className={`@container w-full max-w-[920px] overflow-hidden rounded-[20px] font-sans text-(--cb-ink) ${className}`}
      style={{ ...paletteVars(theme, accent), background: PALETTE[theme].surface, boxShadow: PALETTE[theme].shadow }}
      initial="hidden"
      animate="shown"
      variants={reveal}
      custom={0}
    >
      <motion.div variants={reveal} custom={1} className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 px-5 pt-4 @xl:px-6">
        <div role="tablist" aria-label="Files" className="flex min-w-0 max-w-full gap-4 overflow-x-auto" style={{ boxShadow: "inset 0 -1px 0 var(--cb-line)" }}>
          {files.map((entry, index) => {
            const id = entry.id;
            const active = id === current.id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`${uid}-file-${index}`}
                aria-controls={`${uid}-code`}
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                onKeyDown={(event) => {
                  const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
                  const next = event.key === "Home" ? 0 : event.key === "End" ? files.length - 1 : delta ? (index + delta + files.length) % files.length : -1;
                  if (next < 0) return;
                  event.preventDefault();
                  chooseFile(files[next].id);
                  (event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next])?.focus();
                }}
                data-demo={id === "handler" ? "tab-handler" : undefined}
                onClick={() => chooseFile(id)}
                className={`relative inline-flex h-11 shrink-0 cursor-pointer items-center font-mono text-[12.5px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--cb-ink) @lg:h-9 ${active ? "text-(--cb-ink)" : "text-(--cb-muted) hover:text-(--cb-ink)"}`}
              >
                {entry.name}
                {active && <motion.span layoutId={`${uid}-tab`} transition={reduce ? { duration: 0 } : UI_SPRING} className="absolute inset-x-0 -bottom-px h-[1.5px] rounded-full" style={{ background: "var(--cb-accent-ink)" }} />}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 pb-1">
          <button
            type="button"
            aria-pressed={diff}
            data-demo="diff"
            onClick={() => {
              setDiff((value) => !value);
              setCopied(false);
            }}
            className="inline-flex h-11 cursor-pointer items-center rounded-[9px] px-3 text-[13px] transition-[color,transform] duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--cb-ink) @lg:h-8"
            style={{ color: diff ? "var(--cb-ink)" : "var(--cb-muted)", boxShadow: `inset 0 0 0 1px ${diff ? "var(--cb-line-strong)" : "var(--cb-line)"}` }}
          >
            Diff
          </button>
          <button
            type="button"
            data-demo="copy"
            onClick={copy}
            disabled={copying}
            aria-label={copied ? "Copied" : copying ? "Copying" : "Copy code"}
            className="inline-flex h-11 w-[4.75rem] cursor-pointer items-center justify-center rounded-[9px] text-[13px] font-medium transition-transform duration-100 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--cb-ink) @lg:h-8"
            style={{ background: "var(--cb-ink)", color: "var(--cb-surface)" }}
          >
            <AnimatePresence mode="wait" initial={false}>
              {copied ? (
                <motion.span key="check" initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.86 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: reduce ? 0.12 : 0.18 }} className="inline-flex" aria-label="Copied">
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </motion.span>
              ) : (
                <motion.span key="label" exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                  {copying ? "Copying" : "Copy"}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.div>

      <motion.div variants={reveal} custom={2} className="px-5 pt-3 pb-5 @xl:px-6 @xl:pb-6">
        {copyError && <p role="alert" className="mb-3 text-[13px] text-(--cb-err)">{copyErrorMessage}</p>}
        <span role="status" className="sr-only">{copied ? "Code copied to clipboard." : ""}</span>
        <div id={`${uid}-code`} role="tabpanel" aria-labelledby={`${uid}-file-${activeIndex}`} tabIndex={0} className="overflow-x-auto rounded-[14px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--cb-ink)" style={{ background: "var(--cb-well)", boxShadow: "inset 0 0 0 1px var(--cb-line)" }}>
          <div className="w-max min-w-full py-2">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={`${file}-${diff ? "diff" : "src"}`} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0 }} transition={{ duration: reduce ? 0.12 : 0.22, ease: EASE }}>
                {rows.map((row, index) => (
                  <div
                    key={`${row.mark}-${index}`}
                    className="grid w-max min-w-full items-stretch"
                    style={{
                      gridTemplateColumns: diff ? "2.5rem 1.25rem max-content" : "2.5rem max-content",
                      background: row.hl ? "color-mix(in oklab, var(--cb-accent) 8%, transparent)" : row.mark === "+" ? "color-mix(in oklab, var(--cb-ok) 9%, transparent)" : row.mark === "-" ? "color-mix(in oklab, var(--cb-err) 9%, transparent)" : undefined,
                      boxShadow: row.hl ? "inset 2px 0 0 var(--cb-accent)" : undefined,
                    }}
                  >
                    <span className="sticky left-0 flex items-start justify-end bg-(--cb-well) py-[3px] pr-3 font-mono text-[12px] text-(--cb-faint) tabular-nums select-none" style={row.hl ? { background: "color-mix(in oklab, var(--cb-accent) 8%, var(--cb-well))" } : row.mark === "+" ? { background: "color-mix(in oklab, var(--cb-ok) 9%, var(--cb-well))" } : row.mark === "-" ? { background: "color-mix(in oklab, var(--cb-err) 9%, var(--cb-well))" } : undefined}>
                      {row.mark === "-" ? "" : index + 1 - rows.slice(0, index).filter((item) => item.mark === "-").length}
                    </span>
                    {diff && (
                      <span className="flex items-start justify-center py-[3px] font-mono text-[12px] select-none" style={{ color: row.mark === "+" ? "var(--cb-ok)" : row.mark === "-" ? "var(--cb-err)" : "transparent" }} aria-hidden="true">
                        {row.mark === " " ? " " : row.mark}
                      </span>
                    )}
                    <code className="py-[3px] pr-4 font-mono text-[12.5px] leading-[1.65] whitespace-pre">
                      {row.text ? lex(row.text).map((tok, tokenIndex) => (
                        <span key={tokenIndex} style={{ color: COLOR[tok.kind] }}>
                          {tok.text}
                        </span>
                      )) : "\u00a0"}
                    </code>
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.section>
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

/** A webhook signature, in a quiet editor. */
export default function CodeBlockDemo(overrides: Partial<CodeBlockProps> = {}) {
  const theme: Theme = overrides.theme ?? "dark";
  return (
    <div className="flex min-h-dvh w-full items-center justify-center px-4 py-8 sm:px-8" style={{ background: PALETTE[theme].stage }}>
      <CodeBlock {...overrides} theme={theme} />
    </div>
  );
}
