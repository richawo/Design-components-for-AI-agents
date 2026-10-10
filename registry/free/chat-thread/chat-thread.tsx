"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { ArrowUp, Check, Copy, Paperclip, Square, SquarePen, X } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type ChatBlock =
  | { type: "p"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "code"; lang: string; filename?: string; code: string };

export type ChatSource = { title: string; domain: string; href: string };

export type ChatMessage =
  | { id: string; role: "user"; text: string; time?: string }
  | { id: string; role: "assistant"; blocks: ChatBlock[]; sources?: ChatSource[]; time?: string };

export type ChatThreadProps = {
  /** Thread title shown in the header. */
  title?: string;
  /** Small mono line under the title. */
  subtitle?: string;
  /** The assistant’s display name; its first letter becomes the avatar mark. */
  assistantName?: string;
  /** Model label shown in the composer. */
  model?: string;
  /** Messages already in the thread. */
  messages?: ChatMessage[];
  /** Stream the final assistant message in once the thread has landed. */
  streamLast?: boolean;
  /** Composer placeholder. Defaults to “Reply to {assistantName}…”. */
  placeholder?: string;
  /**
   * Builds the canned reply that streams back after the user sends. Replace it with
   * your own streaming call; the demo returns a polite, honest placeholder.
   */
  reply?: (text: string) => ChatBlock[];
  /** Called with the message text whenever the user sends. */
  onSend?: (text: string) => void;
  /** Called by the “New thread” button. Without it, the button clears this thread. */
  onNewThread?: () => void;
  /** The one accent: the send button and the assistant’s live dot. */
  accent?: string;
  theme?: "dark" | "light";
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    window: "#0e0e10",
    raised: "#141416",
    bubble: "#1c1c1f",
    code: "#08080a",
    line: "#232327",
    rule: "#1b1b1e",
    ink: "#f4f4f5",
    body: "#cfcfd4",
    muted: "#a1a1aa",
    faint: "#8a8a93",
    chip: "#18181b",
    hover: "rgba(255,255,255,0.06)",
    // Syntax runs on luminance alone: keywords brightest, comments quietest.
    synBase: "#bdbdc4",
    synKey: "#f4f4f5",
    synType: "#e4e4e7",
    synStr: "#9d9da6",
    synNum: "#d4d4d8",
    synCom: "#75757e",
    shadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 32px 80px -32px rgba(0,0,0,0.9)",
    composerShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 28px -18px rgba(0,0,0,0.8)",
  },
  light: {
    window: "#ffffff",
    raised: "#fafafa",
    bubble: "#f1f1f3",
    code: "#f7f7f8",
    line: "#e4e4e7",
    rule: "#efeff1",
    ink: "#18181b",
    body: "#3f3f46",
    muted: "#52525b",
    faint: "#71717a",
    chip: "#f4f4f5",
    hover: "rgba(24,24,27,0.05)",
    synBase: "#52525b",
    synKey: "#18181b",
    synType: "#27272a",
    synStr: "#71717a",
    synNum: "#3f3f46",
    synCom: "#8a8a93",
    shadow: "0 1px 2px rgba(24,24,27,0.04), 0 32px 64px -40px rgba(24,24,27,0.25)",
    composerShadow: "0 1px 2px rgba(24,24,27,0.04), 0 12px 28px -20px rgba(24,24,27,0.2)",
  },
} as const;

type Palette = Record<keyof (typeof PALETTE)["dark"], string>;

const DEFAULT_ACCENT = "#ff9a6b";

/** The demo’s quiet backdrop; not part of the component. It follows the theme. */
const STAGE = { dark: "#000000", light: "#e9e9ec" } as const;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;
/** A sent message springs up out of the composer. */
const SPRING_SEND = { type: "spring", stiffness: 420, damping: 34 } as const;

/** One place for the choreography. Seconds unless noted. */
const MOTION = {
  rise: 12, // px
  blur: 8, // px
  block: 0.5,
  step: 0.05, // header: title → subtitle → button
  messagesAt: 0.16,
  messageStep: 0.06, // message to message, in reading order
  composerGap: 0.06, // after the last message starts
  controlStep: 0.04, // composer controls
  think: 0.42, // dots before the first chunk of a reply
  ink: 380, // ms: each chunk settles from a blur, like ink drying
  inkBlur: 3, // px
  exit: 0.16,
  copiedFor: 1600, // ms
  fade: 0.15, // reduced motion
} as const;

const COMPOSER_MAX = 208; // px before the textarea scrolls (about 8 lines)
const PIN_SLOP = 48; // px from the bottom that still counts as “following”

/* ------------------------------------------------------------------ */
/* Demo content                                                         */
/* ------------------------------------------------------------------ */

