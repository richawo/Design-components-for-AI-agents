"use client";

import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
  /** The assistant's display name. */
  assistantName?: string;
  /** Model label shown in the composer. */
  model?: string;
  /** Messages already in the thread. The last assistant message streams in on mount. */
  messages?: ChatMessage[];
  /** Whether the final assistant message streams in when the component mounts. */
  streamLast?: boolean;
  /** Composer placeholder. */
  placeholder?: string;
  /**
   * Builds the canned reply that streams back after the user sends. Replace it with
   * your own streaming call; the demo returns a polite, honest placeholder.
   */
  reply?: (text: string) => ChatBlock[];
  /** Called with the message text whenever the user sends. */
  onSend?: (text: string) => void;
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Demo content                                                         */
/* ------------------------------------------------------------------ */

const demoMessages: ChatMessage[] = [
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
  {
    id: "m3",
    role: "user",
    time: "10:44",
    text: "Show me the hook? We’re on TypeScript.",
  },
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
      items: [
        "A direct answer in the first sentence.",
        "The reasoning, kept short enough to read on a phone.",
        "One next step you could do in the next five minutes.",
      ],
    },
  ];
}

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
    if (m[1] !== undefined) out.push({ text: m[1], kind: "bold" });
    else out.push({ text: m[2], kind: "code" });
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

function Inline({ text, limit }: { text: string; limit: number }) {
  let left = limit;
  const nodes: ReactNode[] = [];
  parseInline(text).forEach((s, i) => {
    if (left <= 0) return;
    const t = s.text.slice(0, left);
    left -= t.length;
    if (s.kind === "bold") nodes.push(<strong key={i} className="font-semibold text-[#1d1a16]">{t}</strong>);
    else if (s.kind === "code")
      nodes.push(
        <code key={i} className="rounded-[5px] bg-[#1d1a16]/[0.06] px-[0.35em] py-[0.1em] font-mono text-[0.86em] text-[#1d1a16]">
          {t}
        </code>,
      );
    else nodes.push(<Fragment key={i}>{t}</Fragment>);
  });
  return <>{nodes}</>;
}

/* ------------------------------------------------------------------ */
/* A deliberately small highlighter for the code block                  */
/* ------------------------------------------------------------------ */

const KEYWORDS = new Set([
  "export", "function", "const", "let", "return", "import", "from", "if", "else", "await", "async", "new", "type", "interface", "for", "of", "in", "true", "false", "null", "undefined",
]);

function highlight(code: string): ReactNode[] {
  const re = /(\/\/.*$)|("[^"]*"|'[^']*'|`[^`]*`)|\b(\d+)\b|\b([A-Za-z_]\w*)\b/gm;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index));
    if (m[1]) out.push(<span key={k++} className="italic text-[#8f8778]">{m[1]}</span>);
    else if (m[2]) out.push(<span key={k++} className="text-[#b9d2a5]">{m[2]}</span>);
    else if (m[3]) out.push(<span key={k++} className="text-[#f2c38b]">{m[3]}</span>);
    else if (m[4] && KEYWORDS.has(m[4])) out.push(<span key={k++} className="text-[#f0a37f]">{m[4]}</span>);
    else if (m[4] && /^[A-Z]/.test(m[4])) out.push(<span key={k++} className="text-[#f2d9a6]">{m[4]}</span>);
    else out.push(m[0]);
    last = m.index + m[0].length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

/* ------------------------------------------------------------------ */
/* Pieces                                                               */
/* ------------------------------------------------------------------ */

function useCopy(timeout = 1600) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  const copy = useCallback(
    (text: string) => {
      void navigator.clipboard?.writeText(text).catch(() => undefined);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), timeout);
    },
    [timeout],
  );
  return { copied, copy };
}

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b4532a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f4ee]";

