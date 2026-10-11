"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  FolderInput,
  Link2,
  PenLine,
  Tag,
  Trash2,
  type LucideIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type EntryBase = { id: string; label: string; icon?: LucideIcon; disabled?: boolean };

/** A plain command. Closes the menu when chosen. */
export type MenuActionItem = EntryBase & {
  kind: "action";
  /** Mono hint on the right, such as "⌘D". Hidden when `shortcuts` is off. */
  shortcut?: string;
  /** Mono status on the right when there is no shortcut, such as "Current". */
  hint?: string;
  /** A second line under the label, for the destructive item's consequence. */
  description?: string;
  /** Set apart in red: the one item that cannot be undone. */
  destructive?: boolean;
};

/** Toggles on and off. The menu stays open so several can be ticked in a row. */
export type MenuCheckboxItem = EntryBase & { kind: "checkbox"; shortcut?: string; defaultChecked?: boolean };

/** One choice out of several, under its own heading. */
export type MenuRadioGroup = {
  kind: "radio";
  id: string;
  label: string;
  defaultValue: string;
  options: { value: string; label: string; shortcut?: string; disabled?: boolean }[];
};

/** Opens a nested menu to the side (or in place, when there is no room). */
export type MenuSubmenu = EntryBase & { kind: "submenu"; items: MenuEntry[] };

export type MenuSeparator = { kind: "separator"; id: string };
/** A small mono heading that labels the items after it, up to the next separator. */
export type MenuLabel = { kind: "label"; id: string; label: string };

export type MenuEntry = MenuActionItem | MenuCheckboxItem | MenuRadioGroup | MenuSubmenu | MenuSeparator | MenuLabel;

export type DropdownMenuNestedProps = {
  /** The menu, in order. Submenus nest their own `items`. */
  items?: MenuEntry[];
  /** Text on the trigger button. */
  triggerLabel?: string;
  /** Icon before the trigger label. Pass null for none. */
  triggerIcon?: LucideIcon | null;
  /** Show submenus. Off, entries that open a submenu are left out. */
  submenus?: boolean;
  /** Show keyboard shortcuts in mono on the right of each row. */
  shortcuts?: boolean;
  /** Show checkbox and radio items. Off, the menu is commands only. */
  checkable?: boolean;
  /** Which edge of the trigger the menu lines up with. Submenus cascade away from that edge. */
  align?: "start" | "end";
  /** Width of the top-level menu in px. Shortcuts step aside below 208px. */
  width?: number;
  /** Draws the safe-triangle hover path while it is protecting an open submenu. Off in production. */
  showSafeArea?: boolean;
  /** Opens once the trigger has landed on first view, without moving focus. */
  defaultOpen?: boolean;
  onSelect?: (id: string) => void;
  onCheckedChange?: (id: string, checked: boolean) => void;
  onValueChange?: (groupId: string, value: string) => void;
  onOpenChange?: (open: boolean) => void;
  /** The one colour: ticks and radio dots. Defaults to the theme's accent. */
  accent?: string;
  theme?: "dark" | "light";
  className?: string;
};

type Direction = "right" | "left";
type Layout = Direction | "drill";
type FocusTarget = "first" | "last" | "menu" | null;
type Point = { x: number; y: number };
type Triangle = [Point, Point, Point];

type Row = {
  key: string;
  kind: "action" | "checkbox" | "radio" | "submenu" | "back";
  label: string;
  disabled: boolean;
  entry: MenuEntry | null;
  /** Radio rows: the group they belong to and their value. */
  group?: string;
  value?: string;
  icon?: LucideIcon;
  shortcut?: string;
  hint?: string;
  description?: string;
  destructive?: boolean;
};

type Block = { kind: "separator"; id: string } | { kind: "group"; id: string; heading?: string; rows: Row[]; radio?: boolean };

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const EASE = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;

const SUBMENU_WIDTH = 224;
/** Space between a menu and the submenu beside it. */
const SUB_GAP = 4;
/** Padding inside every menu surface (`p-1.5`); a submenu's first row lines up with its trigger row. */
const MENU_PAD = 6;
/** Least clearance kept to the viewport edge when choosing where a submenu goes. */
const EDGE = 12;
/** Hover intent: a submenu opens once the pointer has rested on its row this long. */
const SUB_OPEN_DELAY = 110;
/** Inside the safe triangle, a pointer that stops for this long has chosen the row beneath it. */
const GRACE_STALL_MS = 280;
/** The triangle reaches a little past the submenu's corners so a slightly high or low path still counts. */
const GRACE_SLACK = 8;
/** An action row flashes this long before the menu closes, so the choice is felt. */
const SELECT_FLASH_MS = 150;
const TYPEAHEAD_RESET_MS = 500;
/** First view: the menu opens once the trigger has risen into place. */
const AUTO_OPEN_DELAY = 420;
const ROW_STAGGER = 0.014;

const PALETTE = {
  dark: {
    stage: "#09090b",
    trigger: "#141416",
    triggerHover: "#1a1a1d",
    surface: "#121214",
    surfaceSub: "#151518",
    ink: "#f4f4f5",
    body: "#d0d0d6",
    muted: "#8b8b94",
    line: "rgba(255,255,255,0.08)",
    highlight: "rgba(255,255,255,0.075)",
    danger: "#ff7a70",
    dangerHighlight: "rgba(255,105,95,0.13)",
    shadow:
      "inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 56px -18px rgba(0,0,0,0.92), 0 6px 14px -6px rgba(0,0,0,0.7)",
    // Periwinkle on near-black clears 3:1 for non-text marks with room to spare.
    accent: "#8fb0ff",
  },
  light: {
    stage: "#f3f3f0",
    trigger: "#ffffff",
    triggerHover: "#fafafa",
    surface: "#ffffff",
    surfaceSub: "#ffffff",
    ink: "#18181b",
    body: "#3a3a41",
    muted: "#6b6b74",
    line: "rgba(24,24,27,0.09)",
    highlight: "rgba(24,24,27,0.055)",
    danger: "#c8321f",
    dangerHighlight: "rgba(200,50,31,0.08)",
    shadow: "0 22px 48px -18px rgba(24,24,27,0.26), 0 3px 8px -3px rgba(24,24,27,0.12)",
    // About 5:1 on white; the dark theme's periwinkle would wash out here.
    accent: "#2f5bd3",
  },
} as const;

