"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from "react";
import { AnimatePresence, animate, motion, stagger, useMotionValue, useReducedMotion, useTransform, type AnimationPlaybackControls } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

/** Where the confirm stands: waiting for the visitor, deleting, deleted, or failed. */
export type ConfirmStatus = "idle" | "pending" | "done" | "error";

/** One line of what goes with the resource. */
export type LedgerRow = { label: string; value: number; suffix?: string };

/** The words the dialog says around its actions. `{name}` stands for the resource name. */
export type ConfirmLabels = {
  pending: string;
  done: string;
  error: string;
  failed: string;
  cancel: string;
  archive: string;
  archiveFailed: string;
  field: string;
  announceDone: string;
};

export type DialogConfirmTypedProps = {
  /** The button in the card that opens the dialog. */
  triggerLabel?: string;
  /** The exact name the visitor must type before Delete enables. */
  resourceName?: string;
  /** Small caps line above the card title. */
  cardKicker?: string;
  /** The card’s heading. */
  cardTitle?: string;
  /** The card’s sentence. `{name}` stands for the resource name. */
  cardDescription?: string;
  /** Heading level of the card title, so it fits the page’s outline. */
  cardHeadingLevel?: 2 | 3 | 4 | 5 | 6;
  /** Small caps line above the dialog title. It becomes the error line when a delete fails. */
  kicker?: string;
  /** The dialog title. `{name}` stands for the resource name. */
  title?: string;
  /** The dialog’s sentence, read out as its description. */
  description?: string;
  /** The heading over the ledger. */
  ledgerLabel?: string;
  /** What goes with the resource. Each figure counts up when the dialog opens. */
  ledger?: LedgerRow[];
  /** The confirm button’s label. Defaults to the trigger’s. */
  confirmLabel?: string;
  /** Override any of the dialog’s other words. */
  labels?: Partial<ConfirmLabels>;
  /** Ask for the exact name first. Off, Delete is a single plain confirm. */
  requireTyping?: boolean;
  /** Offer “Archive instead”, which keeps environments and history. */
  alternative?: boolean;
  /** Red for removal; the theme’s ink for anything milder. */
  tone?: "danger" | "neutral";
  theme?: "dark" | "light";
  /** Controlled open state. Leave it out and the trigger owns it. */
  open?: boolean;
  /** Fires on every open and close, from the trigger, Cancel, Esc, the scrim or a finished delete. */
  onOpenChange?: (open: boolean) => void;
  /** Controlled status, for a host that tracks the delete itself (a mutation’s status). Leave it out and onConfirm’s promise drives it. */
  status?: ConfirmStatus;
  /** Fires on every status change, including the return to idle after an error or a close. */
  onStatusChange?: (status: ConfirmStatus) => void;
  /** Runs with the typed name. Return a promise for the pending state; reject it for the error state. */
  onConfirm?: (name: string) => void | Promise<unknown>;
  /** Runs when the visitor picks Archive instead. Return a promise to hold the dialog open until it settles. */
  onArchive?: () => void | Promise<unknown>;
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    card: "#121214",
    panel: "#161618",
    field: "#0e0e10",
    line: "rgba(255,255,255,0.08)",
    rule: "rgba(255,255,255,0.07)",
    ink: "#f4f4f5",
    body: "#b4b4bc",
    muted: "#8a8a93",
    scrim: "rgba(0,0,0,0.62)",
    ok: "#5cb86f",
    focus: "rgba(244,244,245,0.42)",
  },
  light: {
    card: "#ffffff",
    panel: "#ffffff",
    field: "#f6f6f7",
    line: "rgba(24,24,27,0.10)",
    rule: "rgba(24,24,27,0.08)",
    ink: "#18181b",
    body: "#3f3f46",
    muted: "#6b6b74",
    scrim: "rgba(18,18,20,0.42)",
    ok: "#2f7d43",
    focus: "rgba(24,24,27,0.40)",
  },
} as const;

