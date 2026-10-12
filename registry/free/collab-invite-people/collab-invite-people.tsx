"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from "react";
import { AnimatePresence, LayoutGroup, motion, useInView, useReducedMotion } from "motion/react";
import { AlertCircle, Check, ChevronDown, X } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type InviteRole = "view" | "comment" | "edit";

export type InvitePerson = {
  email: string;
  name: string;
  role: InviteRole | "owner";
};

export type InviteDraft = {
  email: string;
  /** Omit and the row uses `defaultRole` until someone picks one. */
  role?: InviteRole;
};

export type InviteDirectoryEntry = {
  email: string;
  name: string;
};

export type CollabInvitePeopleProps = {
  /** Heading. */
  title?: string;
  /** Mono line under the heading, e.g. “Ledgerline · Website review”. */
  workspace?: string;
  /** Addresses on this domain are the company; anyone else is a guest. */
  orgDomain?: string;
  /** Seats the plan includes. Inviting past this is allowed and shown on the meter. */
  includedSeats?: number;
  /** People already in the workspace. They count toward the meter. */
  team?: InvitePerson[];
  /** Invites already sent and not yet accepted. */
  pending?: InvitePerson[];
  /** Addresses waiting in the paste well, in paste order. */
  drafts?: InviteDraft[];
  /** Known people, so a pasted address can show a name. */
  directory?: InviteDirectoryEntry[];
  /** Role given to a new address until its own menu is used. */
  defaultRole?: InviteRole;
  /** Show the “on the team” row under the meter. */
  showTeam?: boolean;
  onInvite?: (people: { email: string; name: string; role: InviteRole }[]) => void | Promise<void>;
  onWithdraw?: (email: string) => void | Promise<void>;
  /** The one accent: the Send button and the selected role’s check. */
  accent?: string;
  theme?: "dark" | "light";
  className?: string;
};

type Draft = { id: number; email: string; role: InviteRole; roleTouched: boolean };
type MenuOption<T extends string> = { value: T; label: string; hint?: string };

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
    danger: "#f87171",
    shadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 32px 64px -32px rgba(0,0,0,0.9)",
    pop: "inset 0 1px 0 rgba(255,255,255,0.05), 0 18px 40px -12px rgba(0,0,0,0.85)",
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
    danger: "#b91c1c",
    shadow: "0 1px 2px rgba(24,24,27,0.04), 0 32px 64px -40px rgba(24,24,27,0.25)",
    pop: "0 1px 2px rgba(24,24,27,0.06), 0 18px 40px -16px rgba(24,24,27,0.3)",
  },
} as const;

type Palette = Record<keyof (typeof PALETTE)["dark"], string>;

/** The demo’s quiet backdrop; not part of the component. */
const STAGE = "#0a0a0b";
const STAGE_LIGHT = "#e9e9ec";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;
/** Avatars crossing from the paste well into Pending. Quick, almost no bounce. */
const SPRING_FLY = { type: "spring", stiffness: 380, damping: 34 } as const;

const MOTION = {
  rise: 12,
  blur: 8,
  block: 0.5,
  step: 0.06,
  rowsAt: 0.28,
  rowStep: 0.05,
  exit: 0.16,
  fade: 0.15,
} as const;

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;
const SEPARATORS = new Set([",", ";", " ", "Enter", "Tab"]);

const ROLE_OPTIONS: MenuOption<InviteRole>[] = [
  { value: "view", label: "Viewer", hint: "Read the project" },
  { value: "comment", label: "Commenter", hint: "Leave notes, can’t edit" },
  { value: "edit", label: "Editor", hint: "Change the work" },
];
const ROLE_LABEL: Record<InviteRole, string> = { view: "Viewer", comment: "Commenter", edit: "Editor" };

/* ------------------------------------------------------------------ */
/* Demo data: Ledgerline is filling the last seats before Friday        */
/* ------------------------------------------------------------------ */

const DEMO_TEAM: InvitePerson[] = [
  { email: "sam@ledgerline.co", name: "Sam Okoye", role: "owner" },
  { email: "mara@ledgerline.co", name: "Mara Ilić", role: "edit" },
  { email: "jonas@ledgerline.co", name: "Jonas Weber", role: "comment" },
  { email: "priya@ledgerline.co", name: "Priya Raman", role: "edit" },
  { email: "pablo@ledgerline.co", name: "Pablo Ferreira", role: "view" },
];

