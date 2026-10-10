"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { ChevronDown, Search } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type SelectOption = {
  value: string;
  label: string;
  /** Heading the option sits under when `grouped` is on. */
  group?: string;
  /** Mono text at the end of the row and on the trigger, such as a time zone. */
  hint?: string;
};

export type SelectSize = "sm" | "md";
export type SelectPlacement = "auto" | "top" | "bottom";

export type SelectListboxProps = {
  options?: SelectOption[];
  /** Controlled value. Leave out to let the component keep its own. */
  value?: string;
  /** Value on first render when uncontrolled. Defaults to the first option. */
  defaultValue?: string;
  onValueChange?: (value: string, option: SelectOption) => void;
  /** Mono label above the trigger, and the accessible name of the list. */
  label?: string;
  placeholder?: string;
  /** Placeholder of the filter field when `searchable` is on. */
  searchPlaceholder?: string;
  size?: SelectSize;
  /** Puts options under their `group` headings, in first-seen order. */
  grouped?: boolean;
  /** Adds a filter field at the top of the panel. */
  searchable?: boolean;
  disabled?: boolean;
  /** Where the panel opens. `auto` flips it upward when the trigger sits near the bottom of the viewport. */
  placement?: SelectPlacement;
  /** Opens the panel on first render without moving focus into it. */
  defaultOpen?: boolean;
  /** The one colour: the check on the chosen row. Defaults to the theme's accent in `PALETTE`. */
  accent?: string;
  theme?: "dark" | "light";
  className?: string;
};

type Side = "top" | "bottom";
type Section = { heading?: string; options: SelectOption[] };

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const EASE = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;

/** Space between the trigger and the panel, in px. Matches the panel's `mt-1.5` / `mb-1.5`. */
const PANEL_GAP = 6;
/** Least clearance kept between the panel and the viewport edge when choosing a side. */
const VIEWPORT_EDGE = 12;
// 320 lands the fold mid-row (Mexico City is half visible), so the cut reads as scrollable.
const LIST_MAX_PX = 320;
const LIST_PADDING_PX = 12;
const SEARCH_ROW_PX = 44;
const HEADING_PX = 30;
/** The hairline and padding above every group after the first (`mt-1 border-t pt-1`). */
const GROUP_DIVIDER_PX = 9;
const EMPTY_PX = 64;
/** A pause longer than this starts a new typeahead search. */
const TYPEAHEAD_RESET_MS = 600;
const PAGE_STEP = 5;
/**
 * After a pointer or keyboard choice from the open panel, the panel stays open
 * this long, so the check draws on the row just chosen (its draw is 320ms after
 * a 40ms delay) before the panel folds away.
 */
const COMMIT_HOLD_MS = 300;
/** Soft bottom edge on the list while more rows lie below the fold. */
const FADE_MASK = "linear-gradient(to bottom, black calc(100% - 32px), transparent)";

// Small sizes keep 36px and 32px on fine pointers; coarse pointers get the 44px touch floor.
const SIZE = {
  sm: {
    field: "h-9 px-3 text-[13px] gap-2.5 [@media(pointer:coarse)]:h-11",
    row: "h-8 text-[13px] [@media(pointer:coarse)]:h-11",
    rowPx: 32,
    hint: "text-[11px]",
  },
  // 44px rows match the 44px trigger and the touch-target floor at every pointer.
  md: { field: "h-11 px-3.5 text-[14px] gap-3", row: "h-11 text-[14px]", rowPx: 44, hint: "text-[11.5px]" },
} as const;

/** Container query: below this width the time-zone hints step aside so the names keep room. */
const HINT_HIDE = "@max-[14rem]:hidden";

const PALETTE = {
  dark: {
    field: "#141416",
    fieldHover: "#1a1a1d",
    panel: "#111113",
    ink: "#f4f4f5",
    body: "#c4c4ca",
    hint: "#8a8a93",
    line: "rgba(255,255,255,0.08)",
    highlight: "rgba(255,255,255,0.07)",
    shadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 28px 60px -20px rgba(0,0,0,0.9), 0 4px 12px -4px rgba(0,0,0,0.6)",
    // Mint on near-black clears the 3:1 non-text floor by a wide margin.
    accent: "#7dd3a8",
  },
  light: {
    field: "#ffffff",
    fieldHover: "#fafafa",
    panel: "#ffffff",
    ink: "#18181b",
    body: "#3f3f46",
    hint: "#6b6b74",
    line: "rgba(24,24,27,0.1)",
    highlight: "rgba(24,24,27,0.05)",
    shadow: "0 24px 48px -18px rgba(24,24,27,0.28), 0 2px 6px -2px rgba(24,24,27,0.12)",
    // Mint is about 1.7:1 on white; this deeper green is about 3.4:1, the 3:1 non-text floor.
    accent: "#1f9d6b",
  },
} as const;

