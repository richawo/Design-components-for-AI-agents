"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { Check, ChevronDown, LoaderCircle, RotateCcw } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type SettingValue = string | boolean;
export type SettingsValues = Record<string, SettingValue>;
export type SettingOption = { value: string; label: string };

type RowBase = { id: string; label: string; hint?: string };

export type SettingsRow =
  | (RowBase & { kind: "toggle" })
  | (RowBase & { kind: "segmented"; options: SettingOption[] })
  | (RowBase & { kind: "select"; options: SettingOption[] })
  | (RowBase & { kind: "text"; placeholder?: string; /** Fixed text inside the field, e.g. a domain. */ prefix?: string });

export type SettingsSection = {
  id: string;
  label: string;
  /** One line under the tabs while this section is open. */
  description?: string;
  rows: SettingsRow[];
};

export type SettingsPanelProps = {
  title?: string;
  description?: string;
  sections?: SettingsSection[];
  defaultSection?: string;
  /** Saved values, keyed by row id. Rows without one start empty, off or on their first option. */
  initialValues?: SettingsValues;
  /** Called with every value on Save or ⌘S. Return a promise to hold the saving state; reject to show the error state. */
  onSave?: (values: SettingsValues) => Promise<void> | void;
  onChange?: (values: SettingsValues) => void;
  /** The one accent: switches that are on, and Save. Defaults to the theme’s ink. */
  accent?: string;
  theme?: "dark" | "light";
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    surface: "#111113",
    raised: "#18181b",
    field: "#0c0c0e",
    line: "#232327",
    rule: "#1c1c1f",
    ink: "#f4f4f5",
    muted: "#a1a1aa",
    faint: "#8a8a93",
    track: "#27272a",
    trackHover: "#303034",
    knob: "#a1a1aa",
    danger: "#f87171",
    shadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 32px 64px -32px rgba(0,0,0,0.9)",
  },
  light: {
    surface: "#ffffff",
    raised: "#f6f6f7",
    field: "#fafafa",
    line: "#e4e4e7",
    rule: "#efeff1",
    ink: "#18181b",
    muted: "#52525b",
    faint: "#71717a",
    track: "#e4e4e7",
    trackHover: "#d9d9de",
    knob: "#ffffff",
    danger: "#b91c1c",
    shadow: "0 1px 2px rgba(24,24,27,0.04), 0 32px 64px -40px rgba(24,24,27,0.25)",
  },
} as const;

type Palette = Record<keyof (typeof PALETTE)["dark"], string>;

/** The demo’s quiet backdrop; not part of the component. */
const STAGE = "#0a0a0b";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;

/** One place for the choreography. Seconds unless noted. */
const MOTION = {
  rise: 12, // px
  blur: 8, // px
  block: 0.5,
  step: 0.06, // title → description → tabs
  rowsAt: 0.22, // first row on first view
  rowStep: 0.05,
  switchStep: 0.04, // rows after a section switch
  settle: 0.16, // a row’s control settles (switch fills, pill lands) once the row is down
  exit: 0.16,
  height: 0.32, // card height follows the section
  savedFor: 1.8, // “Saved” lingers, then the bar leaves
  fade: 0.15, // reduced motion
} as const;

const SWITCH = { width: 44, height: 26, knob: 20, pad: 3 } as const;
const FAKE_SAVE_MS = 900;

/* ------------------------------------------------------------------ */
/* Demo content: Fieldnote, a research notes app                        */
/* ------------------------------------------------------------------ */