/** Each tone owns the fill of the confirm button, the trigger’s ink and hairline, and the card’s rule. */
const TONE = {
  dark: {
    danger: { fill: "#d63b40", ink: "#ff8b8f", wash: "rgba(214,59,64,0.10)", line: "rgba(214,59,64,0.42)", on: "#ffffff" },
    neutral: { fill: "#f4f4f5", ink: "#f4f4f5", wash: "rgba(255,255,255,0.06)", line: "rgba(255,255,255,0.22)", on: "#0b0b0c" },
  },
  light: {
    danger: { fill: "#dc2626", ink: "#b91c1c", wash: "rgba(220,38,38,0.07)", line: "rgba(220,38,38,0.38)", on: "#ffffff" },
    neutral: { fill: "#18181b", ink: "#18181b", wash: "rgba(24,24,27,0.05)", line: "rgba(24,24,27,0.22)", on: "#ffffff" },
  },
} as const;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;

/** One place for the feel. Seconds unless noted. */
const MOTION = {
  open: 0.5, // the panel grows out of the trigger
  close: 0.26, // and folds back into it
  block: 0.42, // each block of content rises into place
  riseAt: 0.14, // after the panel has started to open
  step: 0.05, // reading order, one block at a time
  rise: 8,
  count: 0.7, // ledger figures count up from zero
  reach: 960, // px, the circle’s end radius: past the far corner of the panel
  shake: [0, -3, 3, -2, 2, -1, 0],
  shakeFor: 0.34,
  fade: 0.15, // reduced motion: opacity only
  doneHoldMs: 520, // “Deleted” shows before the dialog closes
  errorMs: 2600,
} as const;

/** The root is never shorter than this, and always tall enough for the panel plus this gutter. */
const LAYOUT = { minHeight: 640, gutter: 24 } as const;

const LABELS: ConfirmLabels = {
  pending: "Deleting…",
  done: "Deleted",
  error: "Couldn’t delete",
  failed: "Couldn’t delete. Nothing was removed.",
  cancel: "Cancel",
  archive: "Archive instead",
  archiveFailed: "Couldn’t archive",
  field: "Type {name} to confirm",
  announceDone: "{name} deleted",
};