const CITIES: SelectOption[] = [
  { value: "berlin", label: "Berlin", group: "Europe", hint: "CET" },
  { value: "lisbon", label: "Lisbon", group: "Europe", hint: "WET" },
  { value: "london", label: "London", group: "Europe", hint: "GMT" },
  { value: "madrid", label: "Madrid", group: "Europe", hint: "CET" },
  { value: "austin", label: "Austin", group: "Americas", hint: "CST" },
  { value: "mexico", label: "Mexico City", group: "Americas", hint: "CST" },
  { value: "toronto", label: "Toronto", group: "Americas", hint: "EST" },
  { value: "kyoto", label: "Kyoto", group: "Asia-Pacific", hint: "JST" },
  { value: "seoul", label: "Seoul", group: "Asia-Pacific", hint: "KST" },
  { value: "sydney", label: "Sydney", group: "Asia-Pacific", hint: "AEST" },
];

/* ------------------------------------------------------------------ */
/* Motion                                                              */
/* ------------------------------------------------------------------ */

/** Entrance for the whole block: one rise out of a soft blur, once on mount. */
const reveal = (reduce: boolean): Variants =>
  reduce
    ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.15 } } }
    : {
        hidden: { opacity: 0, y: 8, filter: "blur(6px)" },
        show: {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          transitionEnd: { filter: "none" },
          transition: { duration: 0.5, ease: EASE, delay: 0.05 },
        },
      };

/** The trigger's value cross-fades on change: a 4px rise and a blur that clears. */
const valueSwap = (reduce: boolean): Variants =>
  reduce
    ? {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { duration: 0.12 } },
        exit: { opacity: 0, transition: { duration: 0.08 } },
      }
    : {
        hidden: { opacity: 0, y: 6, filter: "blur(3px)" },
        show: { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" }, transition: { duration: 0.28, ease: EASE } },
        exit: { opacity: 0, y: -6, filter: "blur(3px)", transition: { duration: 0.16, ease: EASE_IN } },
      };

/** The panel unfolds from the edge that touches the trigger. */
const panelMotion = (reduce: boolean, side: Side): Variants => {
  if (reduce) {
    return {
      hidden: { opacity: 0 },
      show: { opacity: 1, transition: { duration: 0.15 } },
      exit: { opacity: 0, transition: { duration: 0.1 } },
    };
  }
  const drift = side === "bottom" ? -6 : 6;
  return {
    hidden: { opacity: 0, scaleY: 0.9, y: drift, filter: "blur(4px)" },
    show: {
      opacity: 1,
      scaleY: 1,
      y: 0,
      filter: "blur(0px)",
      transitionEnd: { filter: "none" },
      transition: { duration: 0.26, ease: EASE },
    },
    exit: { opacity: 0, scaleY: 0.94, y: drift / 2, filter: "blur(3px)", transition: { duration: 0.14, ease: EASE_IN } },
  };
};

/* ------------------------------------------------------------------ */
/* Pure helpers                                                        */
/* ------------------------------------------------------------------ */

/** Groups the options (or keeps them flat) and applies the filter. `flat` is the order the keyboard walks. */
function arrange(options: SelectOption[], grouped: boolean, query: string) {
  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const buckets = new Map<string, SelectOption[]>();
  for (const option of shown) {
    const key = grouped ? (option.group ?? "") : "";
    const bucket = buckets.get(key);
    if (bucket) bucket.push(option);
    else buckets.set(key, [option]);
  }
  const sections: Section[] = [...buckets].map(([key, items]) => ({ heading: key || undefined, options: items }));
  return { sections, flat: sections.flatMap((s) => s.options) };
}

/**
 * The next option whose label starts with what was typed. A single letter
 * searches from the row after the current one, so repeating it cycles through
 * the matches; a longer run stays on the first match from the current row.
 */
function matchTyped(list: SelectOption[], typed: string, from: string | null): SelectOption | undefined {
  if (!list.length) return undefined;
  const needle = typed.toLowerCase();
  const start = Math.max(0, list.findIndex((o) => o.value === from));
  const cycling = typed.length === 1 || /^(.)\1+$/.test(needle);
  for (let i = 0; i < list.length; i++) {
    const option = list[(start + (cycling ? 1 : 0) + i) % list.length];
    if (option.label.toLowerCase().startsWith(needle)) return option;
  }
  return undefined;
}

/** Above or below the trigger: `auto` takes the side with room, preferring below. */
function pickSide(trigger: HTMLElement | null, panelPx: number): Side {
  if (!trigger) return "bottom";
  const r = trigger.getBoundingClientRect();
  const need = panelPx + PANEL_GAP + VIEWPORT_EDGE;
  const below = window.innerHeight - r.bottom;
  const above = r.top;
  if (below >= need) return "bottom";
  if (above >= need) return "top";
  return above > below ? "top" : "bottom";
}

const isTypeable = (e: ReactKeyboardEvent) => e.key.length === 1 && e.key !== " " && !e.metaKey && !e.ctrlKey && !e.altKey;
const optionDomId = (uid: string, value: string) => `${uid}-option-${value.replace(/[^\w-]/g, "_")}`;

/* ------------------------------------------------------------------ */
/* Parts                                                               */
/* ------------------------------------------------------------------ */

/** Mounts with the selection, so it draws each time the chosen row changes. */
function CheckMark({ reduce }: { reduce: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} fill="none" aria-hidden="true" className="text-(--sl-accent)">
      <motion.path
        d="M3.25 8.5 6.5 11.75 12.75 4.75"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.32, ease: EASE, delay: 0.04 }}
      />
    </svg>
  );
}

