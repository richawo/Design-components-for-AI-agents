"use client";

import { useId, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, PenLine, Search, Upload, X } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types and defaults                                                  */
/* ------------------------------------------------------------------ */

export type EmptyStateVariant = "inbox" | "search" | "project";

export type EmptyStateAction = { label: string; onClick?: () => void };

export type EmptyStateProps = {
  variant?: EmptyStateVariant;
  /** Small mono line above the title. */
  meta?: string;
  title?: string;
  body?: string;
  primary?: EmptyStateAction;
  secondary?: EmptyStateAction;
  /** Search variant: the query that found nothing. Shown in the title. */
  query?: string;
  /** Search variant: alternative queries offered as chips. */
  suggestions?: string[];
  onSuggestion?: (s: string) => void;
  /** Project variant: templates offered as chips. */
  templates?: string[];
  onTemplate?: (t: string) => void;
  /** Hide the illustration, e.g. in tight sidebars. */
  illustration?: boolean;
};

const ink = "#1d1c1a";
const accent = "#ef8f4a";
const tint = "#fde3cc";
const shade = "#ebe6dc";
const paper = "#fffdf9";

const defaults: Record<EmptyStateVariant, Required<Pick<EmptyStateProps, "meta" | "title" | "body" | "primary" | "secondary">>> = {
  inbox: {
    meta: "Inbox · 0 unread",
    title: "Inbox zero. Genuinely.",
    body: "Every thread answered, archived or snoozed until Monday. The next email can wait until you’ve finished your tea.",
    primary: { label: "Write something" },
    secondary: { label: "See snoozed (4)" },
  },
  search: {
    meta: "0 of 2,731 items",
    title: "Nothing matches",
    body: "We looked through 2,318 docs, 412 threads and one very long spreadsheet. Try a broader word, or one of these:",
    primary: { label: "Search all workspaces" },
    secondary: { label: "Clear search" },
  },
  project: {
    meta: "Projects · none yet",
    title: "Every project starts as a blank page.",
    body: "This one’s yours. Start from scratch, or borrow a template from someone who has done this before.",
    primary: { label: "New project" },
    secondary: { label: "Import a file" },
  },
};

/* ------------------------------------------------------------------ */
/* EmptyState                                                          */
/* ------------------------------------------------------------------ */

