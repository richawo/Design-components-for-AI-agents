"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { AlertCircle, Building2, Check, ChevronDown, Globe, Link2, Lock, X } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type ShareRole = "view" | "comment" | "edit";
export type LinkAccess = "restricted" | "organisation" | "anyone";

export type ShareMember = {
  email: string;
  name?: string;
  role: ShareRole | "owner";
  /** An invite that hasn’t been accepted yet. */
  pending?: boolean;
};

export type CollabShareAccessProps = {
  /** The thing being shared. */
  docTitle?: string;
  members?: ShareMember[];
  /** Addresses on this domain count as your organisation; others get a Guest tag. */
  orgDomain?: string;
  orgName?: string;
  /** Role pre-selected for new invites. */
  defaultRole?: ShareRole;
  linkAccess?: LinkAccess;
  linkRole?: ShareRole;
  link?: string;
  /** How long Undo stays available after removing someone, in ms. */
  undoMs?: number;
  onInvite?: (emails: string[], role: ShareRole) => void;
  onRemove?: (member: ShareMember) => void;
  onRoleChange?: (email: string, role: ShareRole) => void;
  onLinkAccessChange?: (access: LinkAccess) => void;
  /** The one accent: the Invite button, selected checks and the copied state. Defaults to the theme’s ink. */
  accent?: string;
  theme?: "dark" | "light";
  className?: string;
};

type Chip = { id: number; email: string; problem?: string };
type MenuOption<T extends string> = { value: T; label: string; hint?: string; danger?: boolean };
type Removed = { member: ShareMember; index: number };

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
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;

/** One place for the choreography. Seconds unless noted. */
const MOTION = {
  rise: 12, // px
  blur: 8, // px
  block: 0.5,
  step: 0.06,
  rowsAt: 0.24,
  rowStep: 0.05,
  collapse: 0.28,
  exit: 0.18,
  copiedFor: 1600, // ms
  fade: 0.15, // reduced motion
} as const;

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;
const SEPARATORS = new Set([",", ";", " ", "Enter", "Tab"]);

const ROLE_OPTIONS: MenuOption<ShareRole>[] = [
  { value: "view", label: "Can view", hint: "Read, download and print" },
  { value: "comment", label: "Can comment", hint: "Suggest edits and reply" },
  { value: "edit", label: "Can edit", hint: "Change anything but sharing" },
];
const ROLE_LABEL: Record<ShareRole | "owner", string> = { view: "Can view", comment: "Can comment", edit: "Can edit", owner: "Owner" };

const REMOVE = "remove" as const;
type MemberChoice = ShareRole | typeof REMOVE;

/* ------------------------------------------------------------------ */
/* Demo data: Northwind’s Q4 launch plan                                */
/* ------------------------------------------------------------------ */

const DEMO_MEMBERS: ShareMember[] = [
  { email: "hana@northwind.co", name: "Hana Sato", role: "owner" },
  { email: "mateo@northwind.co", name: "Mateo Herrera", role: "edit" },
  { email: "jonas@northwind.co", name: "Jonas Weber", role: "comment" },
  { email: "elif@studio-demir.com", name: "Elif Demir", role: "view" },
];

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function cssVars(p: Palette, accent: string): CSSProperties {
  const vars: Record<string, string> = { "--sa-accent": accent, "--sa-on-accent": readableOn(accent) };
  for (const [k, v] of Object.entries(p)) vars[`--sa-${k}`] = v;
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

const initials = (m: ShareMember) => {
  const source = m.name ?? m.email.split("@")[0];
  return source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
};

/** Entrance props for a block: rises out of a blur. Reduced motion: a short fade. */
function enter(play: boolean, delay: number, reduce: boolean) {
  if (reduce) return { initial: { opacity: 0 }, animate: { opacity: play ? 1 : 0 }, transition: { duration: MOTION.fade } };
  return {
    initial: { opacity: 0, y: MOTION.rise, filter: `blur(${MOTION.blur}px)` },
    animate: play ? { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } } : undefined,
    transition: { duration: MOTION.block, ease: EASE_OUT, delay },
  };
}

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sa-ink)]";