const LEDGER: LedgerRow[] = [
  { label: "Environments", value: 12 },
  { label: "Last deploy", value: 3, suffix: "h ago" },
  { label: "Environment variables", value: 47 },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function isPromise(value: unknown): value is PromiseLike<unknown> {
  return typeof (value as PromiseLike<unknown> | undefined)?.then === "function";
}

function fill(template: string, name: string) {
  return template.split("{name}").join(name);
}

/** Where the panel’s clip circle starts: the trigger’s centre, in the panel’s own coordinates. */
function originOf(panel: HTMLElement, root: HTMLElement, trigger: HTMLElement | null) {
  if (!trigger) return { x: panel.offsetWidth / 2, y: panel.offsetHeight / 2 };
  const r = root.getBoundingClientRect();
  const t = trigger.getBoundingClientRect();
  // offsetLeft/offsetTop ignore transforms, so a panel mid-animation still measures true. They also ignore
  // the panel’s own -50% centring translate, so take half its size off to reach its real top-left corner.
  const left = panel.offsetLeft - panel.offsetWidth / 2;
  const top = panel.offsetTop - panel.offsetHeight / 2;
  return { x: t.left - r.left + t.width / 2 - left, y: t.top - r.top + t.height / 2 - top };
}

/** setTimeout that is cleared on unmount, so a late callback never lands on a dead component. */
function useTimers() {
  const ids = useRef<number[]>([]);
  useEffect(() => () => ids.current.forEach(clearTimeout), []);
  return useCallback((fn: () => void, ms: number) => {
    ids.current.push(window.setTimeout(fn, ms));
  }, []);
}

/** The panel’s rendered height, so the root can always make room for it. */
function useHeight(ref: RefObject<HTMLElement | null>) {
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setHeight(el.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return height;
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function DialogConfirmTyped({
  triggerLabel = "Delete project",
  resourceName = "atlas-staging",
  cardKicker = "Settings",
  cardTitle = "Delete this project",
  cardDescription = "Removes {name}, its environments and its deploy history. Nothing is kept once it is gone.",
  cardHeadingLevel = 2,
  kicker = "Permanent deletion",
  title = "Delete {name}",
  description = "This removes the project and everything inside it. There is no recovery window and no undo.",
  ledgerLabel = "What goes with it",
  ledger = LEDGER,
  confirmLabel,
  labels: labelOverrides,
  requireTyping = true,
  alternative = true,
  tone = "danger",
  theme = "dark",
  open: openProp,
  onOpenChange,
  status: statusProp,
  onStatusChange,
  onConfirm,
  onArchive,
  className = "",
}: DialogConfirmTypedProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const alive = useRef(true);
  const wasOpen = useRef(false);
  const openRef = useRef(false);
  const origin = useRef({ x: 0, y: 0 });
  const runs = useRef<AnimationPlaybackControls[]>([]);
  const errorRun = useRef(0);
  const later = useTimers();
  const panelHeight = useHeight(panelRef);

  const openControlled = openProp !== undefined;
  const [innerOpen, setInnerOpen] = useState(false);
  const open = openControlled ? openProp : innerOpen;

  const statusControlled = statusProp !== undefined;
  const [innerStatus, setInnerStatus] = useState<ConfirmStatus>("idle");
  const status = statusControlled ? statusProp : innerStatus;
  const statusRef = useRef(status);
  statusRef.current = status;

  const [typed, setTyped] = useState("");
  const [announce, setAnnounce] = useState("");

  const words = useMemo(() => ({ ...LABELS, ...labelOverrides }), [labelOverrides]);
  const confirmText = confirmLabel ?? triggerLabel;

  const palette = PALETTE[theme];
  const toneColours = TONE[theme][tone];
  const vars = useMemo(
    () =>
      ({
        "--dcf-card": palette.card,
        "--dcf-panel": palette.panel,
        "--dcf-field": palette.field,
        "--dcf-line": palette.line,
        "--dcf-rule": palette.rule,
        "--dcf-ink": palette.ink,
        "--dcf-body": palette.body,
        "--dcf-muted": palette.muted,
        "--dcf-scrim": palette.scrim,
        "--dcf-ok": palette.ok,
        "--dcf-focus": palette.focus,
        "--dcf-fill": toneColours.fill,
        "--dcf-tone-ink": toneColours.ink,
        "--dcf-wash": toneColours.wash,
        "--dcf-tone-line": toneColours.line,
        "--dcf-on-fill": toneColours.on,
      }) as CSSProperties,
    [palette, toneColours],
  );

  const changeOpen = useCallback(
    (next: boolean) => {
      if (!openControlled) setInnerOpen(next);
      onOpenChange?.(next);
    },
    [openControlled, onOpenChange],
  );

  const changeStatus = useCallback(
    (next: ConfirmStatus) => {
      if (statusRef.current === next) return;
      statusRef.current = next;
      if (!statusControlled) setInnerStatus(next);
      onStatusChange?.(next);
    },
    [statusControlled, onStatusChange],
  );

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const matches = !requireTyping || typed.trim() === resourceName.trim();
  const busy = status === "pending" || status === "done";

  const dismiss = () => {
    if (!busy) changeOpen(false);
  };

  /* Open and close: the panel grows out of the trigger and folds back into it. Imperative, so the same path serves a click and the host’s Open action. Acts only on a transition, so a changed prop never replays it. */
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const root = rootRef.current;
    const trigger = triggerRef.current;
    openRef.current = open;
    const opening = open && !wasOpen.current;
    const closing = !open && wasOpen.current;
    if (!panel || !root || (!opening && !closing)) return;
    wasOpen.current = open;
    runs.current.forEach((r) => r.stop());
    runs.current = [];

    if (opening) {
      const { x, y } = originOf(panel, root, trigger);
      origin.current = { x, y };
      const at = `${x}px ${y}px`;
      panel.style.visibility = "visible";
      panel.style.transformOrigin = at;
      // A host that opens straight into a later status has already confirmed the name, so the field shows it.
      if (!statusControlled) changeStatus("idle");
      setTyped(statusRef.current === "idle" ? "" : resourceName);
      setAnnounce("");

      if (reduce) {
        runs.current.push(animate(panel, { opacity: [0, 1] }, { duration: MOTION.fade }));
      } else {
        const grow = animate(
          panel,
          { clipPath: [`circle(0px at ${at})`, `circle(${MOTION.reach}px at ${at})`], scale: [0.965, 1], opacity: [0.5, 1] },
          { duration: MOTION.open, ease: EASE_OUT },
        );
        runs.current.push(grow);
        // Only the run that is still current may clear the clip; a stopped run must not touch a reopened panel.
        grow.finished.then(() => {
          if (alive.current && runs.current.includes(grow)) panel.style.clipPath = "";
        });
      }

      const blocks = Array.from(panel.querySelectorAll<HTMLElement>("[data-rise]"));
      runs.current.push(
        animate(
          blocks,
          reduce ? { opacity: [0, 1] } : { opacity: [0, 1], y: [MOTION.rise, 0], filter: ["blur(4px)", "blur(0px)"] },
          { duration: reduce ? MOTION.fade : MOTION.block, ease: EASE_OUT, delay: stagger(MOTION.step, { startDelay: MOTION.riseAt }) },
        ),
      );

      // Focus the field when a name is required, otherwise the least destructive action.
      (requireTyping ? fieldRef.current : cancelRef.current)?.focus({ preventScroll: true });
    } else {
      // Hand focus back before the panel hides, so nothing is left focused in a hidden tree.
      trigger?.focus({ preventScroll: true });
      const { x, y } = origin.current;
      const at = `${x}px ${y}px`;
      const hide = () => {
        // A reopen during the fold stops this run; a stopped run must never hide the new panel.
        if (!alive.current || openRef.current || !runs.current.includes(fold)) return;
        panel.style.visibility = "hidden";
        panel.style.clipPath = "";
        panel.style.transform = "";
        // The confirm settles back once it is out of sight, so the next open starts clean.
        changeStatus("idle");
      };
      const fold = reduce
        ? animate(panel, { opacity: [1, 0] }, { duration: MOTION.fade })
        : animate(
            panel,
            { clipPath: [`circle(${MOTION.reach}px at ${at})`, `circle(0px at ${at})`], scale: [1, 0.965], opacity: [1, 0] },
            { duration: MOTION.close, ease: EASE_IN },
          );
      runs.current.push(fold);
      fold.finished.then(hide);
    }
    // Runs on open transitions only; the status and name it reads are current through refs and the transition itself.
  }, [open, reduce, requireTyping]);

  // Scroll lock while open, so the page behind the dialog stays put.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  /* What each status means once it lands, whether the promise or the host moved it there. */
  useEffect(() => {
    if (!open) return;
    if (status === "idle") return;
    // Past idle the name is confirmed; a host-driven status must not leave Delete gated on an empty field.
    if (requireTyping) setTyped((t) => (t.trim() === resourceName.trim() ? t : resourceName));
    if (status === "pending") {
      setAnnounce(words.pending);
    } else if (status === "done") {
      setAnnounce(fill(words.announceDone, resourceName));
      later(() => {
        if (statusRef.current === "done" && openRef.current) changeOpen(false);
      }, MOTION.doneHoldMs);
    } else {
      setAnnounce(words.failed);
      const panel = panelRef.current;
      if (panel && !reduce) runs.current.push(animate(panel, { x: [...MOTION.shake] }, { duration: MOTION.shakeFor, ease: "easeOut" }));
      // Keep keyboard users on the retry rather than nowhere.
      if (panel && !panel.contains(document.activeElement)) confirmRef.current?.focus({ preventScroll: true });
      const run = ++errorRun.current;
      later(() => {
        if (run === errorRun.current && statusRef.current === "error") changeStatus("idle");
      }, MOTION.errorMs);
    }
    // Keyed on the status (and on opening into one); the words and name are read as they stand.
  }, [status, open]);

  const confirm = () => {
    if (!matches || busy) return;
    changeStatus("pending");
    let result: void | Promise<unknown>;
    try {
      result = onConfirm?.(resourceName);
    } catch {
      changeStatus("error");
      return;
    }
    if (isPromise(result)) {
      result.then(
        () => alive.current && changeStatus("done"),
        () => alive.current && changeStatus("error"),
      );
    } else changeStatus("done");
  };

  const archive = () => {
    if (busy) return;
    let result: void | Promise<unknown>;
    try {
      result = onArchive?.();
    } catch {
      setAnnounce(words.archiveFailed);
      return;
    }
    if (isPromise(result)) {
      result.then(
        () => alive.current && changeOpen(false),
        () => alive.current && setAnnounce(words.archiveFailed),
      );
    } else changeOpen(false);
  };

  /* Focus stays inside the dialog while it is open; Esc dismisses it. The panel itself takes focus on a click, so Esc keeps working after one. */
  const onPanelKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      dismiss();
      return;
    }
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const nodes = Array.from(panel.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)"));
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    const outside = !active || active === panel || !panel.contains(active);
    if (e.shiftKey && (active === first || outside)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || outside)) {
      e.preventDefault();
      first.focus();
    }
  };

  const titleId = `${uid}-title`;
  const bodyId = `${uid}-body`;
  const fieldId = `${uid}-field`;
  const CardHeading = `h${cardHeadingLevel}` as "h2" | "h3" | "h4" | "h5" | "h6";
  const [fieldBefore, fieldAfter = ""] = words.field.split("{name}");

  return (
    <div
      ref={rootRef}
      style={{ ...vars, minHeight: Math.max(LAYOUT.minHeight, panelHeight + LAYOUT.gutter * 2) }}
      className={`@container relative isolate flex w-full items-center justify-center px-4 py-14 font-sans antialiased sm:px-8 ${theme === "dark" ? "[color-scheme:dark]" : "[color-scheme:light]"} ${className}`}
    >
      {/* The surface that holds the trigger. Inert while open, so nothing behind the dialog takes focus. */}
      <section
        inert={open}
        aria-labelledby={`${uid}-card`}
        className="relative w-full max-w-[560px] rounded-[16px] bg-[var(--dcf-card)] p-5 shadow-[inset_0_0_0_1px_var(--dcf-tone-line),inset_0_1px_0_rgba(255,255,255,0.04),0_30px_60px_-40px_rgba(0,0,0,0.6)] @md:flex @md:items-center @md:justify-between @md:gap-8 @md:p-6"
      >
        <div className="min-w-0">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--dcf-muted)]">{cardKicker}</p>
          <CardHeading id={`${uid}-card`} className="mt-2 font-display text-[20px] leading-[1.15] tracking-[-0.02em] text-[var(--dcf-ink)]">
            {cardTitle}
          </CardHeading>
          <p className="mt-1.5 max-w-[44ch] text-[13.5px] leading-[1.55] text-[var(--dcf-body)]">{fill(cardDescription, resourceName)}</p>
        </div>
        <button
          ref={triggerRef}
          type="button"
          data-demo="trigger"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => changeOpen(true)}
          className="mt-5 inline-flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-[11px] px-4 text-[13.5px] font-medium tracking-[-0.01em] text-[var(--dcf-tone-ink)] shadow-[inset_0_0_0_1px_var(--dcf-tone-line)] transition-[background-color,scale] duration-150 ease-out hover:bg-[var(--dcf-wash)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dcf-tone-ink)] active:scale-[0.97] @md:mt-0"
        >
          {triggerLabel}
        </button>
      </section>

      {/* The scrim. Clicking it is the same as Cancel, except while a delete is running. */}
      <div
        aria-hidden="true"
        onClick={dismiss}
        className={`absolute inset-0 z-10 bg-[var(--dcf-scrim)] transition-opacity duration-200 ease-out ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        inert={!open}
        style={{ visibility: "hidden" }}
        onKeyDown={onPanelKey}
        className="absolute left-1/2 top-1/2 z-20 w-[min(460px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[18px] bg-[var(--dcf-panel)] p-6 text-[var(--dcf-ink)] shadow-[inset_0_0_0_1px_var(--dcf-line),inset_0_1px_0_rgba(255,255,255,0.05),0_40px_90px_-30px_rgba(0,0,0,0.85)] outline-none @md:p-7"
      >
        {/* The kicker doubles as the error line, so a failed delete is explained without moving anything. */}
        <p data-rise className="grid font-mono text-[10.5px] uppercase tracking-[0.14em]">
          {/* Both lines sit invisibly in the cell, so an error that wraps in a narrow panel still moves nothing. */}
          {[kicker, words.failed].map((line, i) => (
            <span key={i} aria-hidden="true" className="invisible col-start-1 row-start-1">
              {line}
            </span>
          ))}
          <AnimatePresence initial={false}>
            <motion.span
              key={status === "error" ? "failed" : "kicker"}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: -4, filter: "blur(2px)", transition: { duration: 0.14, ease: EASE_IN } }}
              transition={{ duration: reduce ? MOTION.fade : 0.22, ease: EASE_OUT }}
              className={`col-start-1 row-start-1 ${status === "error" ? "text-[var(--dcf-tone-ink)]" : "text-[var(--dcf-muted)]"}`}
            >
              {status === "error" ? words.failed : kicker}
            </motion.span>
          </AnimatePresence>
        </p>
        <h2 id={titleId} data-rise className="mt-2.5 break-words font-display text-[24px] leading-[1.1] tracking-[-0.03em]">
          {fill(title, resourceName)}
        </h2>
        <p id={bodyId} data-rise className="mt-2.5 text-[14px] leading-[1.55] text-[var(--dcf-body)]">
          {description}
        </p>

        {ledger.length ? (
          <>
            <p data-rise className="mt-6 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--dcf-muted)]">
              {ledgerLabel}
            </p>
            <dl data-rise className="mt-2 border-y border-[var(--dcf-rule)]">
              {ledger.map((row) => (
                <Ledger key={row.label} row={row} open={open} reduce={reduce} />
              ))}
            </dl>
          </>
        ) : null}

        {requireTyping ? (
          <div data-rise className="mt-5">
            <label htmlFor={fieldId} className="block text-[13px] text-[var(--dcf-body)]">
              {fieldBefore}
              <span className="font-mono text-[var(--dcf-ink)]">{resourceName}</span>
              {fieldAfter}
            </label>
            <div className="relative mt-2">
              <input
                ref={fieldRef}
                id={fieldId}
                data-demo="name"
                type="text"
                value={typed}
                readOnly={busy}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  confirm();
                }}
                autoComplete="off"
                spellCheck={false}
                aria-describedby={bodyId}
                className="h-11 w-full rounded-[11px] bg-[var(--dcf-field)] px-3.5 pr-10 font-mono text-[14px] text-[var(--dcf-ink)] shadow-[inset_0_0_0_1px_var(--dcf-line)] transition-shadow duration-150 ease-out focus:shadow-[inset_0_0_0_1px_var(--dcf-focus)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dcf-ink)]"
              />
              <AnimatePresence initial={false}>
                {matches ? (
                  <motion.span
                    key="matched"
                    aria-hidden="true"
                    initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.12 } }}
                    transition={{ duration: 0.2, ease: EASE_OUT }}
                    className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--dcf-ok)]"
                  >
                    <CheckIcon size={16} reduce={reduce} />
                  </motion.span>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        ) : null}

        {/* Cancel and Delete come first in the DOM, so Tab goes from the field straight to them. From @lg the row reverses and Archive sits on the left; below it, the pair fills the width and Archive stacks under it, and in the narrowest containers Delete stacks over Cancel. */}
        <div data-rise className="mt-6 flex flex-col gap-2 @lg:flex-row-reverse @lg:items-center @lg:justify-between @lg:gap-4">
          <div className="flex flex-col-reverse gap-2 @xs:flex-row @xs:items-center">
            <button
              ref={cancelRef}
              type="button"
              onClick={dismiss}
              disabled={busy}
              className="inline-flex h-11 cursor-pointer items-center justify-center rounded-[11px] px-4 text-[14px] text-[var(--dcf-body)] shadow-[inset_0_0_0_1px_var(--dcf-line)] transition-[background-color,scale] duration-150 ease-out hover:bg-[var(--dcf-wash)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dcf-ink)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {words.cancel}
            </button>
            {/* Only the unconfirmed name truly disables Delete. While it works, it stays focused and at full strength, and aria-disabled turns further presses away. */}
            <button
              ref={confirmRef}
              type="button"
              data-demo="confirm"
              onClick={confirm}
              disabled={!matches}
              aria-disabled={busy || undefined}
              aria-busy={status === "pending" || undefined}
              className={`grid h-11 place-items-center rounded-[11px] px-5 text-[14px] font-medium tracking-[-0.01em] transition-[background-color,opacity,scale] duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dcf-fill)] disabled:cursor-not-allowed disabled:opacity-40 @xs:flex-1 @lg:min-w-[168px] @lg:flex-none ${
                status === "pending" ? "cursor-progress" : busy ? "cursor-default" : "cursor-pointer active:scale-[0.98]"
              }`}
              style={{ background: "var(--dcf-fill)", color: "var(--dcf-on-fill)" }}
            >
              <ConfirmLabel status={status} label={confirmText} words={words} reduce={reduce} />
            </button>
          </div>
          {alternative ? (
            <button
              type="button"
              onClick={archive}
              disabled={busy}
              className="inline-flex h-11 cursor-pointer items-center justify-center rounded-[11px] px-3 text-[14px] text-[var(--dcf-muted)] transition-[background-color,color,scale] duration-150 ease-out hover:bg-[var(--dcf-wash)] hover:text-[var(--dcf-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dcf-ink)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 @lg:-ml-3"
            >
              {words.archive}
            </button>
          ) : null}
        </div>
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                               */
/* ------------------------------------------------------------------ */

/** One line of what goes. The figure counts up from zero each time the dialog opens. */
function Ledger({ row, open, reduce }: { row: LedgerRow; open: boolean; reduce: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--dcf-rule)] py-3 last:border-b-0">
      <dt className="text-[13.5px] text-[var(--dcf-body)]">{row.label}</dt>
      <dd className="font-mono text-[13.5px] text-[var(--dcf-ink)]">
        <Figure value={row.value} open={open} reduce={reduce} />
        {row.suffix ? ` ${row.suffix}` : null}
      </dd>
    </div>
  );
}

function Figure({ value, open, reduce }: { value: number; open: boolean; reduce: boolean }) {
  const n = useMotionValue(value);
  const text = useTransform(n, (v) => Math.round(v).toLocaleString("en-US"));
  useEffect(() => {
    if (!open) return;
    if (reduce) {
      n.set(value);
      return;
    }
    n.set(0);
    const run = animate(n, value, { duration: MOTION.count, ease: EASE_OUT, delay: MOTION.riseAt });
    return () => run.stop();
  }, [open, value, reduce, n]);
  return <motion.span className="tabular-nums">{text}</motion.span>;
}

/** The confirm label. Every state sits invisibly in one grid cell, so the button never changes width. */
function ConfirmLabel({ status, label, words, reduce }: { status: ConfirmStatus; label: string; words: ConfirmLabels; reduce: boolean }) {
  const views: Record<ConfirmStatus, { node: ReactNode; text: string }> = {
    idle: { node: <TrashIcon size={16} />, text: label },
    pending: { node: <Spinner size={16} />, text: words.pending },
    done: { node: <CheckIcon size={16} reduce={reduce} />, text: words.done },
    error: { node: <AlertIcon size={16} />, text: words.error },
  };
  const states = Object.keys(views) as ConfirmStatus[];
  const current = views[status];
  return (
    <>
      {states.map((s) => (
        <span key={s} aria-hidden="true" className="invisible col-start-1 row-start-1 flex items-center gap-2 whitespace-nowrap">
          {views[s].node}
          {views[s].text}
        </span>
      ))}
      <AnimatePresence initial={false}>
        <motion.span
          key={status}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(3px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: -6, filter: "blur(3px)", transition: { duration: 0.14, ease: EASE_IN } }}
          transition={{ duration: reduce ? MOTION.fade : 0.22, ease: EASE_OUT }}
          className="col-start-1 row-start-1 flex items-center gap-2 whitespace-nowrap"
        >
          {current.node}
          {current.text}
        </motion.span>
      </AnimatePresence>
    </>
  );
}

/* Icons, drawn on a 16-unit grid. */

function TrashIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M2.75 4.25h10.5M6.25 4.25V3a.75.75 0 0 1 .75-.75h2a.75.75 0 0 1 .75.75v1.25M4 4.25l.6 8.4a1.25 1.25 0 0 0 1.25 1.1h4.3a1.25 1.25 0 0 0 1.25-1.1l.6-8.4M6.75 7v4M9.25 7v4" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ size, reduce }: { size: number; reduce: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <motion.path
        d="M3.25 8.4l3 3 6.5-6.75"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: reduce ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.34, ease: EASE_OUT, delay: 0.06 }}
      />
    </svg>
  );
}

function AlertIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeWidth="1.35" />
      <path d="M8 5.1v3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="10.75" r="0.85" fill="currentColor" />
    </svg>
  );
}

function Spinner({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 animate-spin motion-reduce:animate-none">
      <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.6" />
      <path d="M13.75 8A5.75 5.75 0 0 0 8 2.25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Demo: a danger zone on a quiet stage, with the dialog driven by the Customize panel  */
/* ------------------------------------------------------------------ */

/** The stage behind the component; not part of it. */
const STAGE = { dark: "#000000", light: "#f4f4f5" } as const;

/**
 * The demo frames the component as a settings pane, so the scrim dims a bounded
 * surface rather than a band of the page and the dialog lands inside that frame.
 */
const PANE = {
  dark: "rounded-[22px] overflow-hidden bg-[#060607] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]",
  light: "rounded-[22px] overflow-hidden bg-[#fafafa] shadow-[inset_0_0_0_1px_rgba(24,24,27,0.09)]",
} as const;

/** How long the demo’s delete takes, so the pending state reads. */
const DEMO_DELETE_MS = 900;

function simulateDelete() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, DEMO_DELETE_MS));
}

function simulateArchive() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, 500));
}

/**
 * The featured instance. Its open state and status are runtime: the Customize
 * panel’s actions set them (a status past idle opens the dialog on it), and the
 * component reports back as the visitor moves on. Only a change in an action’s
 * value applies it, so the host’s stored value is never replayed over the visitor.
 */
export default function DialogConfirmTypedDemo({ open: forcedOpen, status: forcedStatus, ...overrides }: Partial<DialogConfirmTypedProps> = {}) {
  const [open, setOpen] = useState(forcedOpen ?? false);
  const [status, setStatus] = useState<ConfirmStatus>(forcedStatus ?? "idle");
  useEffect(() => {
    if (forcedOpen !== undefined) setOpen(forcedOpen);
  }, [forcedOpen]);
  useEffect(() => {
    if (forcedStatus === undefined) return;
    setStatus(forcedStatus);
    if (forcedStatus !== "idle") setOpen(true);
  }, [forcedStatus]);

  const theme = overrides.theme ?? "dark";
  return (
    <div className="flex min-h-dvh w-full items-center justify-center px-2 py-8" style={{ background: STAGE[theme] }}>
      <div className="w-full max-w-[640px]">
        <DialogConfirmTyped
          className={PANE[theme]}
          onConfirm={simulateDelete}
          onArchive={simulateArchive}
          {...overrides}
          open={open}
          onOpenChange={setOpen}
          status={status}
          onStatusChange={setStatus}
        />
      </div>
    </div>
  );
}
