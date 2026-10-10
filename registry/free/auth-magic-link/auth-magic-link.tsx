"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode, type RefObject } from "react";
import { AnimatePresence, animate, motion, useInView, useMotionValue, useReducedMotion, useTransform, type AnimationPlaybackControls } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type MailProvider = { name: string; href: string };

export type AuthMagicLinkProps = {
  title?: string;
  subtitle?: string;
  emailLabel?: string;
  emailPlaceholder?: string;
  submitLabel?: string;
  /** The address your links come from. Used to search Gmail for the message. */
  sender?: string;
  /** How long a link lives, for the copy (“15 minutes”). */
  linkLifetime?: string;
  /** Seconds before “Resend” unlocks. */
  resendAfter?: number;
  defaultEmail?: string;
  /** Open in the “your link expired” state, e.g. when the user lands from a dead link. */
  expired?: boolean;
  /** Send the link. Reject (with an Error message, optionally) to show the error banner. */
  onSend?: (email: string) => Promise<void>;
  alternateLabel?: string;
  alternateHref?: string;
  /** Override or extend provider detection: domain → provider. */
  providers?: Record<string, MailProvider>;
  /** The one accent: the primary button. Defaults to the theme’s ink. */
  accent?: string;
  theme?: "dark" | "light";
  className?: string;
};

type ResendState = "idle" | "sending" | "sent";

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    surface: "#0a0a0b",
    tile: "#141416",
    field: "rgba(255,255,255,0.025)",
    hover: "rgba(255,255,255,0.05)",
    line: "rgba(255,255,255,0.1)",
    lineHover: "rgba(255,255,255,0.18)",
    focus: "rgba(237,237,239,0.62)",
    ink: "#ededef",
    label: "#cfcfd4",
    muted: "#a0a0a8",
    faint: "#7d7d86",
    placeholder: "#5c5c64",
    error: "#ff6b5e",
    errorInk: "#ff8f84",
    errorBody: "#f2d6d2",
    warn: "#f5c451",
    ok: "#3ddc97",
    // The envelope: a little stack of greys, lightest nearest the eye.
    envBack: "#121214",
    envPocket: "#161618",
    envFlapBack: "#1a1a1d",
    envFlap: "#1d1d21",
    envStroke: "rgba(255,255,255,0.15)",
    paper: "#ededef",
    paperLine: "#a6a6ad",
    shadow: "inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.06), 0 32px 80px -32px rgba(0,0,0,0.9)",
  },
  light: {
    surface: "#ffffff",
    tile: "#f4f4f5",
    field: "rgba(24,24,27,0.015)",
    hover: "rgba(24,24,27,0.05)",
    line: "rgba(24,24,27,0.14)",
    lineHover: "rgba(24,24,27,0.26)",
    focus: "rgba(24,24,27,0.7)",
    ink: "#18181b",
    label: "#3f3f46",
    muted: "#52525b",
    faint: "#71717a",
    placeholder: "#a1a1aa",
    error: "#dc2626",
    errorInk: "#b91c1c",
    errorBody: "#7f1d1d",
    warn: "#b45309",
    ok: "#15803d",
    envBack: "#e4e4e7",
    envPocket: "#f4f4f5",
    envFlapBack: "#e9e9ec",
    envFlap: "#fafafa",
    envStroke: "rgba(24,24,27,0.16)",
    paper: "#ffffff",
    paperLine: "#a1a1aa",
    shadow: "0 0 0 1px rgba(24,24,27,0.08), 0 1px 2px rgba(24,24,27,0.04), 0 32px 64px -32px rgba(24,24,27,0.28)",
  },
} as const;

type Palette = Record<keyof (typeof PALETTE)["dark"], string>;

/** The demo’s quiet backdrop; not part of the component. */
const STAGE = { dark: "#000000", light: "#ececef" } as const;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;

/** One place for the choreography. Seconds unless noted. */
const MOTION = {
  card: 0.6,
  cardRise: 16,
  cardBlur: 10,
  rise: 10,
  blur: 6,
  block: 0.45,
  first: 0.12, // first inner block on mount, as the card lands
  switch: 0.14, // first inner block after a view switch, once the old view has cleared
  stagger: 0.05,
  exit: 0.2,
  height: 0.42, // the card following its content
  morph: 0.42, // the primary button travelling between views
  swap: 0.2,
  message: 0.3,
  shake: 0.42,
  roll: 0.32,
  fade: 0.15,
  // Envelope
  letter: 0.5,
  letterDelay: 0.22,
  fold: 0.42,
  foldDelay: 0.62,
  trail: 0.7,
} as const;

const SHAKE_X = [0, -7, 6, -4, 2, 0];
/** Pause before Resend counts down again after a resend lands. ms. */
const RESENT_HOLD_MS = 1600;
/** Lets the form view mount before the returning field is focused. ms. */
const REFOCUS_MS = 60;
const TICK_MS = 250;

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ml-ink)]";

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function emailProblem(v: string): string | null {
  const s = v.trim();
  if (!s) return "Enter your email and we’ll send the link there.";
  if (/\s/.test(s)) return "Emails can’t contain spaces.";
  if (!s.includes("@")) return "That’s missing an @.";
  const [local, domain = ""] = s.split("@");
  if (!local) return "Add the part before the @.";
  if (!/^[^\s@]+\.[^\s@]{2,}$/.test(domain)) return "Add the domain, like name@company.com.";
  return null;
}

const TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "outlook.co": "outlook.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "iclod.com": "icloud.com",
  "icloud.co": "icloud.com",
  "protonmail.co": "protonmail.com",
  "proton.m": "proton.me",
  "porton.me": "proton.me",
};

function suggestFix(v: string): string | null {
  const [local, domain] = v.trim().toLowerCase().split("@");
  if (!local || !domain) return null;
  const fix = TYPOS[domain];
  return fix ? `${v.trim().split("@")[0]}@${fix}` : null;
}

function detectProvider(email: string, sender: string, extra?: Record<string, MailProvider>): MailProvider | null {
  const domain = email.split("@")[1]?.toLowerCase().trim() ?? "";
  if (extra?.[domain]) return extra[domain];
  const q = encodeURIComponent(`from:(${sender}) in:anywhere newer_than:1h`);
  if (["gmail.com", "googlemail.com"].includes(domain)) return { name: "Gmail", href: `https://mail.google.com/mail/u/0/#search/${q}` };
  if (["outlook.com", "hotmail.com", "live.com", "msn.com", "hotmail.co.uk", "outlook.co.uk", "live.co.uk"].includes(domain))
    return { name: "Outlook", href: "https://outlook.live.com/mail/0/" };
  if (["proton.me", "protonmail.com", "pm.me", "protonmail.ch"].includes(domain)) return { name: "Proton", href: "https://mail.proton.me/u/0/inbox" };
  if (["icloud.com", "me.com", "mac.com"].includes(domain)) return { name: "iCloud Mail", href: "https://www.icloud.com/mail" };
  if (["yahoo.com", "ymail.com", "yahoo.co.uk"].includes(domain)) return { name: "Yahoo Mail", href: "https://mail.yahoo.com/" };
  if (["fastmail.com", "fastmail.fm"].includes(domain)) return { name: "Fastmail", href: "https://app.fastmail.com/" };
  if (domain === "hey.com") return { name: "HEY", href: "https://app.hey.com/" };
  return null;
}

/** Black or white, whichever reads on the accent. */
function inkOn(hex: string) {
  const v = hex.replace("#", "");
  const full = v.length === 3 ? [...v].map((c) => c + c).join("") : v.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#0a0a0b" : "#ffffff";
}

/** Palette → `--ml-*` variables (camelCase keys become kebab-case). */
function cssVars(p: Palette, accent: string): CSSProperties {
  const vars: Record<string, string> = { "--ml-accent": accent, "--ml-on-accent": inkOn(accent) };
  for (const [k, v] of Object.entries(p)) vars[`--ml-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`] = v;
  return vars as CSSProperties;
}

/** Entrance props for a block: rises out of a blur. Reduced motion: a short fade. */
function enter(play: boolean, delay: number, reduce: boolean, rise: number = MOTION.rise, blur: number = MOTION.blur, duration: number = MOTION.block) {
  if (reduce) return { initial: { opacity: 0 }, animate: { opacity: play ? 1 : 0 }, transition: { duration: MOTION.fade } };
  return {
    initial: { opacity: 0, y: rise, filter: `blur(${blur}px)` },
    animate: play ? { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: { filter: "none" } } : undefined,
    transition: { duration, ease: EASE_OUT, delay },
  };
}

function swapProps(reduce: boolean, offset = 8) {
  return reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: offset, filter: "blur(3px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" },
        exit: { opacity: 0, y: -offset, filter: "blur(3px)", transition: { duration: MOTION.swap * 0.66, ease: EASE_IN } },
      };
}

/* ------------------------------------------------------------------ */
/* Hooks                                                                */
/* ------------------------------------------------------------------ */

/** setTimeout that can’t outlive the component: everything pending is cleared on unmount. */
function useTimeouts() {
  const pending = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const set = pending.current;
    return () => {
      set.forEach(clearTimeout);
      set.clear();
    };
  }, []);
  return useMemo(() => {
    const later = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        pending.current.delete(id);
        fn();
      }, ms);
      pending.current.add(id);
    };
    return { later, wait: (ms: number) => new Promise<void>((resolve) => later(resolve, ms)) };
  }, []);
}

/** Seconds left on a cooldown, re-rendering once a second only while it runs. */
function useCooldown() {
  const [until, setUntil] = useState(0);
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!until) return;
    const tick = () => {
      const s = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) setUntil(0);
    };
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [until]);
  const start = useCallback((seconds: number) => {
    setUntil(Date.now() + seconds * 1000);
    setLeft(Math.ceil(seconds));
  }, []);
  return { left, start };
}