const DEMO_MESSAGES: ChatMessage[] = [
  {
    id: "m1",
    role: "user",
    time: "10:42",
    text: "Our search box fires a request on every keystroke. What’s the least clever fix?",
  },
  {
    id: "m2",
    role: "assistant",
    time: "10:42",
    blocks: [
      {
        type: "p",
        text: "Debounce the **value**, not the handler. Let the input stay instant and only let the query settle once someone stops typing for about `250ms`. It’s boring, which is the point.",
      },
      {
        type: "list",
        items: [
          "Keep the raw text in state so typing never feels laggy.",
          "Derive a debounced copy and fetch from that, nothing else.",
          "Cancel the previous request with an `AbortController` so a slow reply can’t overwrite a fast one.",
        ],
      },
    ],
  },
  { id: "m3", role: "user", time: "10:44", text: "Show me the hook? We’re on TypeScript." },
  {
    id: "m4",
    role: "assistant",
    time: "10:44",
    blocks: [
      {
        type: "p",
        text: "Here’s the whole thing. It holds on to the **last** value and only lets it through once the input has been quiet for `delay` milliseconds.",
      },
      {
        type: "code",
        lang: "ts",
        filename: "use-debounced-value.ts",
        code: `export function useDebouncedValue<T>(value: T, delay = 250) {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    // Restart the clock on every change; only the last one survives.
    const id = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return settled;
}`,
      },
      {
        type: "p",
        text: "Fetch from `useDebouncedValue(query)` and our test page dropped from 31 requests per search to 3. If someone presses **Enter**, skip the wait and search the raw value straight away.",
      },
    ],
    sources: [
      { title: "Debounce vs throttle, drawn out", domain: "fieldguide.dev", href: "#" },
      { title: "Cancelling fetches you no longer need", domain: "platform-notes.org", href: "#" },
      { title: "Typing latency budgets", domain: "inputlab.io", href: "#" },
    ],
  },
];

function defaultReply(text: string): ChatBlock[] {
  const quoted = text.length > 64 ? `${text.slice(0, 61).trimEnd()}…` : text;
  return [
    {
      type: "p",
      text: `This is a demo thread, so “${quoted}” gets a stand-in answer. Wire **reply** to your model and the real one will stream in right here, like this.`,
    },
    {
      type: "list",
      items: ["A direct answer in the first sentence.", "The reasoning, kept short enough to read on a phone.", "One next step you could do in the next five minutes."],
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function inkOn(hex: string) {
  const v = hex.replace("#", "");
  const full = v.length === 3 ? [...v].map((c) => c + c).join("") : v.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#0a0a0b" : "#ffffff";
}

function cssVars(p: Palette, accent: string): CSSProperties {
  const vars: Record<string, string> = { "--ct-accent": accent, "--ct-on-accent": inkOn(accent) };
  for (const [k, v] of Object.entries(p)) vars[`--ct-${k}`] = v;
  return vars as CSSProperties;
}

/** Entrance props for a block: rises out of a blur. Reduced motion: a short fade. */
function enter(play: boolean, delay: number, reduce: boolean, rise: number = MOTION.rise) {
  if (reduce) return { initial: { opacity: 0 }, animate: { opacity: play ? 1 : 0 }, transition: { duration: MOTION.fade } };
  return {
    initial: { opacity: 0, y: rise, filter: `blur(${MOTION.blur}px)` },
    animate: play ? { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } } : undefined,
    transition: { duration: MOTION.block, ease: EASE_OUT, delay },
  };
}

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ct-ink)]";
const iconButton = `flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--ct-muted)] transition-[background-color,color,transform] duration-150 hover:bg-[var(--ct-hover)] hover:text-[var(--ct-ink)] active:scale-90 ${focusRing}`;

const clock = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/* ------------------------------------------------------------------ */
/* Inline formatting: **bold** and `code`                               */
/* ------------------------------------------------------------------ */

type Seg = { text: string; kind: "text" | "bold" | "code" };

function parseInline(src: string): Seg[] {
  const out: Seg[] = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ text: src.slice(last, m.index), kind: "text" });
    out.push(m[1] !== undefined ? { text: m[1], kind: "bold" } : { text: m[2], kind: "code" });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ text: src.slice(last), kind: "text" });
  return out;
}

const visibleLength = (src: string) => parseInline(src).reduce((n, s) => n + s.text.length, 0);

function blockLength(b: ChatBlock) {
  if (b.type === "p") return visibleLength(b.text);
  if (b.type === "list") return b.items.reduce((n, i) => n + visibleLength(i), 0);
  return b.code.length;
}

