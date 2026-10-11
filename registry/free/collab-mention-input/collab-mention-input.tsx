"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type MentionPerson = {
  id: string;
  name: string;
  /** What follows the @, e.g. “priya”. */
  handle: string;
};

export type MentionChannel = {
  id: string;
  name: string;
};

export type CollabMentionInputProps = {
  /** Small heading above the note. */
  title?: string;
  /** Mono line under the heading. */
  workspace?: string;
  /**
   * The note. `@handle` and `#channel` that match `people` / `channels`
   * render as single tokens; everything else is plain text.
   */
  value?: string;
  people?: MentionPerson[];
  channels?: MentionChannel[];
  placeholder?: string;
  /** The quiet line under the field. */
  showHint?: boolean;
  /** Sans for a working note, serif when it should read like the document. */
  voice?: "sans" | "serif";
  onChange?: (value: string) => void;
  /** The one accent: person tokens. Channel tokens stay neutral. */
  accent?: string;
  theme?: "dark" | "light";
  className?: string;
};

type Kind = "person" | "channel";
type Query = { kind: Kind; text: string; top: number; left: number; width: number };
type Hit = { kind: Kind; id: string; name: string; meta: string };

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    surface: "#111113",
    raised: "#17171a",
    sunken: "#0c0c0e",
    line: "#232327",
    rule: "#1b1b1e",
    ink: "#f4f4f5",
    muted: "#a1a1aa",
    faint: "#8a8a93",
    avatar: "#1f1f23",
    shadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 32px 64px -32px rgba(0,0,0,0.9)",
    pop: "inset 0 1px 0 rgba(255,255,255,0.05), 0 18px 40px -12px rgba(0,0,0,0.8)",
  },
  light: {
    surface: "#ffffff",
    raised: "#f6f6f7",
    sunken: "#fafafa",
    line: "#e4e4e7",
    rule: "#efeff1",
    ink: "#18181b",
    muted: "#52525b",
    faint: "#71717a",
    avatar: "#f0f0f2",
    shadow: "0 1px 2px rgba(24,24,27,0.04), 0 32px 64px -40px rgba(24,24,27,0.25)",
    pop: "0 1px 2px rgba(24,24,27,0.06), 0 18px 40px -16px rgba(24,24,27,0.3)",
  },
} as const;

type Palette = Record<keyof (typeof PALETTE)["dark"], string>;

const STAGE = "#0a0a0b";
const STAGE_LIGHT = "#e9e9ec";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;