function CodeBlock({ block, limit, done }: { block: Extract<ChatBlock, { type: "code" }>; limit: number; done: boolean }) {
  const { copied, copy } = useCopy();
  const shown = block.code.slice(0, limit);
  return (
    <figure className="overflow-hidden rounded-[14px] bg-[#1d1a16] text-[#ebe5d8] ring-1 ring-black/5">
      <figcaption className="flex h-11 items-center justify-between gap-3 border-b border-white/[0.07] pl-4 pr-1.5">
        <span className="flex min-w-0 items-center gap-2.5 font-mono text-[11.5px]">
          <span className="rounded-[4px] bg-white/[0.08] px-1.5 py-0.5 uppercase tracking-[0.08em] text-[#f0a37f]">{block.lang}</span>
          {block.filename ? <span className="truncate text-white/55">{block.filename}</span> : null}
        </span>
        <button
          type="button"
          onClick={() => copy(block.code)}
          disabled={!done}
          aria-label={copied ? "Copied" : "Copy code"}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] px-2.5 font-mono text-[11.5px] text-white/65 transition-colors hover:bg-white/[0.07] hover:text-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0a37f]"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={copied ? "y" : "n"}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
              className="inline-flex items-center gap-1.5"
            >
              {copied ? <Check className="size-3.5 text-[#b9d2a5]" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
              {copied ? "Copied" : "Copy"}
            </motion.span>
          </AnimatePresence>
        </button>
      </figcaption>
      <pre className="overflow-x-auto px-4 py-4 font-mono text-[12.5px] leading-[1.75] sm:text-[13px]">
        <code>{highlight(shown)}</code>
      </pre>
    </figure>
  );
}

