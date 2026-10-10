"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type AiComposerState = "idle" | "generating";

export type ComposerFile = {
  /** Stable key. */
  id: string;
  /** The name written into the prompt after @, so it must not contain spaces. */
  name: string;
  /** Quiet line under the name, such as when it changed. */
  detail: string;
};

export type ComposerCommand = {
  /** Written after /, lowercase, no spaces. */
  name: string;
  description: string;
};

export type AiComposerMinimalProps = {
  /** Shown while the field is empty. */
  placeholder?: string;
  /** Text the field starts with. Read on mount only, so a change needs a remount. */
  defaultValue?: string;
  /** Controlled state. Leave undefined and the composer owns it. */
  state?: AiComposerState;
  /** Fires when the composer wants to change state: on send, and on stop. */
  onStateChange?: (next: AiComposerState) => void;
  /** Receives the trimmed message. Return a promise to keep the composer generating until it settles. */
  onSubmit?: (message: string) => void | Promise<unknown>;
  /** Fires when Stop is pressed while generating. */
  onStop?: () => void;
  /** Uncontrolled only: how long a send keeps generating when onSubmit returns nothing. */
  replyMs?: number;
  /** Files offered by the @ popover. */
  files?: ComposerFile[];
  /** Commands offered by the / popover. */
  commandList?: ComposerCommand[];
  /** Whether typing @ opens the file popover. */
  mentions?: boolean;
  /** Whether a / at the start of a line opens the command popover. */
  commands?: boolean;
  /** Rows the field may grow to before it scrolls (1 to 10). */
  maxRows?: number;
  /** The one accent: mention text and nothing else. Defaults per theme. */
  accent?: string;
  theme?: "dark" | "light";
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Content and tokens                                                   */
/* ------------------------------------------------------------------ */

const DEFAULT_FILES: ComposerFile[] = [
  { id: "q3-launch-roadmap", name: "q3-launch-roadmap.md", detail: "Edited today" },
  { id: "customer-interviews", name: "customer-interview-synthesis.md", detail: "Edited Monday" },
  { id: "launch-brief", name: "launch-brief.md", detail: "3 comments" },
  { id: "pricing-tests", name: "pricing-tests.md", detail: "Last week" },
];

const DEFAULT_COMMANDS: ComposerCommand[] = [
  { name: "summarise", description: "Shorten a document or thread" },
  { name: "translate", description: "Into another language" },
  { name: "outline", description: "Headings and the main claim" },
  { name: "rewrite", description: "Same meaning, plainer words" },
];

const PALETTE = {
  dark: {
    field: "#141416",
    panel: "#1b1b1e",
    line: "rgba(255,255,255,0.08)",
    lineStrong: "rgba(255,255,255,0.2)",
    ink: "#f4f4f5",
    body: "#c4c4ca",
    muted: "#a1a1aa",
    faint: "#8a8a94",
    chip: "rgba(255,255,255,0.06)",
    send: "#f4f4f5",
    sendHover: "#ffffff",
    onSend: "#0b0b0c",
    accent: "#f2b36b",
    shadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 1px 2px rgba(0,0,0,0.5), 0 28px 56px -28px rgba(0,0,0,0.9)",
    panelShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 1px 2px rgba(0,0,0,0.5), 0 32px 64px -20px rgba(0,0,0,0.92)",
  },
  light: {
    field: "#ffffff",
    panel: "#ffffff",
    line: "rgba(17,17,19,0.1)",
    lineStrong: "rgba(17,17,19,0.22)",
    ink: "#18181b",
    body: "#3f3f46",
    muted: "#52525b",
    faint: "#6b6b75",
    chip: "rgba(17,17,19,0.05)",
    send: "#18181b",
    sendHover: "#2a2a2e",
    onSend: "#ffffff",
    accent: "#a84f24",
    shadow: "0 1px 2px rgba(17,17,19,0.06), 0 18px 40px -24px rgba(17,17,19,0.28)",
    panelShadow: "0 1px 2px rgba(17,17,19,0.06), 0 24px 56px -20px rgba(17,17,19,0.3)",
  },
} as const;

/** Line box and vertical padding of the field. One row is LINE_PX + 2 × PAD_Y, so the send button sits on the last line. */
const LINE_PX = 22;
const PAD_Y = 7;
/** The field glides to its new height as a line is added or sent, so growth never snaps. */
const FIELD_GROW = "height 180ms cubic-bezier(0.22, 1, 0.36, 1)";
/** The footer is a fixed-height row, so swapping its hints can never move the composer. */
const FOOTER_PX = 20;
const MAX_ROWS = 10;
const POP_WIDTH = 288;
const POP_MIN_WIDTH = 200;
/** Gap between the menu and the top edge of the composer it opens above. */
const POP_GAP = 8;
/** Touch target: the 36px send button gets a 4px hit area on every side, so it is 44px. */
const SEND_HIT_INSET = "before:absolute before:-inset-1 before:content-['']";
const DEFAULT_REPLY_MS = 1800;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;
/** First-view reveal: a 10px rise and a blur that clears. Reduced motion keeps only the fade. */
const REVEAL_FROM = { opacity: 0, y: 10, filter: "blur(6px)" } as const;
const REVEAL_TO = { opacity: 1, y: 0, filter: "blur(0px)" } as const;
const REVEAL_FROM_REDUCED = { opacity: 0 } as const;
const REVEAL_TO_REDUCED = { opacity: 1 } as const;

/* ------------------------------------------------------------------ */
/* Trigger detection and rendering                                      */
/* ------------------------------------------------------------------ */

type Trigger = { kind: "mention" | "command"; start: number; query: string };

/**
 * The @ or / token the caret is inside, if any. A mention starts after whitespace; a
 * command only at the start of a line, so a path such as src/app never opens the menu.
 */
function findTrigger(text: string, caret: number): Trigger | null {
  const before = text.slice(0, caret);
  const match = /(^|\s)([@/])([^\s@/]*)$/.exec(before);
  if (!match) return null;
  const sigil = match[2];
  const start = before.length - match[3].length - 1;
  if (sigil === "/" && start !== 0 && before[start - 1] !== "\n") return null;
  return { kind: sigil === "@" ? "mention" : "command", start, query: match[3] };
}

type Option = { id: string; label: string; detail: string; insert: string };

/**
 * Mentions that exist are set in the accent, so the prompt reads as a list of references.
 * A name ends before trailing punctuation, so "@launch-brief.md," still matches the file.
 */
function renderText(text: string, known: ReadonlySet<string>, keyPrefix: string): ReactNode[] {
  return text.split(/(@[^\s@]+?)(?=[.,;:!?)]*(?:\s|$))/).map((part, i) => {
    const key = `${keyPrefix}${i}`;
    if (part.startsWith("@") && known.has(part.slice(1))) {
      // Background only, never padding or weight: the mirror must lay out exactly like the textarea above it.
      return (
        <span key={key} className="rounded-[4px]" style={{ color: "var(--cc-accent)", background: "color-mix(in srgb, var(--cc-accent) 16%, transparent)" }}>
          {part}
        </span>
      );
    }
    return <span key={key}>{part}</span>;
  });
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function AiComposerMinimal({
  placeholder = "Ask anything…",
  defaultValue = "",
  state: stateProp,
  onStateChange,
  onSubmit,
  onStop,
  replyMs = DEFAULT_REPLY_MS,
  files = DEFAULT_FILES,
  commandList = DEFAULT_COMMANDS,
  mentions = true,
  commands = true,
  maxRows = 6,
  accent,
  theme = "dark",
  className = "",
}: AiComposerMinimalProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId();
  const palette = PALETTE[theme];
  const rows = Math.min(MAX_ROWS, Math.max(1, Math.round(maxRows)));
  const fieldMaxHeight = rows * LINE_PX + PAD_Y * 2;
  const known = useMemo(() => new Set(files.map((f) => f.name)), [files]);

  const vars = {
    "--cc-field": palette.field,
    "--cc-panel": palette.panel,
    "--cc-line": palette.line,
    "--cc-line-strong": palette.lineStrong,
    "--cc-ink": palette.ink,
    "--cc-body": palette.body,
    "--cc-muted": palette.muted,
    "--cc-faint": palette.faint,
    "--cc-chip": palette.chip,
    "--cc-send": palette.send,
    "--cc-send-hover": palette.sendHover,
    "--cc-on-send": palette.onSend,
    "--cc-accent": accent ?? palette.accent,
    "--cc-shadow": palette.shadow,
    "--cc-panel-shadow": palette.panelShadow,
  } as CSSProperties;

  /* State: controlled when the host passes `state`, otherwise the composer simulates the reply. */
  const controlled = stateProp !== undefined;
  const [ownState, setOwnState] = useState<AiComposerState>("idle");
  const busy = (controlled ? stateProp : ownState) === "generating";

  const [value, setValue] = useState(defaultValue);
  const [caret, setCaret] = useState(defaultValue.length);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState<string | null>(null);
  /** Field height in px. Undefined before the first measure, so the first frame has nothing to animate from. */
  const [fieldHeight, setFieldHeight] = useState<number | undefined>(undefined);
  /** Caret x, and the field's left edge and width, all measured from inside the frame. */
  const [anchor, setAnchor] = useState({ x: 0, fieldLeft: 0, width: 0 });

  const frameRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const runId = useRef(0);
  const replyTimer = useRef<number | undefined>(undefined);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.clearTimeout(replyTimer.current);
    };
  }, []);

  // After an insertion, the caret goes to the end of the inserted text.
  useLayoutEffect(() => {
    const at = pendingCaret.current;
    if (at === null) return;
    pendingCaret.current = null;
    textareaRef.current?.setSelectionRange(at, at);
    setCaret(at);
  }, [value]);

  // Measured from the screen, not offsetTop: the mirror and field sit in different positioning
  // contexts. The menu hangs off the frame, so only horizontal positions are measured here. Height
  // never feeds the menu, which lets the field animate its height without the menu chasing it.
  // Equal values bail out, so this cannot loop.
  useLayoutEffect(() => {
    const el = caretRef.current;
    const field = fieldRef.current;
    const frame = frameRef.current;
    if (!el || !field || !frame) return;
    // clientLeft is the frame's left border; absolutely positioned children measure from inside it.
    const origin = frame.getBoundingClientRect().left + frame.clientLeft;
    const caretBox = el.getBoundingClientRect();
    const fieldBox = field.getBoundingClientRect();
    const next = { x: caretBox.left - origin, fieldLeft: fieldBox.left - origin, width: fieldBox.width };
    setAnchor((prev) => (prev.x === next.x && prev.fieldLeft === next.fieldLeft && prev.width === next.width ? prev : next));
  });

  // The field is as tall as its mirror (already capped at maxRows), so the mirror is the target height.
  useLayoutEffect(() => {
    const mirror = mirrorRef.current;
    if (!mirror) return;
    const height = mirror.offsetHeight;
    setFieldHeight((prev) => (prev === height ? prev : height));
  });

  const trigger = findTrigger(value, caret);
  const triggerKey = trigger ? `${trigger.kind}:${trigger.start}` : "";
  const enabled = trigger !== null && (trigger.kind === "command" ? commands : mentions);
  const open = enabled && dismissed !== triggerKey;

  const query = trigger?.query.toLowerCase() ?? "";
  const options: Option[] = !trigger || !enabled
    ? []
    : trigger.kind === "mention"
      ? files
          .filter((f) => f.name.toLowerCase().includes(query))
          .map((f) => ({ id: f.id, label: f.name, detail: f.detail, insert: `@${f.name} ` }))
      : commandList
          .filter((c) => c.name.includes(query))
          .map((c) => ({ id: c.name, label: `/${c.name}`, detail: c.description, insert: `/${c.name} ` }));
  const index = Math.min(active, Math.max(0, options.length - 1));
  const optionId = (i: number) => `${uid}-option-${i}`;
  const hintId = `${uid}-hint`;
  const popWidth = Math.min(POP_WIDTH, Math.max(POP_MIN_WIDTH, anchor.width));
  // Follows the caret, clamped so the menu stays inside the field's own span.
  const popLeft = Math.min(Math.max(anchor.fieldLeft, anchor.x - 12), anchor.fieldLeft + Math.max(0, anchor.width - popWidth));
  const sendReady = busy || value.trim().length > 0;

  const pick = (option: Option) => {
    if (!trigger) return;
    pendingCaret.current = trigger.start + option.insert.length;
    setValue(value.slice(0, trigger.start) + option.insert + value.slice(caret));
    setActive(0);
  };

  const stop = () => {
    runId.current += 1;
    window.clearTimeout(replyTimer.current);
    onStop?.();
    onStateChange?.("idle");
    if (!controlled) setOwnState("idle");
  };

  const submit = () => {
    const message = value.trim();
    if (!message || busy) return;
    const id = ++runId.current;
    setValue("");
    setCaret(0);
    setDismissed(null);
    onStateChange?.("generating");
    if (controlled) {
      onSubmit?.(message);
      return;
    }
    setOwnState("generating");
    const settle = () => {
      if (runId.current === id && mounted.current) setOwnState("idle");
    };
    const result = onSubmit?.(message);
    if (result && typeof (result as PromiseLike<unknown>).then === "function") {
      (result as Promise<unknown>).then(settle, settle);
    } else {
      replyTimer.current = window.setTimeout(settle, replyMs);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (open && options.length > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((index + step + options.length) % options.length);
        return;
      }
      // Enter picks while the menu is open; Shift+Enter still breaks the line.
      if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
        event.preventDefault();
        const choice = options[index];
        if (choice) pick(choice);
        return;
      }
    }
    if (open && event.key === "Escape") {
      event.preventDefault();
      setDismissed(triggerKey);
      return;
    }
    if (busy && event.key === "Escape") {
      event.preventDefault();
      stop();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const hintLine = busy ? "Generating · esc to stop" : null;

  // Send is never a grey slab: idle and empty it sits on the chip fill with a faint arrow, and it turns
  // solid ink once there is text. aria-disabled (not disabled) keeps its size and its focusability;
  // submit() already ignores an empty send.
  const sendTone = busy
    ? "cursor-pointer text-[color:var(--cc-ink)] hover:bg-[color:var(--cc-chip)] active:scale-[0.97]"
    : sendReady
      ? "cursor-pointer bg-[color:var(--cc-send)] text-[color:var(--cc-on-send)] hover:bg-[color:var(--cc-send-hover)] active:scale-[0.97]"
      : "cursor-not-allowed bg-[color:var(--cc-chip)] text-[color:var(--cc-faint)]";

  // One polite region carries both states. An open menu says how many rows it holds and which is
  // highlighted, so arrowing announces each row; the menu wins over "generating" when both apply.
  const noun = trigger?.kind === "mention" ? "file" : "command";
  const announcement = !open || !trigger
    ? busy ? "Generating a reply" : ""
    : options.length === 0
      ? `No matching ${noun}s`
      : `${options.length} ${noun}${options.length === 1 ? "" : "s"}. ${options[index].label}, ${index + 1} of ${options.length}`;

  return (
    <div className={`@container relative w-full max-w-[600px] ${className}`} style={vars}>
      <motion.div
        ref={frameRef}
        initial={reduce ? REVEAL_FROM_REDUCED : REVEAL_FROM}
        animate={reduce ? REVEAL_TO_REDUCED : REVEAL_TO}
        transition={{ duration: reduce ? 0.15 : 0.5, ease: EASE_OUT }}
        className="relative rounded-[16px] border transition-[border-color] duration-200 ease-out focus-within:border-[color:var(--cc-line-strong)] has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-offset-2"
        style={{
          background: "var(--cc-field)",
          borderColor: "var(--cc-line)",
          boxShadow: "var(--cc-shadow)",
          outlineColor: "var(--cc-line-strong)",
        }}
        onMouseDown={(event) => {
          // A press on the frame (not the field or a button) keeps focus in the prompt.
          const target = event.target as HTMLElement;
          if (target.closest("button") || target.closest("textarea")) return;
          event.preventDefault();
          textareaRef.current?.focus();
        }}
      >
        <div className="flex items-end gap-2.5 py-2.5 pl-4 pr-2.5">
          <div ref={fieldRef} className="min-w-0 flex-1">
            {/* The wrapper glides to the mirror's height and clips it, so a new line or a send's reset animates. */}
            <div className="relative overflow-hidden" style={{ height: fieldHeight, transition: reduce ? undefined : FIELD_GROW }}>
              {/* The mirror lays out the text, the caret and the mention marks. It is in flow, so it sets the height. */}
              <div
                ref={mirrorRef}
                aria-hidden="true"
                className="pointer-events-none overflow-hidden break-words whitespace-pre-wrap py-[7px] font-sans text-[15px] leading-[22px] tracking-[-0.005em]"
                style={{ color: "var(--cc-ink)", maxHeight: fieldMaxHeight }}
              >
                {renderText(value.slice(0, caret), known, "p")}
                <span ref={caretRef} className="inline-block h-[22px] w-0 align-top" />
                {renderText(value.slice(caret), known, "s")}
                {"​"}
              </div>

              <textarea
                ref={textareaRef}
                data-demo="field"
                rows={1}
                value={value}
                placeholder={placeholder}
                aria-label="Message"
                aria-autocomplete="list"
                aria-controls={open ? `${uid}-list` : undefined}
                aria-activedescendant={open && options.length > 0 ? optionId(index) : undefined}
                aria-describedby={open ? hintId : undefined}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                  setValue(event.target.value);
                  setCaret(event.target.selectionStart);
                  setActive(0);
                }}
                onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
                onScroll={(event) => {
                  if (mirrorRef.current) mirrorRef.current.scrollTop = event.currentTarget.scrollTop;
                }}
                onKeyDown={onKeyDown}
                className="absolute inset-0 w-full resize-none overflow-y-auto bg-transparent py-[7px] font-sans text-[15px] leading-[22px] tracking-[-0.005em] break-words outline-none [scrollbar-width:none] placeholder:text-[color:var(--cc-faint)] [&::-webkit-scrollbar]:hidden"
                style={{ color: "transparent", caretColor: "var(--cc-ink)" }}
              />
            </div>
          </div>

          {/* Hover is one step: a 4% lift on the fill (pointer devices only, via Tailwind's hover gate). */}
          <button
            type="button"
            data-demo="send"
            aria-label={busy ? "Stop generating" : "Send message"}
            aria-disabled={!sendReady || undefined}
            onClick={busy ? stop : submit}
            className={`group relative grid size-9 shrink-0 place-items-center rounded-[11px] transition-[background-color,box-shadow,color,transform] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 ${SEND_HIT_INSET} ${sendTone}`}
            style={{ outlineColor: "var(--cc-ink)", boxShadow: busy ? "inset 0 0 0 1px var(--cc-line-strong)" : undefined }}
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={busy ? "stop" : "send"}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? { opacity: 0, transition: { duration: 0.08 } } : { opacity: 0, scale: 0.7, transition: { duration: 0.12, ease: EASE_IN } }}
                transition={{ duration: reduce ? 0.12 : 0.2, ease: EASE_OUT }}
                className="grid place-items-center"
              >
                {busy ? (
                  <StopIcon />
                ) : (
                  // The arrow lifts 1px on hover while it is live; the nudge is nested so motion's own transform on the icon span is untouched.
                  <span className={`grid place-items-center transition-transform duration-150 ease-out ${sendReady ? "group-hover:-translate-y-px" : ""}`}>
                    <ArrowUpIcon />
                  </span>
                )}
              </motion.span>
            </AnimatePresence>
            {busy && (
              // One ambient signal while a reply is in flight. Static under reduced motion.
              <motion.svg
                aria-hidden="true"
                viewBox="0 0 46 46"
                className="pointer-events-none absolute -inset-[5px] size-[46px]"
                animate={reduce ? undefined : { rotate: 360 }}
                transition={{ duration: 2.4, ease: "linear", repeat: Infinity }}
              >
                <circle cx="23" cy="23" r="21.5" fill="none" stroke="var(--cc-ink)" strokeWidth="1.25" strokeLinecap="round" strokeDasharray="34 100" />
              </motion.svg>
            )}
          </button>
        </div>

        {/* The menu hangs off the frame, not the field, so it opens above the whole composer whatever its height. */}
        <AnimatePresence>
          {open && trigger && (
            <motion.div
              key={trigger.kind}
              id={`${uid}-list`}
              role="listbox"
              aria-label={trigger.kind === "mention" ? "Files" : "Commands"}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_IN } }}
              transition={{ duration: reduce ? 0.12 : 0.24, ease: EASE_OUT }}
              className="absolute z-20 max-h-[264px] origin-bottom overflow-y-auto rounded-[14px] border p-1.5"
              style={{
                left: popLeft,
                bottom: `calc(100% + ${POP_GAP}px)`,
                width: popWidth,
                background: "var(--cc-panel)",
                borderColor: "var(--cc-line)",
                boxShadow: "var(--cc-panel-shadow)",
              }}
            >
              <div className="px-2 pt-1 pb-1.5 font-mono text-[10.5px] tracking-[0.14em] uppercase" style={{ color: "var(--cc-faint)" }}>
                {trigger.kind === "mention" ? "Files" : "Commands"}
              </div>
              {options.length === 0 && (
                <div className="px-2 py-2 text-[13px]" style={{ color: "var(--cc-muted)" }}>
                  {trigger.kind === "mention" ? "No matching files" : "No matching commands"}
                </div>
              )}
              {options.map((option, i) => {
                const on = i === index;
                return (
                  <div
                    key={option.id}
                    id={optionId(i)}
                    role="option"
                    aria-selected={on}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(option)}
                    className="relative flex cursor-pointer items-center gap-2.5 rounded-[10px] px-2 py-[7px]"
                  >
                    {on && (
                      <motion.span
                        layoutId={`${uid}-highlight`}
                        transition={reduce ? { duration: 0 } : SPRING_UI}
                        className="absolute inset-0 rounded-[10px]"
                        style={{ background: "var(--cc-chip)" }}
                      />
                    )}
                    {trigger.kind === "mention" && (
                      <span
                        className="relative grid size-7 shrink-0 place-items-center rounded-[8px] border"
                        style={{ borderColor: "var(--cc-line)", color: "var(--cc-muted)" }}
                      >
                        <FileIcon />
                      </span>
                    )}
                    <span className="relative flex min-w-0 flex-col">
                      <span
                        className={`truncate text-[14px] leading-[20px] ${trigger.kind === "command" ? "font-mono text-[13px]" : ""}`}
                        style={{ color: on ? "var(--cc-ink)" : "var(--cc-body)" }}
                      >
                        {option.label}
                      </span>
                      <span className="truncate text-[11.5px] leading-[16px]" style={{ color: "var(--cc-faint)" }}>
                        {option.detail}
                      </span>
                    </span>
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* A fixed-height row: the idle and busy hints differ in height, and the composer must not move for either. */}
      <motion.div
        initial={reduce ? REVEAL_FROM_REDUCED : REVEAL_FROM}
        animate={reduce ? REVEAL_TO_REDUCED : REVEAL_TO}
        transition={{ duration: reduce ? 0.15 : 0.5, delay: reduce ? 0 : 0.06, ease: EASE_OUT }}
        className="mt-3 flex items-center justify-between gap-4 px-1 font-mono text-[11px] leading-none"
        style={{ color: "var(--cc-faint)", height: FOOTER_PX }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={busy ? "busy" : "idle"}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3, transition: { duration: 0.12, ease: EASE_IN } }}
            transition={{ duration: reduce ? 0.12 : 0.18, ease: EASE_OUT }}
            className="flex items-center gap-2 whitespace-nowrap"
          >
            {hintLine ?? (
              <>
                <Key>↵</Key> send <Key>⇧↵</Key> new line
              </>
            )}
          </motion.span>
        </AnimatePresence>
        <span className="hidden items-center gap-3 whitespace-nowrap @[420px]:flex">
          {mentions && (
            <span className="inline-flex items-center gap-1.5">
              <Key>@</Key> mention
            </span>
          )}
          {commands && (
            <span className="inline-flex items-center gap-1.5">
              <Key>/</Key> commands
            </span>
          )}
        </span>
      </motion.div>

      <span id={hintId} className="sr-only">
        Up and down to choose, Enter to insert, Escape to close
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                               */
/* ------------------------------------------------------------------ */

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd
      className="rounded-[5px] border px-1.5 py-[3px] font-mono text-[10.5px] leading-none"
      style={{ borderColor: "var(--cc-line)", background: "var(--cc-chip)", color: "var(--cc-muted)" }}
    >
      {children}
    </kbd>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 12.75V3.5M3.9 7.6 8 3.5l4.1 4.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="4.25" y="4.25" width="7.5" height="7.5" rx="2" fill="currentColor" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4.25 1.75h4.6l3.15 3.35v9.15H4.25zM8.75 1.9v3.5h3.5M6 8.5h4M6 11h4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                 */
/* ------------------------------------------------------------------ */

const STAGE = "#0a0a0b";
/** The demo's simulated reply, in ms. Short enough that the whole walkthrough stays under 8 s. */
const DEMO_REPLY_MS = 600;
/**
 * A multi-line draft for the Max rows control to cap. The demo seeds it only once that control is
 * tuned, so the untouched demo still starts empty and the card video shows the grow-on-wrap moment.
 */
const SAMPLE_DRAFT = [
  "Pull the three themes out of the interview notes.",
  "Keep each theme to one sentence and one customer quote.",
  "Flag anything that touches the pricing tests.",
  "Leave the roadmap out until Thursday.",
  "Finish with a single recommendation.",
].join("\n");

/**
 * The conversation the composer sits under. It is the context a real chat composer has, and it is
 * the only thing that gives the card video height above the field: the video is cropped to the
 * visible content, so a popover opening into empty stage would be cut off at the top of the frame.
 */
function ConversationContext({ light }: { light: boolean }) {
  return (
    <div className="flex flex-col gap-8" aria-hidden="true" style={{ color: light ? "#3f3f46" : "#c4c4ca" }}>
      <p
        className="ml-auto max-w-[78%] rounded-[14px] px-3.5 py-2.5 text-[14px] leading-[20px]"
        style={{ background: light ? "rgba(17,17,19,0.05)" : "rgba(255,255,255,0.06)" }}
      >
        What did the five customer interviews say about exports?
      </p>
      <p className="text-[15px] leading-[22px] tracking-[-0.005em]">
        Four of the five said exports lose their formatting when pasted into a doc. Two asked for a template they can reuse each week, and one wanted the export without the logo. Pricing only came up in the final call, so the pricing tests should wait until the export work ships.
      </p>
    </div>
  );
}

/** Demo stage. The demo's own state drives Stop and back, so the component's controls work too. */
export default function AiComposerMinimalDemo({ state: forced, ...overrides }: Partial<AiComposerMinimalProps> = {}) {
  const [state, setState] = useState<AiComposerState>(forced ?? "idle");
  // Only a reply the user started finishes on its own; an action-forced state stays put until changed.
  const replying = useRef(false);

  useEffect(() => {
    replying.current = false;
    setState(forced ?? "idle");
  }, [forced]);

  useEffect(() => {
    if (state !== "generating" || !replying.current) return;
    const t = window.setTimeout(() => {
      replying.current = false;
      setState("idle");
    }, DEMO_REPLY_MS);
    return () => window.clearTimeout(t);
  }, [state]);

  // Anchored low, where a chat composer sits, with the conversation above it.
  const light = overrides.theme === "light";
  return (
    <div
      className="flex min-h-[max(680px,100dvh)] w-full items-end justify-center px-4 pb-[clamp(40px,10vh,96px)]"
      style={{ background: light ? "#f4f4f5" : STAGE }}
    >
      <div className="flex w-full max-w-[600px] flex-col gap-8">
        <ConversationContext light={light} />
        <AiComposerMinimal
          defaultValue={overrides.maxRows === undefined ? undefined : SAMPLE_DRAFT}
          {...overrides}
          state={state}
          onStateChange={(next) => {
            replying.current = next === "generating";
            setState(next);
          }}
        />
      </div>
    </div>
  );
}
