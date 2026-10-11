"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Archive,
  CalendarDays,
  Circle,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CornerDownLeft,
  FileText,
  History,
  MessagesSquare,
  PenTool,
  Search,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Icon = ComponentType<{ size?: number; strokeWidth?: number; className?: string; "aria-hidden"?: boolean | "true" }>;

/** One value an operator accepts, such as "docs" for `in:` or "mara" for `from:`. */
export type ScopeValue = {
  /** What is typed after the colon and what the host receives, e.g. "docs" or "mara". */
  id: string;
  /** Name in the suggestion list, e.g. "Docs" or "Mara Ilić". */
  label: string;
  /** Shorter name on the chip, e.g. "Mara". Defaults to the label. */
  chip?: string;
  /** Quiet second line of context in the suggestion row, e.g. "Specs, RFCs and wikis". */
  detail?: string;
  /** Trailing figure or tag: a number is formatted as a count, a string shows as is. */
  meta?: number | string;
  icon?: Icon;
  /** Two letters for a person. Draws an initials avatar instead of an icon. */
  initials?: string;
};

/** An operator such as `in:` or `from:`, and the values it understands. */
export type ScopeOperator = {
  /** The word before the colon, lowercase, e.g. "in". */
  key: string;
  /** Heading over its values in the suggestions, e.g. "Search in". */
  label: string;
  /** One line shown when the operator itself is suggested, e.g. "a space such as Docs or Issues". */
  hint: string;
  values: ScopeValue[];
};

/** A scope the search is narrowed by: one per operator. */
export type ScopeToken = { key: string; value: string };

export type RecentSearch = {
  id: string;
  query: string;
  scopes?: ScopeToken[];
  /** Short relative label, e.g. "12m" or "Yesterday". */
  when?: string;
};

/** What the host receives: the free text and the parsed scopes. Results are the host's job. */
export type ScopedSearchValue = { query: string; scopes: ScopeToken[] };

export type ScopedSearchSize = "md" | "lg";
export type ScopedSearchTheme = "dark" | "light";

export type ScopedSearchProps = {
  /** Operators the field understands. Typing `key:` opens that operator's values. */
  operators?: ScopeOperator[];
  /** Parse scope tokens into chips. Off, `in:docs` stays plain text. */
  scopes?: boolean;
  /** Show recent searches when the empty field is focused. */
  recents?: boolean;
  recentSearches?: RecentSearch[];
  /** Show the ⌘K keycap at rest and bind ⌘K / Ctrl K to focus the field. The keycap morphs into the clear button. */
  shortcutHint?: boolean;
  size?: ScopedSearchSize;
  placeholder?: string;
  /** Accessible name of the field. */
  label?: string;
  theme?: ScopedSearchTheme;
  /** The one accent: matched letters, the focus halo and the active row's key. Defaults to the theme's ink. */
  accent?: string;
  defaultQuery?: string;
  defaultScopes?: ScopeToken[];
  /** Called whenever the text or the scopes change. */
  onChange?: (value: ScopedSearchValue) => void;
  /** Called on Enter, on the search row, or when a recent search is picked. */
  onSubmit?: (value: ScopedSearchValue) => void;
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

type Tone = {
  field: string;
  line: string;
  lineHover: string;
  lineFocus: string;
  lift: string;
  ink: string;
  body: string;
  muted: string;
  faint: string;
  chip: string;
  chipLine: string;
  chipArmed: string;
  panel: string;
  panelLine: string;
  panelShadow: string;
  rowActive: string;
  tile: string;
  key: string;
  keyLine: string;
  stage: string;
};

const TONES: Record<ScopedSearchTheme, Tone> = {
  dark: {
    field: "#0e0e10",
    line: "rgba(255,255,255,0.09)",
    lineHover: "rgba(255,255,255,0.17)",
    lineFocus: "rgba(255,255,255,0.32)",
    lift: "inset 0 1px 0 rgba(255,255,255,0.04), 0 1px 2px rgba(0,0,0,0.5)",
    ink: "#f4f4f5",
    body: "#c9c9cf",
    muted: "#a1a1aa",
    faint: "#8a8a93",
    chip: "rgba(255,255,255,0.07)",
    chipLine: "rgba(255,255,255,0.1)",
    chipArmed: "rgba(255,255,255,0.16)",
    panel: "#111113",
    panelLine: "rgba(255,255,255,0.08)",
    panelShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 28px 64px -20px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.45)",
    rowActive: "rgba(255,255,255,0.065)",
    tile: "#1b1b1e",
    key: "rgba(255,255,255,0.06)",
    keyLine: "rgba(255,255,255,0.12)",
    stage: "#050506",
  },
  light: {
    field: "#ffffff",
    line: "rgba(17,17,19,0.12)",
    lineHover: "rgba(17,17,19,0.22)",
    lineFocus: "rgba(17,17,19,0.4)",
    lift: "0 1px 2px rgba(17,17,19,0.06)",
    ink: "#111113",
    body: "#3f3f46",
    muted: "#52525b",
    faint: "#6b6b74",
    chip: "rgba(17,17,19,0.05)",
    chipLine: "rgba(17,17,19,0.1)",
    chipArmed: "rgba(17,17,19,0.12)",
    panel: "#ffffff",
    panelLine: "rgba(17,17,19,0.08)",
    panelShadow: "0 28px 64px -24px rgba(17,17,19,0.28), 0 2px 6px rgba(17,17,19,0.06)",
    rowActive: "rgba(17,17,19,0.05)",
    tile: "#f4f4f5",
    key: "rgba(17,17,19,0.04)",
    keyLine: "rgba(17,17,19,0.12)",
    stage: "#f1f1f2",
  },
};

type Dims = { height: number; radius: number; pad: number; icon: number; text: number; chip: number; chipText: number; row: number; rowText: number };