type Palette = (typeof PALETTE)[keyof typeof PALETTE];

const BRIEF_MENU: MenuEntry[] = [
  { kind: "action", id: "open", label: "Open in new tab", icon: ArrowUpRight, shortcut: "⌘↵" },
  { kind: "action", id: "rename", label: "Rename…", icon: PenLine, shortcut: "⌘R" },
  { kind: "action", id: "duplicate", label: "Duplicate", icon: Copy, shortcut: "⌘D" },
  {
    kind: "submenu",
    id: "move",
    label: "Move to",
    icon: FolderInput,
    items: [
      { kind: "label", id: "move-heading", label: "Halden Studio" },
      { kind: "action", id: "move-inbox", label: "Inbox" },
      { kind: "action", id: "move-q4", label: "Q4 launch", hint: "Current", disabled: true },
      { kind: "action", id: "move-campaigns", label: "Campaigns 2026" },
      { kind: "action", id: "move-archive", label: "Archive" },
      { kind: "separator", id: "move-sep" },
      { kind: "action", id: "move-new", label: "New folder…", shortcut: "⌘⇧N" },
    ],
  },
  { kind: "separator", id: "sep-1" },
  {
    kind: "submenu",
    id: "labels",
    label: "Labels",
    icon: Tag,
    items: [
      { kind: "checkbox", id: "label-review", label: "Design review", defaultChecked: true },
      { kind: "checkbox", id: "label-copy", label: "Needs copy" },
      { kind: "checkbox", id: "label-urgent", label: "Urgent" },
      { kind: "checkbox", id: "label-waiting", label: "Waiting on client" },
      { kind: "checkbox", id: "label-legal", label: "Legal hold" },
      { kind: "separator", id: "labels-sep" },
      { kind: "action", id: "labels-manage", label: "Manage labels…" },
    ],
  },
  {
    kind: "submenu",
    id: "share",
    label: "Share",
    icon: Link2,
    items: [
      { kind: "action", id: "share-link", label: "Copy link", shortcut: "⌘L" },
      { kind: "action", id: "share-invite", label: "Invite people…", shortcut: "⌘I" },
      { kind: "action", id: "share-pdf", label: "Export as PDF", shortcut: "⌘⇧E" },
    ],
  },
  { kind: "separator", id: "sep-2" },
  { kind: "label", id: "view-heading", label: "View" },
  { kind: "checkbox", id: "comments", label: "Show comments", shortcut: "⌘⇧C", defaultChecked: true },
  { kind: "checkbox", id: "word-count", label: "Word count", shortcut: "⌘⇧W" },
  {
    kind: "radio",
    id: "page-width",
    label: "Page width",
    defaultValue: "readable",
    options: [
      { value: "readable", label: "Readable", shortcut: "⌘1" },
      { value: "full", label: "Full width", shortcut: "⌘2" },
    ],
  },
  { kind: "separator", id: "sep-3" },
  {
    kind: "action",
    id: "delete",
    label: "Delete brief",
    icon: Trash2,
    shortcut: "⌘⌫",
    destructive: true,
    description: "Removes it for 6 collaborators",
  },
];

/* ------------------------------------------------------------------ */
/* Motion                                                              */
/* ------------------------------------------------------------------ */

const fadeOnly: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

/** The top-level menu grows out of the trigger corner it is anchored to. */
const panelMotion = (reduce: boolean): Variants =>
  reduce
    ? fadeOnly
    : {
        hidden: { opacity: 0, scale: 0.96, y: -4, filter: "blur(4px)" },
        show: {
          opacity: 1,
          scale: 1,
          y: 0,
          filter: "blur(0px)",
          transitionEnd: { filter: "none" },
          transition: { duration: 0.22, ease: EASE },
        },
        exit: { opacity: 0, scale: 0.97, y: -2, filter: "blur(3px)", transition: { duration: 0.14, ease: EASE_IN } },
      };

/** A submenu slides a few px out from the row that opened it. */
const submenuMotion = (reduce: boolean, direction: Direction): Variants => {
  if (reduce) return fadeOnly;
  const from = direction === "right" ? -6 : 6;
  return {
    hidden: { opacity: 0, x: from, scale: 0.98, filter: "blur(3px)" },
    show: {
      opacity: 1,
      x: 0,
      scale: 1,
      filter: "blur(0px)",
      transitionEnd: { filter: "none" },
      transition: { duration: 0.18, ease: EASE },
    },
    exit: { opacity: 0, x: from / 2, transition: { duration: 0.11, ease: EASE_IN } },
  };
};

/** Drill-in pages (narrow containers) slide in from the side they lead to. */
const pageMotion = (reduce: boolean, depth: number): Variants => {
  if (reduce) return fadeOnly;
  const from = depth > 0 ? 14 : -14;
  return {
    hidden: { opacity: 0, x: from, filter: "blur(3px)" },
    show: { opacity: 1, x: 0, filter: "blur(0px)", transitionEnd: { filter: "none" }, transition: { duration: 0.22, ease: EASE } },
    exit: { opacity: 0, x: -from / 2, filter: "blur(2px)", transition: { duration: 0.12, ease: EASE_IN } },
  };
};

/* ------------------------------------------------------------------ */
/* Pure helpers                                                        */
/* ------------------------------------------------------------------ */

const isNavigable = (e: MenuEntry) => e.kind !== "separator" && e.kind !== "label";

/**
 * Applies the `submenus` and `checkable` switches, then tidies what is left:
 * no heading without items under it, no leading, trailing or doubled separators.
 */