function linkCopy(access: LinkAccess, orgName: string) {
  if (access === "restricted") return { label: "Restricted", hint: "Only people added above can open it", Icon: Lock };
  if (access === "organisation") return { label: `Anyone at ${orgName}`, hint: `Anyone signed in to ${orgName} with the link`, Icon: Building2 };
  return { label: "Anyone with the link", hint: "No sign-in needed. Treat the link like a key", Icon: Globe };
}

/* ------------------------------------------------------------------ */
/* Hooks                                                                */
/* ------------------------------------------------------------------ */

/** Close something on a press outside `ref` or on Escape. */
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

/** A compact select: a quiet trigger and a popover listbox with a sliding highlight. */
function Menu<T extends string>({
  value,
  options,
  onChange,
  label,
  trigger,
  align = "right",
  placement = "bottom",
  demo,
  width = "w-64",
}: {
  value: T;
  options: MenuOption<T>[];
  onChange: (v: T) => void;
  label: string;
  trigger: ReactNode;
  align?: "left" | "right";
  placement?: "top" | "bottom";
  demo?: string;
  width?: string;
}) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, box, close);

  const show = () => {
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    setOpen(true);
  };
  const choose = (v: T) => {
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

  const dangerAt = options.findIndex((o) => o.danger);
  return (
    <div ref={box} className="relative" onKeyDown={onKey}>
      <button
        ref={button}
        type="button"
        data-demo={demo}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${uid}-list`}
        aria-label={label}
        onClick={() => (open ? setOpen(false) : show())}
        className={`[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 group inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-md px-2 text-[13px] text-[var(--sa-muted)] transition-[color,background-color,transform] duration-150 hover:bg-[var(--sa-raised)] hover:text-[var(--sa-ink)] active:scale-[0.97] ${FOCUS_RING} ${open ? "bg-[var(--sa-raised)] text-[var(--sa-ink)]" : ""}`}
      >
        {trigger}
        <ChevronDown className={`size-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} strokeWidth={2} aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            id={`${uid}-list`}
            role="listbox"
            aria-label={label}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: placement === "top" ? 6 : -6, scale: 0.98, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, transition: { duration: 0.14, ease: EASE_IN } }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className={`absolute z-30 ${width} rounded-xl border border-[var(--sa-line)] bg-[var(--sa-raised)] p-1 shadow-[var(--sa-pop)] ${align === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left"} ${
              placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
            }`}
          >
            {options.map((o, i) => {
              const selected = o.value === value;
              return (
                <li key={o.value} role="presentation">
                  {i === dangerAt && i > 0 && <div className="mx-2 my-1 h-px bg-[var(--sa-line)]" aria-hidden="true" />}
                  <div
                    role="option"
                    aria-selected={selected}
                    data-demo={demo ? `${demo}-${o.value}` : undefined}
                    onPointerEnter={() => setActive(i)}
                    onClick={() => choose(o.value)}
                    className="relative flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2"
                  >
                    {i === active && (
                      <motion.span
                        layoutId={`${uid}-active`}
                        transition={reduce ? { duration: 0 } : SPRING_UI}
                        className="absolute inset-0 rounded-lg bg-[color-mix(in_srgb,var(--sa-ink)_7%,transparent)]"
                      />
                    )}
                    <span className="relative min-w-0 flex-1">
                      <span className={`block text-[13px] font-medium ${o.danger ? "text-[var(--sa-danger)]" : "text-[var(--sa-ink)]"}`}>{o.label}</span>
                      {o.hint && <span className="mt-0.5 block text-[12px] leading-[1.4] text-[var(--sa-faint)]">{o.hint}</span>}
                    </span>
                    {selected && <Check className="relative mt-0.5 size-3.5 shrink-0 text-[var(--sa-accent)]" strokeWidth={2.5} aria-hidden="true" />}
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

function Avatar({ member }: { member: ShareMember }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tracking-[0.02em] text-[var(--sa-muted)] ${
        member.pending ? "border border-dashed border-[var(--sa-faint)]" : "bg-[var(--sa-avatar)]"
      }`}
    >
      {initials(member)}
    </span>
  );
}

function EmailChip({ chip, onRemove }: { chip: Chip; onRemove: () => void }) {
  const reduce = useReducedMotion() ?? false;
  const bad = !!chip.problem;
  return (
    <motion.span
      layout={reduce ? false : "position"}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, filter: "blur(3px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, transition: { duration: 0.14, ease: EASE_IN } }}
      transition={{ duration: 0.2, ease: EASE_OUT, layout: SPRING_UI }}
      data-demo={bad ? "chip-invalid" : "chip"}
      className={`inline-flex h-7 max-w-full items-center gap-1 rounded-md pl-2 pr-0.5 text-[13px] ${
        bad ? "border border-dashed border-[var(--sa-danger)] text-[var(--sa-danger)]" : "border border-[var(--sa-line)] bg-[var(--sa-raised)] text-[var(--sa-ink)]"
      }`}
    >
      {bad && <AlertCircle className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />}
      <span className="truncate">{chip.email}</span>
      {bad && <span className="sr-only">: {chip.problem}</span>}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${chip.email}`}
        className={`[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 flex size-6 shrink-0 items-center justify-center rounded text-current opacity-60 transition-opacity duration-150 hover:opacity-100 ${FOCUS_RING}`}
      >
        <X className="size-3" strokeWidth={2.25} aria-hidden="true" />
      </button>
    </motion.span>
  );
}

function MemberRow({
  member,
  you,
  guest,
  play,
  delay,
  onRole,
  onRemove,
}: {
  member: ShareMember;
  you: boolean;
  guest: boolean;
  play: boolean;
  delay: number;
  onRole: (r: ShareRole) => void;
  onRemove: () => void;
}) {
  const reduce = useReducedMotion() ?? false;
  const entrance = enter(play, delay, reduce);
  const options: MenuOption<MemberChoice>[] = [...ROLE_OPTIONS, { value: REMOVE, label: member.pending ? "Cancel invite" : "Remove access", danger: true }];
  return (
    <motion.li
      layout={reduce ? false : "position"}
      {...entrance}
      exit={
        reduce
          ? { opacity: 0 }
          : { opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0, overflow: "hidden", filter: "blur(4px)", transition: { duration: MOTION.collapse, ease: EASE_IN_OUT } }
      }
      transition={{ ...entrance.transition, layout: SPRING_UI }}
      className="flex items-center gap-3 overflow-visible py-2"
    >
      <Avatar member={member} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-medium text-[var(--sa-ink)]">{member.name ?? member.email}</span>
          {you && <span className="shrink-0 text-[13px] text-[var(--sa-faint)]">(you)</span>}
          {guest && <span className="shrink-0 rounded border border-[var(--sa-line)] px-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--sa-faint)]">Guest</span>}
        </div>
        <span className="block truncate text-[12px] text-[var(--sa-faint)]">{member.pending ? "Invite sent · waiting to accept" : member.email}</span>
      </div>
      {member.role === "owner" ? (
        <span className="px-2 text-[13px] text-[var(--sa-faint)]">Owner</span>
      ) : (
        <Menu<MemberChoice>
          value={member.role}
          options={options}
          label={`Access for ${member.name ?? member.email}`}
          trigger={<span>{ROLE_LABEL[member.role]}</span>}
          demo={`role-${member.email.split("@")[0]}`}
          onChange={(v) => (v === REMOVE ? onRemove() : onRole(v))}
        />
      )}
    </motion.li>
  );
}

function UndoBar({ removed, ms, onUndo }: { removed: Removed; ms: number; onUndo: () => void }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, transition: { duration: MOTION.collapse * 0.7, ease: EASE_IN } }}
      transition={{ duration: MOTION.collapse, ease: EASE_OUT }}
      className="overflow-hidden"
      role="status"
    >
      <div className="relative mb-3 flex items-center gap-3 overflow-hidden rounded-lg border border-[var(--sa-line)] bg-[var(--sa-raised)] py-1.5 pl-3 pr-1.5">
        <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--sa-muted)]">
          Removed <span className="font-medium text-[var(--sa-ink)]">{removed.member.name ?? removed.member.email}</span>
        </span>
        <button
          type="button"
          data-demo="undo"
          onClick={onUndo}
          className={`[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 h-7 shrink-0 rounded-md px-2.5 text-[13px] font-medium text-[var(--sa-ink)] transition-[background-color,transform] duration-150 hover:bg-[color-mix(in_srgb,var(--sa-ink)_8%,transparent)] active:scale-[0.97] ${FOCUS_RING}`}
        >
          Undo
        </button>
        <motion.span
          aria-hidden="true"
          key={removed.member.email}
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: ms / 1000, ease: "linear" }}
          className="absolute inset-x-0 bottom-0 h-px origin-left bg-[var(--sa-faint)]"
        />
      </div>
    </motion.div>
  );
}