const SIZES: Record<ScopedSearchSize, Dims> = {
  md: { height: 48, radius: 12, pad: 14, icon: 18, text: 16, chip: 26, chipText: 13, row: 40, rowText: 14 },
  lg: { height: 56, radius: 14, pad: 16, icon: 20, text: 18, chip: 30, chipText: 14, row: 44, rowText: 15 },
};

/** Ease-out for arrivals and state changes. */
const EASE = [0.22, 1, 0.36, 1] as const;
/** Selection indicator: snappy, no bounce. */
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;
/** Seconds for the panel to open and for its height to follow its content. */
const PANEL_S = 0.24;
/** Seconds between staggered rows. */
const ROW_STAGGER_S = 0.04;
/** Rows past this index arrive together, so a long list never makes anyone wait. */
const STAGGER_CAP = 5;
/** Reduced motion keeps only opacity, and only this long. */
const FADE_S = 0.14;
/** Keycap and clear-button geometry for the morph, in px. */
const KEYCAP = { height: 22, radius: 6 };
const CLEAR = { size: 26 };

/** A trailing `key:value` token, value possibly empty. */
const TOKEN_RE = /(^|\s)([a-z]+):(\S*)$/i;
/** A finished `key:value` token followed by a space, which commits it as a chip. */
const COMMIT_RE = /(^|\s)([a-z]+):(\S+)(?=\s)/gi;
/** A trailing bare word that might be the start of an operator. */
const WORD_RE = /(^|\s)([a-z]+)$/i;

const CSS = `
.iss-field {
  box-shadow: inset 0 0 0 1px var(--iss-line), var(--iss-lift);
  transition: box-shadow 160ms cubic-bezier(0.22, 1, 0.36, 1);
}
@media (hover: hover) and (pointer: fine) {
  .iss-field:hover { box-shadow: inset 0 0 0 1px var(--iss-line-hover), var(--iss-lift); }
}
.iss-field:focus-within { box-shadow: inset 0 0 0 1px var(--iss-line-focus), 0 0 0 4px var(--iss-halo), var(--iss-lift); }
.iss-row { scrollbar-width: none; }
.iss-row::-webkit-scrollbar { display: none; }
.iss-input::placeholder { color: var(--iss-faint); opacity: 1; }
.iss-focus:focus-visible { outline: 2px solid var(--iss-ink); outline-offset: 2px; }
.iss-hit { position: relative; }
@media (hover: hover) and (pointer: fine) { .iss-x:hover { background: var(--iss-chip-hover); color: var(--iss-ink); } }
.iss-hit::after { content: ""; position: absolute; inset: -9px -6px; }
@media (prefers-reduced-motion: reduce) { .iss-field { transition: none; } }
`;

/* ------------------------------------------------------------------ */
/* Defaults                                                            */
/* ------------------------------------------------------------------ */

export const DEFAULT_OPERATORS: ScopeOperator[] = [
  {
    key: "in",
    label: "Search in",
    hint: "a space, like Docs or Issues",
    values: [
      { id: "docs", label: "Docs", detail: "Specs, RFCs and the wiki", meta: 1284, icon: FileText },
      { id: "issues", label: "Issues", detail: "Bugs, tasks and chores", meta: 3906, icon: CircleDot },
      { id: "threads", label: "Threads", detail: "Long-running discussions", meta: 712, icon: MessagesSquare },
      { id: "designs", label: "Designs", detail: "Frames, flows and files", meta: 248, icon: PenTool },
      { id: "meetings", label: "Meetings", detail: "Notes and transcripts", meta: 96, icon: CalendarDays },
    ],
  },
  {
    key: "from",
    label: "Written by",
    hint: "a person, like @mara",
    values: [
      { id: "mara", label: "Mara Ilić", chip: "Mara", detail: "@mara", meta: "Design", initials: "MI" },
      { id: "jonah", label: "Jonah Feld", chip: "Jonah", detail: "@jonah", meta: "Platform", initials: "JF" },
      { id: "ines", label: "Inès Okafor", chip: "Inès", detail: "@ines", meta: "Growth", initials: "IO" },
      { id: "theo", label: "Theo Brandt", chip: "Theo", detail: "@theo", meta: "Support", initials: "TB" },
    ],
  },
  {
    key: "is",
    label: "State",
    hint: "open, draft, shipped",
    values: [
      { id: "open", label: "Open", detail: "Still being worked on", icon: Circle },
      { id: "draft", label: "Draft", detail: "Not shared yet", icon: CircleDashed },
      { id: "shipped", label: "Shipped", detail: "Done and released", icon: CircleCheck },
      { id: "archived", label: "Archived", detail: "Out of the way", icon: Archive },
    ],
  },
];

export const DEFAULT_RECENTS: RecentSearch[] = [
  { id: "r1", query: "checkout timeout", scopes: [{ key: "in", value: "issues" }, { key: "is", value: "open" }], when: "12m" },
  { id: "r2", query: "Q3 roadmap", scopes: [{ key: "from", value: "mara" }], when: "2h" },
  { id: "r3", query: "onboarding email copy", scopes: [{ key: "in", value: "docs" }], when: "Yesterday" },
  { id: "r4", query: "billing webhook retries", when: "Mon" },
];

/* ------------------------------------------------------------------ */
/* Parsing                                                             */
/* ------------------------------------------------------------------ */

const normalise = (text: string) => text.toLowerCase().replace(/^@/, "");

function findOperator(operators: ScopeOperator[], key: string) {
  return operators.find((op) => op.key === key.toLowerCase());
}

/** The token being typed at the end of the query, when its key is an operator the field knows. */
function readToken(query: string, operators: ScopeOperator[]) {
  const match = TOKEN_RE.exec(query);
  if (!match) return null;
  const operator = findOperator(operators, match[2]);
  if (!operator) return null;
  return { operator, partial: match[3], start: match.index + match[1].length };
}

/** The bare word at the end of the query, which may be the start of an operator key. */
function readWord(query: string) {
  const match = WORD_RE.exec(query);
  return match ? { word: match[2].toLowerCase(), start: match.index + match[1].length } : null;
}