const DEMO_SECTIONS: SettingsSection[] = [
  {
    id: "notifications",
    label: "Notifications",
    description: "Sent to mika@fieldnote.app. Fieldnote never emails you about emails.",
    rows: [
      { kind: "toggle", id: "mentions", label: "Mentions", hint: "Someone @mentions you in a note or comment." },
      { kind: "toggle", id: "replies", label: "Replies to my comments", hint: "Threads you started or joined." },
      { kind: "toggle", id: "digest", label: "Weekly digest", hint: "Monday morning: what changed in notes you follow." },
      { kind: "toggle", id: "product", label: "Product news", hint: "About once a month. No “we miss you”." },
      {
        kind: "segmented",
        id: "delivery",
        label: "Delivery",
        hint: "Batching keeps your inbox quieter.",
        options: [
          { value: "instant", label: "Instantly" },
          { value: "hourly", label: "Hourly" },
          { value: "daily", label: "Daily" },
        ],
      },
    ],
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "Applies on this device only.",
    rows: [
      {
        kind: "segmented",
        id: "theme",
        label: "Theme",
        options: [
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
          { value: "system", label: "System" },
        ],
      },
      {
        kind: "segmented",
        id: "density",
        label: "Density",
        hint: "Compact fits about 30% more notes on screen.",
        options: [
          { value: "comfortable", label: "Comfortable" },
          { value: "compact", label: "Compact" },
        ],
      },
      {
        kind: "select",
        id: "weekStart",
        label: "Week starts on",
        options: ["Monday", "Sunday", "Saturday"].map((d) => ({ value: d, label: d })),
      },
      { kind: "toggle", id: "reduceMotion", label: "Calm mode", hint: "Fewer animations, no autoplaying previews." },
    ],
  },
  {
    id: "profile",
    label: "Profile",
    description: "What teammates see next to your notes and comments.",
    rows: [
      { kind: "text", id: "name", label: "Display name" },
      { kind: "text", id: "username", label: "Username", hint: "Lowercase letters, numbers and dashes.", prefix: "fieldnote.app/" },
      {
        kind: "select",
        id: "timezone",
        label: "Time zone",
        hint: "Used for reminders and your digest.",
        options: ["Europe/Helsinki (GMT+3)", "Europe/London (GMT+1)", "America/New_York (GMT−4)", "Asia/Tokyo (GMT+9)"].map((z) => ({ value: z, label: z })),
      },
    ],
  },
];

const DEMO_VALUES: SettingsValues = {
  mentions: true,
  replies: true,
  digest: true,
  product: false,
  delivery: "hourly",
  theme: "dark",
  density: "comfortable",
  weekStart: "Monday",
  reduceMotion: false,
  name: "Mika Korhonen",
  username: "mika",
  timezone: "Europe/Helsinki (GMT+3)",
};

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
  const vars: Record<string, string> = { "--sp-accent": accent, "--sp-on-accent": inkOn(accent) };
  for (const [k, v] of Object.entries(p)) vars[`--sp-${k}`] = v;
  return vars as CSSProperties;
}

/** A row’s starting value when the caller didn’t give one. */
function fallbackValue(row: SettingsRow): SettingValue {
  if (row.kind === "toggle") return false;
  if (row.kind === "text") return "";
  return row.options[0]?.value ?? "";
}

/** Entrance props for a block: rises out of a blur. Reduced motion: a short fade. */
function enter(play: boolean, delay: number, reduce: boolean) {
  if (reduce) return { initial: { opacity: 0 }, animate: { opacity: play ? 1 : 0 }, transition: { duration: MOTION.fade } };
  return {
    initial: { opacity: 0, y: MOTION.rise, filter: `blur(${MOTION.blur}px)` },
    animate: play ? { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } } : undefined,
    transition: { duration: MOTION.block, ease: EASE_OUT, delay },
  };
}

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sp-ink)]";
const fieldCls =
  "h-10 w-full rounded-lg border border-[var(--sp-line)] bg-[var(--sp-field)] px-3 text-[14px] text-[var(--sp-ink)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--sp-faint)] hover:border-[color-mix(in_srgb,var(--sp-ink)_22%,transparent)] focus:border-[color-mix(in_srgb,var(--sp-ink)_45%,transparent)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--sp-ink)_10%,transparent)]";

/* ------------------------------------------------------------------ */
/* Hooks                                                                */
/* ------------------------------------------------------------------ */