type OptionRowProps = {
  option: SelectOption;
  id: string;
  /** Shared by every row of one open session, so the highlight glides within it and starts fresh on the next. */
  highlightId: string;
  active: boolean;
  selected: boolean;
  size: SelectSize;
  reduce: boolean;
  onHover: () => void;
  onPick: () => void;
};

function OptionRow({ option, id, highlightId, active, selected, size, reduce, onHover, onPick }: OptionRowProps) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      data-demo={`opt-${option.value}`}
      onPointerMove={onHover}
      // Keep focus where it is: the trigger or the filter field owns the keyboard.
      onPointerDown={(e) => e.preventDefault()}
      onClick={onPick}
      className={`group relative flex cursor-pointer select-none items-center rounded-[8px] px-2.5 ${SIZE[size].row} ${
        active ? "text-(--sl-ink)" : "text-(--sl-body)"
      }`}
    >
      {active ? (
        <motion.span
          layoutId={highlightId}
          aria-hidden="true"
          transition={reduce ? { duration: 0 } : SPRING_UI}
          className="absolute inset-0 rounded-[8px] bg-(--sl-highlight)"
        />
      ) : null}
      {/* The content takes the press, not the highlight, so the glide stays clean under a pressed row. */}
      <span className="relative flex min-w-0 flex-1 items-center gap-3 transition-transform duration-[90ms] ease-out group-active:scale-[0.98] motion-reduce:transition-none motion-reduce:group-active:scale-100">
        <span className="min-w-0 flex-1 truncate">{option.label}</span>
        {option.hint ? (
          <span className={`shrink-0 font-mono tabular-nums text-(--sl-hint) ${SIZE[size].hint} ${HINT_HIDE}`}>{option.hint}</span>
        ) : null}
        <span className="grid size-4 shrink-0 place-items-center">{selected ? <CheckMark reduce={reduce} /> : null}</span>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function SelectListbox({
  options = CITIES,
  value,
  defaultValue,
  onValueChange,
  label = "City",
  placeholder = "Choose a city",
  searchPlaceholder = "Search cities",
  size = "md",
  grouped = true,
  searchable = false,
  disabled = false,
  placement = "auto",
  defaultOpen = false,
  accent,
  theme = "dark",
  className = "",
}: SelectListboxProps) {
  const reduce = !!useReducedMotion();
  const uid = useId();
  const labelId = `${uid}-label`;
  const valueId = `${uid}-value`;
  const listId = `${uid}-list`;

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const focusSearchOnOpen = useRef(false);
  const typed = useRef({ text: "", at: 0 });
  // A choice is on screen and the panel is about to close: input waits until it does.
  const committing = useRef(false);
  const closeTimer = useRef<number | null>(null);

  const [internal, setInternal] = useState(() => defaultValue ?? options[0]?.value ?? "");
  const selectedValue = value ?? internal;
  const selected = options.find((o) => o.value === selectedValue);

  const [open, setOpen] = useState(defaultOpen && !disabled);
  // Counts each opening so the highlight's shared layout id is new every time the panel unfolds.
  const [openCount, setOpenCount] = useState(0);
  const [query, setQuery] = useState("");
  const [activeValue, setActiveValue] = useState<string | null>(() =>
    options.some((o) => o.value === selectedValue) ? selectedValue : (options[0]?.value ?? null),
  );
  const [autoSide, setAutoSide] = useState<Side>("bottom");
  const [overflowBelow, setOverflowBelow] = useState(false);

  const { sections, flat } = useMemo(() => arrange(options, grouped, query), [options, grouped, query]);
  const active = flat.find((o) => o.value === activeValue) ?? flat[0] ?? null;
  const activeKey = active?.value ?? null;
  const activeIndex = active ? flat.indexOf(active) : -1;
  const hasRows = flat.length > 0;
  const side: Side = placement === "auto" ? autoSide : placement;

  // The panel's height is known from its rows, so the side can be chosen before it is painted.
  const headings = sections.filter((s) => s.heading).length;
  const dividers = sections.filter((s, i) => s.heading && i > 0).length;
  const rowsPx = flat.length * SIZE[size].rowPx + headings * HEADING_PX + dividers * GROUP_DIVIDER_PX + LIST_PADDING_PX;
  const listPx = hasRows ? Math.min(LIST_MAX_PX, rowsPx) : EMPTY_PX;
  const panelPx = listPx + (searchable ? SEARCH_ROW_PX : 0);

  const cancelPendingClose = useCallback(() => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  // A pending close must not outlive the component.
  useEffect(() => () => cancelPendingClose(), [cancelPendingClose]);

  const close = useCallback(
    (restoreFocus: boolean) => {
      cancelPendingClose();
      committing.current = false;
      setOpen(false);
      if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
    },
    [cancelPendingClose],
  );

  const show = () => {
    if (disabled) return;
    setQuery("");
    setActiveValue(options.some((o) => o.value === selectedValue) ? selectedValue : (options[0]?.value ?? null));
    focusSearchOnOpen.current = searchable;
    setOpenCount((n) => n + 1);
    setOpen(true);
  };

  /**
   * Chooses an option. From the open panel the choice is confirmed: the panel
   * holds so the check can draw, then closes. On the closed trigger (typeahead)
   * there is no panel to hold, so the value simply changes and typing carries on.
   */
  const commit = (option: SelectOption, fromPanel: boolean) => {
    if (committing.current) return;
    if (value === undefined) setInternal(option.value);
    setActiveValue(option.value);
    onValueChange?.(option.value, option);
    if (!fromPanel) return;
    if (reduce) {
      close(true);
      return;
    }
    // The value swaps at once; the panel holds open so the check draws on the chosen row, then closes.
    committing.current = true;
    closeTimer.current = window.setTimeout(() => close(true), COMMIT_HOLD_MS);
  };

  const typeTo = (char: string, list: SelectOption[], from: string | null) => {
    const now = performance.now();
    const t = typed.current;
    t.text = now - t.at > TYPEAHEAD_RESET_MS ? char : t.text + char;
    t.at = now;
    return matchTyped(list, t.text, from);
  };

  // Keyboard model: the trigger keeps focus while the panel is open (or the filter field, when searchable).
  const onKey = (e: ReactKeyboardEvent<HTMLElement>, fromSearch: boolean) => {
    // Only Tab gets through while a choice is being confirmed: it closes the panel at once.
    if (committing.current && e.key !== "Tab") {
      e.preventDefault();
      return;
    }

    const last = flat.length - 1;
    const goTo = (index: number) => {
      e.preventDefault();
      const next = flat[Math.min(last, Math.max(0, index))];
      if (next) setActiveValue(next.value);
    };

    if (!open) {
      if (fromSearch) return;
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        show();
        return;
      }
      // Typing on a closed select chooses the match straight away, as the native control does.
      if (isTypeable(e)) {
        const hit = typeTo(e.key, flat, selectedValue);
        if (hit) commit(hit, false);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        return goTo(activeIndex + 1);
      case "ArrowUp":
        return goTo(activeIndex - 1);
      case "Home":
        if (!fromSearch) goTo(0);
        return;
      case "End":
        if (!fromSearch) goTo(last);
        return;
      case "PageDown":
        return goTo(activeIndex + PAGE_STEP);
      case "PageUp":
        return goTo(activeIndex - PAGE_STEP);
      case "Enter":
        e.preventDefault();
        if (active) commit(active, true);
        else close(true);
        return;
      case " ":
        if (fromSearch) return;
        e.preventDefault();
        if (active) commit(active, true);
        return;
      case "Escape":
        e.preventDefault();
        close(true);
        return;
      case "Tab":
        close(false);
        return;
      default:
        if (!fromSearch && isTypeable(e)) {
          const hit = typeTo(e.key, flat, activeKey);
          if (hit) setActiveValue(hit.value);
        }
    }
  };

  // Whether the list has rows below the fold, so its bottom edge can fade to say so.
  const syncOverflow = useCallback(() => {
    const list = listRef.current;
    setOverflowBelow(!!list && list.scrollTop + list.clientHeight < list.scrollHeight - 2);
  }, []);

  useLayoutEffect(() => {
    if (open) syncOverflow();
  }, [open, flat, listPx, syncOverflow]);

  // Choose a side on open and whenever the viewport changes, for `auto` only.
  useLayoutEffect(() => {
    if (!open || placement !== "auto") return;
    const update = () => setAutoSide(pickSide(triggerRef.current, panelPx));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [open, placement, panelPx]);

  // Keep the highlighted row inside the scrolling list.
  useEffect(() => {
    const list = listRef.current;
    const row = activeKey && list ? document.getElementById(optionDomId(uid, activeKey)) : null;
    if (!open || !list || !row) return;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }, [activeKey, open, uid]);

  // The filter field takes focus only when the user opens the panel, never on first render.
  useEffect(() => {
    if (open && focusSearchOnOpen.current) {
      focusSearchOnOpen.current = false;
      searchRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (disabled) close(false);
  }, [disabled, close]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, close]);

  const palette = PALETTE[theme];
  const vars = {
    "--sl-field": palette.field,
    "--sl-field-hover": palette.fieldHover,
    "--sl-panel": palette.panel,
    "--sl-ink": palette.ink,
    "--sl-body": palette.body,
    "--sl-hint": palette.hint,
    "--sl-line": palette.line,
    "--sl-highlight": palette.highlight,
    "--sl-shadow": palette.shadow,
    "--sl-accent": accent ?? palette.accent,
  } as CSSProperties;

  const highlightId = `${uid}-highlight-${openCount}`;
  const fade = overflowBelow ? { maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK } : undefined;

  return (
    <motion.div
      ref={rootRef}
      style={vars}
      variants={reveal(reduce)}
      initial="hidden"
      animate="show"
      className={`@container relative w-full max-w-[320px] text-(--sl-ink) ${className}`}
    >
      <span id={labelId} className="mb-2 block font-mono text-[11px] uppercase tracking-[0.12em] text-(--sl-hint)">
        {label}
      </span>

      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          // With a filter field the field is the combobox; the trigger is only the button that opens the popup.
          role={searchable ? "button" : "combobox"}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open && hasRows ? listId : undefined}
          aria-labelledby={`${labelId} ${valueId}`}
          aria-activedescendant={open && !searchable && active ? optionDomId(uid, active.value) : undefined}
          disabled={disabled}
          data-demo="trigger"
          onClick={() => {
            if (committing.current) return;
            if (open) close(true);
            else show();
          }}
          onKeyDown={(e) => onKey(e, false)}
          className={`group flex w-full items-center rounded-[10px] bg-(--sl-field) text-left ring-1 ring-inset transition-[background-color,box-shadow,scale] duration-150 ease-out hover:bg-(--sl-field-hover) active:scale-[0.985] active:duration-[90ms] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-(--sl-field) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--sl-ink)/60 ${
            SIZE[size].field
          } ${open ? "ring-(--sl-ink)/20" : "ring-(--sl-line)"}`}
        >
          <span id={valueId} className="relative min-w-0 flex-1 overflow-hidden">
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={selected?.value ?? "none"}
                variants={valueSwap(reduce)}
                initial="hidden"
                animate="show"
                exit="exit"
                className={`flex min-w-0 items-baseline gap-2 ${selected ? "text-(--sl-ink)" : "text-(--sl-hint)"}`}
              >
                <span className="truncate">{selected ? selected.label : placeholder}</span>
                {selected?.hint ? (
                  <span className={`shrink-0 font-mono tabular-nums text-(--sl-hint) ${SIZE[size].hint} ${HINT_HIDE}`}>{selected.hint}</span>
                ) : null}
              </motion.span>
            </AnimatePresence>
          </span>
          <ChevronDown
            aria-hidden="true"
            size={16}
            strokeWidth={1.75}
            className={`shrink-0 text-(--sl-hint) transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          />
        </button>

        <AnimatePresence>
          {open ? (
            <motion.div
              key="panel"
              variants={panelMotion(reduce, side)}
              initial="hidden"
              animate="show"
              exit="exit"
              style={{ transformOrigin: side === "bottom" ? "top center" : "bottom center" }}
              className={`absolute inset-x-0 z-20 overflow-hidden rounded-[12px] bg-(--sl-panel) shadow-(--sl-shadow) ring-1 ring-inset ring-(--sl-line) ${
                side === "bottom" ? "top-full mt-1.5" : "bottom-full mb-1.5"
              }`}
            >
              {searchable ? (
                <div className="flex h-11 shrink-0 items-center gap-2.5 border-b border-(--sl-line) px-3.5 focus-within:border-(--sl-ink)/30">
                  <Search size={15} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-(--sl-hint)" />
                  {/* 16px, not smaller: iOS zooms the page on focus for any field set under 16px. */}
                  <input
                    ref={searchRef}
                    type="text"
                    role="combobox"
                    aria-expanded="true"
                    aria-autocomplete="list"
                    aria-controls={hasRows ? listId : undefined}
                    aria-activedescendant={active ? optionDomId(uid, active.value) : undefined}
                    aria-label={`Filter ${label.toLowerCase()}`}
                    placeholder={searchPlaceholder}
                    value={query}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => onKey(e, true)}
                    className="min-w-0 flex-1 bg-transparent text-[16px] text-(--sl-ink) outline-none placeholder:text-(--sl-hint)"
                  />
                </div>
              ) : null}

              {hasRows ? (
                <div
                  ref={listRef}
                  id={listId}
                  role="listbox"
                  aria-labelledby={labelId}
                  onScroll={syncOverflow}
                  className="relative overflow-y-auto overscroll-contain p-1.5 [scrollbar-width:thin]"
                  style={{ maxHeight: LIST_MAX_PX, ...fade }}
                >
                  {sections.map((section, si) => {
                    const rows = section.options.map((option) => (
                      <OptionRow
                        key={option.value}
                        option={option}
                        id={optionDomId(uid, option.value)}
                        highlightId={highlightId}
                        active={option.value === activeKey}
                        selected={option.value === selectedValue}
                        size={size}
                        reduce={reduce}
                        onHover={() => {
                          if (!committing.current) setActiveValue(option.value);
                        }}
                        onPick={() => commit(option, true)}
                      />
                    ));
                    if (!section.heading) return <div key={`section-${si}`}>{rows}</div>;
                    const headingId = `${uid}-group-${si}`;
                    return (
                      <div
                        key={section.heading}
                        role="group"
                        aria-labelledby={headingId}
                        className={si > 0 ? "mt-1 border-t border-(--sl-line) pt-1" : undefined}
                      >
                        <div
                          id={headingId}
                          role="presentation"
                          className="px-2.5 pb-1 pt-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-(--sl-hint)"
                        >
                          {section.heading}
                        </div>
                        {rows}
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Outside the listbox: an empty listbox is not a valid container for a status line.
                <p role="status" className="px-4 py-5 text-[13px] text-(--sl-hint)">
                  {query ? `No match for “${query}”` : "Nothing to choose from"}
                </p>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Demo stage                                                          */
/* ------------------------------------------------------------------ */

/**
 * The featured instance opens on first render, so the static preview shows the
 * panel, not a closed field. The stage sits high so the panel has room below
 * the trigger; for `placement: "top"` it sits low so the panel has room above.
 * Overrides spread last so the Customize controls always win.
 */
export default function SelectListboxDemo(overrides: Partial<SelectListboxProps> = {}) {
  const opensUp = overrides.placement === "top";
  return (
    <div
      className={`flex min-h-[100dvh] justify-center px-4 ${
        opensUp ? "items-end pb-[clamp(40px,9vh,96px)] pt-12" : "items-start pb-12 pt-[clamp(80px,22vh,200px)]"
      }`}
    >
      <SelectListbox defaultOpen defaultValue="berlin" {...overrides} />
    </div>
  );
}