function matchValues(operator: ScopeOperator, partial: string) {
  const q = normalise(partial);
  if (!q) return operator.values;
  return operator.values.filter(
    (v) => v.id.toLowerCase().startsWith(q) || v.label.toLowerCase().split(/\s+/).some((w) => w.startsWith(q)),
  );
}

function exactValue(operator: ScopeOperator, partial: string) {
  const q = normalise(partial);
  return operator.values.find((v) => v.id.toLowerCase() === q || v.label.toLowerCase() === q);
}

function resolveScope(operators: ScopeOperator[], scope: ScopeToken) {
  const operator = findOperator(operators, scope.key);
  const value = operator?.values.find((v) => v.id === scope.value);
  return operator && value ? { operator, value } : null;
}

/** "in Docs · from Mara", for the search row and the screen-reader summary. */
function describeScopes(operators: ScopeOperator[], scopes: ScopeToken[]) {
  return scopes
    .map((s) => resolveScope(operators, s))
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .map(({ operator, value }) => `${operator.key} ${value.chip ?? value.label}`)
    .join(" · ");
}

/** Places a scope, replacing an existing one for the same operator in place so its chip morphs rather than moves. */
function withScope(scopes: ScopeToken[], next: ScopeToken) {
  return scopes.some((s) => s.key === next.key)
    ? scopes.map((s) => (s.key === next.key ? next : s))
    : [...scopes, next];
}

type Option =
  | { kind: "recent"; id: string; recent: RecentSearch }
  | { kind: "value"; id: string; operator: ScopeOperator; value: ScopeValue }
  | { kind: "operator"; id: string; operator: ScopeOperator }
  | { kind: "search"; id: string };

type Mode = "closed" | "recents" | "idle" | "values" | "query";

/* ------------------------------------------------------------------ */
/* Small parts                                                         */
/* ------------------------------------------------------------------ */

const countFormat = new Intl.NumberFormat("en-US");

function Initials({ text, size, tone }: { text: string; size: number; tone: Tone }) {
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full font-sans font-semibold tracking-[0.02em]"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: tone.tile,
        color: tone.body,
        boxShadow: `inset 0 0 0 1px ${tone.chipLine}`,
      }}
    >
      {text}
    </span>
  );
}

function ValueGlyph({ value, size, tone }: { value: ScopeValue; size: number; tone: Tone }) {
  if (value.initials) return <Initials text={value.initials} size={size} tone={tone} />;
  const Glyph = value.icon ?? Circle;
  return <Glyph aria-hidden="true" size={Math.round(size * 0.62)} strokeWidth={1.7} />;
}

function Keycap({ children, tone, accent }: { children: string; tone: Tone; accent?: string }) {
  return (
    <kbd
      className="inline-grid h-[20px] min-w-[20px] place-items-center rounded-[5px] px-1.5 font-mono text-[11px] leading-none"
      style={{ background: tone.key, boxShadow: `inset 0 0 0 1px ${tone.keyLine}`, color: accent ?? tone.muted }}
    >
      {children}
    </kbd>
  );
}

/** The label with the typed run picked out, so the eye lands on why a row matched. */
function Highlight({ text, query, color }: { text: string; query: string; color: string }) {
  const q = normalise(query);
  const at = q ? text.toLowerCase().indexOf(q) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className="font-semibold" style={{ color }}>
        {text.slice(at, at + q.length)}
      </span>
      {text.slice(at + q.length)}
    </>
  );
}

