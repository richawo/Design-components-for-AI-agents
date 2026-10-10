"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, animate, motion, stagger, useMotionValue, useReducedMotion, useTransform, type AnimationPlaybackControls } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

type Phase = "editing" | "pending" | "done" | "error";

export type DialogConfirmTypedProps = {
  /** The button in the card that opens the dialog. */
  triggerLabel?: string;
  /** The exact name the visitor must type before Delete enables. */
  resourceName?: string;
  /** Environments that go with the project. */
  environments?: number;
  /** Hours since the last deploy, shown as “3 h ago”. */
  lastDeployHours?: number;
  /** Environment variables that go with the project. */
  secrets?: number;
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

const COPY = {
  confirm: "Delete project",
  pending: "Deleting…",
  done: "Deleted",
  error: "Couldn’t delete",
  archive: "Archive instead",
  cancel: "Cancel",
  archiveError: "Couldn’t archive",
  kicker: "Permanent deletion",
  failed: "Couldn’t delete. Nothing was removed.",
} as const;

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function isPromise(value: unknown): value is PromiseLike<unknown> {
  return typeof (value as PromiseLike<unknown> | undefined)?.then === "function";
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

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function DialogConfirmTyped({
  triggerLabel = "Delete project",
  resourceName = "atlas-staging",
  environments = 12,
  lastDeployHours = 3,
  secrets = 47,
  requireTyping = true,
  alternative = true,
  tone = "danger",
  theme = "dark",
  open: openProp,
  onOpenChange,
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
  const alive = useRef(true);
  const wasOpen = useRef(false);
  const openRef = useRef(false);
  const origin = useRef({ x: 0, y: 0 });
  const runs = useRef<AnimationPlaybackControls[]>([]);
  const later = useTimers();

  const controlled = openProp !== undefined;
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlled ? openProp : innerOpen;
  const [phase, setPhase] = useState<Phase>("editing");
  const [typed, setTyped] = useState("");
  const [announce, setAnnounce] = useState("");

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
      if (!controlled) setInnerOpen(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange],
  );

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const matches = !requireTyping || typed.trim() === resourceName.trim();
  const busy = phase === "pending" || phase === "done";
  const canConfirm = matches && !busy;

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
      setTyped("");
      setPhase("editing");
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

  const shake = () => {
    const panel = panelRef.current;
    if (reduce || !panel) return;
    runs.current.push(animate(panel, { x: [...MOTION.shake] }, { duration: MOTION.shakeFor, ease: "easeOut" }));
  };

  const succeed = () => {
    setPhase("done");
    setAnnounce(`${resourceName} deleted`);
    later(() => changeOpen(false), MOTION.doneHoldMs);
  };

  const fail = () => {
    setPhase("error");
    setAnnounce(COPY.failed);
    shake();
    later(() => setPhase((p) => (p === "error" ? "editing" : p)), MOTION.errorMs);
  };

  const confirm = () => {
    if (!canConfirm) return;
    setPhase("pending");
    setAnnounce(COPY.pending);
    let result: void | Promise<unknown>;
    try {
      result = onConfirm?.(resourceName);
    } catch {
      fail();
      return;
    }
    if (isPromise(result)) {
      result.then(
        () => alive.current && succeed(),
        () => alive.current && fail(),
      );
    } else succeed();
  };

  const archive = () => {
    if (busy) return;
    let result: void | Promise<unknown>;
    try {
      result = onArchive?.();
    } catch {
      setAnnounce(COPY.archiveError);
      return;
    }
    if (isPromise(result)) {
      result.then(
        () => alive.current && changeOpen(false),
        () => alive.current && setAnnounce(COPY.archiveError),
      );
    } else changeOpen(false);
  };

  /* Focus stays inside the dialog while it is open; Esc dismisses it. */
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
    const outside = !active || !panel.contains(active);
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

  return (
    <div
      ref={rootRef}
      style={vars}
      className={`@container relative isolate flex min-h-[640px] w-full items-center justify-center px-4 py-14 font-sans antialiased sm:px-8 ${theme === "dark" ? "[color-scheme:dark]" : "[color-scheme:light]"} ${className}`}
    >
      {/* The surface that holds the trigger. Inert while open, so nothing behind the dialog takes focus. */}
      <section
        inert={open}
        aria-labelledby={`${uid}-card`}
        className="relative w-full max-w-[560px] rounded-[16px] bg-[var(--dcf-card)] p-5 shadow-[inset_0_0_0_1px_var(--dcf-tone-line),inset_0_1px_0_rgba(255,255,255,0.04),0_30px_60px_-40px_rgba(0,0,0,0.6)] @md:flex @md:items-center @md:justify-between @md:gap-8 @md:p-6"
      >
        <div className="min-w-0">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--dcf-muted)]">Settings</p>
          <h3 id={`${uid}-card`} className="mt-2 font-display text-[20px] leading-[1.15] tracking-[-0.02em] text-[var(--dcf-ink)]">
            Delete this project
          </h3>
          <p className="mt-1.5 max-w-[44ch] text-[13.5px] leading-[1.55] text-[var(--dcf-body)]">
            Removes {resourceName}, its environments and its deploy history. Nothing is kept once it is gone.
          </p>
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
        inert={!open}
        style={{ visibility: "hidden" }}
        onKeyDown={onPanelKey}
        className="absolute left-1/2 top-1/2 z-20 w-[min(460px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[18px] bg-[var(--dcf-panel)] p-6 text-[var(--dcf-ink)] shadow-[inset_0_0_0_1px_var(--dcf-line),inset_0_1px_0_rgba(255,255,255,0.05),0_40px_90px_-30px_rgba(0,0,0,0.85)] @md:p-7"
      >
        {/* The kicker doubles as the error line, so a failed delete is explained without moving anything. */}
        <p data-rise className="grid font-mono text-[10.5px] uppercase tracking-[0.14em]">
          <AnimatePresence initial={false}>
            <motion.span
              key={phase === "error" ? "failed" : "kicker"}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: -4, filter: "blur(2px)", transition: { duration: 0.14, ease: EASE_IN } }}
              transition={{ duration: reduce ? MOTION.fade : 0.22, ease: EASE_OUT }}
              className={`col-start-1 row-start-1 ${phase === "error" ? "text-[var(--dcf-tone-ink)]" : "text-[var(--dcf-muted)]"}`}
            >
              {phase === "error" ? COPY.failed : COPY.kicker}
            </motion.span>
          </AnimatePresence>
        </p>
        <h4 id={titleId} data-rise className="mt-2.5 break-words font-display text-[24px] leading-[1.1] tracking-[-0.03em]">
          Delete {resourceName}
        </h4>
        <p id={bodyId} data-rise className="mt-2.5 text-[14px] leading-[1.55] text-[var(--dcf-body)]">
          This removes the project and everything inside it. There is no recovery window and no undo.
        </p>

        <p data-rise className="mt-6 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--dcf-muted)]">
          What goes with it
        </p>
        <dl data-rise className="mt-2 border-y border-[var(--dcf-rule)]">
          <Ledger label="Environments" value={environments} open={open} reduce={reduce} />
          <Ledger label="Last deploy" value={lastDeployHours} suffix="h ago" open={open} reduce={reduce} />
          <Ledger label="Environment variables" value={secrets} open={open} reduce={reduce} />
        </dl>

        {requireTyping ? (
          <div data-rise className="mt-5">
            <label htmlFor={fieldId} className="block text-[13px] text-[var(--dcf-body)]">
              Type <span className="font-mono text-[var(--dcf-ink)]">{resourceName}</span> to confirm
            </label>
            <div className="relative mt-2">
              <input
                ref={fieldRef}
                id={fieldId}
                data-demo="name"
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  confirm();
                }}
                autoComplete="off"
                spellCheck={false}
                aria-describedby={bodyId}
                className="h-11 w-full rounded-[11px] bg-[var(--dcf-field)] px-3.5 pr-10 font-mono text-[14px] text-[var(--dcf-ink)] shadow-[inset_0_0_0_1px_var(--dcf-line)] outline-none transition-shadow duration-150 ease-out focus:shadow-[inset_0_0_0_1px_var(--dcf-focus)]"
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
              {COPY.cancel}
            </button>
            <button
              type="button"
              data-demo="confirm"
              onClick={confirm}
              disabled={!canConfirm}
              aria-busy={phase === "pending" || undefined}
              className={`grid h-11 place-items-center rounded-[11px] px-5 text-[14px] font-medium tracking-[-0.01em] transition-[background-color,opacity,scale] duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dcf-fill)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 @xs:flex-1 @lg:min-w-[168px] @lg:flex-none ${
                phase === "pending" ? "cursor-progress" : "cursor-pointer"
              }`}
              style={{ background: "var(--dcf-fill)", color: "var(--dcf-on-fill)" }}
            >
              <ConfirmLabel phase={phase} reduce={reduce} />
            </button>
          </div>
          {alternative ? (
            <button
              type="button"
              onClick={archive}
              disabled={busy}
              className="inline-flex h-11 cursor-pointer items-center justify-center rounded-[11px] px-3 text-[14px] text-[var(--dcf-muted)] transition-[background-color,color,scale] duration-150 ease-out hover:bg-[var(--dcf-wash)] hover:text-[var(--dcf-ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dcf-ink)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 @lg:-ml-3"
            >
              {COPY.archive}
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
function Ledger({ label, value, suffix, open, reduce }: { label: string; value: number; suffix?: string; open: boolean; reduce: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--dcf-rule)] py-3 last:border-b-0">
      <dt className="text-[13.5px] text-[var(--dcf-body)]">{label}</dt>
      <dd className="font-mono text-[13.5px] text-[var(--dcf-ink)]">
        <Figure value={value} open={open} reduce={reduce} />
        {suffix ? ` ${suffix}` : null}
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
function ConfirmLabel({ phase, reduce }: { phase: Phase; reduce: boolean }) {
  const views: Record<Phase, { node: ReactNode; text: string }> = {
    editing: { node: <TrashIcon size={16} />, text: COPY.confirm },
    pending: { node: <Spinner size={16} />, text: COPY.pending },
    done: { node: <CheckIcon size={16} reduce={reduce} />, text: COPY.done },
    error: { node: <AlertIcon size={16} />, text: COPY.error },
  };
  const phases = Object.keys(views) as Phase[];
  const current = views[phase];
  return (
    <>
      {phases.map((p) => (
        <span key={p} aria-hidden="true" className="invisible col-start-1 row-start-1 flex items-center gap-2 whitespace-nowrap">
          {views[p].node}
          {views[p].text}
        </span>
      ))}
      <AnimatePresence initial={false}>
        <motion.span
          key={phase}
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
 * The featured instance. Its open state is runtime: the Customize panel’s Open
 * action sets it, and the component reports back when the visitor closes it.
 * Only a change in the action’s value reopens, so the host’s stored value is
 * never replayed over a dismissal.
 */
export default function DialogConfirmTypedDemo({ open: forcedOpen, ...overrides }: Partial<DialogConfirmTypedProps> = {}) {
  const [open, setOpen] = useState(forcedOpen ?? false);
  useEffect(() => {
    if (forcedOpen !== undefined) setOpen(forcedOpen);
  }, [forcedOpen]);

  const theme = overrides.theme ?? "dark";
  return (
    <div className="flex min-h-dvh w-full items-center justify-center px-2 py-8" style={{ background: STAGE[theme] }}>
      <div className="w-full max-w-[640px]">
        <DialogConfirmTyped className={PANE[theme]} onConfirm={simulateDelete} onArchive={simulateArchive} {...overrides} open={open} onOpenChange={setOpen} />
      </div>
    </div>
  );
}