const DEMO_DIRECTORY: InviteDirectoryEntry[] = [
  { email: "ines@ledgerline.co", name: "Inês Duarte" },
  { email: "rafi@ledgerline.co", name: "Rafi Mendel" },
  { email: "kade@atelier-kade.com", name: "Kade Adeyemi" },
  { email: "leah@ledgerline.co", name: "Leah Okon" },
];

/** A list someone pasted from the review thread: three good, one broken, one already here. */
const DEMO_DRAFTS: InviteDraft[] = [
  { email: "ines@ledgerline.co", role: "edit" },
  { email: "rafi@ledgerline.co", role: "comment" },
  { email: "kade@atelier-kade.com", role: "view" },
  { email: "priya@" },
  { email: "sam@ledgerline.co" },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function cssVars(p: Palette, accent: string): CSSProperties {
  const vars: Record<string, string> = { "--ip-accent": accent, "--ip-on-accent": readableOn(accent) };
  for (const [k, v] of Object.entries(p)) vars[`--ip-${k}`] = v;
  return vars as CSSProperties;
}

/** Black or white, whichever reads on the given #rrggbb fill. */
function readableOn(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#0a0a0b";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.36 ? "#0a0a0b" : "#fafafa";
}

const initials = (name: string) =>
  name
    .split(/[\s._@-]+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

function personName(email: string, directory: InviteDirectoryEntry[], team: InvitePerson[]) {
  const e = email.toLowerCase();
  const known = directory.find((d) => d.email.toLowerCase() === e) ?? team.find((t) => t.email.toLowerCase() === e);
  if (known) return known.name;
  const local = email.split("@")[0] ?? email;
  const words = local
    .split(/[._+-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return words.join(" ") || email;
}

/** Why this address can’t be sent, or undefined when it can. Later duplicates are the ones flagged. */
function diagnose(email: string, index: number, drafts: Draft[], team: InvitePerson[], pending: InvitePerson[]): string | undefined {
  const raw = email.trim();
  const e = raw.toLowerCase();
  if (!EMAIL.test(raw)) return "Isn’t a full email address";
  if (team.some((t) => t.email.toLowerCase() === e)) return "Already on the team";
  if (pending.some((p) => p.email.toLowerCase() === e)) return "Already invited";
  const first = drafts.findIndex((d) => d.email.trim().toLowerCase() === e);
  if (first !== -1 && first !== index) return "Listed twice";
  return undefined;
}

function seatSentence(taken: number, preview: number, included: number) {
  if (preview <= 0) {
    const room = included - taken;
    if (room > 1) return `${room} seats left`;
    if (room === 1) return "1 seat left";
    if (room === 0) return "Every included seat is taken";
    const over = taken - included;
    return `${over} past the ${included} included`;
  }
  const after = taken + preview;
  const ready = `${preview} ready`;
  if (after < included) {
    const room = included - after;
    return `${ready} · ${room} still open`;
  }
  if (after === included) return `${ready} · the studio fills`;
  const over = after - included;
  return `${ready} · ${over} past the ${included} included`;
}

function enter(play: boolean, delay: number, reduce: boolean) {
  if (reduce) return { initial: { opacity: 0 }, animate: { opacity: play ? 1 : 0 }, transition: { duration: MOTION.fade } };
  return {
    initial: { opacity: 0, y: MOTION.rise, filter: `blur(${MOTION.blur}px)` },
    animate: play ? { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } } : undefined,
    transition: { duration: MOTION.block, ease: EASE_OUT, delay },
  };
}

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ip-ink)]";

function useDismiss(open: boolean, ref: RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, ref, close]);
}

/* ------------------------------------------------------------------ */
/* Pieces                                                               */
/* ------------------------------------------------------------------ */