/** A non-interactive scope, as shown inside a recent search. */
function MiniChip({ operator, value, tone }: { operator: ScopeOperator; value: ScopeValue; tone: Tone }) {
  return (
    <span
      className="inline-flex h-[20px] shrink-0 items-center gap-1 rounded-[5px] px-1.5 text-[12px] leading-none"
      style={{ background: tone.chip, boxShadow: `inset 0 0 0 1px ${tone.chipLine}`, color: tone.body }}
    >
      <span className="font-mono text-[10.5px]" style={{ color: tone.faint }}>
        {operator.key}
      </span>
      {value.chip ?? value.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function ScopedSearch({
  operators = DEFAULT_OPERATORS,
  scopes: scopesEnabled = true,
  recents: recentsEnabled = true,
  recentSearches = DEFAULT_RECENTS,
  shortcutHint = true,
  size = "md",
  placeholder = "Search docs, issues and people",
  label = "Search",
  theme = "dark",
  accent,
  defaultQuery = "",
  defaultScopes = [],
  onChange,
  onSubmit,
  className,
}: ScopedSearchProps) {
  const id = useId();
  const listId = `${id}-list`;
  const reduce = useReducedMotion() ?? false;
  const tone = TONES[theme];
  const dims = SIZES[size];
  const ink = accent ?? tone.ink;

  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState(defaultQuery);
  const [scopes, setScopes] = useState<ScopeToken[]>(defaultScopes);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  /** First Backspace in an empty field arms the last chip; the second removes it. */
  const [armed, setArmed] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [modKey, setModKey] = useState("⌘");

  const token = useMemo(() => (scopesEnabled ? readToken(query, operators) : null), [scopesEnabled, query, operators]);
  const word = useMemo(() => (scopesEnabled && !token ? readWord(query) : null), [scopesEnabled, token, query]);
  const hasContent = query.length > 0 || scopes.length > 0;
  const visibleRecents = useMemo(() => (recentsEnabled ? recentSearches : []), [recentsEnabled, recentSearches]);

  // What the panel holds if it is open. It stays rendered while closed (hidden and inert), so it can
  // animate out with its content and open again without a blank frame.
  const openMode: Mode = token
    ? "values"
    : hasContent
      ? "query"
      : visibleRecents.length > 0
        ? "recents"
        : scopesEnabled
          ? "idle"
          : "closed";
  const mode: Mode = open ? openMode : "closed";

  const options = useMemo<Option[]>(() => {
    switch (openMode) {
      case "recents":
        return visibleRecents.map((recent) => ({ kind: "recent", id: `recent-${recent.id}`, recent }));
      case "values":
        return token
          ? matchValues(token.operator, token.partial).map((value) => ({
              kind: "value",
              id: `value-${token.operator.key}-${value.id}`,
              operator: token.operator,
              value,
            }))
          : [];
      case "query": {
        const list: Option[] = [{ kind: "search", id: "search" }];
        if (word) {
          for (const operator of operators) {
            if (operator.key.startsWith(word.word)) list.push({ kind: "operator", id: `operator-${operator.key}`, operator });
          }
        }
        return list;
      }
      default:
        return [];
    }
  }, [openMode, visibleRecents, token, word, operators]);

  const optionKey = options.map((o) => o.id).join("|");
  const showFooter = scopesEnabled && (openMode === "recents" || openMode === "idle");
  const panelOpen = mode !== "closed" && (options.length > 0 || showFooter || mode === "values");

  // Each opening replays the rows' stagger, even though the panel's content stayed mounted while closed.
  const [openings, setOpenings] = useState(0);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (panelOpen && !wasOpen.current) setOpenings((n) => n + 1);
    wasOpen.current = panelOpen;
  }, [panelOpen]);

  // Recents start with nothing active, so Enter on an empty field never reruns a search by surprise.
  // Every other list starts on its first row, which is what Enter and Tab pick.
  useEffect(() => {
    setActive(mode === "recents" ? -1 : options.length > 0 ? 0 : -1);
  }, [mode, optionKey, options.length]);

  // Report every change of text or scopes to the host. The callback is read through a ref, so a new
  // function from the host is never a reason to report again, and the first render (the defaults) is skipped.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const reported = useRef(false);
  useEffect(() => {
    if (!reported.current) {
      reported.current = true;
      return;
    }
    onChangeRef.current?.({ query, scopes });
  }, [query, scopes]);

  // Keep the caret in view when chips push the text past the edge.
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (row) row.scrollLeft = row.scrollWidth;
  }, [scopes]);

  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) return;
    setModKey("Ctrl");
  }, []);

  // ⌘K / Ctrl K focuses the field from anywhere on the page, which is the promise the keycap makes.
  useEffect(() => {
    if (!shortcutHint) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcutHint]);

  /** Puts the caret at the end after the text was replaced from code. */
  const caretToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  }, []);

  const addScope = (operator: ScopeOperator, value: ScopeValue) => {
    const replacing = scopes.some((s) => s.key === operator.key);
    setScopes((prev) => withScope(prev, { key: operator.key, value: value.id }));
    setAnnouncement(`${replacing ? "Changed" : "Added"} scope ${operator.key}: ${value.label}`);
  };

  const removeScope = (key: string) => {
    const resolved = resolveScope(operators, scopes.find((s) => s.key === key) ?? { key, value: "" });
    setScopes((prev) => prev.filter((s) => s.key !== key));
    setArmed(false);
    if (resolved) setAnnouncement(`Removed scope ${resolved.operator.key}: ${resolved.value.label}`);
    inputRef.current?.focus();
  };

  const submit = (value: ScopedSearchValue) => {
    onSubmit?.(value);
    setOpen(false);
    const summary = describeScopes(operators, value.scopes);
    setAnnouncement(`Searching ${value.query ? `for ${value.query}` : "everything"}${summary ? `, ${summary}` : ""}`);
  };

  const clear = () => {
    setQuery("");
    setScopes([]);
    setArmed(false);
    setOpen(true);
    setAnnouncement("Search cleared");
    inputRef.current?.focus();
  };

  const select = (option: Option) => {
    switch (option.kind) {
      case "value": {
        if (!token) return;
        setQuery(query.slice(0, token.start));
        addScope(option.operator, option.value);
        caretToEnd();
        return;
      }
      case "operator": {
        const base = word ? query.slice(0, word.start) : query;
        setQuery(`${base}${option.operator.key}:`);
        caretToEnd();
        return;
      }
      case "recent": {
        const known = (option.recent.scopes ?? []).filter((s) => resolveScope(operators, s));
        // With scopes off, a recent's scopes come back as the text they were typed as.
        const text = scopesEnabled
          ? option.recent.query
          : [...known.map((s) => `${s.key}:${s.value}`), option.recent.query].join(" ");
        const nextScopes = scopesEnabled ? known : [];
        setQuery(text);
        setScopes(nextScopes);
        caretToEnd();
        submit({ query: text, scopes: nextScopes });
        return;
      }
      case "search":
        submit({ query: query.trim(), scopes });
    }
  };

  /** Adds an operator from the footer: the text keeps what was typed and gains `key:` at its end. */
  const insertOperator = (operator: ScopeOperator) => {
    const base = query.length === 0 || /\s$/.test(query) ? query : `${query} `;
    setQuery(`${base}${operator.key}:`);
    setOpen(true);
    caretToEnd();
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    let next = event.target.value;
    setArmed(false);
    setOpen(true);
    // Resolve every completed token, including pasted queries; preserve unknown values as text.
    if (scopesEnabled && !(event.nativeEvent as InputEvent).isComposing) {
      let changed = false;
      next = next.replace(COMMIT_RE, (match, _space: string, key: string, partial: string) => {
        const operator = findOperator(operators, key);
        const value = operator ? exactValue(operator, partial) : undefined;
        if (!operator || !value) return match;
        changed = true;
        addScope(operator, value);
        return "";
      });
      if (changed) next = next.trimStart();
    }
    setQuery(next);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    const input = event.currentTarget;
    const atStart = input.selectionStart === 0 && input.selectionEnd === 0;

    if (event.key === "Backspace" && atStart && scopes.length > 0) {
      event.preventDefault();
      if (armed) removeScope(scopes[scopes.length - 1].key);
      else setArmed(true);
      return;
    }
    if (armed && event.key !== "Shift") setArmed(false);

    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        if (options.length === 0) return;
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((current) => (current < 0 ? (step > 0 ? 0 : options.length - 1) : (current + step + options.length) % options.length));
        return;
      }
      case "Tab": {
        const option = options[active];
        // Tab completes a scope or an operator; anywhere else it leaves the field as usual.
        if (option && (option.kind === "value" || option.kind === "operator")) {
          event.preventDefault();
          select(option);
        }
        return;
      }
      case "Enter": {
        event.preventDefault();
        const option = options[active];
        if (option) {
          select(option);
          return;
        }
        if (token) {
          const value = exactValue(token.operator, token.partial);
          if (value) {
            setQuery(query.slice(0, token.start));
            addScope(token.operator, value);
            return;
          }
        }
        submit({ query: query.trim(), scopes });
        return;
      }
      case "Escape": {
        if (panelOpen) {
          event.preventDefault();
          setOpen(false);
        } else if (hasContent) {
          event.preventDefault();
          clear();
          setOpen(false);
        }
        return;
      }
    }
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (rootRef.current?.contains(event.relatedTarget as Node | null)) return;
    setOpen(false);
    setArmed(false);
  };

  // A click anywhere on the field's padding or icon lands in the text, like a native input.
  const handleFieldMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button") || target === inputRef.current) return;
    event.preventDefault();
    inputRef.current?.focus();
    setOpen(true);
  };

  const cssVars = {
    "--iss-line": tone.line,
    "--iss-line-hover": tone.lineHover,
    "--iss-line-focus": tone.lineFocus,
    "--iss-lift": tone.lift,
    "--iss-halo": `color-mix(in srgb, ${ink} 14%, transparent)`,
    "--iss-ink": tone.ink,
    "--iss-faint": tone.faint,
    "--iss-chip-hover": tone.chipArmed,
  } as CSSProperties;

  const activeId = options[active] ? `${id}-${options[active].id}` : undefined;

  return (
    <>
      <style href="input-search-scoped-styles" precedence="default">
        {CSS}
      </style>
      <div
        ref={rootRef}
        onBlur={handleBlur}
        data-theme={theme}
        className={`@container relative w-full max-w-[600px] font-sans${className ? ` ${className}` : ""}`}
        style={cssVars}
      >
        {/* ---------------------------------------------------- field */}
        <div
          className="iss-field relative flex items-center"
          style={{ height: dims.height, borderRadius: dims.radius, background: tone.field, paddingInline: dims.pad }}
          onMouseDown={handleFieldMouseDown}
        >
          <Search aria-hidden="true" size={dims.icon} strokeWidth={1.8} className="shrink-0" style={{ color: tone.faint }} />

          <div ref={rowRef} className="iss-row ml-2.5 flex h-full min-w-0 flex-1 items-center overflow-x-auto">
            <div role="list" aria-label="Scopes" className="flex shrink-0 items-center">
              <AnimatePresence initial={false} mode="popLayout">
                {scopes.map((scope, index) => {
                  const resolved = resolveScope(operators, scope);
                  if (!resolved) return null;
                  const isArmed = armed && index === scopes.length - 1;
                  return (
                    <ScopeChip
                      key={scope.key}
                      operator={resolved.operator}
                      value={resolved.value}
                      armed={isArmed}
                      dims={dims}
                      tone={tone}
                      reduce={reduce}
                      onRemove={() => removeScope(scope.key)}
                    />
                  );
                })}
              </AnimatePresence>
            </div>
            <input
              ref={inputRef}
              data-demo="field"
              type="text"
              role="combobox"
              aria-label={label}
              aria-expanded={panelOpen}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={panelOpen ? activeId : undefined}
              aria-keyshortcuts={shortcutHint ? "Meta+K Control+K" : undefined}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="search"
              inputMode="search"
              className="iss-input h-full min-w-[9ch] flex-1 bg-transparent outline-none"
              style={{ fontSize: dims.text, color: tone.ink, caretColor: ink, letterSpacing: "-0.005em" }}
              placeholder={scopes.length > 0 ? "" : placeholder}
              value={query}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setOpen(true)}
              onClick={() => setOpen(true)}
            />
          </div>

          <ClearMorph
            hasContent={hasContent}
            shortcutHint={shortcutHint}
            modKey={modKey}
            tone={tone}
            reduce={reduce}
            onClear={clear}
          />
        </div>

        {/* ---------------------------------------------------- panel */}
        <SuggestionPanel
          open={panelOpen}
          mode={openMode}
          openings={openings}
          listId={listId}
          baseId={id}
          options={options}
          active={active}
          setActive={setActive}
          onSelect={select}
          token={token}
          query={query}
          scopes={scopes}
          operators={operators}
          showFooter={showFooter}
          onOperator={insertOperator}
          scopesEnabled={scopesEnabled}
          dims={dims}
          tone={tone}
          ink={ink}
          reduce={reduce}
        />

        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Chip                                                                */