const plainText = (blocks: ChatBlock[]) =>
  blocks
    .map((b) => (b.type === "p" ? b.text : b.type === "list" ? b.items.map((i) => `• ${i}`).join("\n") : b.code))
    .join("\n\n")
    .replace(/\*\*|`/g, "");

/* ------------------------------------------------------------------ */
/* Ink: streamed text settles chunk by chunk                            */
/* ------------------------------------------------------------------ */

/**
 * Splits `text` (which starts at message offset `start`) at the offsets where each
 * streamed chunk began. Each piece is keyed by its offset, so it mounts once and its
 * settle animation plays once, however often the message re-renders.
 */
function Ink({ text, start, cuts, className }: { text: string; start: number; cuts: number[]; className?: string }) {
  if (!cuts.length) return className ? <span className={className}>{text}</span> : <>{text}</>;
  const end = start + text.length;
  const marks = [start, ...cuts.filter((c) => c > start && c < end), end];
  return (
    <>
      {marks.slice(0, -1).map((at, i) => (
        <span key={at} className={`ct-ink ${className ?? ""}`}>
          {text.slice(at - start, marks[i + 1] - start)}
        </span>
      ))}
    </>
  );
}

function Inline({ text, start, limit, cuts }: { text: string; start: number; limit: number; cuts: number[] }) {
  let at = start;
  let left = limit;
  const nodes: ReactNode[] = [];
  parseInline(text).forEach((s, i) => {
    if (left <= 0) return;
    const shown = s.text.slice(0, left);
    const from = at;
    at += shown.length;
    left -= shown.length;
    const ink = <Ink text={shown} start={from} cuts={cuts} />;
    if (s.kind === "bold")
      nodes.push(
        <strong key={i} className="font-semibold text-[var(--ct-ink)]">
          {ink}
        </strong>,
      );
    else if (s.kind === "code")
      nodes.push(
        <code key={i} className="rounded-[5px] bg-[var(--ct-hover)] px-[0.35em] py-[0.1em] font-mono text-[0.86em] text-[var(--ct-ink)]">
          {ink}
        </code>,
      );
    else nodes.push(<Fragment key={i}>{ink}</Fragment>);
  });
  return <>{nodes}</>;
}

/* ------------------------------------------------------------------ */
/* A deliberately small highlighter, in greys                           */
/* ------------------------------------------------------------------ */

const KEYWORDS = new Set(["export", "function", "const", "let", "return", "import", "from", "if", "else", "await", "async", "new", "type", "interface", "for", "of", "in", "true", "false", "null", "undefined"]);

type Tone = "base" | "key" | "type" | "str" | "num" | "com";
const TONE: Record<Tone, string> = {
  base: "",
  key: "text-[var(--ct-synKey)] font-medium",
  type: "text-[var(--ct-synType)]",
  str: "text-[var(--ct-synStr)]",
  num: "text-[var(--ct-synNum)]",
  com: "italic text-[var(--ct-synCom)]",
};

function tokenizeCode(code: string): { text: string; tone: Tone }[] {
  const re = /(\/\/.*$)|("[^"]*"|'[^']*'|`[^`]*`)|\b(\d+)\b|\b([A-Za-z_]\w*)\b/gm;
  const out: { text: string; tone: Tone }[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    if (m.index > last) out.push({ text: code.slice(last, m.index), tone: "base" });
    const tone: Tone = m[1] ? "com" : m[2] ? "str" : m[3] ? "num" : KEYWORDS.has(m[4]) ? "key" : /^[A-Z]/.test(m[4]) ? "type" : "base";
    out.push({ text: m[0], tone });
    last = m.index + m[0].length;
  }
  if (last < code.length) out.push({ text: code.slice(last), tone: "base" });
  return out;
}

/* ------------------------------------------------------------------ */
/* Hooks                                                                */
/* ------------------------------------------------------------------ */

function useCopy() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = useCallback((text: string) => {
    void navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), MOTION.copiedFor);
  }, []);
  return { copied, copy };
}

/**
 * Reveals `total` characters in uneven chunks (usually 2–6, now and then a 10–22 burst)
 * and remembers where each chunk began, so each can settle on its own. One timer at a time.
 */
function useCharStream(total: number, { streaming, play, delay, reduce, onDone }: { streaming: boolean; play: boolean; delay: number; reduce: boolean; onDone: () => void }) {
  // A message that will stream starts empty, even before it’s in view.
  const [state, setState] = useState(() => ({ budget: streaming && !reduce ? 0 : total, cuts: [] as number[] }));
  const active = streaming && play;
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!active) return;
    if (reduce) {
      setState({ budget: total, cuts: [] });
      done.current();
      return;
    }
    let n = 0;
    let timer: number | undefined;
    const step = () => {
      const burst = Math.random() < 0.12 ? 10 + Math.floor(Math.random() * 12) : 2 + Math.floor(Math.random() * 5);
      const from = n;
      n = Math.min(total, n + burst);
      setState((s) => ({ budget: n, cuts: [...s.cuts, from] }));
      if (n >= total) return done.current();
      timer = window.setTimeout(step, Math.random() < 0.06 ? 160 + Math.random() * 180 : 18 + Math.random() * 34);
    };
    timer = window.setTimeout(step, (delay + MOTION.think) * 1000);
    return () => window.clearTimeout(timer);
  }, [active, delay, reduce, total]);

  return state;
}