function CopyButton({ link }: { link: string }) {
  const reduce = useReducedMotion() ?? false;
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), MOTION.copiedFor);
    return () => window.clearTimeout(t);
  }, [copied]);
  const copy = () => {
    void navigator.clipboard?.writeText(link).catch(() => undefined);
    setCopied(true);
  };
  return (
    <button
      type="button"
      data-demo="copy-link"
      onClick={copy}
      aria-label={copied ? "Link copied" : "Copy link"}
      className={`[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 relative inline-flex h-9 w-full shrink-0 items-center @md:w-[7.25rem] justify-center gap-1.5 overflow-hidden rounded-lg border border-[var(--sa-line)] text-[13px] font-medium text-[var(--sa-ink)] transition-[background-color,border-color,transform] duration-150 hover:border-[var(--sa-faint)] hover:bg-[var(--sa-raised)] active:scale-[0.97] ${FOCUS_RING}`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={copied ? "copied" : "copy"}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(3px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(3px)" }}
          transition={{ duration: 0.22, ease: EASE_OUT }}
          className="inline-flex items-center gap-1.5"
        >
          {copied ? <Check className="size-3.5 text-[var(--sa-accent)]" strokeWidth={2.5} aria-hidden="true" /> : <Link2 className="size-3.5" strokeWidth={2} aria-hidden="true" />}
          {copied ? "Copied" : "Copy link"}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function CollabShareAccess({
  docTitle = "Q4 launch plan",
  members: initialMembers = DEMO_MEMBERS,
  orgDomain = "northwind.co",
  orgName = "Northwind",
  defaultRole = "edit",
  linkAccess: linkAccessProp,
  linkRole: initialLinkRole = "view",
  link = "https://docs.northwind.co/d/q4-launch-plan",
  undoMs = 5000,
  onInvite,
  onRemove,
  onRoleChange,
  onLinkAccessChange,
  accent,
  theme = "dark",
  className = "",
}: CollabShareAccessProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const root = useRef<HTMLElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const play = useInView(root, { once: true, amount: 0.2 });
  const palette = PALETTE[theme];

  const [members, setMembers] = useState(initialMembers);
  const [chips, setChips] = useState<Chip[]>([]);
  const [text, setText] = useState("");
  const [role, setRole] = useState<ShareRole>(defaultRole);
  const [ownLinkAccess, setOwnLinkAccess] = useState<LinkAccess>("organisation");
  const [linkRole, setLinkRole] = useState<ShareRole>(initialLinkRole);
  const [removed, setRemoved] = useState<Removed | null>(null);
  const [added, setAdded] = useState(false);
  const nextId = useRef(1);
  const linkAccess = linkAccessProp ?? ownLinkAccess;

  useEffect(() => setRole(defaultRole), [defaultRole]);

  useEffect(() => {
    if (!removed) return;
    const t = window.setTimeout(() => setRemoved(null), undoMs);
    return () => window.clearTimeout(t);
  }, [removed, undoMs]);

  const owner = members.find((m) => m.role === "owner");
  const problems = chips.filter((c) => c.problem);
  const valid = chips.filter((c) => !c.problem);

  const check = (email: string, existing: Chip[]): string | undefined => {
    const e = email.toLowerCase();
    if (!EMAIL.test(e)) return `“${email}” isn’t a full email address`;
    if (members.some((m) => m.email.toLowerCase() === e)) return `${email} already has access`;
    if (existing.some((c) => c.email.toLowerCase() === e)) return `${email} is in the list twice`;
    return undefined;
  };

  const commit = (raw: string) => {
    const parts = raw
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    setChips((cs) => {
      const next = [...cs];
      for (const email of parts) next.push({ id: nextId.current++, email, problem: check(email, next) });
      return next;
    });
    setText("");
  };

  const onKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) return;
    if (SEPARATORS.has(e.key) && text.trim()) {
      e.preventDefault();
      commit(text);
    } else if (e.key === "Enter" && !text.trim() && valid.length) {
      e.preventDefault();
      invite();
    } else if (e.key === "Backspace" && !text && chips.length) {
      e.preventDefault();
      setChips((cs) => cs.slice(0, -1));
    }
  };

  const onPaste = (e: ReactClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (!/[\s,;]/.test(pasted.trim())) return;
    e.preventDefault();
    commit(text + pasted);
  };

  const invite = () => {
    const pendingText = text.trim();
    let list = chips;
    if (pendingText) {
      list = [...chips, { id: nextId.current++, email: pendingText, problem: check(pendingText, chips) }];
      setText("");
    }
    const ok = list.filter((c) => !c.problem);
    if (!ok.length) {
      setChips(list);
      return;
    }
    setAdded(true);
    setMembers((ms) => [...ms, ...ok.map((c) => ({ email: c.email, role, pending: true }))]);
    setChips(list.filter((c) => c.problem));
    onInvite?.(
      ok.map((c) => c.email),
      role,
    );
    field.current?.focus({ focusVisible: false } as FocusOptions);
  };

  const remove = (email: string) => {
    const index = members.findIndex((m) => m.email === email);
    if (index < 0) return;
    const member = members[index];
    setMembers((ms) => ms.filter((m) => m.email !== email));
    setRemoved({ member, index });
    onRemove?.(member);
  };

  const undo = () => {
    if (!removed) return;
    setMembers((ms) => {
      const next = [...ms];
      next.splice(Math.min(removed.index, next.length), 0, removed.member);
      return next;
    });
    setRemoved(null);
  };

  const changeRole = (email: string, r: ShareRole) => {
    setMembers((ms) => ms.map((m) => (m.email === email ? { ...m, role: r } : m)));
    onRoleChange?.(email, r);
  };

  const changeLink = (a: LinkAccess) => {
    setOwnLinkAccess(a);
    onLinkAccessChange?.(a);
  };

  const domainOf = (email: string) => email.split("@")[1]?.toLowerCase() ?? "";
  const lc = linkCopy(linkAccess, orgName);
  const LinkIcon = lc.Icon;
  const linkOptions: MenuOption<LinkAccess>[] = (["restricted", "organisation", "anyone"] as const).map((a) => ({
    value: a,
    label: linkCopy(a, orgName).label,
    hint: linkCopy(a, orgName).hint,
  }));

  return (
    <section
      ref={root}
      aria-labelledby={`${uid}-title`}
      style={cssVars(palette, accent ?? palette.ink)}
      className={`@container w-full font-sans text-[var(--sa-ink)] antialiased ${className}`}
    >
      <motion.div {...enter(play, 0, reduce)} className="rounded-[14px] border border-[var(--sa-line)] bg-[var(--sa-surface)] shadow-[var(--sa-shadow)]">
        <div className="px-5 pb-5 pt-5 @md:px-6">
          <motion.header {...enter(play, MOTION.step, reduce)} className="flex items-baseline justify-between gap-4">
            <h2 id={`${uid}-title`} className="min-w-0 truncate font-display text-[18px] font-semibold tracking-[-0.025em]">
              Share <span className="text-[var(--sa-muted)]">“{docTitle}”</span>
            </h2>
            <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--sa-faint)]">
              {members.length} {members.length === 1 ? "person" : "people"}
            </span>
          </motion.header>

          <motion.div {...enter(play, MOTION.step * 2, reduce)} className="mt-4 flex flex-col gap-2 @md:flex-row @md:items-start">
            <div className="flex min-h-11 flex-1 items-start gap-1 rounded-xl border border-[var(--sa-line)] bg-[var(--sa-sunken)] py-1.5 pl-2 pr-1 transition-[border-color,box-shadow] duration-150 focus-within:border-[var(--sa-faint)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--sa-ink)_8%,transparent)]">
              <div onClick={(e) => e.target === e.currentTarget && field.current?.focus()} className="flex min-w-0 flex-1 cursor-text flex-wrap items-center gap-1.5">
                <AnimatePresence initial={false}>
                  {chips.map((c) => (
                    <EmailChip key={c.id} chip={c} onRemove={() => setChips((cs) => cs.filter((x) => x.id !== c.id))} />
                  ))}
                </AnimatePresence>
                <input
                  ref={field}
                  data-demo="invite-input"
                  type="text"
                  inputMode="email"
                  autoComplete="off"
                  spellCheck={false}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={onKey}
                  onPaste={onPaste}
                  onBlur={() => text.trim() && commit(text)}
                  placeholder={chips.length ? "" : "Add people by email"}
                  aria-label="Emails to invite"
                  aria-describedby={`${uid}-hint`}
                  aria-invalid={problems.length > 0}
                  className="h-8 min-w-[6rem] flex-1 bg-transparent px-1.5 text-[14px] text-[var(--sa-ink)] outline-none placeholder:text-[var(--sa-faint)]"
                />
              </div>
              <Menu<ShareRole> value={role} options={ROLE_OPTIONS} onChange={setRole} label="Role for new invites" trigger={<span>{ROLE_LABEL[role]}</span>} demo="invite-role" />
            </div>
            <button
              type="button"
              data-demo="invite"
              onClick={invite}
              disabled={!valid.length && !text.trim()}
              className={`[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 h-11 shrink-0 rounded-xl bg-[var(--sa-accent)] px-5 text-[14px] font-medium text-[var(--sa-on-accent)] transition-[opacity,transform,filter] duration-150 hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100 ${FOCUS_RING}`}
            >
              Invite{valid.length > 1 ? ` ${valid.length}` : ""}
            </button>
          </motion.div>

          <div id={`${uid}-hint`} aria-live="polite" className="mt-2 min-h-[18px] text-[12px]">
            <AnimatePresence mode="wait" initial={false}>
              {problems.length ? (
                <motion.p
                  key={`err-${problems[0].id}`}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                  className="flex items-center gap-1.5 text-[var(--sa-danger)]"
                >
                  {problems[0].problem}
                  {problems.length > 1 ? ` (and ${problems.length - 1} more)` : ""}. Fix it or remove the chip.
                </motion.p>
              ) : (
                <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} className="text-[var(--sa-faint)]">
                  Separate with commas or Enter. People outside {orgDomain} join as guests.
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <motion.h3 {...enter(play, MOTION.step * 3, reduce)} className="mt-4 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--sa-faint)]">
            People with access
          </motion.h3>
          <ul className="mt-1" aria-label="People with access">
            <AnimatePresence initial={false}>
              {members.map((m, i) => (
                <MemberRow
                  key={m.email}
                  member={m}
                  you={m === owner}
                  guest={domainOf(m.email) !== orgDomain.toLowerCase()}
                  play={play}
                  delay={added && m.pending ? 0 : MOTION.rowsAt + i * MOTION.rowStep}
                  onRole={(r) => changeRole(m.email, r)}
                  onRemove={() => remove(m.email)}
                />
              ))}
            </AnimatePresence>
          </ul>
        </div>

        <motion.div {...enter(play, MOTION.rowsAt + members.length * MOTION.rowStep, reduce)} className="border-t border-[var(--sa-rule)] px-5 pb-5 pt-4 @md:px-6">
          <AnimatePresence initial={false}>{removed && <UndoBar key={removed.member.email} removed={removed} ms={undoMs} onUndo={undo} />}</AnimatePresence>
          <h3 className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--sa-faint)]">General access</h3>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-3">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--sa-line)] bg-[var(--sa-raised)] text-[var(--sa-muted)]"
              aria-hidden="true"
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={linkAccess}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, rotate: -20 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                  transition={SPRING_UI}
                  className="flex"
                >
                  <LinkIcon className="size-4" strokeWidth={1.75} />
                </motion.span>
              </AnimatePresence>
            </span>
            <div className="min-w-0 flex-1 basis-[12rem]">
              <div className="-ml-2 flex flex-wrap items-center">
                <Menu<LinkAccess>
                  value={linkAccess}
                  options={linkOptions}
                  onChange={changeLink}
                  label="Who can open the link"
                  trigger={<span className="font-medium text-[var(--sa-ink)]">{lc.label}</span>}
                  align="left"
                  placement="top"
                  demo="link-access"
                  width="w-72"
                />
                <AnimatePresence initial={false}>
                  {linkAccess !== "restricted" && (
                    <motion.span
                      initial={reduce ? { opacity: 0 } : { opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, transition: { duration: MOTION.exit } }}
                      transition={{ duration: 0.22, ease: EASE_OUT }}
                      className="flex items-center"
                    >
                      <span className="text-[13px] text-[var(--sa-faint)]" aria-hidden="true">
                        ·
                      </span>
                      <Menu<ShareRole>
                        value={linkRole}
                        options={ROLE_OPTIONS}
                        onChange={setLinkRole}
                        label="What link visitors can do"
                        trigger={<span>{ROLE_LABEL[linkRole].toLowerCase()}</span>}
                        align="left"
                        placement="top"
                      />
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={linkAccess}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.22, ease: EASE_OUT }}
                  className="truncate text-[12px] text-[var(--sa-faint)]"
                >
                  {lc.hint}
                </motion.p>
              </AnimatePresence>
            </div>
            <CopyButton link={link} />
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

/** The demo owns link access so the Customize panel and the in-panel menu drive the same state. */
export default function CollabShareAccessDemo({ linkAccess: forced, onLinkAccessChange: _onLinkAccessChange, ...overrides }: Partial<CollabShareAccessProps> = {}) {
  void _onLinkAccessChange;
  const [access, setAccess] = useState<LinkAccess>(forced ?? "organisation");
  useEffect(() => {
    if (forced) setAccess(forced);
  }, [forced]);

  const light = overrides.theme === "light";
  // The dark theme's own accent is its ink; on the light theme that would vanish, so fall back to the light ink.
  const accent = light && overrides.accent?.toLowerCase() === "#f4f4f5" ? undefined : overrides.accent;
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-16 sm:px-8" style={{ background: light ? STAGE_LIGHT : STAGE }}>
      <div className="w-full max-w-[600px]">
        <CollabShareAccess {...overrides} accent={accent} linkAccess={access} onLinkAccessChange={setAccess} />
      </div>
    </div>
  );
}