/* ------------------------------------------------------------------ */

function ScopeChip({
  operator,
  value,
  armed,
  dims,
  tone,
  reduce,
  onRemove,
}: {
  operator: ScopeOperator;
  value: ScopeValue;
  armed: boolean;
  dims: Dims;
  tone: Tone;
  reduce: boolean;
  onRemove: () => void;
}) {
  const name = value.chip ?? value.label;
  return (
    <motion.div
      role="listitem"
      layout={!reduce}
      data-demo={`chip-${operator.key}`}
      className="mr-1.5 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[7px] pl-2 pr-1"
      style={{ height: dims.chip, fontSize: dims.chipText, color: tone.ink }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.88, filter: "blur(4px)" }}
      animate={{
        opacity: 1,
        scale: 1,
        filter: "blur(0px)",
        backgroundColor: armed ? tone.chipArmed : tone.chip,
        boxShadow: `inset 0 0 0 1px ${armed ? tone.lineFocus : tone.chipLine}`,
      }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.88, filter: "blur(4px)" }}
      transition={reduce ? { duration: FADE_S } : { duration: 0.22, ease: EASE, layout: SPRING_UI }}
    >
      <span className="font-mono text-[11px] leading-none" style={{ color: tone.faint }}>
        {operator.key}
      </span>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value.id}
          className="inline-flex items-center gap-1.5 leading-none"
          style={{ color: tone.ink }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 5, filter: "blur(3px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -5, filter: "blur(3px)" }}
          transition={{ duration: reduce ? FADE_S : 0.2, ease: EASE }}
        >
          <span className="grid place-items-center" style={{ color: tone.muted }}>
            <ValueGlyph value={value} size={value.initials ? dims.chip - 10 : dims.chip - 6} tone={tone} />
          </span>
          {name}
        </motion.span>
      </AnimatePresence>
      <button
        type="button"
        aria-label={`Remove scope ${operator.key}: ${value.label}`}
        className="iss-focus iss-hit iss-x grid size-[18px] place-items-center rounded-[5px] transition-colors duration-150 active:scale-90"
        style={{ color: tone.muted }}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onRemove}
      >
        <X aria-hidden="true" size={12} strokeWidth={2} />
      </button>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* ⌘K hint that morphs into the clear button                           */