type SaveStatus = "idle" | "saving" | "saved" | "error";

/** Saved vs. edited values, the list of changed keys, and the save lifecycle. */
function useSettingsForm(sections: SettingsSection[], initialValues: SettingsValues, onSave?: SettingsPanelProps["onSave"], onChange?: SettingsPanelProps["onChange"]) {
  const [saved, setSaved] = useState<SettingsValues>(() => {
    const base: SettingsValues = {};
    for (const s of sections) for (const r of s.rows) base[r.id] = initialValues[r.id] ?? fallbackValue(r);
    return base;
  });
  const [values, setValues] = useState(saved);
  const [status, setStatus] = useState<SaveStatus>("idle");

  // Undoing a change by hand makes it disappear from the count.
  const changed = useMemo(() => Object.keys(values).filter((k) => values[k] !== saved[k]), [values, saved]);

  const set = useCallback(
    (id: string, value: SettingValue) => {
      setStatus((s) => (s === "saving" ? s : "idle"));
      setValues((v) => {
        const next = { ...v, [id]: value };
        onChange?.(next);
        return next;
      });
    },
    [onChange],
  );

  const save = useCallback(async () => {
    if (!changed.length || status === "saving") return;
    setStatus("saving");
    try {
      await (onSave ? onSave(values) : new Promise<void>((r) => setTimeout(r, FAKE_SAVE_MS)));
      setSaved(values);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }, [changed.length, status, onSave, values]);

  const discard = useCallback(() => {
    setValues(saved);
    setStatus("idle");
  }, [saved]);

  // “Saved” lingers, then the bar takes its leave.
  useEffect(() => {
    if (status !== "saved") return;
    const t = setTimeout(() => setStatus("idle"), MOTION.savedFor * 1000);
    return () => clearTimeout(t);
  }, [status]);

  return { values, changed, status, set, save, discard };
}

/** ⌘S / Ctrl+S, without re-binding the listener on every keystroke. */
function useSaveShortcut(save: () => void) {
  const latest = useRef(save);
  useEffect(() => {
    latest.current = save;
  }, [save]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        latest.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/** Content height, so the card can ease between sections instead of jumping. */
function useContentHeight() {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setHeight(entry.borderBoxSize[0]?.blockSize ?? el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, height };
}

/** False until `delay` has passed after `play`: lets a control settle after its row lands. */
function useSettled(play: boolean, delay: number) {
  const reduce = useReducedMotion() ?? false;
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!play || settled) return;
    if (reduce) {
      setSettled(true);
      return;
    }
    const t = setTimeout(() => setSettled(true), delay * 1000);
    return () => clearTimeout(t);
  }, [play, delay, reduce, settled]);
  return settled;
}

/* ------------------------------------------------------------------ */
/* Controls                                                             */
/* ------------------------------------------------------------------ */

/** A switch whose fill and knob only travel once its row has landed. */
function Toggle({ checked, onChange, labelledBy, describedBy, settleAt, play }: { checked: boolean; onChange: (v: boolean) => void; labelledBy: string; describedBy?: string; settleAt: number; play: boolean }) {
  const reduce = useReducedMotion() ?? false;
  const settled = useSettled(play, settleAt);
  const on = checked && settled;
  const travel = SWITCH.width - SWITCH.knob - SWITCH.pad * 2;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClick={() => onChange(!checked)}
      className={`group relative shrink-0 rounded-full transition-transform duration-150 active:scale-[0.96] ${focusRing}`}
      style={{ width: SWITCH.width, height: SWITCH.height }}
    >
      {/* 44px hit area around a 26px switch */}
      <span className="absolute -inset-[9px]" aria-hidden="true" />
      <span className="absolute inset-0 rounded-full bg-[var(--sp-track)] transition-colors duration-150 group-hover:bg-[var(--sp-trackHover)]" aria-hidden="true" />
      <motion.span
        className="absolute inset-0 rounded-full bg-[var(--sp-accent)]"
        initial={false}
        animate={{ opacity: on ? 1 : 0 }}
        transition={{ duration: reduce ? 0 : 0.2 }}
        aria-hidden="true"
      />
      <motion.span
        className="absolute rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.35)]"
        style={{ top: SWITCH.pad, left: SWITCH.pad, width: SWITCH.knob, height: SWITCH.knob }}
        initial={false}
        animate={{ x: on ? travel : 0, backgroundColor: on ? "var(--sp-on-accent)" : "var(--sp-knob)" }}
        transition={reduce ? { duration: 0 } : { x: SPRING_UI, backgroundColor: { duration: 0.2 } }}
        aria-hidden="true"
      />
    </button>
  );
}