export function EmptyState({
  variant = "inbox",
  meta,
  title,
  body,
  primary,
  secondary,
  query = "quarterly vibes",
  suggestions = ["quarterly review", "Q3 report", "vibe check"],
  onSuggestion,
  templates = ["Product launch", "Editorial calendar", "Hiring loop"],
  onTemplate,
  illustration = true,
}: EmptyStateProps) {
  const d = defaults[variant];
  const headingId = useId();
  const m = meta ?? d.meta;
  const p = primary ?? d.primary;
  const s = secondary ?? d.secondary;
  const t = title ?? d.title;

  const primaryIcon: Record<EmptyStateVariant, ReactNode> = {
    inbox: <PenLine size={16} strokeWidth={2} aria-hidden="true" />,
    search: <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />,
    project: <span className="text-[18px] font-normal leading-none">+</span>,
  };

  return (
    <div role="region" aria-labelledby={headingId} className="flex flex-col items-center px-6 py-10 text-center text-[#1d1c1a] sm:px-10">
      {illustration && (
        <div className="w-[min(256px,76%)]" aria-hidden="true">
          {variant === "inbox" && <InboxArt />}
          {variant === "search" && <SearchArt />}
          {variant === "project" && <ProjectArt />}
        </div>
      )}

      <p className="mt-7 font-mono text-[11px] uppercase tracking-[0.14em] text-[#1d1c1a]/50">{m}</p>
      <h3 id={headingId} className="mt-3 max-w-[22ch] text-balance font-display text-[clamp(1.375rem,1.2rem+0.6vw,1.625rem)] font-semibold leading-[1.15] tracking-[-0.025em]">
        {variant === "search" && title === undefined ? (
          <>
            {t} <span className="font-serif text-[1.12em] font-normal italic tracking-[-0.01em]">“{query}”</span>
          </>
        ) : (
          t
        )}
      </h3>
      <p className="mt-3 max-w-[38ch] text-pretty text-[15px] leading-[1.6] text-[#1d1c1a]/65">{body ?? d.body}</p>

      {variant === "search" && suggestions.length > 0 && (
        <ul className="mt-5 flex flex-wrap justify-center gap-2" aria-label="Suggested searches">
          {suggestions.map((sg) => (
            <li key={sg}>
              <button
                type="button"
                onClick={() => onSuggestion?.(sg)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] text-[#1d1c1a] shadow-[inset_0_0_0_1px_rgba(29,28,26,0.14)] outline-none transition-colors hover:bg-[#fde3cc] hover:shadow-[inset_0_0_0_1px_rgba(239,143,74,0.6)] focus-visible:ring-2 focus-visible:ring-[#ef8f4a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffdf9]"
              >
                <Search size={13} strokeWidth={2} className="text-[#1d1c1a]/45" aria-hidden="true" />
                {sg}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        <button
          type="button"
          onClick={p.onClick}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[#1d1c1a] pl-5 pr-4 text-[14px] font-medium text-[#fffdf9] outline-none transition-[background-color,transform] duration-150 hover:bg-[#33312d] focus-visible:ring-2 focus-visible:ring-[#ef8f4a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffdf9] active:translate-y-px"
        >
          {p.label}
          {primaryIcon[variant]}
        </button>
        <button
          type="button"
          onClick={s.onClick}
          className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-[14px] font-medium text-[#1d1c1a] outline-none transition-colors hover:bg-[#1d1c1a]/[0.06] focus-visible:ring-2 focus-visible:ring-[#ef8f4a]"
        >
          {variant === "search" && <X size={15} strokeWidth={2} aria-hidden="true" />}
          {variant === "project" && <Upload size={15} strokeWidth={2} aria-hidden="true" />}
          {s.label}
        </button>
      </div>

      {variant === "project" && templates.length > 0 && (
        <div className="mt-7 w-full max-w-[22rem] border-t border-dashed border-[#1d1c1a]/20 pt-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#1d1c1a]/50">Or start from a template</p>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {templates.map((tp, i) => (
              <li key={tp}>
                <button
                  type="button"
                  onClick={() => onTemplate?.(tp)}
                  className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-[#f4f0e8] pl-2 pr-3 text-[13px] text-[#1d1c1a] outline-none transition-colors hover:bg-[#fde3cc] focus-visible:ring-2 focus-visible:ring-[#ef8f4a]"
                >
                  <TemplateGlyph n={i} />
                  {tp}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TemplateGlyph({ n }: { n: number }) {
  const shapes = [
    <path key="a" d="M3 11 8 3l5 8z" />,
    <rect key="b" x="3" y="3" width="10" height="10" rx="1.5" />,
    <circle key="c" cx="8" cy="8" r="5" />,
  ];
  return (
    <svg viewBox="0 0 16 16" className="size-5 rounded-[6px] bg-white p-[3px]" fill={accent} stroke={ink} strokeWidth="1.2" aria-hidden="true">
      {shapes[n % shapes.length]}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Illustrations: ink line, paper fills, one apricot accent            */
/* ------------------------------------------------------------------ */

const line = { stroke: ink, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function InboxArt() {
  const reduce = useReducedMotion();
  const steam = (delay: number) =>
    reduce
      ? {}
      : {
          animate: { y: [4, -4], opacity: [0, 1, 0] },
          transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" as const, delay },
        };
  return (
    <svg viewBox="0 0 240 160" className="h-auto w-full overflow-visible">
      <ellipse cx="120" cy="143" rx="96" ry="6" fill={shade} />
      {/* Flight path of the last email, leaving */}
      <path d="M104 92c-18-20-40-18-44-34-5-18 22-26 36-14 12 10 2 24 18 26 14 2 22-18 40-30" fill="none" {...line} strokeWidth={1.3} strokeDasharray="2 5" opacity="0.55" />
      <motion.g
        initial={false}
        animate={reduce ? undefined : { x: [0, 3, 0], y: [0, -3, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <path d="M156 38 190 22l-14 30-6-9z" fill={paper} {...line} />
        <path d="m170 43 20-21" fill="none" {...line} />
        <path d="m170 43-2 9 8-0.5" fill={tint} {...line} />
      </motion.g>
      {/* Tray */}
      <path d="M62 92h116l14 14H48z" fill={shade} {...line} />
      <path d="M72 98h96" {...line} strokeWidth={1.2} opacity="0.35" />
      <path d="M48 106h144l-8 34H56z" fill={paper} {...line} />
      <rect x="104" y="117" width="32" height="10" rx="3" fill={tint} {...line} strokeWidth={1.3} />
      {/* Tea */}
      <motion.path d="M206 100c-4-5 4-8 0-14" fill="none" {...line} strokeWidth={1.4} {...steam(0)} />
      <motion.path d="M214 98c-4-5 4-8 0-14" fill="none" {...line} strokeWidth={1.4} {...steam(0.9)} />
      <path d="M198 110h24v22a6 6 0 0 1-6 6h-12a6 6 0 0 1-6-6z" fill={accent} {...line} />
      <path d="M222 116h3a5 5 0 0 1 0 10h-3" fill="none" {...line} />
      <path d="M198 116h24" {...line} strokeWidth={1.2} opacity="0.4" />
    </svg>
  );
}

function SearchArt() {
  const reduce = useReducedMotion();
  const clipId = useId();
  return (
    <svg viewBox="0 0 240 160" className="h-auto w-full overflow-visible">
      <ellipse cx="120" cy="143" rx="96" ry="6" fill={shade} />
      {/* A fanned stack of index cards, none of them the right one */}
      <g transform="rotate(-8 92 96)">
        <rect x="46" y="56" width="92" height="76" rx="6" fill={shade} {...line} />
      </g>
      <g transform="rotate(5 150 96)">
        <rect x="104" y="58" width="92" height="76" rx="6" fill={paper} {...line} />
        <path d="M116 76h44M116 88h66M116 100h56M116 112h38" {...line} strokeWidth={1.3} opacity="0.3" />
      </g>
      <rect x="74" y="52" width="92" height="82" rx="6" fill={paper} {...line} />
      <path d="M86 70h40M86 82h66M86 94h58M86 106h66M86 118h30" {...line} strokeWidth={1.3} opacity="0.3" />
      {/* The lens finds nothing */}
      <motion.g
        initial={false}
        animate={reduce ? undefined : { x: [-14, 18, -14], rotate: [-4, 4, -4] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        style={{ originX: "128px", originY: "84px" }}
      >
        <defs>
          <clipPath id={clipId}>
            <circle cx="128" cy="84" r="25" />
          </clipPath>
        </defs>
        <circle cx="128" cy="84" r="25" fill={tint} />
        <g clipPath={`url(#${clipId})`}>
          <text x="128" y="96" textAnchor="middle" fontSize="34" fontWeight="700" fill={accent} style={{ fontFamily: "var(--font-display, ui-sans-serif)" }} stroke={ink} strokeWidth="1.2" paintOrder="stroke">
            0
          </text>
        </g>
        <circle cx="128" cy="84" r="25" fill="none" {...line} strokeWidth={4.5} />
        <circle cx="128" cy="84" r="25" fill="none" stroke={paper} strokeWidth={1.6} />
        <path d="M118 70a14 14 0 0 1 8-4" fill="none" stroke={paper} strokeWidth={2.4} strokeLinecap="round" />
        <path d="m146 102 18 18" {...line} strokeWidth={9} />
        <path d="m146 102 18 18" stroke={accent} strokeWidth={5.5} strokeLinecap="round" />
      </motion.g>
    </svg>
  );
}

function ProjectArt() {
  const reduce = useReducedMotion();
  const gridId = useId();
  return (
    <svg viewBox="0 0 240 160" className="h-auto w-full overflow-visible">
      <defs>
        <pattern id={gridId} width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M12 0H0v12" fill="none" stroke={ink} strokeWidth="0.6" opacity="0.14" />
        </pattern>
      </defs>
      {/* Cutting mat */}
      <rect x="20" y="40" width="200" height="104" rx="8" fill={shade} {...line} />
      <rect x="20" y="40" width="200" height="104" rx="8" fill={`url(#${gridId})`} />
      <path d="M32 48v6M44 48v3M56 48v3M68 48v6M80 48v3M92 48v3M104 48v6" {...line} strokeWidth={1} opacity="0.45" />
      {/* Blank sheet */}
      <g transform="rotate(-4 120 92)">
        <path d="M76 26h76l16 16v86H76z" fill={paper} {...line} />
        <path d="M152 26v16h16" fill={tint} {...line} />
        <motion.rect
          x="90"
          y="50"
          width="64"
          height="62"
          rx="4"
          fill="none"
          stroke={ink}
          strokeWidth={1.3}
          strokeDasharray="4 4"
          opacity="0.55"
          initial={false}
          animate={reduce ? undefined : { strokeDashoffset: [0, -16] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
        />
        <circle cx="122" cy="81" r="12" fill={accent} {...line} />
        <path d="M122 75v12M116 81h12" {...line} strokeWidth={1.8} />
      </g>
      {/* Pencil */}
      <g transform="rotate(-32 186 112)">
        <rect x="150" y="106" width="58" height="12" rx="2" fill={accent} {...line} />
        <path d="M150 106v12" {...line} />
        <path d="M208 106h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8z" fill={tint} {...line} />
        <path d="M150 106l-14 6 14 6z" fill={paper} {...line} />
        <path d="m136 112 5-2.2v4.4z" fill={ink} />
        <path d="M156 112h46" {...line} strokeWidth={1} opacity="0.35" />
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                */
/* ------------------------------------------------------------------ */

export type EmptyStateDemoProps = {
  kicker?: string;
  title?: string;
  titleItalic?: string;
  intro?: string;
};

export function EmptyStateGallery({
  kicker = "Primitives / Empty states",
  title = "Nothing here,",
  titleItalic = "on purpose.",
  intro = "An empty screen is the first thing a new user sees and the last thing a busy one hopes for. Three of them, each with a drawing, a line worth reading and a clear next step.",
}: EmptyStateDemoProps) {
  const [query, setQuery] = useState("quarterly vibes");
  const [inputValue, setInputValue] = useState("quarterly vibes");

  return (
    <section className="bg-[#f4f1ea] text-[#1d1c1a]">
      <div className="mx-auto max-w-[80rem] px-4 py-12 sm:px-8 lg:px-12 lg:py-20">
        <div className="grid gap-6 px-1 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#1d1c1a]/55">{kicker}</p>
            <h2 className="mt-5 font-display text-[clamp(2.75rem,1.6rem+4.4vw,5.5rem)] font-bold leading-[0.92] tracking-[-0.05em]">
              {title}
              <br />
              <span className="font-serif font-normal italic tracking-[-0.02em] text-[#c9601e]">{titleItalic}</span>
            </h2>
          </div>
          <p className="max-w-[44ch] text-[16px] leading-[1.6] text-[#1d1c1a]/65 md:col-span-5 md:pb-2">{intro}</p>
        </div>

        <div className="mt-12 grid gap-4 lg:mt-16 lg:grid-cols-3 lg:gap-5">
          {/* Inbox */}
          <Frame
            label="Mail"
            header={
              <div className="flex items-center gap-1 text-[13px]">
                <span className="rounded-full bg-[#1d1c1a] px-3 py-1 font-medium text-[#fffdf9]">Primary</span>
                <span className="rounded-full px-3 py-1 text-[#1d1c1a]/55">Updates</span>
                <span className="rounded-full px-3 py-1 text-[#1d1c1a]/55">Snoozed</span>
              </div>
            }
          >
            <EmptyState variant="inbox" />
          </Frame>

          {/* Search */}
          <Frame
            label="Search"
            header={
              <form
                role="search"
                className="relative w-full"
                onSubmit={(e) => {
                  e.preventDefault();
                  setQuery(inputValue.trim() || "nothing at all");
                }}
              >
                <Search size={15} strokeWidth={2} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#1d1c1a]/45" aria-hidden="true" />
                <input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  aria-label="Search everything"
                  className="h-9 w-full rounded-full bg-[#f4f1ea] pl-9 pr-4 text-[13px] text-[#1d1c1a] outline-none ring-[#ef8f4a] placeholder:text-[#1d1c1a]/40 focus-visible:ring-2"
                  placeholder="Search everything"
                />
              </form>
            }
          >
            <EmptyState
              variant="search"
              query={query}
              onSuggestion={(s) => {
                setInputValue(s);
                setQuery(s);
              }}
              secondary={{
                label: "Clear search",
                onClick: () => {
                  setInputValue("");
                },
              }}
            />
          </Frame>

          {/* Project */}
          <Frame
            label="Projects"
            header={
              <div className="flex w-full items-center justify-between text-[13px]">
                <span className="font-medium">All projects</span>
                <span className="font-mono text-[11px] tabular-nums text-[#1d1c1a]/45">0</span>
              </div>
            }
          >
            <EmptyState variant="project" />
          </Frame>
        </div>
      </div>
    </section>
  );
}

function Frame({ label, header, children }: { label: string; header: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[20px] bg-[#fffdf9] shadow-[0_0_0_1px_rgba(29,28,26,0.08),0_1px_2px_rgba(29,28,26,0.04),0_24px_48px_-32px_rgba(29,28,26,0.25)]">
      <div className="flex h-14 items-center gap-3 border-b border-[#1d1c1a]/[0.07] px-4">
        <span className="sr-only">{label}</span>
        {header}
      </div>
      <div className="flex flex-1 items-center justify-center">{children}</div>
    </div>
  );
}

export default EmptyStateGallery;