function Caret() {
  return (
    <motion.span
      aria-hidden="true"
      className="ml-[2px] inline-block h-[1.05em] w-[0.5em] translate-y-[0.18em] rounded-[2px] bg-[#b4532a]"
      animate={{ opacity: [1, 0.25, 1] }}
      transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function AssistantMark({ name }: { name: string }) {
  return (
    <span aria-hidden="true" className="relative flex size-7 shrink-0 items-center justify-center rounded-full bg-[#1d1a16] text-[#f7f4ee]">
      <span className="font-serif text-[17px] italic leading-none">{name.charAt(0)}</span>
      <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-[#f7f4ee] bg-[#b4532a]" />
    </span>
  );
}

function AssistantMessage({
  message,
  name,
  streaming,
  onDone,
  reduce,
}: {
  message: Extract<ChatMessage, { role: "assistant" }>;
  name: string;
  streaming: boolean;
  onDone: () => void;
  reduce: boolean;
}) {
  const total = message.blocks.reduce((n, b) => n + blockLength(b), 0);
  const [budget, setBudget] = useState(streaming && !reduce ? 0 : total);
  // Finished when every character is out, or when the stream was stopped early.
  const done = budget >= total || !streaming;
  const stopped = !streaming && budget < total;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const { copied, copy } = useCopy();

  useEffect(() => {
    if (reduce) {
      setBudget(total);
      doneRef.current();
      return;
    }
    if (!streaming) return;
    let n = 0;
    let t: ReturnType<typeof setTimeout>;
    const step = () => {
      // Chunked, uneven pacing reads like a model thinking, not a typewriter.
      const burst = Math.random() < 0.12 ? 10 + Math.floor(Math.random() * 12) : 2 + Math.floor(Math.random() * 5);
      n = Math.min(total, n + burst);
      setBudget(n);
      if (n >= total) {
        doneRef.current();
        return;
      }
      const pause = Math.random() < 0.06 ? 160 + Math.random() * 180 : 18 + Math.random() * 34;
      t = setTimeout(step, pause);
    };
    t = setTimeout(step, 420);
    return () => clearTimeout(t);
  }, [streaming, reduce, total]);

  let left = budget;
  const plain = message.blocks
    .map((b) => (b.type === "p" ? b.text : b.type === "list" ? b.items.map((i) => `• ${i}`).join("\n") : b.code))
    .join("\n\n")
    .replace(/\*\*|`/g, "");

  return (
    <article aria-label={`${name} said`} aria-busy={!done} className="group/msg">
      <header className="mb-3 flex items-center gap-2.5">
        <AssistantMark name={name} />
        <span className="text-[14px] font-semibold tracking-[-0.01em]">{name}</span>
        {message.time ? <time className="font-mono text-[11px] tabular-nums text-[#1d1a16]/45">{message.time}</time> : null}
        {!done ? <span className="font-mono text-[11px] text-[#b4532a]">writing…</span> : null}
        {stopped ? <span className="font-mono text-[11px] text-[#1d1a16]/45">stopped</span> : null}
      </header>

      <div className="space-y-4 text-[15.5px] leading-[1.7] text-[#1d1a16]/[0.86] sm:pl-[38px] sm:text-[16px]">
        {message.blocks.map((b, i) => {
          if (left <= 0) return null;
          const len = blockLength(b);
          const lim = Math.min(left, len);
          left -= lim;
          const isLive = !done && left <= 0;
          if (b.type === "p")
            return (
              <p key={i} className="max-w-[64ch] text-pretty">
                <Inline text={b.text} limit={lim} />
                {isLive ? <Caret /> : null}
              </p>
            );
          if (b.type === "list") {
            let l = lim;
            const Tag = b.ordered ? "ol" : "ul";
            return (
              <Tag key={i} className="max-w-[62ch] space-y-2">
                {b.items.map((it, j) => {
                  if (l <= 0) return null;
                  const n = Math.min(l, visibleLength(it));
                  l -= n;
                  return (
                    <li key={j} className="relative pl-6">
                      <span aria-hidden="true" className="absolute left-1 top-[0.72em] h-[2px] w-2.5 rounded-full bg-[#b4532a]" />
                      <Inline text={it} limit={n} />
                      {isLive && l <= 0 ? <Caret /> : null}
                    </li>
                  );
                })}
              </Tag>
            );
          }
          return <CodeBlock key={i} block={b} limit={lim} done={done} />;
        })}
        {budget === 0 && !done ? (
          <p className="flex h-[1.7em] items-center gap-1" aria-label={`${name} is thinking`}>
            {[0, 1, 2].map((d) => (
              <motion.span
                key={d}
                className="size-1.5 rounded-full bg-[#1d1a16]/40"
                animate={{ opacity: [0.25, 1, 0.25] }}
                transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }}
              />
            ))}
          </p>
        ) : null}

        <AnimatePresence>
          {done && message.sources?.length ? (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
              className="pt-1"
            >
              <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#1d1a16]/50">Sources</p>
              <ol className="flex flex-wrap gap-2">
                {message.sources.map((s, i) => (
                  <li key={s.href + i} className="min-w-0 max-w-full">
                    <a
                      href={s.href}
                      className={`group/src flex min-h-11 max-w-full items-center gap-2.5 rounded-[10px] border border-[#1d1a16]/10 bg-[#fffdf9] py-1.5 pl-1.5 pr-3 transition-colors hover:border-[#1d1a16]/25 ${focusRing}`}
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-[6px] bg-[#1d1a16]/[0.06] font-mono text-[11px] tabular-nums text-[#1d1a16]/70">{i + 1}</span>
                      <span className="min-w-0 leading-tight">
                        <span className="block truncate text-[13px] font-medium text-[#1d1a16] group-hover/src:underline group-hover/src:decoration-[#b4532a] group-hover/src:underline-offset-2">{s.title}</span>
                        <span className="block truncate font-mono text-[10.5px] text-[#1d1a16]/50">{s.domain}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {done ? (
          <div className="-ml-2 flex items-center gap-0.5 text-[#1d1a16]/50">
            <button
              type="button"
              onClick={() => copy(plain)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-[8px] px-2 font-mono text-[11px] transition-colors hover:bg-[#1d1a16]/[0.05] hover:text-[#1d1a16] ${focusRing}`}
            >
              {copied ? <Check className="size-3.5 text-[#4d7a3a]" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function UserMessage({ message, reduce }: { message: Extract<ChatMessage, { role: "user" }>; reduce: boolean }) {
  return (
    <motion.article
      aria-label="You said"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      className="flex flex-col items-end"
    >
      <p className="max-w-[min(82%,30rem)] whitespace-pre-wrap break-words rounded-[18px] rounded-br-[6px] bg-[#1d1a16] px-4 py-2.5 text-[15px] leading-[1.55] text-[#f7f4ee]">
        {message.text}
      </p>
      {message.time ? <time className="mr-1 mt-1.5 font-mono text-[10.5px] tabular-nums text-[#1d1a16]/40">{message.time}</time> : null}
    </motion.article>
  );
}

/* ------------------------------------------------------------------ */
/* Thread                                                               */
/* ------------------------------------------------------------------ */

const now = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export function ChatThread({
  title = "Search box fires on every keystroke",
  subtitle = "Frontend · 4 messages · Today",
  assistantName = "Wren",
  model = "Wren 2 · Balanced",
  messages = demoMessages,
  streamLast = true,
  placeholder = "Reply to Wren…",
  reply = defaultReply,
  onSend,
  className = "",
}: ChatThreadProps) {
  const reduce = !!useReducedMotion();
  const [thread, setThread] = useState<ChatMessage[]>(messages);
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const [streamingId, setStreamingId] = useState<string | null>(streamLast && lastAssistant ? lastAssistant.id : null);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pinned = useRef(true);
  const inputId = useId();
  const counter = useRef(0);

  const streaming = streamingId !== null;
  const canSend = draft.trim().length > 0 && !streaming;

  // Auto-grow the textarea up to ~8 lines.
  useLayoutEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 208)}px`;
  }, [draft]);

  // Follow the conversation while the reader is at the bottom.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (pinned.current) el.scrollTo({ top: el.scrollHeight });
    });
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  const send = () => {
    const text = draft.trim();
    if (!text || streaming) return;
    counter.current += 1;
    const id = `local-${counter.current}`;
    const withFiles = files.length ? `${text}\n\nAttached: ${files.join(", ")}` : text;
    setThread((t) => [
      ...t,
      { id: `${id}-u`, role: "user", text: withFiles, time: now() },
      { id: `${id}-a`, role: "assistant", blocks: reply(text), time: now() },
    ]);
    setStreamingId(`${id}-a`);
    setDraft("");
    setFiles([]);
    pinned.current = true;
    onSend?.(text);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  return (
    <section className={`bg-[#e9e3d8] text-[#1d1a16] sm:flex sm:min-h-[100dvh] sm:items-center sm:px-6 sm:py-8 lg:py-10 ${className}`}>
      <div className="mx-auto flex h-[100dvh] min-h-[620px] w-full max-w-[1040px] flex-col overflow-hidden bg-[#f7f4ee] sm:h-[820px] sm:rounded-[22px] sm:shadow-[0_1px_0_rgba(29,26,22,0.04),0_30px_60px_-30px_rgba(29,26,22,0.35)] sm:ring-1 sm:ring-[#1d1a16]/[0.08]">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[#1d1a16]/[0.08] px-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate font-display text-[16px] font-semibold tracking-[-0.02em] sm:text-[17px]">{title}</h2>
            <p className="truncate font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#1d1a16]/50">{subtitle}</p>
          </div>
          <button
            type="button"
            aria-label="New thread"
            className={`flex size-11 shrink-0 items-center justify-center rounded-full text-[#1d1a16]/60 transition-colors hover:bg-[#1d1a16]/[0.06] hover:text-[#1d1a16] ${focusRing}`}
          >
            <SquarePen className="size-[18px]" aria-hidden="true" />
          </button>
        </header>

        {/* Messages */}
        <div ref={scroller} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div role="log" aria-label={`Conversation with ${assistantName}`} className="mx-auto max-w-[720px] space-y-9 px-4 pb-10 pt-8 sm:px-8 sm:pt-10">
            {thread.map((m) =>
              m.role === "user" ? (
                <UserMessage key={m.id} message={m} reduce={reduce} />
              ) : (
                <AssistantMessage
                  key={m.id}
                  message={m}
                  name={assistantName}
                  reduce={reduce}
                  streaming={m.id === streamingId}
                  onDone={() => setStreamingId((s) => (s === m.id ? null : s))}
                />
              ),
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="relative shrink-0 px-3 pb-3 sm:px-8 sm:pb-6">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-[#f7f4ee] to-transparent" />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="mx-auto max-w-[720px] rounded-[20px] border border-[#1d1a16]/[0.12] bg-[#fffdf9] shadow-[0_1px_2px_rgba(29,26,22,0.05),0_12px_28px_-18px_rgba(29,26,22,0.3)] transition-[border-color,box-shadow] focus-within:border-[#1d1a16]/30 focus-within:shadow-[0_1px_2px_rgba(29,26,22,0.05),0_16px_32px_-18px_rgba(29,26,22,0.4)]"
          >
            <AnimatePresence initial={false}>
              {files.length ? (
                <motion.ul
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex flex-wrap gap-1.5 overflow-hidden px-3 pt-3"
                >
                  {files.map((f) => (
                    <li key={f} className="flex h-8 max-w-full items-center gap-1.5 rounded-[8px] bg-[#1d1a16]/[0.05] pl-2.5 pr-1 text-[12.5px]">
                      <Paperclip className="size-3.5 shrink-0 text-[#1d1a16]/50" aria-hidden="true" />
                      <span className="truncate">{f}</span>
                      <button
                        type="button"
                        aria-label={`Remove ${f}`}
                        onClick={() => setFiles((fs) => fs.filter((x) => x !== f))}
                        className={`flex size-6 shrink-0 items-center justify-center rounded-[6px] text-[#1d1a16]/50 hover:bg-[#1d1a16]/[0.08] hover:text-[#1d1a16] ${focusRing}`}
                      >
                        <X className="size-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </motion.ul>
              ) : null}
            </AnimatePresence>
            <label htmlFor={inputId} className="sr-only">
              Message {assistantName}
            </label>
            <textarea
              id={inputId}
              ref={textarea}
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              className="block max-h-52 min-h-[52px] w-full resize-none bg-transparent px-4 pb-1 pt-[15px] text-[16px] leading-[1.5] text-[#1d1a16] placeholder:text-[#1d1a16]/40 focus:outline-none"
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
                <button
                  type="button"
                  aria-label="Attach a file"
                  onClick={() => fileInput.current?.click()}
                  className={`flex size-11 shrink-0 items-center justify-center rounded-full text-[#1d1a16]/55 transition-colors hover:bg-[#1d1a16]/[0.06] hover:text-[#1d1a16] sm:size-9 ${focusRing}`}
                >
                  <Paperclip className="size-[18px]" aria-hidden="true" />
                </button>
                <span className="flex min-w-0 items-center gap-1.5 truncate rounded-full px-2 font-mono text-[11px] text-[#1d1a16]/55">
                  <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[#b4532a]" />
                  <span className="truncate">{model}</span>
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="hidden font-mono text-[10.5px] text-[#1d1a16]/40 md:inline">
                  <kbd className="font-mono">↵</kbd> send · <kbd className="font-mono">⇧↵</kbd> new line
                </span>
                {streaming ? (
                  <button
                    type="button"
                    aria-label="Stop generating"
                    onClick={() => setStreamingId(null)}
                    className={`flex size-11 items-center justify-center rounded-full bg-[#1d1a16] text-[#f7f4ee] transition-transform active:scale-95 sm:size-9 ${focusRing}`}
                  >
                    <Square className="size-3.5 fill-current" aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    aria-label="Send message"
                    disabled={!canSend}
                    className={`flex size-11 items-center justify-center rounded-full bg-[#1d1a16] text-[#f7f4ee] transition-[transform,opacity,background-color] hover:bg-[#b4532a] active:scale-95 disabled:cursor-not-allowed disabled:bg-[#1d1a16]/15 disabled:text-[#1d1a16]/40 disabled:hover:bg-[#1d1a16]/15 sm:size-9 ${focusRing}`}
                  >
                    <ArrowUp className="size-[18px]" strokeWidth={2.2} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </form>
          <p className="mx-auto mt-2 hidden max-w-[720px] text-center font-mono text-[10.5px] text-[#1d1a16]/40 sm:block">
            {assistantName} can be confidently wrong. Check anything that matters.
          </p>
        </div>
      </div>
    </section>
  );
}

export default ChatThread;