const MOTION = { rise: 12, blur: 8, block: 0.5, step: 0.06, fade: 0.15 } as const;
const LIST_LIMIT = 5;
const QUERY = /(^|[\s\u00a0])([@#])([a-z0-9._-]*)$/i;
const TOKEN_SPLIT = /(@[a-z0-9._-]+|#[a-z0-9._-]+)/gi;

const DEMO_PEOPLE: MentionPerson[] = [
  { id: "mara", name: "Mara Ilić", handle: "mara" },
  { id: "jonas", name: "Jonas Weber", handle: "jonas" },
  { id: "priya", name: "Priya Raman", handle: "priya" },
  { id: "sam", name: "Sam Okoye", handle: "sam" },
  { id: "pablo", name: "Pablo Ferreira", handle: "pablo" },
];

const DEMO_CHANNELS: MentionChannel[] = [
  { id: "legal", name: "legal" },
  { id: "pricing", name: "pricing" },
  { id: "billing", name: "billing" },
  { id: "launch", name: "launch" },
  { id: "design", name: "design" },
];

const DEMO_VALUE = "@mara, the v3 headline is ready for a last look in #legal before Friday. ";

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function cssVars(p: Palette, accent: string): CSSProperties {
  const vars: Record<string, string> = { "--mi-accent": accent };
  for (const [k, v] of Object.entries(p)) vars[`--mi-${k}`] = v;
  return vars as CSSProperties;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const firstName = (name: string) => name.split(" ")[0] ?? name;

function enter(play: boolean, delay: number, reduce: boolean) {
  if (reduce) return { initial: { opacity: 0 }, animate: { opacity: play ? 1 : 0 }, transition: { duration: MOTION.fade } };
  return {
    initial: { opacity: 0, y: MOTION.rise, filter: `blur(${MOTION.blur}px)` },
    animate: play ? { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } } : undefined,
    transition: { duration: MOTION.block, ease: EASE_OUT, delay },
  };
}

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mi-ink)]";

const PERSON_CLASS =
  "mx-px inline whitespace-nowrap rounded-[5px] bg-[color-mix(in_srgb,var(--mi-accent)_16%,transparent)] px-1 py-px align-baseline font-medium text-[var(--mi-ink)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--mi-accent)_28%,transparent)]";
const CHANNEL_CLASS =
  "mx-px inline whitespace-nowrap rounded-[5px] bg-[var(--mi-raised)] px-1 py-px align-baseline font-mono text-[0.92em] text-[var(--mi-ink)] shadow-[inset_0_0_0_1px_var(--mi-line)]";

function makeToken(kind: Kind, id: string, label: string) {
  const el = document.createElement("span");
  el.contentEditable = "false";
  el.dataset.token = kind;
  el.dataset.id = id;
  el.className = kind === "person" ? PERSON_CLASS : CHANNEL_CLASS;
  el.textContent = label;
  el.setAttribute("aria-label", kind === "person" ? `Mention ${label}` : `Channel ${label}`);
  return el;
}

/** A token arriving from the list. Paint() does not use this — the note is already written. */
function arrive(el: HTMLElement) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  el.animate(
    [
      { opacity: 0, filter: "blur(4px)", transform: "translateY(2px)" },
      { opacity: 1, filter: "blur(0px)", transform: "translateY(0)" },
    ],
    { duration: 280, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
  );
}

function serialize(root: HTMLElement) {
  let out = "";
  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) out += node.textContent ?? "";
    else if (node instanceof HTMLElement && node.dataset.token) {
      const id = node.dataset.id ?? "";
      out += node.dataset.token === "channel" ? `#${id}` : `@${id}`;
    } else if (node instanceof HTMLBRElement) out += "\n";
    else if (node instanceof HTMLElement) out += node.innerText;
  });
  return out.replace(/\u00a0/g, " ");
}

function paint(root: HTMLElement, value: string, people: MentionPerson[], channels: MentionChannel[]) {
  const frag = document.createDocumentFragment();
  const parts = value.split(TOKEN_SPLIT);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith("@")) {
      const person = people.find((p) => p.handle.toLowerCase() === part.slice(1).toLowerCase());
      if (person) {
        frag.append(makeToken("person", person.handle, `@${firstName(person.name)}`));
        continue;
      }
    }
    if (part.startsWith("#")) {
      const channel = channels.find((c) => c.name.toLowerCase() === part.slice(1).toLowerCase());
      if (channel) {
        frag.append(makeToken("channel", channel.name, `#${channel.name}`));
        continue;
      }
    }
    frag.append(document.createTextNode(part));
  }
  root.replaceChildren(frag);
}

function placeCaretAtEnd(root: HTMLElement) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