function useShake(reduce: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const running = useRef<AnimationPlaybackControls | null>(null);
  useEffect(() => () => running.current?.stop(), []);
  const shake = useCallback(() => {
    if (!ref.current || reduce) return;
    running.current?.stop();
    running.current = animate(ref.current, { x: SHAKE_X }, { duration: MOTION.shake, ease: "easeOut" });
  }, [reduce]);
  return [ref, shake] as const;
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function AuthMagicLink({
  title = "Sign in with a link",
  subtitle = "No password to forget. We’ll email you a link that signs you straight in.",
  emailLabel = "Email",
  emailPlaceholder = "you@company.com",
  submitLabel = "Email me a link",
  sender = "login@halyard.app",
  linkLifetime = "15 minutes",
  resendAfter = 30,
  defaultEmail = "",
  expired = false,
  onSend,
  alternateLabel = "Use a password instead",
  alternateHref = "#password",
  providers,
  accent,
  theme = "dark",
  className = "",
}: AuthMagicLinkProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const root = useRef<HTMLDivElement>(null);
  const play = useInView(root, { once: true, amount: 0.3 });
  const palette = PALETTE[theme];
  const { later, wait } = useTimeouts();

  const [view, setView] = useState<"form" | "sent">("form");
  const [email, setEmail] = useState(defaultEmail);
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [resendState, setResendState] = useState<ResendState>("idle");
  const [replay, setReplay] = useState(0);
  const [showExpired, setShowExpired] = useState(expired);
  const [announce, setAnnounce] = useState("");
  // The first view rides in on the card’s entrance; later views stagger in as soon as the old one clears.
  const [switched, setSwitched] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const [shakeRef, shake] = useShake(reduce);
  const cooldown = useCooldown();

  useEffect(() => setShowExpired(expired), [expired]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    if (sending) return;
    const problem = emailProblem(email);
    setBanner(null);
    if (problem) {
      setError(problem);
      shake();
      inputRef.current?.focus();
      return;
    }
    const target = email.trim();
    setError(null);
    setSending(true);
    setAnnounce("Sending your link…");
    try {
      await (onSend ? onSend(target) : wait(1100));
      setSentTo(target);
      setShowExpired(false);
      cooldown.start(resendAfter);
      setSwitched(true);
      setView("sent");
      setAnnounce(`Link sent to ${target}. Check your inbox.`);
    } catch (err) {
      setBanner(err instanceof Error && err.message ? err.message : "We couldn’t send the email just now. Our mail server is having a moment, so try again in a few seconds.");
      setAnnounce("");
    } finally {
      setSending(false);
    }
  };

  const resend = async () => {
    if (cooldown.left > 0 || resendState !== "idle") return;
    setResendState("sending");
    try {
      await (onSend ? onSend(sentTo) : wait(1000));
      setResendState("sent");
      setReplay((r) => r + 1);
      setAnnounce(`Sent another link to ${sentTo}. Only the newest one works.`);
      later(() => {
        setResendState("idle");
        cooldown.start(resendAfter);
      }, RESENT_HOLD_MS);
    } catch {
      setResendState("idle");
      setAnnounce("Couldn’t resend. Try again in a moment.");
    }
  };

  // Coming back from “sent”: refocus the field with the address selected, ready to retype.
  const back = () => {
    setEmail(sentTo);
    setView("form");
    setAnnounce("");
    later(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, REFOCUS_MS);
  };

  const viewPlay = switched || play;
  const base = switched ? MOTION.switch : MOTION.first;
  const exit = reduce ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(4px)", transition: { duration: MOTION.exit, ease: EASE_IN } };

  return (
    <div
      ref={root}
      style={cssVars(palette, accent ?? palette.ink)}
      className={`@container w-full max-w-[400px] font-sans text-[var(--ml-ink)] antialiased ${theme === "dark" ? "[color-scheme:dark]" : "[color-scheme:light]"} ${className}`}
    >
      <style>{`@keyframes auth-magic-link-spin { to { transform: rotate(360deg) } }`}</style>
      <motion.div
        {...enter(play, 0, reduce, MOTION.cardRise, MOTION.cardBlur, MOTION.card)}
        className="relative overflow-hidden rounded-[20px] bg-[var(--ml-surface)] shadow-[var(--ml-shadow)]"
      >
        <AutoHeight reduce={reduce}>
          <div className="px-5 pb-6 pt-7 @[22rem]:px-6 @sm:px-8 @sm:pb-8 @sm:pt-9">
            {/* No initial={false} here: it would suppress every block’s own entrance on first render. */}
            <AnimatePresence mode="popLayout">
              {view === "form" ? (
                <motion.div key="form" exit={exit}>
                  <FormView
                    uid={uid}
                    play={viewPlay}
                    base={base}
                    animateCta={!switched}
                    expired={showExpired}
                    title={title}
                    subtitle={subtitle}
                    linkLifetime={linkLifetime}
                    banner={banner}
                    emailLabel={emailLabel}
                    emailPlaceholder={emailPlaceholder}
                    email={email}
                    error={error}
                    sending={sending}
                    submitLabel={submitLabel}
                    alternateLabel={alternateLabel}
                    alternateHref={alternateHref}
                    inputRef={inputRef}
                    shakeRef={shakeRef}
                    onEmail={(v) => {
                      setEmail(v);
                      // Reward early, punish late: typing only clears an error once it’s fixed.
                      if (error && !emailProblem(v)) setError(null);
                    }}
                    onBlurCheck={() => email.trim() && setError(emailProblem(email))}
                    onSuggest={(v) => {
                      setEmail(v);
                      inputRef.current?.focus();
                    }}
                    onSubmit={send}
                    reduce={reduce}
                  />
                </motion.div>
              ) : (
                <motion.div key="sent" exit={exit}>
                  <SentView
                    uid={uid}
                    base={base}
                    replay={replay}
                    sentTo={sentTo}
                    sender={sender}
                    linkLifetime={linkLifetime}
                    provider={detectProvider(sentTo, sender, providers)}
                    resendLeft={cooldown.left}
                    resendState={resendState}
                    onResend={() => void resend()}
                    onBack={back}
                    reduce={reduce}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </AutoHeight>
        <p className="sr-only" role="status" aria-live="polite">
          {announce}
        </p>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Views                                                                */
/* ------------------------------------------------------------------ */

function FormView({
  uid,
  play,
  base,
  animateCta,
  expired,
  title,
  subtitle,
  linkLifetime,
  banner,
  emailLabel,
  emailPlaceholder,
  email,
  error,
  sending,
  submitLabel,
  alternateLabel,
  alternateHref,
  inputRef,
  shakeRef,
  onEmail,
  onBlurCheck,
  onSuggest,
  onSubmit,
  reduce,
}: {
  uid: string;
  play: boolean;
  base: number;
  /** The CTA staggers in on first mount; after a view switch it travels instead (shared layoutId). */
  animateCta: boolean;
  expired: boolean;
  title: string;
  subtitle: string;
  linkLifetime: string;
  banner: string | null;
  emailLabel: string;
  emailPlaceholder: string;
  email: string;
  error: string | null;
  sending: boolean;
  submitLabel: string;
  alternateLabel: string;
  alternateHref: string;
  inputRef: RefObject<HTMLInputElement | null>;
  shakeRef: RefObject<HTMLDivElement | null>;
  onEmail: (v: string) => void;
  onBlurCheck: () => void;
  onSuggest: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  reduce: boolean;
}) {
  const at = (n: number) => base + n * MOTION.stagger;
  const suggestion = error ? null : suggestFix(email);
  const swap = swapProps(reduce);
  const fieldId = `${uid}-email`;

  return (
    <>
      <motion.div {...enter(play, at(0), reduce)}>{expired ? <ExpiredGlyph /> : <Mark />}</motion.div>
      <motion.h1 {...enter(play, at(1), reduce)} className="mt-6 text-[clamp(1.375rem,1.2rem+0.6cqi,1.5rem)] font-semibold leading-[1.15] tracking-[-0.025em]">
        {expired ? "That link has expired" : title}
      </motion.h1>
      <motion.p {...enter(play, at(2), reduce)} className="mt-2 text-pretty text-[14.5px] leading-[1.55] text-[var(--ml-muted)]">
        {expired ? `Sign-in links work once and last ${linkLifetime}, so this one’s retired. We’ll send you a fresh one.` : subtitle}
      </motion.p>

      <Collapse show={!!banner} reduce={reduce}>
        <div
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-[12px] bg-[color-mix(in_srgb,var(--ml-error)_7%,transparent)] px-3.5 py-3 text-[13.5px] leading-[1.5] text-[var(--ml-error-body)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ml-error)_26%,transparent)]"
        >
          <span className="mt-[1px] shrink-0 text-[var(--ml-error)]">
            <AlertGlyph />
          </span>
          <p className="min-w-0">{banner}</p>
        </div>
      </Collapse>

      <form noValidate onSubmit={onSubmit} className="mt-7">
        <motion.div {...enter(play, at(3), reduce)}>
          <label htmlFor={fieldId} className="mb-2 block text-[13px] font-medium leading-5 text-[var(--ml-label)]">
            {emailLabel}
          </label>
          <div ref={shakeRef}>
            <div
              className={`rounded-[11px] transition-[background-color,box-shadow,opacity] duration-150 ${
                error
                  ? "bg-[color-mix(in_srgb,var(--ml-error)_5%,transparent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ml-error)_60%,transparent)] focus-within:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ml-error)_90%,transparent),0_0_0_4px_color-mix(in_srgb,var(--ml-error)_10%,transparent)]"
                  : "bg-[var(--ml-field)] shadow-[inset_0_0_0_1px_var(--ml-line)] hover:shadow-[inset_0_0_0_1px_var(--ml-line-hover)] focus-within:!shadow-[inset_0_0_0_1px_var(--ml-focus),0_0_0_4px_var(--ml-hover)]"
              } ${sending ? "opacity-60" : ""}`}
            >
              <input
                ref={inputRef}
                data-demo="email"
                id={fieldId}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder={emailPlaceholder}
                value={email}
                readOnly={sending}
                aria-invalid={!!error || undefined}
                aria-describedby={error ? `${uid}-err` : suggestion ? `${uid}-fix` : undefined}
                onChange={(e) => onEmail(e.target.value)}
                onBlur={onBlurCheck}
                className="h-11 w-full min-w-0 rounded-[11px] bg-transparent px-3.5 text-[16px] text-[var(--ml-ink)] outline-none selection:bg-[color-mix(in_srgb,var(--ml-ink)_22%,transparent)] placeholder:text-[var(--ml-placeholder)] @sm:text-[15px]"
              />
            </div>
          </div>

          {/* Error, or a typo suggestion */}
          <Collapse show={!!(error || suggestion)} reduce={reduce} swapKey={error ? "err" : "fix"}>
            {error ? (
              <motion.p
                id={`${uid}-err`}
                role="alert"
                initial={reduce ? false : { y: -6 }}
                animate={{ y: 0 }}
                transition={{ duration: MOTION.message, ease: EASE_OUT }}
                className="flex items-start gap-1.5 pt-2 text-[13px] leading-[1.45] text-[var(--ml-error-ink)]"
              >
                <span className="mt-[3px] shrink-0">
                  <SmallAlert />
                </span>
                {error}
              </motion.p>
            ) : (
              <p id={`${uid}-fix`} className="pt-2 text-[13px] leading-[1.45] text-[var(--ml-muted)]">
                Did you mean{" "}
                <button
                  type="button"
                  onClick={() => suggestion && onSuggest(suggestion)}
                  className={`rounded-sm font-medium text-[var(--ml-ink)] underline decoration-[var(--ml-line-hover)] underline-offset-[3px] transition-[text-decoration-color] duration-150 hover:decoration-[var(--ml-focus)] ${focusRing}`}
                >
                  {suggestion}
                </button>
                ?
              </p>
            )}
          </Collapse>
        </motion.div>

        <motion.div {...(animateCta ? enter(play, at(4), reduce) : {})}>
          <PrimaryButton layoutId={`${uid}-cta`} demo="send" type="submit" disabled={sending} reduce={reduce} className="mt-5">
            <AnimatePresence mode="popLayout" initial={false}>
              {sending ? (
                <motion.span key="sending" {...swap} transition={{ duration: MOTION.swap, ease: EASE_OUT }} className="relative flex items-center gap-2.5">
                  <Spinner /> Sending link…
                </motion.span>
              ) : (
                <motion.span key="label" {...swap} transition={{ duration: MOTION.swap, ease: EASE_OUT }} className="relative flex items-center gap-2">
                  {expired ? "Send a new link" : submitLabel}
                  <ArrowRight />
                </motion.span>
              )}
            </AnimatePresence>
          </PrimaryButton>
        </motion.div>
      </form>

      <motion.p {...enter(play, at(5), reduce)} className="mt-6 text-center text-[13.5px] leading-5">
        <a
          href={alternateHref}
          className={`rounded-sm text-[var(--ml-muted)] underline decoration-[var(--ml-line)] underline-offset-[3px] transition-[color,text-decoration-color] duration-150 hover:text-[var(--ml-ink)] hover:decoration-[var(--ml-focus)] ${focusRing}`}
        >
          {alternateLabel}
        </a>
      </motion.p>
    </>
  );
}

function SentView({
  uid,
  base,
  replay,
  sentTo,
  sender,
  linkLifetime,
  provider,
  resendLeft,
  resendState,
  onResend,
  onBack,
  reduce,
}: {
  uid: string;
  base: number;
  replay: number;
  sentTo: string;
  sender: string;
  linkLifetime: string;
  provider: MailProvider | null;
  resendLeft: number;
  resendState: ResendState;
  onResend: () => void;
  onBack: () => void;
  reduce: boolean;
}) {
  const at = (n: number) => base + n * MOTION.stagger;
  return (
    <>
      <motion.div {...enter(true, at(0), reduce)}>
        <Envelope key={replay} reduce={reduce} />
      </motion.div>
      <motion.h1 {...enter(true, at(1), reduce)} className="mt-6 text-center text-[clamp(1.375rem,1.2rem+0.6cqi,1.5rem)] font-semibold leading-[1.15] tracking-[-0.025em]">
        Check your inbox
      </motion.h1>
      <motion.p {...enter(true, at(2), reduce)} className="mx-auto mt-2 max-w-[34ch] text-pretty text-center text-[14.5px] leading-[1.55] text-[var(--ml-muted)]">
        We sent a sign-in link to <span className="break-all font-medium text-[var(--ml-ink)]">{sentTo}</span>. It works once and expires in {linkLifetime}.
      </motion.p>

      {provider ? (
        <PrimaryButton layoutId={`${uid}-cta`} demo="open-mail" href={provider.href} reduce={reduce} className="mt-7">
          <motion.span {...enter(true, at(3), reduce, 6, 3, MOTION.swap + 0.1)} className="relative flex items-center gap-2">
            Open {provider.name}
            <ArrowUpRight />
          </motion.span>
        </PrimaryButton>
      ) : (
        <motion.p
          {...enter(true, at(3), reduce)}
          className="mt-7 rounded-[11px] bg-[var(--ml-field)] px-4 py-3 text-center text-[13.5px] leading-[1.5] text-[var(--ml-muted)] shadow-[inset_0_0_0_1px_var(--ml-line)]"
        >
          Look for an email from <span className="text-[var(--ml-ink)]">{sender}</span>.
        </motion.p>
      )}

      <motion.div {...enter(true, at(4), reduce)} className="mt-6 flex min-h-11 items-center justify-between gap-3 border-t border-[var(--ml-line)] pt-4">
        <button
          type="button"
          onClick={onBack}
          className={`group/back -ml-2 inline-flex h-11 items-center gap-1.5 rounded-[10px] px-2 text-[13.5px] text-[var(--ml-muted)] transition-[color,background-color,transform] duration-150 hover:bg-[var(--ml-hover)] hover:text-[var(--ml-ink)] active:scale-[0.97] ${focusRing}`}
        >
          <span className="transition-transform duration-150 group-hover/back:-translate-x-0.5">
            <ArrowLeft />
          </span>
          Use a different email
        </button>
        <ResendButton left={resendLeft} state={resendState} onClick={onResend} reduce={reduce} />
      </motion.div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Layout helpers                                                       */
/* ------------------------------------------------------------------ */

/** The card’s height follows its content, so a view switch reads as one surface reshaping. */
function AutoHeight({ children, reduce }: { children: ReactNode; reduce: boolean }) {
  const inner = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | "auto">("auto");
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <motion.div initial={false} animate={{ height: h }} transition={{ duration: reduce ? 0 : MOTION.height, ease: EASE_IN_OUT }} className="relative">
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}

/** Height-and-fade reveal for banners and messages. `swapKey` cross-fades between two contents in the same slot. */
function Collapse({ show, reduce, swapKey = "only", children }: { show: boolean; reduce: boolean; swapKey?: string; children: ReactNode }) {
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {show && (
        <motion.div
          key={swapKey}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0, transition: { duration: reduce ? 0.1 : 0.16, ease: EASE_IN } }}
          transition={{ duration: reduce ? 0.12 : MOTION.message, ease: EASE_OUT }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* Envelope: the letter slides in, the flap folds shut, it leaves a trail */
/* ------------------------------------------------------------------ */

function Envelope({ reduce }: { reduce: boolean }) {
  // One value drives the flap: −1 (open, behind the letter) → 1 (shut, over the pocket).
  const fold = useMotionValue(reduce ? 1 : -1);
  const backOpacity = useTransform(fold, (v) => (v < 0 ? 1 : 0));
  const frontOpacity = useTransform(fold, (v) => (v >= 0 ? 1 : 0));
  const [closed, setClosed] = useState(reduce);

  useEffect(() => {
    if (reduce) return;
    const shut = animate(fold, 1, { duration: MOTION.fold, delay: MOTION.foldDelay, ease: EASE_IN_OUT, onComplete: () => setClosed(true) });
    return () => shut.stop();
  }, [fold, reduce]);

  const flap = "M14 30 L60 60 L106 30 Z";
  const stroke = { stroke: "var(--ml-env-stroke)" };
  return (
    <div className="flex justify-center" aria-hidden="true">
      <motion.svg
        width="132"
        height="104"
        viewBox="-6 -8 132 104"
        className="h-[104px] w-[132px] overflow-visible"
        initial={false}
        animate={closed && !reduce ? { x: [0, 7, 0] } : { x: 0 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
      >
        {/* Sent trail */}
        {!reduce &&
          [42, 56, 70].map((y, i) => (
            <motion.path
              key={y}
              d={`M${-2 - i * 3} ${y} H${8 - i * 2}`}
              strokeWidth="1.5"
              strokeLinecap="round"
              style={{ stroke: "var(--ml-ink)" }}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={closed ? { pathLength: [0, 1, 1], opacity: [0, 0.55, 0], x: [6, 0, -8] } : { pathLength: 0, opacity: 0 }}
              transition={{ duration: MOTION.trail, delay: i * 0.05, ease: EASE_OUT }}
            />
          ))}
        <rect x="14" y="30" width="92" height="58" rx="8" style={{ fill: "var(--ml-env-back)", ...stroke }} />
        {/* Open flap, behind the letter */}
        <motion.path d={flap} strokeLinejoin="round" style={{ fill: "var(--ml-env-flap-back)", ...stroke, scaleY: fold, opacity: backOpacity, originX: "50%", originY: "0%", transformBox: "fill-box" }} />
        {/* The letter */}
        <motion.g initial={reduce ? { y: 0 } : { y: -34 }} animate={{ y: 0 }} transition={{ duration: MOTION.letter, delay: MOTION.letterDelay, ease: EASE_IN_OUT }}>
          <rect x="26" y="34" width="68" height="48" rx="4" style={{ fill: "var(--ml-paper)", ...stroke }} />
          <path d="M36 46 H70 M36 54 H82 M36 62 H62" strokeWidth="2.4" strokeLinecap="round" style={{ stroke: "var(--ml-paper-line)" }} />
        </motion.g>
        {/* Front pocket */}
        <path d="M14.5 31 L60 61.5 L105.5 31 V80 A7.5 7.5 0 0 1 98 87.5 H22 A7.5 7.5 0 0 1 14.5 80 Z" strokeLinejoin="round" style={{ fill: "var(--ml-env-pocket)", ...stroke }} />
        {/* Closed flap, in front */}
        <motion.path d={flap} strokeLinejoin="round" style={{ fill: "var(--ml-env-flap)", ...stroke, scaleY: fold, opacity: frontOpacity, originX: "50%", originY: "0%", transformBox: "fill-box" }} />
        {/* Seal */}
        <motion.circle
          cx="60"
          cy="56"
          r="5"
          initial={reduce ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
          animate={closed ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
          transition={reduce ? { duration: 0 } : SPRING_UI}
          style={{ fill: "var(--ml-ink)", originX: "50%", originY: "50%", transformBox: "fill-box" }}
        />
      </motion.svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                              */
/* ------------------------------------------------------------------ */

function PrimaryButton({
  layoutId,
  children,
  type,
  href,
  disabled,
  reduce,
  className = "",
  demo,
}: {
  layoutId: string;
  children: ReactNode;
  type?: "submit" | "button";
  href?: string;
  disabled?: boolean;
  reduce: boolean;
  className?: string;
  demo?: string;
}) {
  const cls = `group/cta relative flex h-11 w-full items-center justify-center overflow-hidden rounded-[11px] bg-[var(--ml-accent)] text-[14.5px] font-medium tracking-[-0.005em] text-[var(--ml-on-accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-1px_0_rgba(0,0,0,0.12)] ${focusRing} ${className}`;
  const t = reduce ? { duration: 0 } : { layout: { duration: MOTION.morph, ease: EASE_IN_OUT } };
  // Hover: a wash of the label colour, so it darkens a light accent and lightens a dark one.
  const wash = <span aria-hidden="true" className="absolute inset-0 bg-current opacity-0 transition-opacity duration-150 group-hover/cta:opacity-[0.07]" />;
  if (href)
    return (
      <motion.a layoutId={layoutId} transition={t} data-demo={demo} href={href} target="_blank" rel="noopener noreferrer" whileTap={reduce ? undefined : { scale: 0.98 }} className={cls}>
        {wash}
        {children}
      </motion.a>
    );
  return (
    <motion.button
      layoutId={layoutId}
      transition={t}
      data-demo={demo}
      type={type ?? "button"}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      whileTap={reduce || disabled ? undefined : { scale: 0.98 }}
      className={`${cls} disabled:pointer-events-none`}
    >
      {wash}
      {children}
    </motion.button>
  );
}

function ResendButton({ left, state, onClick, reduce }: { left: number; state: ResendState; onClick: () => void; reduce: boolean }) {
  const ready = left <= 0 && state === "idle";
  const key = state !== "idle" ? state : ready ? "ready" : "wait";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!ready}
      className={`relative -mr-2 inline-flex h-11 shrink-0 items-center overflow-hidden rounded-[10px] px-2.5 text-[13.5px] font-medium transition-[background-color,color,transform] duration-150 enabled:hover:bg-[var(--ml-hover)] enabled:active:scale-[0.97] disabled:cursor-not-allowed ${focusRing} ${
        ready ? "text-[var(--ml-ink)]" : "text-[var(--ml-muted)]"
      }`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={key} {...swapProps(reduce, 6)} transition={{ duration: MOTION.swap, ease: EASE_OUT }} className="flex items-center gap-1.5 whitespace-nowrap">
          {key === "wait" && (
            <>
              Resend in <RollingText value={fmtClock(left)} reduce={reduce} />
            </>
          )}
          {key === "ready" && "Resend link"}
          {key === "sending" && (
            <>
              <Spinner /> Sending…
            </>
          )}
          {key === "sent" && (
            <>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-[var(--ml-ok)]">
                <motion.path
                  d="M3.5 8.4 L6.6 11.3 L12.5 4.8"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: reduce ? 1 : 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.3, ease: EASE_OUT }}
                />
              </svg>
              Sent again
            </>
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                          */
/* ------------------------------------------------------------------ */

/** Each changed character rolls down into place; unchanged characters stay put. */
function RollingText({ value, reduce }: { value: string; reduce: boolean }) {
  return (
    <span className="inline-flex tabular-nums" aria-label={value}>
      {value.split("").map((ch, i) => (
        <span key={i} aria-hidden="true" className="relative inline-flex h-[1.5em] overflow-hidden leading-[1.5em]" style={{ width: /\d/.test(ch) ? "1ch" : undefined }}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={ch}
              initial={reduce ? { opacity: 0 } : { y: "-70%", opacity: 0, filter: "blur(1.5px)" }}
              animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { y: "70%", opacity: 0, filter: "blur(1.5px)" }}
              transition={{ duration: MOTION.roll, ease: EASE_OUT }}
              className="inline-block"
            >
              {ch}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ animation: "auth-magic-link-spin 0.7s linear infinite" }}>
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.75" />
      <path d="M8 1.75 A6.25 6.25 0 0 1 14.25 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function Mark() {
  return (
    <span className="flex size-10 items-center justify-center rounded-[11px] bg-[var(--ml-tile)] text-[var(--ml-ink)] shadow-[inset_0_0_0_1px_var(--ml-line),inset_0_1px_0_var(--ml-hover)]" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M9.2 2.5 V15 H3.2 Z" fill="currentColor" />
        <path d="M10.8 5.5 L16.6 15 H10.8 Z" fill="currentColor" fillOpacity="0.45" />
        <path d="M2.5 17.2 H17.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** Warning, not decoration: the hourglass tile only appears for a dead link. */
function ExpiredGlyph() {
  return (
    <span
      className="flex size-10 items-center justify-center rounded-[11px] bg-[color-mix(in_srgb,var(--ml-warn)_9%,transparent)] text-[var(--ml-warn)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ml-warn)_26%,transparent)]"
      aria-hidden="true"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5.5 2.75 H14.5 M5.5 17.25 H14.5" />
        <path d="M6.5 2.75 V5.2 C6.5 6.6 8 7.9 10 10 C12 7.9 13.5 6.6 13.5 5.2 V2.75" />
        <path d="M6.5 17.25 V14.8 C6.5 13.4 8 12.1 10 10 C12 12.1 13.5 13.4 13.5 14.8 V17.25" />
        <path d="M8.2 15.6 H11.8" />
      </svg>
    </span>
  );
}

function ArrowRight() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform duration-150 group-hover/cta:translate-x-0.5">
      <path d="M3 8 H13 M9 4 L13 8 L9 12" />
    </svg>
  );
}

function ArrowUpRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform duration-150 group-hover/cta:-translate-y-px group-hover/cta:translate-x-px">
      <path d="M5 11 L11 5 M6 5 H11 V10" />
    </svg>
  );
}

function ArrowLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 8 H3 M7 4 L3 8 L7 12" />
    </svg>
  );
}

function AlertGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 4.8v3.6M8 11h.01" />
    </svg>
  );
}

function SmallAlert() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
      <circle cx="8" cy="8" r="6.4" />
      <path d="M8 4.8v3.6M8 11h.01" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                 */
/* ------------------------------------------------------------------ */

const DEMO_LATENCY_MS = 1100;
const DEMO_MODES = [
  { id: "fresh", label: "New visit" },
  { id: "expired", label: "Expired link" },
] as const;

/** The dark theme’s own ink; as a control default it means “no accent chosen”, so the light theme keeps its ink. */
const DEFAULT_DARK_ACCENT = "#ededef";

const DEMO_TONE = {
  dark: { ring: "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]", on: "text-[#0a0a0b]", off: "text-[#8a8a92] hover:text-[#ededef]", pill: "bg-[#ededef]", focus: "focus-visible:outline-[#ededef]", note: "text-[#7d7d86]" },
  light: { ring: "shadow-[inset_0_0_0_1px_rgba(24,24,27,0.14)]", on: "text-[#ffffff]", off: "text-[#52525b] hover:text-[#18181b]", pill: "bg-[#18181b]", focus: "focus-visible:outline-[#18181b]", note: "text-[#52525b]" },
} as const;

export default function AuthMagicLinkDemo({ expired: forcedExpired, theme = "dark", accent, ...overrides }: Partial<AuthMagicLinkProps> = {}) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [mode, setMode] = useState<(typeof DEMO_MODES)[number]["id"]>(forcedExpired ? "expired" : "fresh");
  const { wait } = useTimeouts();
  const tone = DEMO_TONE[theme];

  // The Customize panel and the demo’s own switch drive the same state.
  useEffect(() => {
    setMode(forcedExpired ? "expired" : "fresh");
  }, [forcedExpired]);

  const onSend = async (email: string) => {
    await wait(DEMO_LATENCY_MS);
    if (email.toLowerCase().endsWith("@example.com")) throw new Error("example.com is reserved and can’t receive mail. Try a real address.");
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12 transition-colors duration-300 sm:py-16" style={{ background: STAGE[theme] }}>
      <AuthMagicLink
        key={mode}
        expired={mode === "expired"}
        defaultEmail={mode === "expired" ? "ines@proton.me" : ""}
        onSend={onSend}
        {...overrides}
        theme={theme}
        accent={accent === DEFAULT_DARK_ACCENT && theme === "light" ? undefined : accent}
      />
      <motion.div {...enter(true, 0.6, reduce)} className="mt-6 flex flex-col items-center gap-3">
        <div role="radiogroup" aria-label="Demo state" className={`flex rounded-full p-1 ${tone.ring}`}>
          {DEMO_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              data-demo={`mode-${m.id}`}
              onClick={() => setMode(m.id)}
              className={`relative h-9 rounded-full px-4 font-mono text-[11px] uppercase tracking-[0.12em] transition-[color,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.97] ${tone.focus} ${
                mode === m.id ? tone.on : tone.off
              }`}
            >
              {mode === m.id && <motion.span layoutId={`${uid}-mode`} transition={reduce ? { duration: 0 } : SPRING_UI} className={`absolute inset-0 rounded-full ${tone.pill}`} />}
              <span className="relative">{m.label}</span>
            </button>
          ))}
        </div>
        <p className={`max-w-[340px] text-center font-mono text-[11px] uppercase leading-[1.6] tracking-[0.12em] ${tone.note}`}>
          Try gmail.com, outlook.com or proton.me · <span className="normal-case tracking-[0.04em]">@example.com</span> fails
        </p>
      </motion.div>
    </div>
  );
}