function prune(entries: MenuEntry[], opts: { submenus: boolean; checkable: boolean }): MenuEntry[] {
  const kept = entries.flatMap((e): MenuEntry[] => {
    if (e.kind === "submenu") {
      if (!opts.submenus) return [];
      const items = prune(e.items, opts);
      return items.some(isNavigable) ? [{ ...e, items }] : [];
    }
    if ((e.kind === "checkbox" || e.kind === "radio") && !opts.checkable) return [];
    return [e];
  });
  const out: MenuEntry[] = [];
  kept.forEach((e, i) => {
    if (e.kind === "label") {
      const rest = kept.slice(i + 1);
      const end = rest.findIndex((n) => n.kind === "separator" || n.kind === "label");
      if ((end < 0 ? rest : rest.slice(0, end)).some(isNavigable)) out.push(e);
      return;
    }
    if (e.kind === "separator") {
      const last = out.at(-1);
      if (last && last.kind !== "separator") out.push(e);
      return;
    }
    out.push(e);
  });
  while (out.at(-1)?.kind === "separator") out.pop();
  return out;
}

const radioKey = (group: string, value: string) => `${group}-${value}`;

function rowOf(e: MenuEntry): Row | null {
  switch (e.kind) {
    case "action":
      return {
        key: e.id,
        kind: "action",
        label: e.label,
        disabled: !!e.disabled,
        entry: e,
        icon: e.icon,
        shortcut: e.shortcut,
        hint: e.hint,
        description: e.description,
        destructive: e.destructive,
      };
    case "checkbox":
      return { key: e.id, kind: "checkbox", label: e.label, disabled: !!e.disabled, entry: e, shortcut: e.shortcut };
    case "submenu":
      return { key: e.id, kind: "submenu", label: e.label, disabled: !!e.disabled, entry: e, icon: e.icon };
    default:
      return null;
  }
}

/** Splits a menu into separators and groups. Headings and radio sets each open a labelled group. */
function blocksOf(entries: MenuEntry[], back: string | undefined): { blocks: Block[]; rows: Row[] } {
  const blocks: Block[] = [];
  let current: Extract<Block, { kind: "group" }> | null = null;
  const open = (id: string, heading?: string, radio?: boolean) => {
    current = { kind: "group", id, heading, rows: [], radio };
    blocks.push(current);
    return current;
  };
  if (back) {
    open("back").rows.push({ key: "back", kind: "back", label: back, disabled: false, entry: null });
    blocks.push({ kind: "separator", id: "back-sep" });
    current = null;
  }
  for (const e of entries) {
    if (e.kind === "separator") {
      blocks.push({ kind: "separator", id: e.id });
      current = null;
    } else if (e.kind === "label") {
      open(e.id, e.label);
    } else if (e.kind === "radio") {
      const g = open(e.id, e.label, true);
      for (const o of e.options)
        g.rows.push({
          key: radioKey(e.id, o.value),
          kind: "radio",
          label: o.label,
          disabled: !!o.disabled,
          entry: e,
          group: e.id,
          value: o.value,
          shortcut: o.shortcut,
        });
      current = null;
    } else {
      const row = rowOf(e);
      if (row) (current ?? open(`g-${e.id}`)).rows.push(row);
    }
  }
  return { blocks, rows: blocks.flatMap((b) => (b.kind === "group" ? b.rows : [])) };
}

/** Every checkbox and radio default in the tree, so state survives submenus closing. */
function collectDefaults(entries: MenuEntry[], checks: Record<string, boolean> = {}, radios: Record<string, string> = {}) {
  for (const e of entries) {
    if (e.kind === "checkbox") checks[e.id] = !!e.defaultChecked;
    else if (e.kind === "radio") radios[e.id] = e.defaultValue;
    else if (e.kind === "submenu") collectDefaults(e.items, checks, radios);
  }
  return { checks, radios };
}

/** Same-side test on all three edges; points on an edge count as inside. */
function inTriangle(p: Point, [a, b, c]: Triangle) {
  const side = (u: Point, v: Point) => (v.x - u.x) * (p.y - u.y) - (v.y - u.y) * (p.x - u.x);
  const d1 = side(a, b);
  const d2 = side(b, c);
  const d3 = side(c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

const isTypeable = (e: ReactKeyboardEvent) => e.key.length === 1 && e.key !== " " && !e.metaKey && !e.ctrlKey && !e.altKey;

/* ------------------------------------------------------------------ */
/* Shared state                                                        */
/* ------------------------------------------------------------------ */

type MenuContextValue = {
  uid: string;
  reduce: boolean;
  palette: Palette;
  shortcuts: boolean;
  layout: Layout;
  keyboard: boolean;
  setKeyboard: (on: boolean) => void;
  flashKey: string | null;
  isChecked: (id: string) => boolean;
  radioValue: (group: string) => string | undefined;
  /** Rows for submenu triggers show how many of their checkboxes are ticked. */
  checkedCount: (entry: MenuSubmenu) => number;
  activate: (row: Row) => void;
  drillInto: (entry: MenuSubmenu, focus: FocusTarget) => void;
  closeAll: (restoreFocus: boolean) => void;
  showSafeArea: (tri: Triangle | null) => void;
};

const MenuContext = createContext<MenuContextValue | null>(null);

function useMenu() {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error("Menu parts must render inside DropdownMenuNested");
  return ctx;
}

/** Tracks an element's height, so a drill-in surface can animate between pages of different length. */
function useHeight(ref: RefObject<HTMLDivElement | null>) {
  const [height, setHeight] = useState<number | "auto">("auto");
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => setHeight(el.offsetHeight);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return height;
}

/* ------------------------------------------------------------------ */
/* Parts                                                               */
/* ------------------------------------------------------------------ */

/** Mounts when an item is ticked, so the tick draws each time it is turned on. */
function Tick({ reduce }: { reduce: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} fill="none" aria-hidden="true" className="text-(--dm-accent)">
      <motion.path
        d="M3.25 8.5 6.5 11.75 12.75 4.75"
        stroke="currentColor"
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.28, ease: EASE }}
      />
    </svg>
  );
}