/* ------------------------------------------------------------------ */

function ClearMorph({
  hasContent,
  shortcutHint,
  modKey,
  tone,
  reduce,
  onClear,
}: {
  hasContent: boolean;
  shortcutHint: boolean;
  modKey: string;
  tone: Tone;
  reduce: boolean;
  onClear: () => void;
}) {
  const state = hasContent ? "clear" : shortcutHint ? "hint" : "none";
  // One box changes shape: a keycap at rest, a round clear button once there is something to clear.
  const shape =
    state === "clear"
      ? { width: CLEAR.size, height: CLEAR.size, borderRadius: CLEAR.size / 2, opacity: 1, scale: 1, backgroundColor: tone.chip, marginLeft: 10 }
      : state === "hint"
        ? { width: modKey === "⌘" ? 38 : 52, height: KEYCAP.height, borderRadius: KEYCAP.radius, opacity: 1, scale: 1, backgroundColor: tone.key, marginLeft: 10 }
        : { width: 0, height: KEYCAP.height, borderRadius: KEYCAP.radius, opacity: 0, scale: 0.6, backgroundColor: tone.key, marginLeft: 0 };
  const swapIn = reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(3px)" };
  const swapOut = reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(3px)" };

  return (
    <motion.button
      type="button"
      data-demo="clear"
      aria-label={state === "clear" ? "Clear search" : undefined}
      aria-hidden={state === "clear" ? undefined : true}
      tabIndex={state === "clear" ? 0 : -1}
      disabled={state === "none"}
      className="iss-focus relative grid shrink-0 place-items-center overflow-hidden active:scale-95"
      style={{ boxShadow: `inset 0 0 0 1px ${state === "clear" ? tone.chipLine : tone.keyLine}`, color: tone.muted, cursor: state === "clear" ? "pointer" : "text" }}
      initial={false}
      animate={shape}
      whileHover={state === "clear" && !reduce ? { backgroundColor: tone.chipArmed } : undefined}
      transition={reduce ? { duration: FADE_S } : { duration: 0.3, ease: [0.65, 0, 0.35, 1] }}
      onMouseDown={(event) => event.preventDefault()}
      onClick={state === "clear" ? onClear : undefined}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {state === "clear" && (
          <motion.span key="x" className="grid place-items-center" initial={swapIn} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} exit={swapOut} transition={{ duration: 0.2, ease: EASE }}>
            <X aria-hidden="true" size={14} strokeWidth={2} style={{ color: tone.ink }} />
          </motion.span>
        )}
        {state === "hint" && (
          <motion.span
            key="hint"
            className="flex items-center gap-[3px] whitespace-nowrap font-mono text-[11.5px] leading-none"
            initial={swapIn}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={swapOut}
            transition={{ duration: 0.2, ease: EASE }}
          >
            <span>{modKey}</span>
            <span>K</span>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* Suggestions                                                         */
/* ------------------------------------------------------------------ */

type PanelProps = {
  open: boolean;
  mode: Mode;
  /** Bumped on every opening, to replay the rows' entrance. */
  openings: number;
  listId: string;
  baseId: string;
  options: Option[];
  active: number;
  setActive: (index: number) => void;
  onSelect: (option: Option) => void;
  token: ReturnType<typeof readToken>;
  query: string;
  scopes: ScopeToken[];
  operators: ScopeOperator[];
  showFooter: boolean;
  onOperator: (operator: ScopeOperator) => void;
  scopesEnabled: boolean;
  dims: Dims;
  tone: Tone;
  ink: string;
  reduce: boolean;
};

const HEADINGS: Record<Exclude<Mode, "closed">, { title: string; keys: string }> = {
  recents: { title: "Recent searches", keys: "↵ to search again" },
  idle: { title: "Narrow your search", keys: "" },
  values: { title: "", keys: "Tab to add" },
  query: { title: "Search", keys: "↵ to search" },
};

function SuggestionPanel(props: PanelProps) {
  const { open, mode, openings, listId, options, showFooter, operators, onOperator, token, tone, reduce } = props;
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number | "auto">("auto");

  // The panel follows its content's height, so swapping lists glides instead of snapping.
  useLayoutEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    const measure = () => setHeight(node.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const shownMode = mode === "closed" ? "recents" : mode;
  const heading = HEADINGS[shownMode];
  const title = shownMode === "values" && token ? token.operator.label : heading.title;

  return (
    <motion.div
      aria-hidden={!open || undefined}
      inert={!open}
      className="absolute inset-x-0 top-full z-20 mt-2 origin-top overflow-hidden rounded-[14px]"
      style={{ background: tone.panel, boxShadow: `inset 0 0 0 1px ${tone.panelLine}, ${tone.panelShadow}`, pointerEvents: open ? "auto" : "none" }}
      initial={false}
      animate={
        open
          ? { opacity: 1, y: 0, scale: 1, height }
          : reduce
            ? { opacity: 0, height }
            : { opacity: 0, y: -6, scale: 0.985, height }
      }
      transition={
        reduce
          ? { duration: FADE_S }
          : { duration: open ? PANEL_S : PANEL_S * 0.66, ease: open ? EASE : [0.4, 0, 1, 1], height: { duration: 0.28, ease: EASE } }
      }
    >
      <div ref={contentRef}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={`${openings}-${shownMode === "values" && token ? `values-${token.operator.key}` : shownMode}`}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, transition: { duration: 0.12, ease: [0.4, 0, 1, 1] } }}
            transition={{ duration: reduce ? FADE_S : 0.2, ease: EASE }}
          >
            {title && (
              <div className="flex items-center justify-between gap-3 px-3.5 pb-1.5 pt-3">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.08em]" style={{ color: tone.faint }}>
                  {title}
                </span>
                {heading.keys && options.length > 0 && (
                  <span className="hidden font-mono text-[10.5px] tracking-[0.02em] @md:inline" style={{ color: tone.faint }}>
                    {heading.keys}
                  </span>
                )}
              </div>
            )}

            <div role="listbox" id={listId} aria-label={title || "Suggestions"} className="px-1.5 pb-1.5" style={{ paddingTop: title ? 0 : 6 }}>
              {options.map((option, index) => (
                <OptionRow key={option.id} option={option} index={index} {...props} />
              ))}
            </div>

            {mode === "values" && token && options.length === 0 && (
              <p className="px-3.5 pb-3.5 pt-0.5 text-[13.5px] leading-[1.5]" style={{ color: tone.muted }}>
                Nothing in <span className="font-mono" style={{ color: tone.body }}>{token.operator.key}:</span> starts with “
                <span style={{ color: tone.ink }}>{token.partial}</span>”. It will be searched as plain text.
              </p>
            )}

            {showFooter && (
              <div
                className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3.5 py-2.5"
                style={{ boxShadow: options.length > 0 ? `inset 0 1px 0 ${tone.panelLine}` : undefined }}
              >
                <span className="mr-1 text-[12.5px]" style={{ color: tone.muted }}>
                  Narrow with
                </span>
                {operators.map((operator) => (
                  <OperatorButton key={operator.key} operator={operator} tone={tone} onPick={() => onOperator(operator)} />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function OperatorButton({ operator, tone, onPick }: { operator: ScopeOperator; tone: Tone; onPick: () => void }) {
  return (
    <button
      type="button"
      data-demo={`operator-${operator.key}`}
      aria-label={`Add ${operator.key}: scope, ${operator.hint}`}
      className="iss-focus iss-hit h-7 rounded-[6px] px-2 font-mono text-[12px] transition-[background-color,color,transform] duration-150 active:scale-[0.97]"
      style={{ background: tone.key, boxShadow: `inset 0 0 0 1px ${tone.keyLine}`, color: tone.body }}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPick}
    >
      {operator.key}:
    </button>
  );
}

function OptionRow({
  option,
  index,
  baseId,
  active,
  setActive,
  onSelect,
  token,
  query,
  scopes,
  operators,
  scopesEnabled,
  dims,
  tone,
  ink,
  reduce,
}: PanelProps & { option: Option; index: number }) {
  const isActive = index === active;
  const delay = reduce ? 0 : Math.min(index, STAGGER_CAP) * ROW_STAGGER_S;

  return (
    <motion.div
      id={`${baseId}-${option.id}`}
      role="option"
      aria-selected={isActive}
      data-demo={option.kind === "value" ? `scope-${option.value.id}` : option.id}
      layout={reduce ? false : "position"}
      className="relative flex cursor-pointer items-center gap-3 rounded-[9px] px-2.5"
      style={{ minHeight: dims.row, fontSize: dims.rowText }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? FADE_S : 0.24, ease: EASE, delay, layout: SPRING_UI }}
      onMouseDown={(event) => event.preventDefault()}
      onMouseMove={() => !isActive && setActive(index)}
      onClick={() => onSelect(option)}
    >
      {isActive && (
        <motion.span
          layoutId={`${baseId}-active`}
          aria-hidden="true"
          className="absolute inset-0 rounded-[9px]"
          style={{ background: tone.rowActive }}
          transition={reduce ? { duration: 0 } : SPRING_UI}
        />
      )}
      <span className="relative flex min-w-0 flex-1 items-center gap-3">
        <RowBody option={option} token={token} query={query} scopes={scopes} operators={operators} scopesEnabled={scopesEnabled} tone={tone} ink={ink} />
      </span>
      <span className="relative flex shrink-0 items-center gap-2">
        <RowMeta option={option} tone={tone} />
        <span className="grid w-[22px] place-items-center" aria-hidden="true">
          {isActive && (
            <span className="grid place-items-center" style={{ color: ink }}>
              {option.kind === "value" || option.kind === "operator" ? (
                <Keycap tone={tone} accent={ink}>
                  ⇥
                </Keycap>
              ) : (
                <CornerDownLeft size={15} strokeWidth={1.8} />
              )}
            </span>
          )}
        </span>
      </span>
    </motion.div>
  );
}

function Tile({ children, tone }: { children: ReactNode; tone: Tone }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-[26px] shrink-0 place-items-center rounded-[7px]"
      style={{ background: tone.tile, boxShadow: `inset 0 0 0 1px ${tone.chipLine}`, color: tone.muted }}
    >
      {children}
    </span>
  );
}

function RowBody({
  option,
  token,
  query,
  scopes,
  operators,
  scopesEnabled,
  tone,
  ink,
}: {
  option: Option;
  token: ReturnType<typeof readToken>;
  query: string;
  scopes: ScopeToken[];
  operators: ScopeOperator[];
  scopesEnabled: boolean;
  tone: Tone;
  ink: string;
}) {
  switch (option.kind) {
    case "recent": {
      const resolved = (option.recent.scopes ?? []).map((s) => resolveScope(operators, s)).filter((r): r is NonNullable<typeof r> => r !== null);
      return (
        <>
          <Tile tone={tone}>
            <History size={14} strokeWidth={1.8} />
          </Tile>
          <span className="flex min-w-0 items-center gap-1.5">
            {scopesEnabled
              ? resolved.map(({ operator, value }) => <MiniChip key={operator.key} operator={operator} value={value} tone={tone} />)
              : resolved.map(({ operator, value }) => (
                  <span key={operator.key} className="shrink-0 font-mono text-[12.5px]" style={{ color: tone.muted }}>
                    {operator.key}:{value.id}
                  </span>
                ))}
            <span className="truncate" style={{ color: tone.ink }}>
              {option.recent.query}
            </span>
          </span>
        </>
      );
    }
    case "value": {
      const partial = token?.partial ?? "";
      return (
        <>
          {option.value.initials ? (
            <Initials text={option.value.initials} size={26} tone={tone} />
          ) : (
            <Tile tone={tone}>
              <ValueGlyph value={option.value} size={22} tone={tone} />
            </Tile>
          )}
          <span className="flex min-w-0 items-baseline gap-2.5">
            <span className="shrink-0" style={{ color: tone.body }}>
              <Highlight text={option.value.label} query={partial} color={ink} />
            </span>
            {option.value.detail && (
              <span className="hidden truncate text-[13px] @sm:inline" style={{ color: tone.faint }}>
                {option.value.detail}
              </span>
            )}
          </span>
        </>
      );
    }
    case "operator":
      return (
        <>
          <Tile tone={tone}>
            <span className="font-mono text-[11px]" style={{ color: tone.body }}>
              {option.operator.key}:
            </span>
          </Tile>
          <span className="min-w-0 truncate" style={{ color: tone.body }}>
            Narrow to {option.operator.hint}
          </span>
        </>
      );
    case "search": {
      const summary = describeScopes(operators, scopes);
      const text = query.trim();
      return (
        <>
          <Tile tone={tone}>
            <Search size={14} strokeWidth={1.8} />
          </Tile>
          <span className="flex min-w-0 items-baseline gap-2.5">
            <span className="min-w-0 truncate" style={{ color: tone.ink }}>
              {text ? (
                <>
                  Search for “<span className="font-medium">{text}</span>”
                </>
              ) : (
                "Search everything"
              )}
            </span>
            {summary && (
              <span className="hidden shrink-0 text-[13px] @sm:inline" style={{ color: tone.faint }}>
                {summary}
              </span>
            )}
          </span>
        </>
      );
    }
  }
}

function RowMeta({ option, tone }: { option: Option; tone: Tone }) {
  const text =
    option.kind === "recent"
      ? option.recent.when
      : option.kind === "value"
        ? typeof option.value.meta === "number"
          ? countFormat.format(option.value.meta)
          : option.value.meta
        : undefined;
  if (!text) return null;
  return (
    <span className="font-mono text-[11.5px] tabular-nums" style={{ color: tone.faint }}>
      {text}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                */
/* ------------------------------------------------------------------ */

/** Most recent first, without repeats, at most this many. */
const MAX_RECENTS = 5;
/** Room the stage leaves under the field for the suggestions, so they never cover the legend. */
const PANEL_ROOM = 312;

/** A quiet legend under the panel's room: the grammar in four keys. It follows the controls. */
function StageLegend({ tone, shortcutHint, scopes }: { tone: Tone; shortcutHint: boolean; scopes: boolean }) {
  const items = [
    shortcutHint ? { key: "⌘K", text: "focus" } : null,
    scopes ? { key: "in:", text: "narrow" } : null,
    scopes ? { key: "Tab", text: "complete" } : null,
    { key: "Esc", text: "close" },
  ].filter((item): item is { key: string; text: string } => item !== null);
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-mono text-[11.5px]" style={{ color: tone.faint }}>
      {items.map((item) => (
        <span key={item.key} className="inline-flex items-center gap-1.5">
          <kbd
            className="inline-grid h-[20px] min-w-[20px] place-items-center rounded-[5px] px-1.5 font-mono text-[11px] leading-none"
            style={{ background: tone.key, boxShadow: `inset 0 0 0 1px ${tone.keyLine}`, color: tone.body }}
          >
            {item.key}
          </kbd>
          {item.text}
        </span>
      ))}
    </p>
  );
}

/**
 * The field on a quiet stage, sitting high so its suggestions open into the room below it, with a
 * small key legend underneath. A search that is run joins the recents, as it would in a host app.
 * Overrides are spread on the field.
 */
export default function ScopedSearchDemo(overrides: Partial<ScopedSearchProps> = {}) {
  const reduce = useReducedMotion() ?? false;
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(DEFAULT_RECENTS);
  const tone = TONES[overrides.theme ?? "dark"];

  const remember = ({ query, scopes }: ScopedSearchValue) => {
    if (!query && scopes.length === 0) return;
    const same = (r: RecentSearch) => r.query === query && JSON.stringify(r.scopes ?? []) === JSON.stringify(scopes);
    setRecentSearches((prev) => [{ id: `r${Date.now()}`, query, scopes, when: "Now" }, ...prev.filter((r) => !same(r))].slice(0, MAX_RECENTS));
  };

  return (
    <div className="flex min-h-dvh w-full justify-center px-4 pb-16 pt-[clamp(56px,14vh,120px)] sm:px-8" style={{ background: tone.stage }}>
      <motion.div
        className="flex w-full max-w-[600px] flex-col"
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <ScopedSearch recentSearches={recentSearches} onSubmit={remember} {...overrides} />
        <div style={{ marginTop: PANEL_ROOM }}>
          <StageLegend tone={tone} shortcutHint={overrides.shortcutHint ?? true} scopes={overrides.scopes ?? true} />
        </div>
      </motion.div>
    </div>
  );
}