function Segmented({ value, options, onChange, labelledBy, layoutId, settleAt, play }: { value: string; options: SettingOption[]; onChange: (v: string) => void; labelledBy: string; layoutId: string; settleAt: number; play: boolean }) {
  const reduce = useReducedMotion() ?? false;
  const settled = useSettled(play, settleAt);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  const onKey = (e: ReactKeyboardEvent) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      onKeyDown={onKey}
      className="grid w-full auto-cols-fr grid-flow-col rounded-lg border border-[var(--sp-line)] bg-[var(--sp-field)] p-[3px] @lg:inline-grid @lg:w-auto"
    >
      {options.map((o, i) => {
        const on = i === index;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`relative h-8 whitespace-nowrap rounded-md px-3.5 text-[13px] font-medium transition-[color,transform] duration-150 active:scale-[0.97] ${focusRing} ${
              on && settled ? "text-[var(--sp-surface)]" : on ? "text-[var(--sp-ink)]" : "text-[var(--sp-faint)] hover:text-[var(--sp-ink)]"
            }`}
          >
            {on && settled && (
              <motion.span
                layoutId={layoutId}
                initial={reduce ? false : { opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={reduce ? { duration: 0 } : SPRING_UI}
                className="absolute inset-0 rounded-md bg-[var(--sp-ink)]"
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function SelectField({ id, value, options, onChange, describedBy }: { id: string; value: string; options: SettingOption[]; onChange: (v: string) => void; describedBy?: string }) {
  return (
    <div className="relative">
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={describedBy} className={`${fieldCls} cursor-pointer appearance-none pr-9`}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--sp-faint)]" strokeWidth={1.75} aria-hidden="true" />
    </div>
  );
}

function TextField({ id, value, onChange, placeholder, prefix, describedBy }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string; prefix?: string; describedBy?: string }) {
  if (!prefix) return <input id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-describedby={describedBy} className={fieldCls} />;
  return (
    <div className={`${fieldCls} flex items-center gap-0 px-0 focus-within:border-[color-mix(in_srgb,var(--sp-ink)_45%,transparent)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--sp-ink)_10%,transparent)]`}>
      <span className="select-none pl-3 font-mono text-[12.5px] text-[var(--sp-faint)]">{prefix}</span>
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={describedBy}
        spellCheck={false}
        className="h-full min-w-0 flex-1 bg-transparent pr-3 font-mono text-[12.5px] text-[var(--sp-ink)] outline-none"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Layout pieces                                                        */
/* ------------------------------------------------------------------ */

/**
 * Label + hint on the left, the control on the right. Switches stay inline at every width;
 * segmented controls hug the right edge; text and selects fill their column.
 */
function Row({
  label,
  hint,
  labelId,
  hintId,
  htmlFor,
  control,
  delay,
  play,
  children,
}: {
  label: string;
  hint?: string;
  labelId: string;
  hintId: string;
  htmlFor?: string;
  control: "inline" | "end" | "fill";
  delay: number;
  play: boolean;
  children: ReactNode;
}) {
  const inline = control === "inline";
  const reduce = useReducedMotion() ?? false;
  const Label = htmlFor ? "label" : "p";
  return (
    <motion.div
      {...enter(play, delay, reduce)}
      className={`border-t border-[var(--sp-rule)] px-5 py-4 first:border-t-0 @lg:px-6 ${
        inline ? "flex items-center justify-between gap-6" : "grid gap-3 @lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] @lg:items-center @lg:gap-8"
      }`}
    >
      <div className="min-w-0">
        <Label id={labelId} {...(htmlFor ? { htmlFor } : {})} className="block text-[14px] font-medium text-[var(--sp-ink)]">
          {label}
        </Label>
        {hint && (
          <p id={hintId} className="mt-0.5 text-[13px] leading-snug text-[var(--sp-faint)]">
            {hint}
          </p>
        )}
      </div>
      <div className={inline ? "shrink-0" : control === "end" ? "min-w-0 @lg:justify-self-end" : "min-w-0"}>{children}</div>
    </motion.div>
  );
}

/** Every row of one section. Rows stagger in on first view and again after each switch. */
function Section({ section, values, onSet, play, firstView, uid }: { section: SettingsSection; values: SettingsValues; onSet: (id: string, v: SettingValue) => void; play: boolean; firstView: boolean; uid: string }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <motion.div
      role="tabpanel"
      id={`${uid}-panel-${section.id}`}
      aria-labelledby={`${uid}-tab-${section.id}`}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(4px)", transition: { duration: MOTION.exit, ease: EASE_IN } }}
    >
      {section.rows.map((row, i) => {
        const delay = firstView ? MOTION.rowsAt + i * MOTION.rowStep : 0.04 + i * MOTION.switchStep;
        const settleAt = delay + MOTION.settle;
        const ids = { labelId: `${uid}-${row.id}-label`, hintId: `${uid}-${row.id}-hint`, control: `${uid}-${row.id}` };
        const describedBy = row.hint ? ids.hintId : undefined;
        const value = values[row.id];
        return (
          <Row
            key={row.id}
            label={row.label}
            hint={row.hint}
            labelId={ids.labelId}
            hintId={ids.hintId}
            htmlFor={row.kind === "select" || row.kind === "text" ? ids.control : undefined}
            control={row.kind === "toggle" ? "inline" : row.kind === "segmented" ? "end" : "fill"}
            delay={delay}
            play={play}
          >
            {row.kind === "toggle" && (
              <Toggle checked={value === true} onChange={(v) => onSet(row.id, v)} labelledBy={ids.labelId} describedBy={describedBy} settleAt={settleAt} play={play} />
            )}
            {row.kind === "segmented" && (
              <Segmented
                value={String(value)}
                options={row.options}
                onChange={(v) => onSet(row.id, v)}
                labelledBy={ids.labelId}
                layoutId={`${uid}-${row.id}-pill`}
                settleAt={settleAt}
                play={play}
              />
            )}
            {row.kind === "select" && <SelectField id={ids.control} value={String(value)} options={row.options} onChange={(v) => onSet(row.id, v)} describedBy={describedBy} />}
            {row.kind === "text" && (
              <TextField id={ids.control} value={String(value)} placeholder={row.placeholder} prefix={row.prefix} onChange={(v) => onSet(row.id, v)} describedBy={describedBy} />
            )}
          </Row>
        );
      })}
    </motion.div>
  );
}

function SectionTabs({ sections, value, dirty, onChange, uid }: { sections: SettingsSection[]; value: string; dirty: Set<string>; onChange: (id: string) => void; uid: string }) {
  const reduce = useReducedMotion() ?? false;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, sections.findIndex((s) => s.id === value));

  const onKey = (e: ReactKeyboardEvent) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + sections.length) % sections.length;
    onChange(sections[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label="Settings sections" onKeyDown={onKey} className="-mb-px flex gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {sections.map((s, i) => {
        const on = i === index;
        return (
          <button
            key={s.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${uid}-tab-${s.id}`}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={`${uid}-panel-${s.id}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(s.id)}
            className={`relative flex h-11 shrink-0 items-center gap-1.5 text-[14px] transition-[color,transform] duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--sp-ink)] ${
              on ? "text-[var(--sp-ink)]" : "text-[var(--sp-faint)] hover:text-[var(--sp-ink)]"
            }`}
          >
            {s.label}
            <AnimatePresence>
              {dirty.has(s.id) && (
                <motion.span
                  key="dot"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={reduce ? { duration: 0 } : SPRING_UI}
                  className="size-1.5 rounded-full bg-[var(--sp-muted)]"
                  aria-label="unsaved changes"
                />
              )}
            </AnimatePresence>
            {on && (
              <motion.span layoutId={`${uid}-tab`} transition={reduce ? { duration: 0 } : SPRING_UI} className="absolute inset-x-0 bottom-0 h-[1.5px] rounded-full bg-[var(--sp-ink)]" aria-hidden="true" />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Slides up from the card’s foot while there’s something to save, then says so and leaves. */
function SaveBar({ count, status, onSave, onDiscard }: { count: number; status: SaveStatus; onSave: () => void; onDiscard: () => void }) {
  const reduce = useReducedMotion() ?? false;
  const show = count > 0 || status === "saved";
  const message = status === "saved" && count === 0 ? "saved" : status === "error" ? "error" : "dirty";
  const swap = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 6, filter: "blur(3px)" }, animate: { opacity: 1, y: 0, filter: "blur(0px)" }, exit: { opacity: 0, y: -6, filter: "blur(3px)" } };

  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key="bar"
          initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0, transition: { duration: 0.22, ease: EASE_IN } }}
          transition={{ duration: reduce ? MOTION.fade : 0.34, ease: EASE_OUT }}
          className="overflow-hidden"
        >
          <div className="flex items-center gap-3 border-t border-[var(--sp-line)] bg-[var(--sp-raised)] py-3 pl-5 pr-3 @lg:pl-6" aria-live="polite">
            <div className="relative h-5 min-w-0 flex-1 overflow-hidden text-[14px]">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.p key={message === "dirty" ? `dirty-${count}` : message} {...swap} transition={{ duration: 0.2, ease: EASE_OUT }} className="flex items-center gap-2 truncate">
                  {message === "saved" && (
                    <>
                      <Check className="size-4 shrink-0 text-[var(--sp-ink)]" strokeWidth={2.5} aria-hidden="true" />
                      Changes saved
                    </>
                  )}
                  {message === "error" && <span className="text-[var(--sp-danger)]">Couldn’t save. Check your connection.</span>}
                  {message === "dirty" && (
                    <span className="truncate text-[var(--sp-muted)]">
                      <span className="tabular-nums text-[var(--sp-ink)]">{count}</span> unsaved {count === 1 ? "change" : "changes"}
                    </span>
                  )}
                </motion.p>
              </AnimatePresence>
            </div>
            {count > 0 && (
              <>
                <button
                  type="button"
                  onClick={onDiscard}
                  disabled={status === "saving"}
                  className={`h-9 shrink-0 rounded-lg px-3 text-[13px] font-medium text-[var(--sp-muted)] transition-[color,background-color,transform] duration-150 hover:bg-[color-mix(in_srgb,var(--sp-ink)_6%,transparent)] hover:text-[var(--sp-ink)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={status === "saving"}
                  className={`relative inline-flex h-9 min-w-[7.5rem] shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--sp-accent)] px-3.5 text-[13px] font-semibold text-[var(--sp-on-accent)] transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.97] disabled:cursor-progress ${focusRing}`}
                >
                  {status === "saving" ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" strokeWidth={2.5} aria-hidden="true" />
                      Saving
                    </>
                  ) : status === "error" ? (
                    <>
                      <RotateCcw className="size-3.5" strokeWidth={2.5} aria-hidden="true" />
                      Try again
                    </>
                  ) : (
                    <>
                      Save
                      <kbd className="hidden rounded border border-current/25 px-1 font-mono text-[10px] font-medium opacity-70 @md:inline">⌘S</kbd>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function SettingsPanel({
  title = "Settings",
  description = "How Fieldnote looks, and how often it’s allowed to interrupt you.",
  sections = DEMO_SECTIONS,
  defaultSection,
  initialValues = DEMO_VALUES,
  onSave,
  onChange,
  accent,
  theme = "dark",
  className = "",
}: SettingsPanelProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const root = useRef<HTMLElement>(null);
  const play = useInView(root, { once: true, amount: 0.2 });
  const palette = PALETTE[theme];
  const form = useSettingsForm(sections, initialValues, onSave, onChange);
  const { ref: bodyRef, height } = useContentHeight();

  const [active, setActive] = useState(defaultSection ?? sections[0]?.id ?? "");
  // The first section staggers in with the card; later switches are quicker.
  const [switched, setSwitched] = useState(false);
  const section = sections.find((s) => s.id === active) ?? sections[0];

  useSaveShortcut(() => void form.save());

  const dirtySections = useMemo(() => new Set(sections.filter((s) => s.rows.some((r) => form.changed.includes(r.id))).map((s) => s.id)), [sections, form.changed]);

  if (!section) return null;

  const choose = (id: string) => {
    if (id === section.id) return;
    setSwitched(true);
    setActive(id);
  };

  return (
    <section
      ref={root}
      aria-labelledby={`${uid}-title`}
      style={cssVars(palette, accent ?? palette.ink)}
      className={`@container w-full font-sans text-[var(--sp-ink)] antialiased ${theme === "dark" ? "[color-scheme:dark]" : "[color-scheme:light]"} ${className}`}
    >
      <motion.div {...enter(play, 0, reduce)} className="overflow-hidden rounded-[16px] border border-[var(--sp-line)] bg-[var(--sp-surface)] shadow-[var(--sp-shadow)]">
        <header className="border-b border-[var(--sp-line)] px-5 pt-6 @lg:px-6 @lg:pt-7">
          <motion.h2 id={`${uid}-title`} {...enter(play, MOTION.step, reduce)} className="font-display text-[clamp(1.5rem,1.1rem+2cqi,2rem)] font-semibold leading-none tracking-[-0.035em]">
            {title}
          </motion.h2>
          <motion.p {...enter(play, MOTION.step * 2, reduce)} className="mt-2 max-w-[56ch] text-pretty text-[14px] leading-relaxed text-[var(--sp-muted)]">
            {description}
          </motion.p>
          <motion.div {...enter(play, MOTION.step * 3, reduce)} className="mt-5">
            <SectionTabs sections={sections} value={section.id} dirty={dirtySections} onChange={choose} uid={uid} />
          </motion.div>
        </header>

        {/* The card’s height eases to each section’s rows rather than jumping. */}
        <motion.div
          initial={false}
          animate={{ height }}
          transition={{ duration: reduce ? 0 : MOTION.height, ease: EASE_OUT }}
          className="overflow-hidden"
        >
          <div ref={bodyRef}>
            {section.description && (
              <div className="relative overflow-hidden px-5 pt-4 @lg:px-6">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={section.id}
                    {...enter(play, switched ? 0 : MOTION.step * 3, reduce)}
                    exit={{ opacity: 0, transition: { duration: MOTION.exit } }}
                    className="text-[13px] leading-relaxed text-[var(--sp-faint)]"
                  >
                    {section.description}
                  </motion.p>
                </AnimatePresence>
              </div>
            )}
            <div className="py-1">
              <AnimatePresence mode="wait">
                <Section key={section.id} section={section} values={form.values} onSet={form.set} play={play} firstView={!switched} uid={uid} />
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        <SaveBar count={form.changed.length} status={form.status} onSave={() => void form.save()} onDiscard={form.discard} />
      </motion.div>
    </section>
  );
}

export default function SettingsPanelDemo() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-16 sm:px-8" style={{ background: STAGE }}>
      <div className="w-full max-w-[680px]">
        <SettingsPanel />
      </div>
    </div>
  );
}