/** A number that cross-fades with a small rise when it changes. */
function Count({ value, reduce }: { value: number; reduce: boolean }) {
  return (
    <span className="relative inline-grid overflow-hidden font-mono text-[11px] tabular-nums text-(--dm-muted)">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 7, filter: "blur(2px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -7, filter: "blur(2px)" }}
          transition={{ duration: 0.22, ease: EASE }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

type MenuRowProps = {
  row: Row;
  index: number;
  rowId: string;
  level: number;
  active: boolean;
  highlightId: string;
  expanded: boolean;
  submenuId?: string;
  register: (key: string, el: HTMLDivElement | null) => void;
  onClick: (row: Row) => void;
};

function MenuRow({ row, index, rowId, level, active, highlightId, expanded, submenuId, register, onClick }: MenuRowProps) {
  const ctx = useMenu();
  const { reduce, palette } = ctx;
  const Icon = row.kind === "back" ? ChevronLeft : row.icon;
  const checked =
    row.kind === "checkbox" ? ctx.isChecked(row.key) : row.kind === "radio" && row.group ? ctx.radioValue(row.group) === row.value : undefined;
  const flash = ctx.flashKey === row.key;
  const role = row.kind === "checkbox" ? "menuitemcheckbox" : row.kind === "radio" ? "menuitemradio" : "menuitem";
  const count = row.kind === "submenu" && row.entry?.kind === "submenu" ? ctx.checkedCount(row.entry) : 0;
  // In a menu that cascades left, the submenu chevron points the way it opens.
  const flipChevron = ctx.layout === "left";

  return (
    <motion.div
      ref={(el) => register(row.key, el)}
      id={rowId}
      role={role}
      tabIndex={-1}
      aria-disabled={row.disabled || undefined}
      aria-checked={checked}
      aria-haspopup={row.kind === "submenu" ? "menu" : undefined}
      aria-expanded={row.kind === "submenu" ? expanded : undefined}
      aria-controls={row.kind === "submenu" && expanded ? submenuId : undefined}
      data-menu-row=""
      data-level={level}
      data-key={row.key}
      data-demo={`item-${row.key}`}
      onClick={() => onClick(row)}
      initial={reduce ? false : { opacity: 0, y: -3 }}
      animate={{ opacity: row.disabled ? 0.4 : 1, y: 0 }}
      transition={{ duration: 0.2, ease: EASE, delay: reduce ? 0 : 0.04 + index * ROW_STAGGER }}
      className={`group relative flex select-none items-center rounded-[7px] px-2 outline-none ${
        row.description ? "min-h-11 py-1.5" : "h-8 [@media(pointer:coarse)]:h-11"
      } ${row.disabled ? "cursor-not-allowed" : "cursor-pointer"} ${
        row.destructive ? "text-(--dm-danger)" : active || expanded ? "text-(--dm-ink)" : "text-(--dm-body)"
      }`}
    >
      {active ? (
        <motion.span
          layoutId={highlightId}
          aria-hidden="true"
          initial={false}
          animate={{
            backgroundColor: row.destructive ? palette.dangerHighlight : palette.highlight,
            opacity: flash ? [1, 0.3, 1] : 1,
          }}
          transition={reduce ? { duration: 0 } : { ...SPRING_UI, backgroundColor: { duration: 0.14 }, opacity: { duration: 0.15 } }}
          className={`absolute inset-0 rounded-[7px] ${ctx.keyboard ? "ring-1 ring-inset ring-(--dm-ink)/25" : ""}`}
        />
      ) : expanded ? (
        // The row whose submenu is open keeps a quieter mark while the pointer works inside the submenu.
        <span aria-hidden="true" className="absolute inset-0 rounded-[7px] bg-(--dm-highlight) opacity-60" />
      ) : null}

      {/* The content takes the press, so the highlight under it stays put. */}
      <span className="relative flex min-w-0 flex-1 items-center gap-2.5 transition-transform duration-[90ms] ease-out group-active:scale-[0.98] motion-reduce:transition-none motion-reduce:group-active:scale-100">
        <span className="grid size-4 shrink-0 place-items-center">
          {row.kind === "checkbox" ? (
            checked ? <Tick reduce={reduce} /> : null
          ) : row.kind === "radio" ? (
            checked ? (
              <motion.span
                layoutId={`${ctx.uid}-dot-${row.group}`}
                transition={reduce ? { duration: 0 } : SPRING_UI}
                className="block size-[7px] rounded-full bg-(--dm-accent)"
              />
            ) : null
          ) : Icon ? (
            <Icon
              size={15}
              strokeWidth={1.75}
              aria-hidden="true"
              className={row.destructive ? "text-(--dm-danger)" : active ? "text-(--dm-ink)" : "text-(--dm-muted)"}
            />
          ) : null}
        </span>

        <span className="flex min-w-0 flex-1 flex-col">
          <span className={`truncate text-[13.5px] leading-5 ${row.kind === "back" ? "font-medium text-(--dm-ink)" : ""}`}>
            {row.label}
          </span>
          {row.description ? (
            <span className="truncate text-[11.5px] leading-4 text-(--dm-muted)">{row.description}</span>
          ) : null}
        </span>

        {row.kind === "submenu" ? (
          <span className="flex shrink-0 items-center gap-1.5">
            {count > 0 ? <Count value={count} reduce={reduce} /> : null}
            <ChevronRight
              size={14}
              strokeWidth={1.75}
              aria-hidden="true"
              className={`text-(--dm-muted) transition-transform duration-150 ease-out motion-reduce:transition-none ${flipChevron ? "rotate-180" : ""} ${
                active || expanded ? (flipChevron ? "-translate-x-px" : "translate-x-px") : ""
              }`}
            />
          </span>
        ) : row.shortcut && ctx.shortcuts ? (
          <kbd
            className={`shrink-0 font-mono text-[11px] tracking-[0.06em] @max-[13rem]:hidden ${
              row.destructive ? "text-(--dm-danger)/70" : "text-(--dm-muted)"
            }`}
          >
            {row.shortcut}
          </kbd>
        ) : row.hint ? (
          <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.1em] text-(--dm-muted)">{row.hint}</span>
        ) : null}
      </span>
    </motion.div>
  );
}

type MenuPanelProps = {
  entries: MenuEntry[];
  level: number;
  menuId: string;
  labelledBy: string;
  /** Draws the menu's own surface. Off for drill-in pages, whose surface is shared. */
  surface: boolean;
  /** Where focus goes when the menu appears (and again whenever `focusNonce` changes). */
  focus: FocusTarget;
  focusNonce?: number;
  /** Escape: close this menu (a submenu returns focus to its trigger row; the top level closes everything). */
  onEscape: () => void;
  /** The arrow that points back toward the parent menu, and the drill-in Back row. */
  onOutward?: () => void;
  /** Drill-in pages show a Back row with the submenu's name. */
  backLabel?: string;
  className?: string;
  style?: CSSProperties;
};

function MenuPanel({ entries, level, menuId, labelledBy, surface, focus, focusNonce = 0, onEscape, onOutward, backLabel, className = "", style }: MenuPanelProps) {
  const ctx = useMenu();
  const { uid, reduce, layout } = ctx;
  const { blocks, rows } = useMemo(() => blocksOf(entries, backLabel), [entries, backLabel]);
  const enabled = useMemo(() => rows.filter((r) => !r.disabled), [rows]);

  const [active, setActive] = useState<string | null>(null);
  const [sub, setSub] = useState<{ id: string; focus: FocusTarget; nonce: number; top: number } | null>(null);
  const [shift, setShift] = useState(0);

  const menuRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const rowEls = useRef(new Map<string, HTMLDivElement>());
  const openTimer = useRef<number | null>(null);
  /** The submenu row waiting out its hover delay, so pointer moves on it don't restart the wait. */
  const pendingSub = useRef<string | null>(null);
  const stallTimer = useRef<number | null>(null);
  const grace = useRef<Triangle | null>(null);
  const lastPoint = useRef<Point | null>(null);
  const typed = useRef({ text: "", at: 0 });

  const cascade = layout !== "drill";
  const direction: Direction = layout === "left" ? "left" : "right";
  const subEntry = sub ? entries.find((e): e is MenuSubmenu => e.kind === "submenu" && e.id === sub.id) : undefined;
  const subMenuId = sub ? `${uid}-menu-${sub.id}` : undefined;
  const rowId = (key: string) => `${uid}-row-${key}`;

  const register = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) rowEls.current.set(key, el);
    else rowEls.current.delete(key);
  }, []);

  const clearTimer = (t: RefObject<number | null>) => {
    if (t.current !== null) window.clearTimeout(t.current);
    t.current = null;
    if (t === openTimer) pendingSub.current = null;
  };

  const clearGrace = useCallback(() => {
    if (stallTimer.current !== null) window.clearTimeout(stallTimer.current);
    stallTimer.current = null;
    if (grace.current) {
      grace.current = null;
      ctx.showSafeArea(null);
    }
  }, [ctx]);

  useEffect(
    () => () => {
      if (openTimer.current !== null) window.clearTimeout(openTimer.current);
      if (stallTimer.current !== null) window.clearTimeout(stallTimer.current);
    },
    [],
  );

  const focusRow = useCallback((key: string) => {
    setActive(key);
    rowEls.current.get(key)?.focus({ preventScroll: true });
  }, []);

  const closeSub = useCallback(() => {
    clearTimer(openTimer);
    clearGrace();
    setSub(null);
    setShift(0);
  }, [clearGrace]);

  const openSub = (key: string, focusTo: FocusTarget) => {
    clearTimer(openTimer);
    const el = rowEls.current.get(key);
    setSub((s) => ({ id: key, focus: focusTo, nonce: (s?.nonce ?? 0) + 1, top: (el?.offsetTop ?? MENU_PAD) - MENU_PAD }));
  };

  // Focus on appear (and when a parent asks again, as ArrowRight on an already-open submenu does).
  useEffect(() => {
    if (focus === "first" && enabled[0]) focusRow(enabled[0].key);
    else if (focus === "last" && enabled.length) focusRow(enabled[enabled.length - 1].key);
    else if (focus === "menu") menuRef.current?.focus({ preventScroll: true });
    // Only the request matters here, not every re-render of the rows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  // A submenu never runs off the bottom of the viewport: it slides up by what would overflow.
  useLayoutEffect(() => {
    const el = subRef.current;
    if (!sub || !el) return;
    const r = el.getBoundingClientRect();
    const over = r.bottom - (window.innerHeight - EDGE);
    if (over > 0) setShift(-Math.min(over, Math.max(0, r.top - EDGE)));
  }, [sub]);

  /** What the pointer is over decides the highlight, unless it is crossing toward an open submenu. */
  const hover = (key: string | null) => {
    if (key === null) return;
    const row = rows.find((r) => r.key === key);
    if (!row) return;
    if (row.disabled) {
      setActive(null);
      if (sub) closeSub();
      return;
    }
    if (key !== active) focusRow(key);
    if (row.kind === "submenu" && cascade) {
      if (sub?.id === key || pendingSub.current === key) return;
      if (sub) closeSub();
      clearTimer(openTimer);
      pendingSub.current = key;
      openTimer.current = window.setTimeout(() => openSub(key, null), SUB_OPEN_DELAY);
    } else {
      clearTimer(openTimer);
      if (sub) closeSub();
    }
  };

  /** Inside the triangle, a pointer that rests has made up its mind: apply the row under it. */
  const armStall = () => {
    if (stallTimer.current !== null) window.clearTimeout(stallTimer.current);
    stallTimer.current = window.setTimeout(() => {
      stallTimer.current = null;
      clearGrace();
      const p = lastPoint.current;
      const el = p ? document.elementFromPoint(p.x, p.y)?.closest<HTMLElement>("[data-menu-row]") : null;
      if (el && el.dataset.level === String(level)) hover(el.dataset.key ?? null);
    }, GRACE_STALL_MS);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    ctx.setKeyboard(false);
    const target = e.target as Element;
    // Moves inside a nested submenu bubble up here: the pointer has arrived, the grace is spent.
    if (subRef.current?.contains(target)) {
      clearGrace();
      return;
    }
    const pt = { x: e.clientX, y: e.clientY };
    const prev = lastPoint.current;
    lastPoint.current = pt;
    const rowEl = target.closest<HTMLElement>("[data-menu-row]");
    const key = rowEl && rowEl.dataset.level === String(level) ? (rowEl.dataset.key ?? null) : null;

    if (grace.current) {
      if (inTriangle(pt, grace.current)) {
        armStall();
        return;
      }
      clearGrace();
    } else if (cascade && sub && key !== sub.id && active === sub.id && prev && subRef.current) {
      // Leaving the open submenu's row: if the pointer is heading for the submenu,
      // the rows it crosses on the way don't count. The triangle runs from where it
      // left to the submenu's near corners.
      const toward = direction === "right" ? pt.x > prev.x : pt.x < prev.x;
      if (toward) {
        const r = subRef.current.getBoundingClientRect();
        const nearX = direction === "right" ? r.left : r.right;
        const tri: Triangle = [prev, { x: nearX, y: r.top - GRACE_SLACK }, { x: nearX, y: r.bottom + GRACE_SLACK }];
        if (inTriangle(pt, tri)) {
          grace.current = tri;
          ctx.showSafeArea(tri);
          armStall();
          return;
        }
      }
    }
    hover(key);
  };

  const onPointerLeave = () => {
    clearTimer(openTimer);
    lastPoint.current = null;
    if (!sub) setActive(null);
  };

  const activateRow = (row: Row, from: "pointer" | "keyboard") => {
    if (row.disabled) return;
    if (row.kind === "back") {
      onOutward?.();
      return;
    }
    if (row.kind === "submenu" && row.entry?.kind === "submenu") {
      if (!cascade) ctx.drillInto(row.entry, from === "keyboard" ? "first" : "menu");
      else if (from === "keyboard" || sub?.id !== row.key) openSub(row.key, from === "keyboard" ? "first" : null);
      return;
    }
    ctx.activate(row);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    // Each menu owns its keys; nothing leaks up to the menu that contains it.
    e.stopPropagation();
    ctx.setKeyboard(true);
    const focusedRow = (e.target as Element).closest<HTMLElement>("[data-menu-row]");
    const focusedKey = focusedRow?.dataset.level === String(level) ? focusedRow.dataset.key : active;
    const index = enabled.findIndex((r) => r.key === focusedKey);
    const current = index >= 0 ? enabled[index] : undefined;
    const move = (i: number) => {
      e.preventDefault();
      const n = enabled.length;
      const next = n ? enabled[((i % n) + n) % n] : undefined;
      if (!next) return;
      if (sub) closeSub();
      focusRow(next.key);
    };
    // The arrow that points into a submenu follows the side it opens on.
    const inward = cascade && direction === "left" ? "ArrowLeft" : "ArrowRight";
    const outward = inward === "ArrowRight" ? "ArrowLeft" : "ArrowRight";

    switch (e.key) {
      case "ArrowDown":
        return move(index < 0 ? 0 : index + 1);
      case "ArrowUp":
        return move(index < 0 ? enabled.length - 1 : index - 1);
      case "Home":
      case "PageUp":
        return move(0);
      case "End":
      case "PageDown":
        return move(enabled.length - 1);
      case inward:
        e.preventDefault();
        if (current?.kind === "submenu") activateRow(current, "keyboard");
        return;
      case outward:
        e.preventDefault();
        onOutward?.();
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        if (current) activateRow(current, "keyboard");
        return;
      case "Escape":
        e.preventDefault();
        onEscape();
        return;
      case "Tab":
        // Focus goes back to the trigger first, so Tab carries on from there as if the menu was never open.
        ctx.closeAll(true);
        return;
      default:
        if (!isTypeable(e)) return;
        e.preventDefault();
        {
          const now = performance.now();
          const t = typed.current;
          t.text = now - t.at > TYPEAHEAD_RESET_MS ? e.key.toLowerCase() : t.text + e.key.toLowerCase();
          t.at = now;
          const cycling = /^(.)\1*$/.test(t.text);
          const start = Math.max(0, index);
          for (let i = 0; i < enabled.length; i++) {
            const row = enabled[(start + (cycling ? 1 : 0) + i) % enabled.length];
            if (row.kind !== "back" && row.label.toLowerCase().startsWith(cycling ? t.text[0] : t.text)) {
              if (sub) closeSub();
              focusRow(row.key);
              break;
            }
          }
        }
    }
  };

  const highlightId = `${menuId}-highlight`;
  let rowIndex = 0;

  return (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      tabIndex={-1}
      aria-labelledby={labelledBy}
      aria-orientation="vertical"
      data-demo={level === 0 ? "menu" : undefined}
      onKeyDown={onKeyDown}
      onFocus={(event) => {
        const row = (event.target as Element).closest<HTMLElement>("[data-menu-row]");
        if (row?.dataset.level === String(level)) setActive(row.getAttribute("aria-disabled") === "true" ? null : row.dataset.key ?? null);
      }}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={style}
      className={`@container relative p-1.5 outline-none ${
        surface ? "rounded-[12px] bg-(--dm-surface) shadow-(--dm-shadow) ring-1 ring-inset ring-(--dm-line)" : ""
      } ${className}`}
    >
      {blocks.map((block) => {
        if (block.kind === "separator") return <div key={block.id} role="separator" className="-mx-1.5 my-1.5 h-px bg-(--dm-line)" />;
        const rendered = block.rows.map((row) => (
          <MenuRow
            key={row.key}
            row={row}
            index={rowIndex++}
            rowId={rowId(row.key)}
            level={level}
            active={active === row.key}
            highlightId={highlightId}
            expanded={sub?.id === row.key}
            submenuId={subMenuId}
            register={register}
            onClick={(r) => activateRow(r, "pointer")}
          />
        ));
        if (!block.heading) return <div key={block.id}>{rendered}</div>;
        const headingId = `${uid}-heading-${block.id}`;
        return (
          <div key={block.id} role="group" aria-labelledby={headingId}>
            <div id={headingId} className="px-2 pb-1 pt-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-(--dm-muted)">
              {block.heading}
            </div>
            {rendered}
          </div>
        );
      })}

      <AnimatePresence>
        {cascade && sub && subEntry ? (
          <motion.div
            ref={subRef}
            key={sub.id}
            variants={submenuMotion(reduce, direction)}
            initial="hidden"
            animate="show"
            exit="exit"
            className="absolute z-10"
            style={{
              top: sub.top + shift,
              width: `min(${SUBMENU_WIDTH}px, calc(100vw - ${EDGE * 2}px))`,
              ...(direction === "right" ? { left: `calc(100% + ${SUB_GAP}px)` } : { right: `calc(100% + ${SUB_GAP}px)` }),
              transformOrigin: direction === "right" ? "left top" : "right top",
            }}
          >
            <MenuPanel
              entries={subEntry.items}
              level={level + 1}
              menuId={subMenuId ?? `${uid}-menu-sub`}
              labelledBy={rowId(sub.id)}
              surface
              focus={sub.focus}
              focusNonce={sub.nonce}
              style={{ background: ctx.palette.surfaceSub }}
              onEscape={() => {
                const key = sub.id;
                closeSub();
                focusRow(key);
              }}
              onOutward={() => {
                const key = sub.id;
                closeSub();
                focusRow(key);
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function DropdownMenuNested({
  items = BRIEF_MENU,
  triggerLabel = "Q4 launch brief",
  triggerIcon = FileText,
  submenus = true,
  shortcuts = true,
  checkable = true,
  align = "start",
  width = 256,
  showSafeArea = false,
  defaultOpen = false,
  onSelect,
  onCheckedChange,
  onValueChange,
  onOpenChange,
  accent,
  theme = "dark",
  className = "",
}: DropdownMenuNestedProps) {
  const reduce = !!useReducedMotion();
  const uid = useId();
  const triggerId = `${uid}-trigger`;
  const menuId = `${uid}-menu`;
  const palette = PALETTE[theme];

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const flashTimer = useRef<number | null>(null);
  const autoOpened = useRef(false);

  const [open, setOpen] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const [initialFocus, setInitialFocus] = useState<FocusTarget>(null);
  const [layout, setLayout] = useState<Layout>(align === "end" ? "left" : "right");
  const [stack, setStack] = useState<{ entry: MenuSubmenu; focus: FocusTarget }[]>([]);
  const [keyboard, setKeyboard] = useState(false);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [safe, setSafe] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const defaults = useMemo(() => collectDefaults(items), [items]);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [radios, setRadios] = useState<Record<string, string>>({});
  const entries = useMemo(() => prune(items, { submenus, checkable }), [items, submenus, checkable]);

  const isChecked = useCallback((id: string) => checks[id] ?? defaults.checks[id] ?? false, [checks, defaults]);
  const radioValue = useCallback((group: string) => radios[group] ?? defaults.radios[group], [radios, defaults]);
  const checkedCount = useCallback(
    (entry: MenuSubmenu) => entry.items.filter((e) => e.kind === "checkbox" && isChecked(e.id)).length,
    [isChecked],
  );

  const setOpenState = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const show = useCallback(
    (focus: FocusTarget) => {
      setInitialFocus(focus);
      setStack([]);
      setOpenCount((n) => n + 1);
      setOpenState(true);
    },
    [setOpenState],
  );

  const closeAll = useCallback(
    (restoreFocus: boolean) => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
      flashTimer.current = null;
      setFlashKey(null);
      setSafe(null);
      setStack([]);
      setOpenState(false);
      if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
    },
    [setOpenState],
  );

  useEffect(
    () => () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current);
    },
    [],
  );

  // First view: open once the trigger has risen into place, without taking focus.
  useEffect(() => {
    if (!defaultOpen || autoOpened.current) return;
    // Marked inside the timer, so a Strict Mode effect replay (which clears the timer) still opens it.
    const t = window.setTimeout(() => {
      autoOpened.current = true;
      show(null);
    }, reduce ? 0 : AUTO_OPEN_DELAY);
    return () => window.clearTimeout(t);
  }, [defaultOpen, reduce, show]);

  // Cascade toward the preferred side, flip when it runs out of room, and drill in place when neither side fits.
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const t = triggerRef.current?.getBoundingClientRect();
      if (!t) return;
      const vw = window.innerWidth;
      const w = Math.min(width, vw - 32);
      const left = align === "start" ? t.left : t.right - w;
      const fits: Record<Direction, boolean> = {
        right: left + w + SUB_GAP + SUBMENU_WIDTH <= vw - EDGE,
        left: left - SUB_GAP - SUBMENU_WIDTH >= EDGE,
      };
      const prefer: Direction = align === "start" ? "right" : "left";
      const other: Direction = prefer === "right" ? "left" : "right";
      setLayout(fits[prefer] ? prefer : fits[other] ? other : "drill");
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, align, width]);

  // Leaving drill mode (a wider window) drops any page that was drilled into.
  useEffect(() => {
    if (layout !== "drill") setStack([]);
  }, [layout]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) closeAll(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, closeAll]);

  const activate = useCallback(
    (row: Row) => {
      if (row.kind === "checkbox") {
        const next = !isChecked(row.key);
        setChecks((c) => ({ ...c, [row.key]: next }));
        onCheckedChange?.(row.key, next);
        setAnnouncement(`${row.label} ${next ? "on" : "off"}`);
        return;
      }
      if (row.kind === "radio" && row.group && row.value) {
        setRadios((r) => ({ ...r, [row.group as string]: row.value as string }));
        onValueChange?.(row.group, row.value);
        setAnnouncement(`${row.label} selected`);
        return;
      }
      onSelect?.(row.key);
      setAnnouncement(row.label.replace(/…$/, ""));
      if (reduce) {
        closeAll(true);
        return;
      }
      // The chosen row blinks once, then the menu closes and focus returns to the trigger.
      setFlashKey(row.key);
      flashTimer.current = window.setTimeout(() => closeAll(true), SELECT_FLASH_MS);
    },
    [isChecked, onCheckedChange, onValueChange, onSelect, reduce, closeAll],
  );

  const showSafe = useCallback((tri: Triangle | null) => {
    const root = rootRef.current?.getBoundingClientRect();
    if (!tri || !root) {
      setSafe(null);
      return;
    }
    setSafe(tri.map((p) => `${(p.x - root.left).toFixed(1)},${(p.y - root.top).toFixed(1)}`).join(" "));
  }, []);

  const ctx: MenuContextValue = {
    uid,
    reduce,
    palette,
    shortcuts,
    layout,
    keyboard,
    setKeyboard,
    flashKey,
    isChecked,
    radioValue,
    checkedCount,
    activate,
    drillInto: (entry, focus) => setStack((s) => [...s, { entry, focus }]),
    closeAll,
    showSafeArea: showSafe,
  };

  const onTriggerKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (open) return;
    setKeyboard(true);
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault();
      show("first");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      show("last");
    }
  };

  const vars = {
    "--dm-trigger": palette.trigger,
    "--dm-trigger-hover": palette.triggerHover,
    "--dm-surface": palette.surface,
    "--dm-ink": palette.ink,
    "--dm-body": palette.body,
    "--dm-muted": palette.muted,
    "--dm-line": palette.line,
    "--dm-highlight": palette.highlight,
    "--dm-danger": palette.danger,
    "--dm-shadow": palette.shadow,
    "--dm-accent": accent ?? palette.accent,
  } as CSSProperties;

  const TriggerIcon = triggerIcon;
  const page = stack.at(-1);
  const panelWidth = `min(${width}px, calc(100vw - 32px))`;

  return (
    <MenuContext.Provider value={ctx}>
      <motion.div
        ref={rootRef}
        style={vars}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
        transition={{ duration: reduce ? 0.15 : 0.5, ease: EASE }}
        className={`relative inline-flex font-sans text-(--dm-ink) ${className}`}
      >
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          data-demo="trigger"
          onPointerMove={() => setKeyboard(false)}
          onClick={() => (open ? closeAll(false) : show("menu"))}
          onKeyDown={onTriggerKey}
          className={`group flex h-10 max-w-[min(320px,calc(100vw-32px))] items-center gap-2.5 rounded-[10px] bg-(--dm-trigger) pl-3 pr-2.5 text-[14px] font-medium ring-1 ring-inset transition-[background-color,box-shadow,scale] duration-150 ease-out hover:bg-(--dm-trigger-hover) active:scale-[0.98] active:duration-[90ms] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--dm-ink)/60 motion-reduce:active:scale-100 [@media(pointer:coarse)]:h-11 ${
            open ? "ring-(--dm-ink)/20" : "ring-(--dm-line)"
          }`}
        >
          {TriggerIcon ? <TriggerIcon size={15} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-(--dm-muted)" /> : null}
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown
            size={15}
            strokeWidth={1.75}
            aria-hidden="true"
            className={`shrink-0 text-(--dm-muted) transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          />
        </button>

        <AnimatePresence>
          {open ? (
            <motion.div
              key="panel"
              variants={panelMotion(reduce)}
              initial="hidden"
              animate="show"
              exit="exit"
              className={`absolute top-full z-30 mt-2 ${align === "end" ? "right-0" : "left-0"}`}
              style={{ width: panelWidth, transformOrigin: align === "end" ? "right top" : "left top" }}
            >
              {layout === "drill" ? (
                <DrillSurface>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={page ? page.entry.id : "root"}
                      variants={pageMotion(reduce, stack.length)}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                    >
                      <MenuPanel
                        key={`${openCount}-${page?.entry.id ?? "root"}`}
                        entries={page ? page.entry.items : entries}
                        level={0}
                        menuId={menuId}
                        labelledBy={triggerId}
                        surface={false}
                        focus={page ? page.focus : initialFocus}
                        backLabel={page?.entry.label}
                        onEscape={page ? () => setStack((s) => s.slice(0, -1)) : () => closeAll(true)}
                        onOutward={page ? () => setStack((s) => s.slice(0, -1)) : undefined}
                      />
                    </motion.div>
                  </AnimatePresence>
                </DrillSurface>
              ) : (
                <MenuPanel
                  key={openCount}
                  entries={entries}
                  level={0}
                  menuId={menuId}
                  labelledBy={triggerId}
                  surface
                  focus={initialFocus}
                  onEscape={() => closeAll(true)}
                />
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {showSafeArea ? (
          <svg aria-hidden="true" width={1} height={1} className="pointer-events-none absolute left-0 top-0 z-40 overflow-visible">
            <AnimatePresence>
              {safe ? (
                <motion.polygon
                  key={safe}
                  points={safe}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.18 } }}
                  transition={{ duration: 0.12 }}
                  fill={palette.ink}
                  fillOpacity={0.06}
                  stroke={palette.ink}
                  strokeOpacity={0.4}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  strokeLinejoin="round"
                />
              ) : null}
            </AnimatePresence>
          </svg>
        ) : null}

        <span role="status" aria-live="polite" className="sr-only">
          {announcement}
        </span>
      </motion.div>
    </MenuContext.Provider>
  );
}

/** The shared surface for drill-in pages: its height follows the page it shows. */
function DrillSurface({ children }: { children: ReactNode }) {
  const { reduce } = useMenu();
  const innerRef = useRef<HTMLDivElement>(null);
  const height = useHeight(innerRef);
  return (
    <motion.div
      animate={{ height }}
      transition={reduce ? { duration: 0 } : { duration: 0.28, ease: EASE }}
      className="overflow-hidden rounded-[12px] bg-(--dm-surface) shadow-(--dm-shadow) ring-1 ring-inset ring-(--dm-line)"
    >
      <div ref={innerRef}>{children}</div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Demo stage                                                          */
/* ------------------------------------------------------------------ */

/**
 * The menu opens on first view so the still preview shows it. The trigger sits
 * at the edge of a 480px column on the side the menu aligns to, so the menu and
 * its submenu share the centre of the stage. Overrides spread last so the
 * Customize controls always win.
 */
export default function DropdownMenuNestedDemo(overrides: Partial<DropdownMenuNestedProps> = {}) {
  const theme = overrides.theme ?? "dark";
  const end = overrides.align === "end";
  return (
    <div
      className="flex min-h-[100dvh] justify-center px-4 pb-16 pt-[clamp(56px,12vh,120px)]"
      style={{ background: PALETTE[theme].stage }}
    >
      <div className={`flex w-full max-w-[480px] items-start ${end ? "justify-end" : "justify-start"}`}>
        <DropdownMenuNested defaultOpen showSafeArea {...overrides} />
      </div>
    </div>
  );
}