function Menu({
  value,
  options,
  onChange,
  label,
  demo,
}: {
  value: InviteRole;
  options: MenuOption<InviteRole>[];
  onChange: (v: InviteRole) => void;
  label: string;
  demo?: string;
}) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const close = () => setOpen(false);
  useDismiss(open, box, close);

  const show = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const choose = (v: InviteRole) => {
    setOpen(false);
    onChange(v);
    button.current?.focus({ focusVisible: false } as FocusOptions);
  };
  const onKey = (e: ReactKeyboardEvent) => {
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        show();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(options[active].value);
    } else if (e.key === "Tab") setOpen(false);
  };

  return (
    <div ref={box} className="relative" onKeyDown={onKey}>
      <button
        ref={button}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${uid}-list`}
        aria-label={label}
        data-demo={demo}
        onClick={() => (open ? setOpen(false) : show())}
        className={`[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-md px-2 text-[13px] text-[var(--ip-muted)] transition-[color,background-color,transform] duration-150 hover:bg-[var(--ip-raised)] hover:text-[var(--ip-ink)] active:scale-[0.97] ${FOCUS_RING} ${open ? "bg-[var(--ip-raised)] text-[var(--ip-ink)]" : ""}`}
      >
        {ROLE_LABEL[value]}
        <ChevronDown className={`size-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} strokeWidth={2} aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            id={`${uid}-list`}
            role="listbox"
            aria-label={label}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, transition: { duration: 0.12, ease: EASE_IN } }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="absolute right-0 z-30 mt-1.5 w-56 origin-top-right rounded-xl border border-[var(--ip-line)] bg-[var(--ip-raised)] p-1 shadow-[var(--ip-pop)]"
          >
            {options.map((o, i) => {
              const selected = o.value === value;
              return (
                <li key={o.value} role="presentation">
                  <div
                    role="option"
                    aria-selected={selected}
                    onPointerEnter={() => setActive(i)}
                    onClick={() => choose(o.value)}
                    className="relative flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2"
                  >
                    {i === active && (
                      <motion.span
                        layoutId={`${uid}-active`}
                        transition={reduce ? { duration: 0 } : SPRING_UI}
                        className="absolute inset-0 rounded-lg bg-[color-mix(in_srgb,var(--ip-ink)_7%,transparent)]"
                      />
                    )}
                    <span className="relative min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-[var(--ip-ink)]">{o.label}</span>
                      {o.hint && <span className="mt-0.5 block text-[12px] leading-[1.4] text-[var(--ip-faint)]">{o.hint}</span>}
                    </span>
                    {selected && <Check className="relative mt-0.5 size-3.5 shrink-0 text-[var(--ip-accent)]" strokeWidth={2.5} aria-hidden="true" />}
                  </div>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function Avatar({ name, flyId }: { name: string; flyId: string }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <motion.span
      layoutId={reduce ? undefined : flyId}
      transition={SPRING_FLY}
      aria-hidden="true"
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--ip-avatar)] text-[10px] font-semibold tracking-[0.02em] text-[var(--ip-muted)]"
    >
      {initials(name)}
    </motion.span>
  );
}

function RollingCount({ value }: { value: number }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <span className="relative inline-flex h-[1em] overflow-hidden align-bottom tabular-nums leading-none">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={reduce ? { opacity: 0 } : { y: "70%", opacity: 0, filter: "blur(3px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { y: "-70%", opacity: 0, filter: "blur(3px)" }}
          transition={{ duration: reduce ? MOTION.fade : 0.32, ease: EASE_OUT }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function SeatMeter({ taken, preview, included, play }: { taken: number; preview: number; included: number; play: boolean }) {
  const reduce = useReducedMotion() ?? false;
  const count = Math.max(included, taken + preview, 1);
  const label = `${taken} of ${included} seats taken. ${preview > 0 ? `${preview} more if you send.` : ""}`.trim();
  return (
    <div className="flex h-2 gap-[3px]" role="img" aria-label={label}>
      {Array.from({ length: count }, (_, i) => {
        const state = i < taken ? "taken" : i < taken + preview ? (i < included ? "preview" : "over") : "empty";
        const tone =
          state === "taken"
            ? "bg-[var(--ip-ink)]"
              : state === "preview"
              ? "bg-[color-mix(in_srgb,var(--ip-ink)_42%,transparent)]"
              : state === "over"
                ? "bg-[color-mix(in_srgb,var(--ip-danger)_22%,transparent)] shadow-[inset_0_0_0_1px_var(--ip-danger)]"
                : "bg-[var(--ip-line)]";
        return (
          <motion.span
            key={i}
            initial={reduce || !play ? { scaleX: 1 } : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: reduce ? 0 : 0.45, ease: EASE_OUT, delay: reduce || !play ? 0 : 0.18 + i * 0.035 }}
            style={{ originX: 0 }}
            className={`h-2 min-w-0 flex-1 rounded-full ${tone}`}
          />
        );
      })}
    </div>
  );
}

function IconButton({ label, onClick, disabled = false }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className={`[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 flex size-8 shrink-0 items-center justify-center rounded-md text-[var(--ip-faint)] transition-[color,background-color,transform] duration-150 hover:bg-[var(--ip-raised)] hover:text-[var(--ip-ink)] active:scale-[0.97] ${FOCUS_RING}`}
    >
      <X className="size-3.5" strokeWidth={2.25} aria-hidden="true" />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function CollabInvitePeople({
  title = "Invite people",
  workspace = "Ledgerline · Website review",
  orgDomain = "ledgerline.co",
  includedSeats = 8,
  team = DEMO_TEAM,
  pending: initialPending = [],
  drafts: initialDrafts = DEMO_DRAFTS,
  directory = DEMO_DIRECTORY,
  defaultRole = "edit",
  showTeam = true,
  onInvite,
  onWithdraw,
  accent,
  theme = "dark",
  className = "",
}: CollabInvitePeopleProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const root = useRef<HTMLElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const play = useInView(root, { once: true, amount: 0.2 });
  const palette = PALETTE[theme];
  const domain = orgDomain.toLowerCase();

  const nextId = useRef(1);
  const seed = (list: InviteDraft[]): Draft[] =>
    list.map((d) => ({
      id: nextId.current++,
      email: d.email,
      role: d.role ?? defaultRole,
      roleTouched: d.role !== undefined,
    }));

  const [drafts, setDrafts] = useState<Draft[]>(() => seed(initialDrafts));
  const [pending, setPending] = useState<InvitePerson[]>(initialPending);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const pendingAction = useRef(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const draftsRef = useRef(drafts);
  const textRef = useRef("");
  draftsRef.current = drafts;
  textRef.current = text;

  useEffect(() => {
    setDrafts((ds) => {
      if (ds.every((d) => d.roleTouched || d.role === defaultRole)) return ds;
      return ds.map((d) => (d.roleTouched || d.role === defaultRole ? d : { ...d, role: defaultRole }));
    });
  }, [defaultRole]);

  const rows = useMemo(
    () => drafts.map((d, i) => ({ ...d, problem: diagnose(d.email, i, drafts, team, pending) })),
    [drafts, team, pending],
  );
  const valid = rows.filter((r) => !r.problem);
  const problems = rows.filter((r) => r.problem);
  const taken = team.length + pending.length;
  const preview = valid.length;
  const over = Math.max(0, taken + preview - includedSeats);

  const flyId = (email: string) => `${uid}-${email.trim().toLowerCase()}`;
  const isGuest = (email: string) => (email.split("@")[1]?.toLowerCase() ?? "") !== domain;

  const commit = (raw: string) => {
    const parts = raw
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    textRef.current = "";
    setText("");
    if (!parts.length) return draftsRef.current;
    const next = [
      ...draftsRef.current,
      ...parts.map((email) => ({ id: nextId.current++, email, role: defaultRole, roleTouched: false })),
    ];
    draftsRef.current = next;
    setDrafts(next);
    return next;
  };

  const send = async () => {
    if (!onInvite || pendingAction.current) return;
    const list = textRef.current.trim() ? commit(textRef.current) : draftsRef.current;
    const ready = list
      .map((d, i) => ({ ...d, problem: diagnose(d.email, i, list, team, pending) }))
      .filter((d) => !d.problem);
    if (!ready.length) return;
    const people = ready.map((d) => ({
      email: d.email.trim(),
      name: personName(d.email, directory, team),
      role: d.role,
    }));
    pendingAction.current = true;
    setSending(true);
    setRequestError(null);
    try {
      await onInvite(people);
      const accepted = new Set(ready.map((draft) => draft.id));
      const stay = draftsRef.current.filter((draft) => !accepted.has(draft.id));
      draftsRef.current = stay;
      setDrafts(stay);
      setPending((ps) => [...ps, ...people]);
    } catch {
      setRequestError("We couldn't send these invitations. Your draft is kept.");
    } finally {
      pendingAction.current = false;
      setSending(false);
      requestAnimationFrame(() => field.current?.focus({ preventScroll: true }));
    }
  };

  const onKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
    if (SEPARATORS.has(e.key) && textRef.current.trim()) {
      e.preventDefault();
      commit(textRef.current);
    } else if (e.key === "Enter" && !textRef.current.trim() && valid.length) {
      e.preventDefault();
      send();
    } else if (e.key === "Backspace" && !textRef.current && draftsRef.current.length) {
      e.preventDefault();
      const next = draftsRef.current.slice(0, -1);
      draftsRef.current = next;
      setDrafts(next);
    }
  };

  const onPaste = (e: ReactClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (!/[\s,;]/.test(pasted)) return;
    e.preventDefault();
    commit(textRef.current + pasted);
  };

  const setRole = (id: number, role: InviteRole) => {
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, role, roleTouched: true } : d)));
  };
  const removeDraft = (id: number) => {
    const next = draftsRef.current.filter((d) => d.id !== id);
    draftsRef.current = next;
    setDrafts(next);
  };
  const withdraw = async (email: string) => {
    if (!onWithdraw || pendingAction.current) return;
    pendingAction.current = true;
    setSending(true);
    setRequestError(null);
    try {
      await onWithdraw(email);
      setPending((ps) => ps.filter((person) => person.email !== email));
    } catch {
      setRequestError("We couldn't withdraw this invitation. It is still pending.");
    } finally {
      pendingAction.current = false;
      setSending(false);
    }
  };

  const firstNames = team.map((p) => p.name.split(" ")[0]).join(", ");

  return (
    <section
      ref={root}
      aria-labelledby={`${uid}-title`}
      style={cssVars(palette, accent ?? palette.ink)}
      className={`@container w-full font-sans text-[var(--ip-ink)] antialiased ${className}`}
    >
      <LayoutGroup id={uid}>
        <motion.div aria-busy={sending} {...enter(play, 0, reduce)} className="rounded-[14px] border border-[var(--ip-line)] bg-[var(--ip-surface)] shadow-[var(--ip-shadow)]">
          <div inert={sending} className="px-5 pb-5 pt-5 @md:px-6">
            <motion.header {...enter(play, MOTION.step, reduce)} className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <h2 id={`${uid}-title`} className="truncate font-display text-[18px] font-semibold tracking-[-0.03em]">
                  {title}
                </h2>
                <p className="mt-1 truncate font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--ip-faint)]">{workspace}</p>
              </div>
              <p className="shrink-0 text-right">
                <span className="block font-display text-[32px] font-semibold leading-none tracking-[-0.04em]">
                  <RollingCount value={taken} />
                </span>
                <span className="mt-1 block font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--ip-faint)]">of {includedSeats}</span>
              </p>
            </motion.header>

            <motion.div {...enter(play, MOTION.step * 2, reduce)} className="mt-4">
              <SeatMeter taken={taken} preview={preview} included={includedSeats} play={play} />
              <p className="mt-2.5 text-[13px] leading-[1.4] text-[var(--ip-muted)]" aria-live="polite">
                {seatSentence(taken, preview, includedSeats)}
                {over > 0 && preview > 0 && <span className="text-[var(--ip-faint)]"> — sending is still allowed</span>}
              </p>
            </motion.div>

            {showTeam && team.length > 0 && (
              <motion.div {...enter(play, MOTION.step * 3, reduce)} className="mt-4 flex items-center gap-3">
                <div className="flex shrink-0 -space-x-1.5" aria-hidden="true">
                  {team.slice(0, 5).map((p) => (
                    <span
                      key={p.email}
                      className="flex size-6 items-center justify-center rounded-full bg-[var(--ip-avatar)] text-[9px] font-semibold tracking-[0.02em] text-[var(--ip-muted)] shadow-[0_0_0_2px_var(--ip-surface)]"
                    >
                      {initials(p.name)}
                    </span>
                  ))}
                </div>
                <p className="min-w-0 truncate text-[13px] text-[var(--ip-faint)]">
                  <span className="font-medium text-[var(--ip-ink)]">{team.length} on the team</span>
                  <span className="hidden @md:inline"> · {firstNames}</span>
                </p>
              </motion.div>
            )}

            <motion.h3 {...enter(play, MOTION.step * 4, reduce)} className="mb-2 mt-5 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--ip-faint)]">
              To invite
            </motion.h3>
            <motion.div
              {...enter(play, MOTION.step * 4, reduce)}
              className="rounded-xl border border-[var(--ip-line)] bg-[var(--ip-sunken)] transition-[border-color,box-shadow] duration-150 focus-within:border-[var(--ip-faint)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ip-ink)_8%,transparent)]"
            >
              <ul aria-label="Addresses to invite">
                <AnimatePresence initial={false}>
                  {rows.map((row, i) => {
                    const bad = !!row.problem;
                    const name = bad ? row.email : personName(row.email, directory, team);
                    return (
                      <motion.li
                        key={row.id}
                        {...enter(play, MOTION.rowsAt + i * MOTION.rowStep, reduce)}
                        exit={{ opacity: 0, transition: { duration: MOTION.exit, ease: EASE_IN } }}
                        className="relative flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-[var(--ip-rule)] px-2 py-2 last:border-b-0 @md:flex-nowrap @md:gap-3 @md:px-3"
                      >
                        {bad && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-r bg-[var(--ip-danger)]" />}
                        {bad ? (
                          <span className="order-1 flex size-7 shrink-0 items-center justify-center text-[var(--ip-danger)]">
                            <AlertCircle className="size-4" strokeWidth={2} aria-hidden="true" />
                          </span>
                        ) : (
                          <span className="order-1 shrink-0">
                            <Avatar name={name} flyId={flyId(row.email)} />
                          </span>
                        )}
                        <div className="order-2 min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className={`truncate text-[14px] font-medium ${bad ? "text-[var(--ip-danger)]" : "text-[var(--ip-ink)]"}`}>{name}</span>
                            {!bad && isGuest(row.email) && (
                              <span className="shrink-0 rounded border border-[var(--ip-line)] px-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ip-faint)]">Guest</span>
                            )}
                          </div>
                          <span className={`mt-0.5 block truncate text-[12px] ${bad ? "text-[var(--ip-danger)]" : "text-[var(--ip-faint)]"}`}>
                            {bad ? row.problem : row.email}
                            {bad && <span className="sr-only">. Remove it or correct the address.</span>}
                          </span>
                        </div>
                        <span className="order-3 @md:order-4">
                          <IconButton label={`Remove ${row.email}`} onClick={() => removeDraft(row.id)} />
                        </span>
                        {!bad && (
                          <div className="order-4 flex w-full pl-[38px] @md:order-3 @md:w-auto @md:pl-0">
                            <Menu
                              value={row.role}
                              options={ROLE_OPTIONS}
                              onChange={(r) => setRole(row.id, r)}
                              label={`Role for ${name}`}
                              demo={`role-${row.email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9-]/g, "") || "person"}`}
                            />
                          </div>
                        )}
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
              <div className="px-2 py-1.5 @md:px-3">
                <input
                  ref={field}
                  data-demo="invite-field"
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  spellCheck={false}
                  value={text}
                  onChange={(e) => {
                    textRef.current = e.target.value;
                    setText(e.target.value);
                  }}
                  onKeyDown={onKey}
                  onPaste={onPaste}
                  onBlur={() => {
                    if (textRef.current.trim()) commit(textRef.current);
                  }}
                  placeholder="Paste emails, or type one"
                  aria-label="Email addresses to invite"
                  aria-invalid={problems.length > 0}
                  aria-describedby={`${uid}-hint`}
                  className="h-9 w-full bg-transparent px-1 text-[14px] text-[var(--ip-ink)] outline-none placeholder:text-[var(--ip-faint)]"
                />
              </div>
            </motion.div>

            <div className="mt-3 flex flex-col gap-3 @md:flex-row @md:items-center @md:justify-between">
              <p id={`${uid}-hint`} className="min-w-0 text-[12px] leading-[1.45] text-[var(--ip-faint)]">
                {problems.length
                  ? `${problems.length} still ${problems.length === 1 ? "needs" : "need"} a look. New addresses join as ${ROLE_LABEL[defaultRole]}.`
                  : `Separate with commas, spaces or a new line. New addresses join as ${ROLE_LABEL[defaultRole]}.`}
              </p>
              <button
                type="button"
                data-demo="send"
                onClick={send}
                disabled={!onInvite || sending || (!valid.length && !text.trim())}
                className={`[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--ip-accent)] px-4 text-[14px] font-medium text-[var(--ip-on-accent)] transition-[opacity,transform,filter] duration-150 hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100 @md:min-w-[9.5rem] ${FOCUS_RING}`}
              >
                {valid.length ? (
                  <>
                    <span>Send</span>
                    <RollingCount value={valid.length} />
                    <span>{valid.length === 1 ? "invite" : "invites"}</span>
                  </>
                ) : (
                  "Send"
                )}
              </button>
            </div>
          </div>

          {requestError && <motion.p role="alert" initial={{ opacity: 0, y: reduce ? 0 : 4 }} animate={{ opacity: 1, y: 0 }} className="px-5 pb-4 text-[13px] text-[var(--ip-danger)] @md:px-6">{requestError}</motion.p>}
          <motion.div {...enter(play, MOTION.rowsAt + rows.length * MOTION.rowStep, reduce)} className="border-t border-[var(--ip-rule)] px-5 pb-5 pt-4 @md:px-6">
            <h3 className="flex items-baseline justify-between font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--ip-faint)]">
              Pending
              <span className="tabular-nums">{pending.length}</span>
            </h3>
            <AnimatePresence mode="wait" initial={false}>
              {pending.length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: MOTION.exit } }}
                  className="mt-3 flex min-h-16 items-center justify-center rounded-xl border border-dashed border-[var(--ip-line)] px-4 text-center"
                >
                  <p className="text-[13px] text-[var(--ip-faint)]">They’ll land here, one seat each.</p>
                </motion.div>
              ) : (
                <motion.ul key="list" aria-label="Pending invites" className="mt-1" initial={false}>
                  <AnimatePresence initial={false}>
                    {pending.map((p) => (
                      <motion.li
                        key={p.email}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, transition: { duration: MOTION.exit, ease: EASE_IN } }}
                        transition={{ duration: 0.28, ease: EASE_OUT }}
                        className="flex items-center gap-3 py-2"
                      >
                        <Avatar name={p.name} flyId={flyId(p.email)} />
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-[14px] font-medium">{p.name}</span>
                            {isGuest(p.email) && (
                              <span className="shrink-0 rounded border border-[var(--ip-line)] px-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ip-faint)]">Guest</span>
                            )}
                          </div>
                          <span className="block truncate text-[12px] text-[var(--ip-faint)]">
                            Invited · {ROLE_LABEL[p.role === "owner" ? "edit" : p.role]} · {p.email}
                          </span>
                        </div>
                        <IconButton label={`Withdraw invite to ${p.name}`} disabled={!onWithdraw || sending} onClick={() => void withdraw(p.email)} />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </motion.ul>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </LayoutGroup>
    </section>
  );
}

/** The featured invite, on the quiet stage. Controls spread over the defaults. */
export default function CollabInvitePeopleDemo(overrides: Partial<CollabInvitePeopleProps> = {}) {
  const light = overrides.theme === "light";
  return (
    <div className="flex min-h-dvh items-start justify-center px-4 py-10 sm:items-center sm:px-8 sm:py-16" style={{ background: light ? STAGE_LIGHT : STAGE }}>
      <div className="w-full max-w-[560px]">
        <CollabInvitePeople onInvite={async () => { await new Promise(resolve => setTimeout(resolve, 450)); }} onWithdraw={async () => { await new Promise(resolve => setTimeout(resolve, 300)); }} {...overrides} />
      </div>
    </div>
  );
}