/** Grows the textarea with its content, up to COMPOSER_MAX. */
function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX)}px`;
  }, [ref, value]);
}

/** Follows the conversation while the reader is at the bottom; scrolling up lets go. */
function useFollowBottom() {
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  useEffect(() => {
    const el = scroller.current;
    const content = el?.firstElementChild;
    if (!el || !content) return;
    const ro = new ResizeObserver(() => {
      if (pinned.current) el.scrollTo({ top: el.scrollHeight });
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, []);
  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < PIN_SLOP;
  }, []);
  const pin = useCallback(() => {
    pinned.current = true;
  }, []);
  return { scroller, onScroll, pin };
}

/* ------------------------------------------------------------------ */
/* Pieces                                                               */
/* ------------------------------------------------------------------ */

function Caret() {
  return (
    <motion.span
      aria-hidden="true"
      className="ml-[2px] inline-block h-[1.05em] w-[2px] translate-y-[0.18em] rounded-full bg-[var(--ct-ink)]"
      animate={{ opacity: [0.85, 0.2, 0.85] }}
      transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function ThinkingDots({ label }: { label: string }) {
  return (
    <p className="flex h-[1.7em] items-center gap-1" aria-label={label}>
      {[0, 1, 2].map((d) => (
        <motion.span
          key={d}
          className="size-1.5 rounded-full bg-[var(--ct-faint)]"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }}
        />
      ))}
    </p>
  );
}

function CopyButton({ text, label, disabled }: { text: string; label: string; disabled?: boolean }) {
  const { copied, copy } = useCopy();
  return (
    <button
      type="button"
      onClick={() => copy(text)}
      disabled={disabled}
      aria-label={copied ? "Copied" : label}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] px-2.5 font-mono text-[11.5px] text-[var(--ct-muted)] transition-[background-color,color,transform] duration-150 hover:bg-[var(--ct-hover)] hover:text-[var(--ct-ink)] active:scale-95 disabled:pointer-events-none disabled:opacity-40 ${focusRing}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={copied ? "copied" : "copy"}
          initial={{ opacity: 0, y: 4, filter: "blur(2px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
          transition={{ duration: 0.16, ease: EASE_OUT }}
          className="inline-flex items-center gap-1.5"
        >
          {copied ? <Check className="size-3.5 text-[var(--ct-ink)]" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function CodeBlock({ block, start, limit, cuts, done }: { block: Extract<ChatBlock, { type: "code" }>; start: number; limit: number; cuts: number[]; done: boolean }) {
  let at = start;
  return (
    <figure className="overflow-hidden rounded-[14px] border border-[var(--ct-line)] bg-[var(--ct-code)]">
      <figcaption className="flex h-11 items-center justify-between gap-3 border-b border-[var(--ct-rule)] pl-4 pr-1.5">
        <span className="flex min-w-0 items-center gap-2.5 font-mono text-[11.5px]">
          <span className="rounded-[4px] bg-[var(--ct-hover)] px-1.5 py-0.5 uppercase tracking-[0.08em] text-[var(--ct-ink)]">{block.lang}</span>
          {block.filename ? <span className="truncate text-[var(--ct-faint)]">{block.filename}</span> : null}
        </span>
        <CopyButton text={block.code} label="Copy code" disabled={!done} />
      </figcaption>
      <pre className="overflow-x-auto px-4 py-4 font-mono text-[12.5px] leading-[1.75] text-[var(--ct-synBase)] @xl:text-[13px]">
        <code>
          {tokenizeCode(block.code.slice(0, limit)).map((t) => {
            const from = at;
            at += t.text.length;
            return <Ink key={from} text={t.text} start={from} cuts={cuts} className={TONE[t.tone]} />;
          })}
        </code>
      </pre>
    </figure>
  );
}

/** The assistant’s blocks, cut off at `budget` characters, with a caret on the live edge. */
function Blocks({ blocks, budget, cuts, done }: { blocks: ChatBlock[]; budget: number; cuts: number[]; done: boolean }) {
  let left = budget;
  let at = 0;
  return (
    <>
      {blocks.map((b, i) => {
        if (left <= 0) return null;
        const start = at;
        const len = blockLength(b);
        const lim = Math.min(left, len);
        left -= lim;
        at += len;
        const live = !done && left <= 0;
        if (b.type === "p")
          return (
            <p key={i} className="max-w-[64ch] text-pretty">
              <Inline text={b.text} start={start} limit={lim} cuts={cuts} />
              {live ? <Caret /> : null}
            </p>
          );
        if (b.type === "list") {
          const Tag = b.ordered ? "ol" : "ul";
          let itemLeft = lim;
          let itemAt = start;
          return (
            <Tag key={i} className="max-w-[62ch] space-y-2">
              {b.items.map((it, j) => {
                if (itemLeft <= 0) return null;
                const from = itemAt;
                const n = Math.min(itemLeft, visibleLength(it));
                itemLeft -= n;
                itemAt += visibleLength(it);
                return (
                  <li key={j} className="relative pl-6">
                    <span aria-hidden="true" className="absolute left-1 top-[0.72em] h-[2px] w-2.5 rounded-full bg-[var(--ct-faint)]" />
                    <Inline text={it} start={from} limit={n} cuts={cuts} />
                    {live && itemLeft <= 0 ? <Caret /> : null}
                  </li>
                );
              })}
            </Tag>
          );
        }
        return <CodeBlock key={i} block={b} start={start} limit={lim} cuts={cuts} done={done} />;
      })}
    </>
  );
}

function Sources({ sources, reduce }: { sources: ChatSource[]; reduce: boolean }) {
  return (
    <div className="pt-1">
      <motion.p {...enter(true, 0, reduce, 6)} className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--ct-faint)]">
        Sources
      </motion.p>
      <ol className="flex flex-wrap gap-2">
        {sources.map((s, i) => (
          <motion.li key={s.href + i} {...enter(true, 0.06 + i * MOTION.step, reduce, 6)} className="min-w-0 max-w-full">
            <a
              href={s.href}
              className={`group/src flex min-h-11 max-w-full items-center gap-2.5 rounded-[10px] border border-[var(--ct-line)] bg-[var(--ct-chip)] py-1.5 pl-1.5 pr-3 transition-[border-color,transform] duration-150 hover:border-[var(--ct-faint)] active:scale-[0.98] ${focusRing}`}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-[6px] bg-[var(--ct-hover)] font-mono text-[11px] tabular-nums text-[var(--ct-muted)]">{i + 1}</span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[13px] font-medium text-[var(--ct-ink)] group-hover/src:underline group-hover/src:underline-offset-2">{s.title}</span>
                <span className="block truncate font-mono text-[10.5px] text-[var(--ct-faint)]">{s.domain}</span>
              </span>
            </a>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

/** A white disc with the assistant’s initial; the accent dot only shows while it writes. */
function AssistantMark({ name, live, reduce }: { name: string; live: boolean; reduce: boolean }) {
  return (
    <span aria-hidden="true" className="relative flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--ct-ink)] text-[var(--ct-window)]">
      <span className="text-[14px] font-semibold leading-none">{name.charAt(0)}</span>
      <AnimatePresence>
        {live ? (
          <motion.span
            key="live"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={reduce ? { duration: 0 } : SPRING_UI}
            className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-[var(--ct-window)] bg-[var(--ct-accent)]"
          />
        ) : null}
      </AnimatePresence>
    </span>
  );
}

function AssistantMessage({
  message,
  name,
  streaming,
  play,
  delay,
  onDone,
  reduce,
}: {
  message: Extract<ChatMessage, { role: "assistant" }>;
  name: string;
  streaming: boolean;
  play: boolean;
  /** Seconds until this message lands; a streamed reply starts once it has. */
  delay: number;
  onDone: () => void;
  reduce: boolean;
}) {
  const total = message.blocks.reduce((n, b) => n + blockLength(b), 0);
  const { budget, cuts } = useCharStream(total, { streaming, play, delay: delay + MOTION.block * 0.6, reduce, onDone });
  // Finished when every character is out, or when the stream was stopped early.
  const done = budget >= total || !streaming;
  const stopped = !streaming && budget < total;

  return (
    <motion.article {...enter(play, delay, reduce)} aria-label={`${name} said`} aria-busy={!done}>
      <header className="mb-3 flex items-center gap-2.5">
        <AssistantMark name={name} live={!done} reduce={reduce} />
        <span className="text-[14px] font-semibold tracking-[-0.01em] text-[var(--ct-ink)]">{name}</span>
        {message.time ? <time className="font-mono text-[11px] tabular-nums text-[var(--ct-faint)]">{message.time}</time> : null}
        {!done ? <span className="font-mono text-[11px] text-[var(--ct-muted)]">writing…</span> : null}
        {stopped ? <span className="font-mono text-[11px] text-[var(--ct-faint)]">stopped</span> : null}
      </header>

      <div className="space-y-4 text-[15.5px] leading-[1.7] text-[var(--ct-body)] @xl:pl-[38px] @xl:text-[16px]">
        <Blocks blocks={message.blocks} budget={budget} cuts={cuts} done={done} />
        {budget === 0 && !done ? <ThinkingDots label={`${name} is thinking`} /> : null}
        {done && message.sources?.length ? <Sources sources={message.sources} reduce={reduce} /> : null}
        {done ? (
          <motion.div {...enter(true, 0.12, reduce, 4)} className="-ml-2.5 flex items-center">
            <CopyButton text={plainText(message.blocks)} label="Copy reply" />
          </motion.div>
        ) : null}
      </div>
    </motion.article>
  );
}

function UserMessage({ message, play, delay, sent, reduce }: { message: Extract<ChatMessage, { role: "user" }>; play: boolean; delay: number; sent: boolean; reduce: boolean }) {
  // A message you just sent springs up out of the composer; history rises with the thread.
  const motionProps = sent
    ? {
        initial: reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96, filter: "blur(6px)" },
        animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
        transition: reduce ? { duration: MOTION.fade } : SPRING_SEND,
      }
    : enter(play, delay, reduce);
  return (
    <motion.article {...motionProps} aria-label="You said" style={{ transformOrigin: "100% 100%" }} className="flex flex-col items-end">
      <p className="max-w-[min(82%,30rem)] whitespace-pre-wrap break-words rounded-[18px] rounded-br-[6px] bg-[var(--ct-bubble)] px-4 py-2.5 text-[15px] leading-[1.55] text-[var(--ct-ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        {message.text}
      </p>
      {message.time ? <time className="mr-1 mt-1.5 font-mono text-[10.5px] tabular-nums text-[var(--ct-faint)]">{message.time}</time> : null}
    </motion.article>
  );
}

function EmptyThread({ name, reduce }: { name: string; reduce: boolean }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
      <motion.p {...enter(true, 0, reduce)} className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--ct-faint)]">
        New thread
      </motion.p>
      <motion.p {...enter(true, MOTION.step * 2, reduce)} className="mt-3 font-display text-[clamp(1.5rem,1.1rem+2cqi,2rem)] font-semibold tracking-[-0.035em] text-[var(--ct-ink)]">
        What are we working on?
      </motion.p>
      <motion.p {...enter(true, MOTION.step * 4, reduce)} className="mt-2 max-w-[40ch] text-[14px] leading-relaxed text-[var(--ct-muted)]">
        {name} reads attachments, writes code and says when it isn’t sure.
      </motion.p>
    </div>
  );
}

function SendButton({ streaming, canSend, onStop, reduce }: { streaming: boolean; canSend: boolean; onStop: () => void; reduce: boolean }) {
  const pop = {
    initial: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 },
    animate: { opacity: 1, scale: 1 },
    exit: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, transition: { duration: 0.1 } },
    transition: reduce ? { duration: MOTION.fade } : SPRING_UI,
  };
  return (
    <span className="relative grid size-11 place-items-center @xl:size-9">
      <AnimatePresence mode="popLayout" initial={false}>
        {streaming ? (
          <motion.button
            key="stop"
            type="button"
            aria-label="Stop generating"
            data-demo="stop"
            onClick={onStop}
            {...pop}
            whileTap={reduce ? undefined : { scale: 0.92 }}
            className={`flex size-11 items-center justify-center rounded-full bg-[var(--ct-ink)] text-[var(--ct-window)] @xl:size-9 ${focusRing}`}
          >
            <Square className="size-3.5 fill-current" aria-hidden="true" />
          </motion.button>
        ) : (
          <motion.button
            key="send"
            type="submit"
            aria-label="Send message"
            data-demo="send"
            disabled={!canSend}
            {...pop}
            whileTap={reduce || !canSend ? undefined : { scale: 0.92 }}
            className={`flex size-11 items-center justify-center rounded-full bg-[var(--ct-accent)] text-[var(--ct-on-accent)] transition-[background-color,color,filter] duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:bg-[var(--ct-hover)] disabled:text-[var(--ct-faint)] disabled:hover:brightness-100 @xl:size-9 ${focusRing}`}
          >
            {/* The arrow lifts when there’s something to send. */}
            <ArrowUp
              className={`size-[18px] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${canSend ? "translate-y-0" : "translate-y-[2px]"}`}
              strokeWidth={2.2}
              aria-hidden="true"
            />
          </motion.button>
        )}
      </AnimatePresence>
    </span>
  );
}

function Composer({
  name,
  model,
  placeholder,
  streaming,
  onSend,
  onStop,
  play,
  delay,
  reduce,
}: {
  name: string;
  model: string;
  placeholder: string;
  streaming: boolean;
  onSend: (text: string, files: string[]) => void;
  onStop: () => void;
  play: boolean;
  delay: number;
  reduce: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const canSend = draft.trim().length > 0 && !streaming;
  useAutoGrow(textarea, draft);

  const send = () => {
    if (!canSend) return;
    onSend(draft.trim(), files);
    setDraft("");
    setFiles([]);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const control = (i: number) => enter(play, delay + 0.08 + i * MOTION.controlStep, reduce, 4);

  return (
    <div className="relative shrink-0 px-3 pb-3 @xl:px-8 @xl:pb-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-[var(--ct-window)] to-transparent" />
      <motion.form
        {...enter(play, delay, reduce)}
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="mx-auto max-w-[720px] rounded-[20px] border border-[var(--ct-line)] bg-[var(--ct-raised)] shadow-[var(--ct-composerShadow)] transition-[border-color] duration-150 focus-within:border-[color-mix(in_srgb,var(--ct-ink)_30%,transparent)]"
      >
        <AnimatePresence initial={false}>
          {files.length ? (
            <motion.ul
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0, transition: { duration: MOTION.exit, ease: EASE_IN } }}
              transition={{ duration: reduce ? MOTION.fade : 0.28, ease: EASE_OUT }}
              className="flex flex-wrap gap-1.5 overflow-hidden px-3 pt-3"
            >
              {files.map((f) => (
                <li key={f} className="flex h-8 max-w-full items-center gap-1.5 rounded-[8px] bg-[var(--ct-hover)] pl-2.5 pr-1 text-[12.5px] text-[var(--ct-ink)]">
                  <Paperclip className="size-3.5 shrink-0 text-[var(--ct-faint)]" aria-hidden="true" />
                  <span className="truncate">{f}</span>
                  <button type="button" aria-label={`Remove ${f}`} onClick={() => setFiles((fs) => fs.filter((x) => x !== f))} className={`${iconButton} size-6 rounded-[6px]`}>
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </motion.ul>
          ) : null}
        </AnimatePresence>
        <label htmlFor={inputId} className="sr-only">
          Message {name}
        </label>
        <textarea
          id={inputId}
          data-demo="composer"
          ref={textarea}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="block max-h-52 min-h-[52px] w-full resize-none bg-transparent px-4 pb-1 pt-[15px] text-[16px] leading-[1.5] text-[var(--ct-ink)] outline-none placeholder:text-[var(--ct-faint)]"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <div className="flex min-w-0 items-center gap-1">
            <input
              ref={fileInput}
              type="file"
              multiple
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const names = Array.from(e.target.files ?? []).map((f) => f.name);
                setFiles((fs) => Array.from(new Set([...fs, ...names])));
                e.target.value = "";
              }}
            />
            <motion.button {...control(0)} type="button" aria-label="Attach a file" onClick={() => fileInput.current?.click()} className={`${iconButton} @xl:size-9`}>
              <Paperclip className="size-[18px]" aria-hidden="true" />
            </motion.button>
            <motion.span {...control(1)} className="min-w-0 truncate px-2 font-mono text-[11px] text-[var(--ct-faint)]">
              {model}
            </motion.span>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <motion.span {...control(2)} className="hidden font-mono text-[10.5px] text-[var(--ct-faint)] @3xl:inline">
              <kbd className="font-mono">↵</kbd> send · <kbd className="font-mono">⇧↵</kbd> new line
            </motion.span>
            <motion.span {...control(3)} className="flex">
              <SendButton streaming={streaming} canSend={canSend} onStop={onStop} reduce={reduce} />
            </motion.span>
          </div>
        </div>
      </motion.form>
      <motion.p {...enter(play, delay + 0.08 + 4 * MOTION.controlStep, reduce, 4)} className="mx-auto mt-2 hidden max-w-[720px] text-center font-mono text-[10.5px] text-[var(--ct-faint)] @xl:block">
        {name} can be confidently wrong. Check anything that matters.
      </motion.p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Thread                                                               */
/* ------------------------------------------------------------------ */

/** Messages sent here enter from the composer; the history the thread opened with staggers in. */
type ThreadMessage = ChatMessage & { local?: boolean };

export function ChatThread({
  title = "Search box fires on every keystroke",
  subtitle = "Frontend · 4 messages · Today",
  assistantName = "Wren",
  model = "Wren 2 · Balanced",
  messages = DEMO_MESSAGES,
  streamLast = true,
  placeholder,
  reply = defaultReply,
  onSend,
  onNewThread,
  accent = DEFAULT_ACCENT,
  theme = "dark",
  className = "",
}: ChatThreadProps) {
  const reduce = useReducedMotion() ?? false;
  const root = useRef<HTMLElement>(null);
  const play = useInView(root, { once: true, amount: 0.2 });
  const { scroller, onScroll, pin } = useFollowBottom();
  const [thread, setThread] = useState<ThreadMessage[]>(messages);
  const [streamingId, setStreamingId] = useState<string | null>(() => (streamLast ? ([...messages].reverse().find((m) => m.role === "assistant")?.id ?? null) : null));
  const counter = useRef(0);

  const streaming = streamingId !== null;
  const messageDelay = (i: number) => MOTION.messagesAt + i * MOTION.messageStep;
  const composerAt = messageDelay(messages.length) + MOTION.composerGap;

  const finish = useCallback((id: string) => setStreamingId((s) => (s === id ? null : s)), []);

  const send = (text: string, files: string[]) => {
    counter.current += 1;
    const id = `local-${counter.current}`;
    setThread((t) => [
      ...t,
      { id: `${id}-u`, role: "user", text: files.length ? `${text}\n\nAttached: ${files.join(", ")}` : text, time: clock(), local: true },
      { id: `${id}-a`, role: "assistant", blocks: reply(text), time: clock(), local: true },
    ]);
    setStreamingId(`${id}-a`);
    pin();
    onSend?.(text);
  };

  const newThread = () => {
    if (onNewThread) return onNewThread();
    setStreamingId(null);
    setThread([]);
  };

  return (
    <section
      ref={root}
      aria-label={title}
      style={cssVars(PALETTE[theme], accent)}
      className={`@container flex h-full w-full font-sans antialiased ${theme === "dark" ? "[color-scheme:dark]" : "[color-scheme:light]"} ${className}`}
    >
      {/* Show the ink settle once per chunk; reduced motion drops it entirely. */}
      <style>{`
        @keyframes ct-ink { from { opacity: 0; filter: blur(${MOTION.inkBlur}px); } to { opacity: 1; filter: blur(0); } }
        .ct-ink { animation: ct-ink ${MOTION.ink}ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        @media (prefers-reduced-motion: reduce) { .ct-ink { animation: none; } }
      `}</style>

      <motion.div
        {...enter(play, 0, reduce, 16)}
        className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[var(--ct-window)] text-[var(--ct-ink)] @xl:rounded-[22px] @xl:border @xl:border-[var(--ct-line)] @xl:shadow-[var(--ct-shadow)]"
      >
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[var(--ct-line)] px-4 @xl:px-6">
          <div className="min-w-0">
            <motion.h2 {...enter(play, MOTION.step, reduce, 6)} className="truncate font-display text-[16px] font-semibold tracking-[-0.02em] @xl:text-[17px]">
              {thread.length ? title : "New thread"}
            </motion.h2>
            <motion.p {...enter(play, MOTION.step * 2, reduce, 6)} className="truncate font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--ct-faint)]">
              {thread.length ? subtitle : `${assistantName} · Just now`}
            </motion.p>
          </div>
          <motion.button {...enter(play, MOTION.step * 3, reduce, 6)} type="button" aria-label="New thread" onClick={newThread} className={iconButton}>
            <SquarePen className="size-[18px]" aria-hidden="true" />
          </motion.button>
        </header>

        <div ref={scroller} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div role="log" aria-label={`Conversation with ${assistantName}`} className="mx-auto max-w-[720px] space-y-9 px-4 pb-10 pt-8 @xl:px-8 @xl:pt-10">
            {thread.length === 0 ? <EmptyThread name={assistantName} reduce={reduce} /> : null}
            {thread.map((m, i) =>
              m.role === "user" ? (
                <UserMessage key={m.id} message={m} play={play} delay={messageDelay(i)} sent={!!m.local} reduce={reduce} />
              ) : (
                <AssistantMessage
                  key={m.id}
                  message={m}
                  name={assistantName}
                  reduce={reduce}
                  play={play}
                  delay={m.local ? MOTION.step * 2 : messageDelay(i)}
                  streaming={m.id === streamingId}
                  onDone={() => finish(m.id)}
                />
              ),
            )}
          </div>
        </div>

        <Composer
          name={assistantName}
          model={model}
          placeholder={placeholder ?? `Reply to ${assistantName}…`}
          streaming={streaming}
          onSend={send}
          onStop={() => setStreamingId(null)}
          play={play}
          delay={composerAt}
          reduce={reduce}
        />
      </motion.div>
    </section>
  );
}

/**
 * The demo’s opening thread: one question and an answer that ends on a short paragraph,
 * its sources and Copy, so the whole thread fits in frame and the first view is composed.
 */
const DEMO_SEED: ChatMessage[] = [
  DEMO_MESSAGES[0],
  {
    id: "m2",
    role: "assistant",
    time: "10:42",
    blocks: [
      {
        type: "p",
        text: "Debounce the **value**, not the handler. Keep the raw text in state, restart a `setTimeout` on every change, and fetch from the settled copy after `250ms` of quiet. Our test page dropped from 31 requests per search to 3.",
      },
    ],
    sources: (DEMO_MESSAGES[3] as Extract<ChatMessage, { role: "assistant" }>).sources,
  },
];

/** The demo’s stand-in answer to the scripted question: a sentence, then a test that streams in as code. */
function demoReply(): ChatBlock[] {
  return [
    { type: "p", text: "Sure. Here it is." },
    {
      type: "code",
      lang: "ts",
      filename: "use-debounced-value.test.ts",
      code: `it("waits", async () => {
  const h = renderHook(useDebouncedValue, { initialProps: 0 });
  h.rerender(1);
  await waitFor(() => expect(h.result.current).toBe(1));
});`,
    },
  ];
}

export default function ChatThreadDemo(overrides: Partial<ChatThreadProps> = {}) {
  const theme = overrides.theme ?? "dark";
  return (
    <div className="flex min-h-dvh items-center justify-center sm:px-6 sm:py-8 lg:py-10" style={{ background: STAGE[theme] }}>
      <div className="h-dvh min-h-[620px] w-full max-w-[1040px] sm:h-[820px] sm:min-h-0">
        {/* The thread opens settled so the scripted send is the one reply that streams. */}
        <ChatThread messages={DEMO_SEED} subtitle="Frontend · 2 messages · Today" streamLast={false} reply={demoReply} {...overrides} />
      </div>
    </div>
  );
}