function matchesFor(kind: Kind, text: string, people: MentionPerson[], channels: MentionChannel[]): Hit[] {
  const q = text.toLowerCase();
  if (kind === "person") {
    return people
      .filter((p) => !q || p.handle.toLowerCase().startsWith(q) || p.name.toLowerCase().includes(q))
      .slice(0, LIST_LIMIT)
      .map((p) => ({ kind: "person", id: p.handle, name: p.name, meta: `@${p.handle}` }));
  }
  return channels
    .filter((c) => !q || c.name.toLowerCase().startsWith(q))
    .slice(0, LIST_LIMIT)
    .map((c) => ({ kind: "channel", id: c.name, name: `#${c.name}`, meta: "Channel" }));
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function CollabMentionInput({
  title = "Friday note",
  workspace = "Ledgerline · Website",
  value = DEMO_VALUE,
  people = DEMO_PEOPLE,
  channels = DEMO_CHANNELS,
  placeholder = "Write a note. @ mentions a person, # a channel.",
  showHint = true,
  voice = "sans",
  onChange,
  accent = "#f5a524",
  theme = "dark",
  className = "",
}: CollabMentionInputProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const root = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<HTMLDivElement>(null);
  const play = useInView(root, { once: true, amount: 0.2 });
  const palette = PALETTE[theme];

  const [query, setQuery] = useState<Query | null>(null);
  const [active, setActive] = useState(0);
  const [empty, setEmpty] = useState(value.trim().length === 0);
  const [status, setStatus] = useState("");
  const peopleRef = useRef(people);
  const channelsRef = useRef(channels);
  const onChangeRef = useRef(onChange);
  peopleRef.current = people;
  channelsRef.current = channels;
  onChangeRef.current = onChange;

  const hits = query ? matchesFor(query.kind, query.text, people, channels) : [];
  const current = hits[Math.min(active, Math.max(hits.length - 1, 0))];

  useEffect(() => {
    const el = editor.current;
    if (!el) return;
    paint(el, value, people, channels);
    setEmpty((el.textContent ?? "").trim().length === 0);
    // Paint once. Rebuilding the DOM on every keystroke would throw the caret away.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => {
    const el = editor.current;
    if (!el) return;
    setEmpty((el.textContent ?? "").replace(/\u00a0/g, " ").trim().length === 0);
    onChangeRef.current?.(serialize(el));
  };

  const queryKey = useRef("");
  const readQuery = () => {
    const el = editor.current;
    const box = host.current;
    const sel = window.getSelection();
    if (!el || !box || !sel || sel.rangeCount === 0 || !sel.anchorNode || !el.contains(sel.anchorNode)) {
      queryKey.current = "";
      setQuery(null);
      return;
    }
    if (sel.anchorNode.nodeType !== Node.TEXT_NODE) {
      queryKey.current = "";
      setQuery(null);
      return;
    }
    const text = sel.anchorNode.textContent ?? "";
    const caret = sel.anchorOffset;
    const found = QUERY.exec(text.slice(0, caret));
    if (!found) {
      queryKey.current = "";
      setQuery(null);
      return;
    }
    const kind: Kind = found[2] === "#" ? "channel" : "person";
    const key = `${kind}:${found[3].toLowerCase()}`;
    if (queryKey.current !== key) {
      queryKey.current = key;
      setActive(0);
    }
    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(true);
    const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
    const bounds = box.getBoundingClientRect();
    const width = Math.min(272, bounds.width - 16);
    const left = Math.max(8, Math.min(rect.left - bounds.left, bounds.width - width - 8));
    // Drop under the caret. If that would leave the viewport, sit above it instead.
    const rows = matchesFor(kind, found[3], peopleRef.current, channelsRef.current).length || 1;
    const listH = 36 + rows * 44;
    const below = window.innerHeight - rect.bottom;
    const above = rect.top - bounds.top;
    const top = below < listH + 16 && above > listH ? rect.top - bounds.top - listH - 8 : rect.bottom - bounds.top + 8;
    setQuery({ kind, text: found[3], top, left, width });
  };

  const insert = (hit: Hit) => {
    const el = editor.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0 || !sel.anchorNode || sel.anchorNode.nodeType !== Node.TEXT_NODE) return;
    const node = sel.anchorNode;
    const caret = sel.anchorOffset;
    const before = (node.textContent ?? "").slice(0, caret);
    const found = QUERY.exec(before);
    if (!found) return;
    const start = caret - found[2].length - found[3].length;
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, caret);
    range.deleteContents();
    const label = hit.kind === "person" ? `@${firstName(hit.name)}` : hit.name;
    const token = makeToken(hit.kind, hit.id, label);
    range.insertNode(token);
    arrive(token);
    const space = document.createTextNode("\u00a0");
    token.after(space);
    const after = document.createRange();
    after.setStart(space, 1);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
    setQuery(null);
    setStatus(hit.kind === "person" ? `Mentioned ${hit.name}` : `Added ${hit.name}`);
    emit();
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
    if (query) {
      if (hits.length && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + hits.length) % hits.length);
        return;
      }
      if (hits.length && (e.key === "Enter" || e.key === "Tab")) {
        e.preventDefault();
        insert(hits[Math.min(active, hits.length - 1)]);
        return;
      }
      if (e.key === "Escape" || (e.key === "Enter" && !hits.length)) {
        e.preventDefault();
        setQuery(null);
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      document.execCommand("insertLineBreak");
      emit();
      return;
    }
    if (e.key === "Backspace") {
      const sel = window.getSelection();
      const node = sel?.anchorNode;
      if (!sel || !node || !sel.isCollapsed) return;
      const atStart = node.nodeType === Node.TEXT_NODE && sel.anchorOffset === 0;
      const prev = node.nodeType === Node.TEXT_NODE ? node.previousSibling : node instanceof HTMLElement ? node.childNodes[sel.anchorOffset - 1] : null;
      const token = prev instanceof HTMLElement && prev.dataset.token ? prev : null;
      if (atStart && token) {
        e.preventDefault();
        const before = token.previousSibling;
        if (before?.nodeType === Node.TEXT_NODE && (before.textContent ?? "").length === 1 && /\s|\u00a0/.test(before.textContent ?? "")) before.remove();
        token.remove();
        emit();
        setQuery(null);
      }
    }
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = editor.current;
    if (!el || e.target !== el) return;
    // A scripted click never gets the browser’s caret. A real click does, except
    // in the empty well under the writing, which should land at the end.
    const range = document.createRange();
    range.selectNodeContents(el);
    const box = range.getBoundingClientRect();
    const below = box.height === 0 || e.clientY > box.bottom + 2;
    if (e.nativeEvent.isTrusted && !below) return;
    requestAnimationFrame(() => {
      if (editor.current) placeCaretAtEnd(editor.current);
      readQuery();
    });
  };

  const onPaste = (e: ReactClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain").replace(/\r\n/g, "\n");
    document.execCommand("insertText", false, text);
    emit();
  };

  const hint = query
    ? hits.length
      ? "↑↓ to choose · Enter to insert · Esc to dismiss"
      : query.kind === "person"
        ? `No one matches “${query.text}”`
        : `No channel matches “${query.text}”`
    : "Type @ for a person, # for a channel. Backspace removes the whole token.";

  return (
    <section
      ref={root}
      aria-labelledby={`${uid}-title`}
      style={cssVars(palette, accent)}
      className={`@container w-full font-sans text-[var(--mi-ink)] antialiased ${className}`}
    >
      <motion.div {...enter(play, 0, reduce)} className="rounded-[14px] border border-[var(--mi-line)] bg-[var(--mi-surface)] shadow-[var(--mi-shadow)]">
        <motion.header {...enter(play, MOTION.step, reduce)} className="px-5 pb-1 pt-5 @md:px-6">
          <h2 id={`${uid}-title`} className="truncate font-display text-[18px] font-semibold tracking-[-0.03em]">
            {title}
          </h2>
          <p className="mt-1 truncate font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--mi-faint)]">{workspace}</p>
        </motion.header>

        <motion.div
          {...enter(play, MOTION.step * 2, reduce)}
          ref={host}
          className="relative mx-5 mb-4 rounded-xl border border-[var(--mi-line)] bg-[var(--mi-sunken)] @md:mx-6"
        >
          {empty && (
            <span aria-hidden="true" className="pointer-events-none absolute left-4 top-3 text-[15px] leading-[1.65] text-[var(--mi-faint)]">
              {placeholder}
            </span>
          )}
          <div
            ref={editor}
            data-demo="editor"
            role="textbox"
            aria-multiline="true"
            aria-label={title}
            aria-autocomplete="list"
            aria-controls={query ? `${uid}-list` : undefined}
            aria-activedescendant={query && current ? `${uid}-opt-${current.id}` : undefined}
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            onInput={() => {
              emit();
              readQuery();
            }}
            onKeyUp={readQuery}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            onPaste={onPaste}
            onBlur={() => {
              // Wait a tick so a click on a suggestion (which blurs the field) still lands.
              window.setTimeout(() => setQuery(null), 120);
            }}
            className={`min-h-[9.5rem] whitespace-pre-wrap px-4 py-3 text-[var(--mi-muted)] caret-[var(--mi-ink)] outline-none selection:bg-[color-mix(in_srgb,var(--mi-accent)_35%,transparent)] ${voice === "serif" ? "font-serif text-[17px] leading-[1.55]" : "text-[15px] leading-[1.65]"} ${FOCUS_RING}`}
          />
          <AnimatePresence>
            {query && (
              <motion.div
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, transition: { duration: 0.12, ease: EASE_IN } }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
                style={{ top: query.top, left: query.left, width: query.width }}
                className="absolute z-30 rounded-xl border border-[var(--mi-line)] bg-[var(--mi-raised)] p-1 shadow-[var(--mi-pop)]"
              >
                <p className="px-2.5 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--mi-faint)]">
                  {query.kind === "person" ? "People" : "Channels"}
                </p>
                <ul id={`${uid}-list`} role="listbox" aria-label={query.kind === "person" ? "People" : "Channels"}>
                  {hits.length === 0 ? (
                    <li className="px-2.5 pb-2 pt-1 text-[13px] text-[var(--mi-faint)]">Nothing matches.</li>
                  ) : (
                    hits.map((hit, i) => {
                      const on = i === active;
                      return (
                        <li key={`${hit.kind}-${hit.id}`} role="presentation">
                          <div
                            id={`${uid}-opt-${hit.id}`}
                            role="option"
                            aria-selected={on}
                            data-demo={`suggestion-${hit.id}`}
                            onPointerEnter={() => setActive(i)}
                            onPointerDown={(e) => e.preventDefault()}
                            onClick={() => insert(hit)}
                            className="relative flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 active:scale-[0.98]"
                          >
                            {on && (
                              <motion.span
                                layoutId={`${uid}-active`}
                                transition={reduce ? { duration: 0 } : SPRING_UI}
                                className="absolute inset-0 rounded-lg bg-[color-mix(in_srgb,var(--mi-ink)_7%,transparent)]"
                              />
                            )}
                            <span
                              aria-hidden="true"
                              className={`relative flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--mi-avatar)] text-[10px] font-semibold tracking-[0.02em] text-[var(--mi-muted)] ${
                                on && hit.kind === "person" ? "shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--mi-accent)_55%,transparent)]" : ""
                              }`}
                            >
                              {hit.kind === "person" ? initials(hit.name) : "#"}
                            </span>
                            <span className="relative min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-medium text-[var(--mi-ink)]">{hit.name}</span>
                              <span className="block truncate font-mono text-[11px] text-[var(--mi-faint)]">{hit.meta}</span>
                            </span>
                          </div>
                        </li>
                      );
                    })
                  )}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {showHint && (
          <motion.p {...enter(play, MOTION.step * 3, reduce)} className="border-t border-[var(--mi-rule)] px-5 py-3 font-mono text-[11px] tracking-[0.01em] text-[var(--mi-faint)] @md:px-6" aria-live="polite">
            {hint}
          </motion.p>
        )}
        <span className="sr-only" aria-live="polite">
          {status}
        </span>
      </motion.div>
    </section>
  );
}

export default function CollabMentionInputDemo(overrides: Partial<CollabMentionInputProps> = {}) {
  const light = overrides.theme === "light";
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-16 sm:px-8" style={{ background: light ? STAGE_LIGHT : STAGE }}>
      <div className="w-full max-w-[560px]">
        <CollabMentionInput {...overrides} />
      </div>
    </div>
  );
}
