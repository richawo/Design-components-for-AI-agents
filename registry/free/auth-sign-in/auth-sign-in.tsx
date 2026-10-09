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
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
  type ReactNode,
  type RefObject,
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
  type MotionValue,
} from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

export type SsoProvider = "google" | "github" | "apple";

export type SignInValues = {
  email: string;
  password: string;
  remember: boolean;
};

/** What `onSubmit` / `onSso` resolve with. Throwing is treated as a network failure. */
export type SignInResult =
  | { ok: true; message?: string }
  | { ok: false; reason: "invalid_credentials"; message?: string; attemptsLeft?: number }
  | { ok: false; reason: "unknown_email"; message?: string }
  | { ok: false; reason: "locked"; retryAfter: number; message?: string };

export type AuthSignInProps = {
  productName?: string;
  title?: string;
  subtitle?: string;
  /** SSO buttons, in order. Pass [] to hide the row and divider. */
  providers?: SsoProvider[];
  /** Label on the divider between SSO and the form. */
  dividerLabel?: string;
  emailLabel?: string;
  emailPlaceholder?: string;
  passwordLabel?: string;
  rememberLabel?: string;
  submitLabel?: string;
  forgotLabel?: string;
  forgotHref?: string;
  /** Called when “Forgot?” is clicked, with whatever is in the email field. */
  onForgotPassword?: (email: string) => void;
  signUpPrompt?: string;
  signUpLabel?: string;
  signUpHref?: string;
  defaultEmail?: string;
  defaultRemember?: boolean;
  /** Resolve with a SignInResult. The button stays in its loading state until it settles. */
  onSubmit?: (values: SignInValues) => Promise<SignInResult | void>;
  /** Resolve when the provider round-trip finishes (or redirect and never resolve). */
  onSso?: (provider: SsoProvider) => Promise<SignInResult | void>;
  /** Called once after a successful sign-in, after the check has drawn. */
  onSuccess?: (how: "password" | SsoProvider) => void;
  autoFocus?: boolean;
  /** The one accent: the submit button and the checked remember box. Defaults to the theme’s ink. */
  accent?: string;
  theme?: "dark" | "light";
  className?: string;
};

type FieldName = "email" | "password";
type Status = "idle" | "loading" | "success";
type ControlState = "idle" | "loading" | "success";

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    surface: "#0a0a0b",
    tile: "#141416",
    field: "rgba(255,255,255,0.025)",
    fieldFocus: "rgba(255,255,255,0.04)",
    hover: "rgba(255,255,255,0.06)",
    line: "rgba(255,255,255,0.1)",
    lineHover: "rgba(255,255,255,0.18)",
    focus: "rgba(255,255,255,0.62)",
    ink: "#ededef",
    label: "#cfcfd4",
    muted: "#a0a0a8",
    faint: "#7d7d86",
    placeholder: "#5c5c64",
    error: "#ff6b5e",
    errorInk: "#ff8f84",
    errorBody: "#f2d6d2",
    warn: "#f5c451",
    warnBody: "#e9e2cf",
    shadow: "inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.06), 0 32px 80px -32px rgba(0,0,0,0.9)",
  },
  light: {
    surface: "#ffffff",
    tile: "#f4f4f5",
    field: "rgba(24,24,27,0.015)",
    fieldFocus: "#ffffff",
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
    warnBody: "#57534e",
    shadow: "0 0 0 1px rgba(24,24,27,0.08), 0 1px 2px rgba(24,24,27,0.04), 0 32px 64px -32px rgba(24,24,27,0.28)",
  },
} as const;

type Palette = Record<keyof (typeof PALETTE)["dark"], string>;

/** The demo’s quiet backdrop; not part of the component. */
const STAGE = "#000000";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

/** One place for the choreography. Seconds unless noted. */
const MOTION = {
  card: 0.6, // the card rising out of its blur
  cardRise: 16, // px
  cardBlur: 10, // px
  rise: 10, // px each inner block travels
  blur: 6, // px of blur that clears as a block lands
  block: 0.45, // inner block entrance
  first: 0.12, // first inner block, once the card has begun to land
  stagger: 0.045, // between inner blocks, in reading order
  sso: 0.03, // between SSO buttons inside their row
  hairline: 0.5, // divider rules drawing outward
  swap: 0.22, // label ↔ spinner ↔ check swaps
  message: 0.3, // field messages opening
  shake: 0.42,
  light: 0.8, // the focus light’s lap
  wipe: 0.5, // password dots ↔ text
  eye: 0.32,
  roll: 0.32, // countdown digits
  check: 0.36,
  fade: 0.15, // reduced-motion fades
} as const;

/** How long the success state holds before `onSuccess` fires. ms. */
const SUCCESS_HOLD_MS = 700;
/** Lockout countdown resolution. ms. */
const LOCK_TICK_MS = 250;
const SHAKE_X = [0, -7, 6, -4, 2, 0];
const FIELD_RADIUS = 11;

const PROVIDER_LABEL: Record<SsoProvider, string> = { google: "Google", github: "GitHub", apple: "Apple" };

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--si-ink)]";

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function emailProblem(v: string, productName: string): string | null {
  const s = v.trim();
  if (!s) return `Enter the email you use for ${productName}.`;
  if (!s.includes("@")) return "That’s missing an @. Emails need one.";
  const [local, domain = ""] = s.split("@");
  if (!local) return "Add the part before the @.";
  if (!domain || !/^[^\s@]+\.[^\s@]{2,}$/.test(domain)) return "Add the domain, like name@company.com.";
  if (/\s/.test(s)) return "Emails can’t contain spaces.";
  return null;
}

const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Black or white, whichever reads on the accent. */
function inkOn(hex: string) {
  const v = hex.replace("#", "");
  const full = v.length === 3 ? [...v].map((c) => c + c).join("") : v.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#0a0a0b" : "#ffffff";
}

function cssVars(p: Palette, accent: string): CSSProperties {
  return {
    "--si-surface": p.surface,
    "--si-tile": p.tile,
    "--si-field": p.field,
    "--si-field-focus": p.fieldFocus,
    "--si-hover": p.hover,
    "--si-line": p.line,
    "--si-line-hover": p.lineHover,
    "--si-focus": p.focus,
    "--si-ink": p.ink,
    "--si-label": p.label,
    "--si-muted": p.muted,
    "--si-faint": p.faint,
    "--si-placeholder": p.placeholder,
    "--si-error": p.error,
    "--si-error-ink": p.errorInk,
    "--si-error-body": p.errorBody,
    "--si-warn": p.warn,
    "--si-warn-body": p.warnBody,
    "--si-shadow": p.shadow,
    "--si-accent": accent,
    "--si-on-accent": inkOn(accent),
  } as CSSProperties;
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

/** Cross-fade for content swapped inside a control that keeps its size. */
function swapProps(reduce: boolean) {
  return reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 8, filter: "blur(3px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" },
        exit: { opacity: 0, y: -8, filter: "blur(3px)", transition: { duration: MOTION.swap * 0.66, ease: EASE_IN } },
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

/** A server-imposed pause: seconds left, ticking only while it matters. */
function useLockout(onLift: () => void) {
  const [until, setUntil] = useState<number | null>(null);
  const [left, setLeft] = useState(0);
  const lift = useRef(onLift);
  useEffect(() => {
    lift.current = onLift;
  }, [onLift]);

  useEffect(() => {
    if (until === null) return;
    const tick = () => {
      const s = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setLeft(s); // same value → React skips the render, so this re-renders once a second
      if (s === 0) {
        setUntil(null);
        lift.current();
      }
    };
    const id = setInterval(tick, LOCK_TICK_MS);
    return () => clearInterval(id);
  }, [until]);

  const lock = useCallback((seconds: number) => {
    setUntil(Date.now() + seconds * 1000);
    setLeft(Math.ceil(seconds));
  }, []);

  return { left, locked: left > 0, lock };
}

/** One “no” shake on a wrapper. The animation is stopped if the component unmounts mid-shake. */
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

/** Live size of an element, for SVG overlays drawn to its exact border. */
function useBox(ref: RefObject<HTMLElement | null>) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setBox({ w: el.offsetWidth, h: el.offsetHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [ref]);
  return box;
}

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

export function AuthSignIn({
  productName = "Halyard",
  title = "Sign in to Halyard",
  subtitle = "Welcome back. The backlog didn’t groom itself.",
  providers = ["google", "github", "apple"],
  dividerLabel = "or with email",
  emailLabel = "Work email",
  emailPlaceholder = "you@company.com",
  passwordLabel = "Password",
  rememberLabel = "Keep me signed in for 30 days",
  submitLabel = "Sign in",
  forgotLabel = "Forgot?",
  forgotHref = "#forgot",
  onForgotPassword,
  signUpPrompt = "New to Halyard?",
  signUpLabel = "Create an account",
  signUpHref = "#sign-up",
  defaultEmail = "",
  defaultRemember = true,
  onSubmit,
  onSso,
  onSuccess,
  autoFocus = false,
  accent,
  theme = "dark",
  className = "",
}: AuthSignInProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const root = useRef<HTMLDivElement>(null);
  const play = useInView(root, { once: true, amount: 0.3 });
  const palette = PALETTE[theme];
  const { later, wait } = useTimeouts();

  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(defaultRemember);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [ssoBusy, setSsoBusy] = useState<SsoProvider | null>(null);
  const [ssoDone, setSsoDone] = useState<SsoProvider | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [emailShakeRef, shakeEmail] = useShake(reduce);
  const [passwordShakeRef, shakePassword] = useShake(reduce);
  const lockout = useLockout(useCallback(() => setAnnounce("You can try signing in again."), []));

  const busy = status === "loading" || ssoBusy !== null;
  const done = status === "success" || ssoDone !== null;
  const formInert = busy || done;

  useEffect(() => {
    if (autoFocus) emailRef.current?.focus();
  }, [autoFocus]);

  const succeed = (how: "password" | SsoProvider) => later(() => onSuccess?.(how), reduce ? 0 : SUCCESS_HOLD_MS);

  const fail = (field: FieldName, text: string) => {
    setErrors({ [field]: text });
    (field === "email" ? shakeEmail : shakePassword)();
    const input = (field === "email" ? emailRef : passwordRef).current;
    input?.focus();
    if (field === "password") input?.select();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || done || lockout.locked) return;
    setBanner(null);
    const next: Partial<Record<FieldName, string>> = {};
    const emailError = emailProblem(email, productName);
    if (emailError) next.email = emailError;
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    if (next.email || next.password) {
      if (next.email) shakeEmail();
      if (next.password) shakePassword();
      (next.email ? emailRef : passwordRef).current?.focus();
      return;
    }

    setStatus("loading");
    setAnnounce("Signing in…");
    let res: SignInResult | void;
    try {
      res = await (onSubmit ? onSubmit({ email: email.trim(), password, remember }) : wait(1100));
    } catch {
      setStatus("idle");
      setBanner(`Couldn’t reach ${productName}. Check your connection and try again.`);
      setAnnounce("");
      return;
    }
    if (!res || res.ok) {
      setStatus("success");
      setAnnounce(res?.message ?? "Signed in. Opening your workspace.");
      succeed("password");
      return;
    }
    setStatus("idle");
    setAnnounce("");
    if (res.reason === "locked") {
      lockout.lock(res.retryAfter);
      setPassword("");
      setErrors({});
    } else if (res.reason === "unknown_email") {
      fail("email", res.message ?? `No ${productName} account uses this email. Check for typos, or create one below.`);
    } else {
      const left = res.attemptsLeft;
      fail(
        "password",
        res.message ??
          (left === undefined
            ? "That password doesn’t match this account."
            : left === 1
              ? "That password doesn’t match. One more try before we pause sign-in."
              : `That password doesn’t match. ${left} tries left.`),
      );
    }
  };

  const sso = async (p: SsoProvider) => {
    if (busy || done || lockout.locked) return;
    setBanner(null);
    setSsoBusy(p);
    setAnnounce(`Opening ${PROVIDER_LABEL[p]}…`);
    try {
      const res = await (onSso ? onSso(p) : wait(1300));
      setSsoBusy(null);
      if (res && !res.ok) {
        setBanner(res.message ?? `${PROVIDER_LABEL[p]} didn’t confirm your account. Try again, or use your email.`);
        return;
      }
      setSsoDone(p);
      setAnnounce(`Signed in with ${PROVIDER_LABEL[p]}.`);
      succeed(p);
    } catch {
      setSsoBusy(null);
      setBanner(`The ${PROVIDER_LABEL[p]} window closed before we heard back. Try again?`);
    }
  };

  // Reading order for the entrance: mark, title, subtitle, SSO, divider, email, password, remember, submit, footer.
  const hasSso = providers.length > 0;
  const order = ["mark", "title", "subtitle", ...(hasSso ? ["sso", "divider"] : []), "email", "password", "remember", "submit", "footer"];
  const at = (block: string) => MOTION.first + Math.max(0, order.indexOf(block)) * MOTION.stagger;

  return (
    <div
      ref={root}
      style={cssVars(palette, accent ?? palette.ink)}
      className={`@container w-full max-w-[400px] font-sans text-[var(--si-ink)] antialiased ${theme === "dark" ? "[color-scheme:dark]" : "[color-scheme:light]"} ${className}`}
    >
      <style>{`@keyframes auth-sign-in-spin { to { transform: rotate(360deg); } }`}</style>
      <motion.div
        {...enter(play, 0, reduce, MOTION.cardRise, MOTION.cardBlur, MOTION.card)}
        className="relative rounded-[20px] bg-[var(--si-surface)] px-5 pb-6 pt-7 shadow-[var(--si-shadow)] @[22rem]:px-6 @sm:px-8 @sm:pb-8 @sm:pt-9"
      >
        <motion.div {...enter(play, at("mark"), reduce)}>
          <Mark />
        </motion.div>
        <motion.h1
          id={`${uid}-title`}
          {...enter(play, at("title"), reduce)}
          className="mt-6 text-[clamp(1.375rem,1.2rem+0.6cqi,1.5rem)] font-semibold leading-[1.15] tracking-[-0.025em]"
        >
          {title}
        </motion.h1>
        <motion.p {...enter(play, at("subtitle"), reduce)} className="mt-2 text-pretty text-[14.5px] leading-[1.55] text-[var(--si-muted)]">
          {subtitle}
        </motion.p>

        <Banner locked={lockout.locked} text={banner} reduce={reduce} />

        {hasSso && (
          <>
            <SsoRow
              providers={providers}
              busy={ssoBusy}
              done={ssoDone}
              blocked={status !== "idle" || lockout.locked}
              onPick={(p) => void sso(p)}
              play={play}
              delay={at("sso")}
              reduce={reduce}
            />
            <Divider label={dividerLabel} play={play} delay={at("divider")} reduce={reduce} />
          </>
        )}

        <form noValidate method="post" onSubmit={submit} aria-labelledby={`${uid}-title`} className={hasSso ? "mt-6" : "mt-7"}>
          <motion.div {...enter(play, at("email"), reduce)}>
            <EmailField
              id={`${uid}-email`}
              label={emailLabel}
              placeholder={emailPlaceholder}
              value={email}
              error={errors.email}
              inert={formInert}
              inputRef={emailRef}
              shakeRef={emailShakeRef}
              onChange={(v) => {
                setEmail(v);
                // Reward early, punish late: typing only clears or refines an error that is already showing.
                if (errors.email) setErrors((er) => ({ ...er, email: emailProblem(v, productName) ?? undefined }));
              }}
              onBlurCheck={() => {
                const problem = emailProblem(email, productName);
                if (email.trim() && problem) setErrors((er) => ({ ...er, email: problem }));
              }}
              reduce={reduce}
            />
          </motion.div>

          <motion.div {...enter(play, at("password"), reduce)} className="mt-4">
            <PasswordField
              id={`${uid}-password`}
              label={passwordLabel}
              value={password}
              error={errors.password}
              inert={formInert}
              inputRef={passwordRef}
              shakeRef={passwordShakeRef}
              forgotLabel={forgotLabel}
              forgotHref={forgotHref}
              onForgot={() => onForgotPassword?.(email.trim())}
              onChange={(v) => {
                setPassword(v);
                if (errors.password && v) setErrors((er) => ({ ...er, password: undefined }));
              }}
              reduce={reduce}
            />
          </motion.div>

          <motion.div {...enter(play, at("remember"), reduce)}>
            <Checkbox id={`${uid}-remember`} checked={remember} onChange={setRemember} disabled={formInert} label={rememberLabel} reduce={reduce} />
          </motion.div>

          <motion.div {...enter(play, at("submit"), reduce)}>
            <SubmitButton
              state={status}
              label={submitLabel}
              lockLeft={lockout.left}
              disabled={lockout.locked || ssoBusy !== null || ssoDone !== null}
              reduce={reduce}
            />
          </motion.div>
        </form>

        <motion.p {...enter(play, at("footer"), reduce)} className="mt-6 text-center text-[13.5px] leading-5 text-[var(--si-muted)]">
          {signUpPrompt}{" "}
          <a
            href={signUpHref}
            className={`rounded-sm font-medium text-[var(--si-ink)] underline decoration-[var(--si-line-hover)] underline-offset-[3px] transition-[text-decoration-color] duration-150 hover:decoration-[var(--si-focus)] ${focusRing}`}
          >
            {signUpLabel}
          </a>
        </motion.p>

        <p className="sr-only" aria-live="polite" role="status">
          {announce}
        </p>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Header pieces                                                        */
/* ------------------------------------------------------------------ */

function Banner({ locked, text, reduce }: { locked: boolean; text: string | null; reduce: boolean }) {
  const show = locked || !!text;
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key={locked ? "locked" : "error"}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0, transition: { duration: reduce ? 0.1 : 0.22, ease: EASE_IN } }}
          transition={{ duration: reduce ? 0.12 : 0.32, ease: EASE_OUT }}
          className="overflow-hidden"
        >
          <div
            role="alert"
            className={`mt-6 flex items-start gap-3 rounded-[12px] px-3.5 py-3 text-[13.5px] leading-[1.5] ${
              locked
                ? "bg-[color-mix(in_srgb,var(--si-warn)_8%,transparent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--si-warn)_24%,transparent)]"
                : "bg-[color-mix(in_srgb,var(--si-error)_7%,transparent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--si-error)_26%,transparent)]"
            }`}
          >
            <span className={`mt-[1px] shrink-0 ${locked ? "text-[var(--si-warn)]" : "text-[var(--si-error)]"}`} aria-hidden="true">
              {locked ? <LockGlyph /> : <AlertGlyph />}
            </span>
            {locked ? (
              <p className="min-w-0 text-[var(--si-warn-body)]">
                <span className="font-medium text-[var(--si-warn)]">Sign-in paused.</span> Too many wrong passwords, so we’re giving this account a short breather. Your email stays
                put.
              </p>
            ) : (
              <p className="min-w-0 text-[var(--si-error-body)]">{text}</p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SsoRow({
  providers,
  busy,
  done,
  blocked,
  onPick,
  play,
  delay,
  reduce,
}: {
  providers: SsoProvider[];
  busy: SsoProvider | null;
  done: SsoProvider | null;
  /** The password form is busy or the account is locked. */
  blocked: boolean;
  onPick: (p: SsoProvider) => void;
  play: boolean;
  delay: number;
  reduce: boolean;
}) {
  return (
    <div className="mt-7 grid gap-2" style={{ gridTemplateColumns: `repeat(${providers.length}, minmax(0, 1fr))` }}>
      {providers.map((p, i) => {
        const state: ControlState = busy === p ? "loading" : done === p ? "success" : "idle";
        const othersActive = (busy !== null && busy !== p) || (done !== null && done !== p);
        return (
          <motion.div key={p} {...enter(play, delay + i * MOTION.sso, reduce)} className="min-w-0">
            <SsoButton provider={p} state={state} disabled={othersActive || blocked} onClick={() => onPick(p)} reduce={reduce} />
          </motion.div>
        );
      })}
    </div>
  );
}

/** Two hairlines that draw outward from the label as it lands. */
function Divider({ label, play, delay, reduce }: { label: string; play: boolean; delay: number; reduce: boolean }) {
  const line = (origin: "left" | "right") => ({
    initial: reduce ? { opacity: 0 } : { scaleX: 0 },
    animate: play ? (reduce ? { opacity: 1 } : { scaleX: 1 }) : undefined,
    transition: { duration: reduce ? MOTION.fade : MOTION.hairline, ease: EASE_OUT, delay: reduce ? 0 : delay },
    style: { originX: origin === "left" ? 0 : 1 },
  });
  return (
    <div className="mt-6 flex items-center gap-3" aria-hidden="true">
      <motion.span {...line("right")} className="h-px flex-1 bg-gradient-to-r from-transparent to-[var(--si-line)]" />
      <motion.span {...enter(play, delay, reduce)} className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--si-faint)]">
        {label}
      </motion.span>
      <motion.span {...line("left")} className="h-px flex-1 bg-gradient-to-l from-transparent to-[var(--si-line)]" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fields                                                               */
/* ------------------------------------------------------------------ */

function EmailField({
  id,
  label,
  placeholder,
  value,
  error,
  inert,
  inputRef,
  shakeRef,
  onChange,
  onBlurCheck,
  reduce,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  error?: string;
  inert: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  shakeRef: RefObject<HTMLDivElement | null>;
  onChange: (v: string) => void;
  onBlurCheck: () => void;
  reduce: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[13px] font-medium leading-5 text-[var(--si-label)]">
        {label}
      </label>
      <div ref={shakeRef}>
        <FieldShell focused={focused} invalid={!!error} disabled={inert} reduce={reduce}>
          <input
            ref={inputRef}
            id={id}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={placeholder}
            value={value}
            readOnly={inert}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? `${id}-msg` : undefined}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              onBlurCheck();
            }}
            className={inputCls}
          />
        </FieldShell>
      </div>
      <FieldMessage id={`${id}-msg`} text={error} tone="error" reduce={reduce} />
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  error,
  inert,
  inputRef,
  shakeRef,
  forgotLabel,
  forgotHref,
  onForgot,
  onChange,
  reduce,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  inert: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  shakeRef: RefObject<HTMLDivElement | null>;
  forgotLabel: string;
  forgotHref: string;
  onForgot: () => void;
  onChange: (v: string) => void;
  reduce: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [caps, setCaps] = useState(false);
  const capsId = `${id}-caps`;
  const describedBy = [error ? `${id}-msg` : "", caps ? capsId : ""].filter(Boolean).join(" ") || undefined;
  const readCaps = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === "function") setCaps(e.getModifierState("CapsLock"));
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor={id} className="block text-[13px] font-medium leading-5 text-[var(--si-label)]">
          {label}
        </label>
        <a
          href={forgotHref}
          onClick={onForgot}
          className={`-my-2 -mr-1.5 inline-flex h-9 items-center rounded-md px-1.5 text-[13px] text-[var(--si-muted)] transition-[color,transform] duration-150 hover:text-[var(--si-ink)] active:scale-[0.97] ${focusRing}`}
        >
          {forgotLabel}
        </a>
      </div>
      <div ref={shakeRef}>
        <FieldShell focused={focused} invalid={!!error} disabled={inert} reduce={reduce}>
          <PasswordInput
            inputRef={inputRef}
            id={id}
            value={value}
            revealed={revealed}
            readOnly={inert}
            invalid={!!error}
            describedBy={describedBy}
            onChange={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              setCaps(false);
            }}
            onKey={readCaps}
            reduce={reduce}
          />
          <RevealButton revealed={revealed} onToggle={() => setRevealed((r) => !r)} keepFocus={focused} disabled={inert} reduce={reduce} />
        </FieldShell>
      </div>
      <FieldMessage id={`${id}-msg`} text={error} tone="error" reduce={reduce} />
      <FieldMessage id={capsId} text={caps && focused ? "Caps Lock is on." : undefined} tone="warn" reduce={reduce} />
    </div>
  );
}

const inputCls =
  "h-11 w-full min-w-0 rounded-[11px] bg-transparent px-3.5 text-[16px] text-[var(--si-ink)] outline-none selection:bg-[color-mix(in_srgb,var(--si-ink)_22%,transparent)] placeholder:text-[var(--si-placeholder)] @sm:text-[15px]";

function FieldShell({ focused, invalid, disabled, reduce, children }: { focused: boolean; invalid: boolean; disabled: boolean; reduce: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const startX = useRef<number | null>(null);
  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (r) startX.current = e.clientX - r.left;
      }}
      className={`group/field relative flex items-center rounded-[11px] transition-[background-color,box-shadow,opacity] duration-150 ${
        invalid
          ? "bg-[color-mix(in_srgb,var(--si-error)_5%,transparent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--si-error)_55%,transparent)]"
          : focused
            ? "bg-[var(--si-field-focus)] shadow-[inset_0_0_0_1px_var(--si-line),0_0_0_4px_var(--si-hover)]"
            : "bg-[var(--si-field)] shadow-[inset_0_0_0_1px_var(--si-line)] hover:shadow-[inset_0_0_0_1px_var(--si-line-hover)]"
      } ${disabled ? "opacity-60" : ""}`}
    >
      {children}
      <FocusLight active={focused} invalid={invalid} startX={startX} reduce={reduce} />
    </div>
  );
}

/**
 * The signature: when the field takes focus, a point of light starts where you
 * clicked (top-left for keyboard focus), runs once around the border drawing the
 * ring behind it, then fades, leaving the ring settled. Everything is driven by
 * one motion value, so the lap never re-renders React.
 */
function FocusLight({ active, invalid, startX, reduce }: { active: boolean; invalid: boolean; startX: MutableRefObject<number | null>; reduce: boolean }) {
  const host = useRef<HTMLSpanElement>(null);
  const { w, h } = useBox(host);
  const t = useMotionValue(0);
  const start = useMotionValue(0);
  const per = useMotionValue(0);

  const sw = 1.5;
  const i = sw / 2;
  const r = FIELD_RADIUS - i;
  const P = w && h ? 2 * (w - 2 * i - 2 * r) + 2 * (h - 2 * i - 2 * r) + 2 * Math.PI * r : 0;
  useEffect(() => per.set(P), [P, per]);

  // Read width inside the effect without making it a dependency (resizes shouldn’t replay the lap).
  const width = useRef(0);
  useEffect(() => {
    width.current = w;
  }, [w]);

  useEffect(() => {
    if (!active) return;
    const x = startX.current;
    startX.current = null;
    start.set(x === null ? 0 : Math.max(0, Math.min(width.current - 2 * FIELD_RADIUS, x - FIELD_RADIUS)));
    if (reduce) {
      t.set(1);
      return;
    }
    t.set(0);
    const lap = animate(t, 1, { duration: MOTION.light, ease: EASE_IN_OUT });
    return () => lap.stop();
  }, [active, reduce, t, start, startX]);

  const ringDash = useTransform([t, per], ([v, L]: number[]) => `${v * L} ${L - v * L + 0.001}`);
  const ringOffset = useTransform(start, (s) => -s);
  const head = useTransform([t, start, per], ([v, s0, L]: number[]) => s0 + v * L);
  const cometOpacity = useTransform(t, [0, 0.06, 0.82, 1], [0, 1, 1, 0]);

  const d = `M${i + r} ${i} H${w - i - r} A${r} ${r} 0 0 1 ${w - i} ${i + r} V${h - i - r} A${r} ${r} 0 0 1 ${w - i - r} ${h - i} H${i + r} A${r} ${r} 0 0 1 ${i} ${h - i - r} V${i + r} A${r} ${r} 0 0 1 ${i + r} ${i} Z`;
  const ring = invalid ? "color-mix(in srgb, var(--si-error) 90%, transparent)" : "var(--si-focus)";
  const light = invalid ? "var(--si-error-ink)" : "var(--si-ink)";

  return (
    <span ref={host} aria-hidden="true" className="pointer-events-none absolute inset-0">
      {P > 0 && (
        <motion.svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          className="pointer-events-none absolute inset-0 overflow-visible"
          initial={false}
          animate={{ opacity: active ? 1 : 0 }}
          transition={{ duration: active ? 0 : 0.18 }}
        >
          <motion.path d={d} fill="none" strokeWidth={sw} style={{ stroke: ring, strokeDasharray: ringDash, strokeDashoffset: ringOffset }} />
          {!reduce && (
            <motion.g style={{ opacity: cometOpacity }}>
              {COMET.map(([len, strokeWidth, alpha], k) => (
                <CometLayer key={k} d={d} head={head} start={start} len={Math.min(len, P / 3)} P={P} width={strokeWidth} alpha={alpha} color={light} />
              ))}
            </motion.g>
          )}
        </motion.svg>
      )}
    </span>
  );
}

/** [length px, stroke width, opacity]: tail segments first, then halo and core. Layered strokes, not an SVG blur, so it stays crisp. */
const COMET: [number, number, number][] = [
  [84, 1.5, 0.14],
  [46, 1.5, 0.28],
  [22, 1.75, 0.55],
  [16, 8, 0.07],
  [13, 4.5, 0.16],
  [10, 2.25, 1],
];

function CometLayer({
  d,
  head,
  start,
  len,
  P,
  width,
  alpha,
  color,
}: {
  d: string;
  head: MotionValue<number>;
  start: MotionValue<number>;
  len: number;
  P: number;
  width: number;
  alpha: number;
  color: string;
}) {
  // A tail never reaches back past where the light started.
  const visible = (h: number, s0: number) => Math.max(0.01, Math.min(len, h - s0));
  const dash = useTransform([head, start], ([h, s0]: number[]) => `${visible(h, s0)} ${P}`);
  const offset = useTransform([head, start], ([h, s0]: number[]) => -(h - visible(h, s0)));
  return <motion.path d={d} fill="none" strokeOpacity={alpha} strokeWidth={width} strokeLinecap="round" style={{ stroke: color, strokeDasharray: dash, strokeDashoffset: offset }} />;
}

function FieldMessage({ id, text, tone, reduce }: { id: string; text?: string; tone: "error" | "warn"; reduce: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {text && (
        <motion.div
          key={tone}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0, transition: { duration: reduce ? 0.1 : 0.2, ease: EASE_IN } }}
          transition={{ duration: reduce ? 0.12 : MOTION.message, ease: EASE_OUT }}
          className="overflow-hidden"
        >
          <motion.p
            id={id}
            role={tone === "error" ? "alert" : "status"}
            initial={reduce ? false : { y: -6 }}
            animate={{ y: 0 }}
            transition={{ duration: MOTION.message, ease: EASE_OUT }}
            className={`flex items-start gap-1.5 pt-2 text-[13px] leading-[1.45] ${tone === "error" ? "text-[var(--si-error-ink)]" : "text-[var(--si-warn)]"}`}
          >
            <span className="mt-[3px] shrink-0" aria-hidden="true">
              {tone === "error" ? <SmallAlert /> : <CapsGlyph />}
            </span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={text} {...swapProps(reduce)} transition={{ duration: MOTION.swap, ease: EASE_OUT }} className="min-w-0">
                {text}
              </motion.span>
            </AnimatePresence>
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* Password: dots cross-fade to text in a left-to-right wipe            */
/* ------------------------------------------------------------------ */

function PasswordInput({
  inputRef,
  id,
  value,
  revealed,
  readOnly,
  invalid,
  describedBy,
  onChange,
  onFocus,
  onBlur,
  onKey,
  reduce,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  id: string;
  value: string;
  revealed: boolean;
  readOnly: boolean;
  invalid: boolean;
  describedBy?: string;
  onChange: (v: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onKey: (e: ReactKeyboardEvent<HTMLInputElement>) => void;
  reduce: boolean;
}) {
  const p = useMotionValue(1);
  // The old rendering, held on top while the new one wipes in underneath it.
  const [ghost, setGhost] = useState<null | { type: "password" | "text"; n: number }>(null);
  const ghostRef = useRef<HTMLInputElement>(null);
  const shownAs = useRef(revealed);
  const hasValue = useRef(false);
  useEffect(() => {
    hasValue.current = value.length > 0;
  }, [value]);

  useEffect(() => {
    if (shownAs.current === revealed) return;
    shownAs.current = revealed;
    if (reduce || !hasValue.current) return;
    setGhost((g) => ({ type: revealed ? "password" : "text", n: (g?.n ?? 0) + 1 }));
    p.set(0);
    const wipe = animate(p, 1, { duration: MOTION.wipe, ease: EASE_IN_OUT, onComplete: () => setGhost(null) });
    return () => wipe.stop();
  }, [revealed, reduce, p]);

  useLayoutEffect(() => {
    if (ghost && ghostRef.current && inputRef.current) ghostRef.current.scrollLeft = inputRef.current.scrollLeft;
  }, [ghost, inputRef]);

  const realMask = useWipeMask(p, false);
  const ghostMask = useWipeMask(p, true);
  const cls = `${inputCls} pr-12 tracking-[0.01em]`;

  return (
    <div className="relative min-w-0 flex-1">
      <motion.input
        ref={inputRef}
        id={id}
        name="password"
        type={revealed ? "text" : "password"}
        autoComplete="current-password"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="••••••••••"
        value={value}
        readOnly={readOnly}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKey}
        onKeyUp={onKey}
        style={ghost ? { WebkitMaskImage: realMask, maskImage: realMask } : undefined}
        className={cls}
      />
      {ghost && (
        <motion.input
          ref={ghostRef}
          key={ghost.n}
          tabIndex={-1}
          aria-hidden="true"
          readOnly
          type={ghost.type}
          value={value}
          autoComplete="off"
          data-1p-ignore=""
          data-lpignore="true"
          data-form-type="other"
          style={{ WebkitMaskImage: ghostMask, maskImage: ghostMask }}
          className={`pointer-events-none absolute inset-0 ${cls}`}
        />
      )}
    </div>
  );
}

/** A soft 16%-wide edge sweeps left to right; the ghost gives way exactly where the new rendering arrives. */
function useWipeMask(p: MotionValue<number>, inverse: boolean) {
  return useTransform(p, (v) => {
    const a = v * 120 - 10;
    return inverse ? `linear-gradient(90deg, transparent ${a - 8}%, #000 ${a + 8}%)` : `linear-gradient(90deg, #000 ${a - 8}%, transparent ${a + 8}%)`;
  });
}

function RevealButton({ revealed, onToggle, keepFocus, disabled, reduce }: { revealed: boolean; onToggle: () => void; keepFocus: boolean; disabled: boolean; reduce: boolean }) {
  const maskId = `${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-eye`;
  const tr = reduce ? { duration: 0 } : { duration: MOTION.eye, ease: EASE_IN_OUT };
  return (
    <button
      type="button"
      aria-label="Show password"
      aria-pressed={revealed}
      disabled={disabled}
      // Keep the caret in the field when toggling with a pointer.
      onMouseDown={(e) => keepFocus && e.preventDefault()}
      onClick={onToggle}
      className={`absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-[8px] text-[var(--si-muted)] transition-[color,background-color,transform] duration-150 hover:bg-[var(--si-hover)] hover:text-[var(--si-ink)] active:scale-[0.94] disabled:pointer-events-none ${focusRing} focus-visible:outline-offset-0`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
            <rect width="24" height="24" fill="#fff" />
            <motion.path d="M4.5 3.5 L20.5 19.5" stroke="#000" strokeWidth="4.2" initial={false} animate={{ pathLength: revealed ? 1 : 0 }} transition={tr} />
          </mask>
        </defs>
        <g mask={`url(#${maskId})`}>
          <motion.path
            initial={false}
            animate={{ d: revealed ? "M2.5 12 C4.6 9.9 8 8.8 12 8.8 C16 8.8 19.4 9.9 21.5 12" : "M2.5 12 C4.6 7.6 8 5.5 12 5.5 C16 5.5 19.4 7.6 21.5 12" }}
            transition={tr}
          />
          <motion.path
            initial={false}
            animate={{ d: revealed ? "M2.5 12 C4.6 14.1 8 15.2 12 15.2 C16 15.2 19.4 14.1 21.5 12" : "M2.5 12 C4.6 16.4 8 18.5 12 18.5 C16 18.5 19.4 16.4 21.5 12" }}
            transition={tr}
          />
          <motion.circle cx="12" cy="12" initial={false} animate={{ r: revealed ? 1.6 : 2.8 }} transition={tr} />
        </g>
        <motion.path
          d="M4 3 L21 20"
          initial={false}
          animate={{ pathLength: revealed ? 1 : 0, opacity: revealed ? 1 : 0 }}
          transition={reduce ? { duration: 0 } : { duration: MOTION.eye, ease: EASE_IN_OUT, opacity: { duration: 0.08 } }}
        />
      </svg>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Controls                                                             */
/* ------------------------------------------------------------------ */

function Checkbox({ id, checked, onChange, disabled, label, reduce }: { id: string; checked: boolean; onChange: (v: boolean) => void; disabled: boolean; label: string; reduce: boolean }) {
  return (
    <label
      htmlFor={id}
      className={`group/cb mt-4 flex min-h-11 cursor-pointer select-none items-center gap-3 text-[13.5px] text-[var(--si-muted)] ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <input id={id} type="checkbox" name="remember" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={`relative flex size-[18px] shrink-0 items-center justify-center rounded-[5px] text-[var(--si-on-accent)] transition-[background-color,box-shadow,transform] duration-150 group-active/cb:scale-[0.92] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--si-ink)] ${
          checked
            ? "bg-[var(--si-accent)] shadow-[inset_0_0_0_1px_var(--si-accent)]"
            : "bg-[var(--si-field)] shadow-[inset_0_0_0_1px_var(--si-line-hover)] group-hover/cb:shadow-[inset_0_0_0_1px_var(--si-focus)]"
        }`}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <motion.path
            d="M2.6 6.3 L5 8.6 L9.6 3.6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            transition={reduce ? { duration: 0 } : { duration: MOTION.swap, ease: EASE_OUT, opacity: { duration: 0.05 } }}
          />
        </svg>
      </span>
      <span className="transition-colors duration-150 group-hover/cb:text-[var(--si-label)]">{label}</span>
    </label>
  );
}

/** Label → spinner → drawn check, all inside the same 44px box. Locked turns it into a quiet countdown. */
function SubmitButton({ state, label, lockLeft, disabled, reduce }: { state: Status; label: string; lockLeft: number; disabled: boolean; reduce: boolean }) {
  const locked = lockLeft > 0;
  const swap = swapProps(reduce);
  const tr = { duration: MOTION.swap, ease: EASE_OUT };
  const busy = state !== "idle";
  return (
    <button
      type="submit"
      disabled={disabled}
      aria-disabled={busy || undefined}
      className={`group/submit relative mt-5 flex h-11 w-full items-center justify-center overflow-hidden rounded-[11px] text-[14.5px] font-medium tracking-[-0.005em] transition-[background-color,color,transform,box-shadow] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${focusRing} ${
        locked
          ? "bg-[var(--si-hover)] text-[var(--si-muted)] shadow-[inset_0_0_0_1px_var(--si-line)]"
          : "bg-[var(--si-accent)] text-[var(--si-on-accent)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),inset_0_-1px_0_rgba(0,0,0,0.12)] disabled:opacity-40"
      } ${busy ? "pointer-events-none" : ""}`}
    >
      {/* Hover: a wash of the label colour, so it darkens a light accent and lightens a dark one. */}
      {!locked && <span aria-hidden="true" className="absolute inset-0 bg-current opacity-0 transition-opacity duration-150 group-enabled/submit:group-hover/submit:opacity-[0.07]" />}
      <AnimatePresence mode="popLayout" initial={false}>
        {state === "idle" && !locked && (
          <motion.span key="label" {...swap} transition={tr} className="relative flex items-center">
            {label}
          </motion.span>
        )}
        {state === "idle" && locked && (
          <motion.span key="locked" {...swap} transition={tr} className="relative flex items-center tabular-nums">
            <span className="mr-2 flex opacity-80">
              <LockGlyph />
            </span>
            Try again in&nbsp;
            <RollingText value={fmtClock(lockLeft)} reduce={reduce} />
          </motion.span>
        )}
        {state === "loading" && (
          <motion.span key="spin" {...swap} transition={tr} className="relative flex items-center gap-2.5">
            <Spinner />
            <span>Signing in…</span>
          </motion.span>
        )}
        {state === "success" && (
          <motion.span key="ok" {...swap} transition={tr} className="relative flex items-center gap-2">
            <DrawnCheck size={18} reduce={reduce} />
            <span>Signed in</span>
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

function SsoButton({ provider, state, disabled, onClick, reduce }: { provider: SsoProvider; state: ControlState; disabled: boolean; onClick: () => void; reduce: boolean }) {
  const label = PROVIDER_LABEL[provider];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Continue with ${label}`}
      aria-busy={state === "loading" || undefined}
      className={`group/sso relative flex h-11 w-full min-w-0 items-center justify-center gap-2 rounded-[11px] bg-[var(--si-field)] px-2 text-[13.5px] font-medium text-[var(--si-label)] shadow-[inset_0_0_0_1px_var(--si-line)] transition-[background-color,box-shadow,opacity,transform] duration-150 enabled:hover:bg-[var(--si-hover)] enabled:hover:shadow-[inset_0_0_0_1px_var(--si-line-hover)] enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ${focusRing} ${
        state !== "idle" ? "!opacity-100" : ""
      }`}
    >
      <span className="relative flex size-4 shrink-0 items-center justify-center">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={state}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(2px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, filter: "blur(2px)" }}
            transition={{ duration: MOTION.swap * 0.9, ease: EASE_OUT }}
            className="flex text-[var(--si-ink)]"
          >
            {state === "loading" ? <Spinner /> : state === "success" ? <DrawnCheck size={16} reduce={reduce} /> : <ProviderMark provider={provider} />}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                          */
/* ------------------------------------------------------------------ */

/** Each changed character rolls down into place; unchanged characters stay put. */
function RollingText({ value, reduce }: { value: string; reduce: boolean }) {
  return (
    <span className="inline-flex" aria-label={value}>
      {value.split("").map((ch, i) => (
        <span key={i} aria-hidden="true" className="relative inline-flex h-[1.5em] overflow-hidden align-bottom leading-[1.5em]" style={{ width: /\d/.test(ch) ? "1ch" : undefined }}>
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

function DrawnCheck({ size, reduce }: { size: number; reduce: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <motion.path
        d="M4 9.4 L7.4 12.6 L14 5.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: reduce ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: MOTION.check, delay: 0.08, ease: EASE_OUT }}
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true" className="motion-reduce:[animation-duration:1.6s]" style={{ animation: "auth-sign-in-spin 0.7s linear infinite" }}>
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.75" />
      <path d="M8 1.75 A6.25 6.25 0 0 1 14.25 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function Mark() {
  return (
    <span className="flex size-10 items-center justify-center rounded-[11px] bg-[var(--si-tile)] text-[var(--si-ink)] shadow-[inset_0_0_0_1px_var(--si-line),inset_0_1px_0_var(--si-hover)]" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M9.2 2.5 V15 H3.2 Z" fill="currentColor" />
        <path d="M10.8 5.5 L16.6 15 H10.8 Z" fill="currentColor" fillOpacity="0.45" />
        <path d="M2.5 17.2 H17.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** Provider marks keep their brand colours; GitHub and Apple are monochrome marks, so they take the ink. */
function ProviderMark({ provider }: { provider: SsoProvider }) {
  if (provider === "google")
    return (
      <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
    );
  if (provider === "github")
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
      </svg>
    );
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.37 12.78c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.8 1.3 10.35.86 1.25 1.89 2.65 3.24 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.38.81 1.4-.02 2.29-1.27 3.14-2.53.99-1.45 1.4-2.86 1.42-2.93-.03-.01-2.72-1.04-2.75-4.13zM13.78 5.16c.72-.87 1.2-2.07 1.07-3.27-1.03.04-2.28.69-3.02 1.55-.66.77-1.24 1.99-1.09 3.17 1.15.09 2.32-.58 3.04-1.45z" />
    </svg>
  );
}

function LockGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7" rx="2" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
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

function CapsGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <path d="M8 2.5 L13.5 8.2 H10.5 V11 H5.5 V8.2 H2.5 Z" />
      <path d="M5.5 13.6 H10.5" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                 */
/* ------------------------------------------------------------------ */

const DEMO_PASSWORD = "correct-horse";
const DEMO_LATENCY_MS = 1150;
const DEMO_MAX_MISSES = 3;
const DEMO_LOCK_SECONDS = 30;

export default function AuthSignInDemo() {
  const reduce = useReducedMotion() ?? false;
  const misses = useRef(0);
  const [run, setRun] = useState(0);
  const [signedIn, setSignedIn] = useState(false);
  const { wait } = useTimeouts();

  const onSubmit = async (v: SignInValues): Promise<SignInResult> => {
    await wait(DEMO_LATENCY_MS);
    if (v.email.toLowerCase().startsWith("nobody@")) return { ok: false, reason: "unknown_email" };
    if (v.password === DEMO_PASSWORD) {
      misses.current = 0;
      return { ok: true };
    }
    misses.current += 1;
    if (misses.current >= DEMO_MAX_MISSES) {
      misses.current = 0;
      return { ok: false, reason: "locked", retryAfter: DEMO_LOCK_SECONDS };
    }
    return { ok: false, reason: "invalid_credentials", attemptsLeft: DEMO_MAX_MISSES - misses.current };
  };

  const fade = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 6, filter: "blur(4px)" }, animate: { opacity: 1, y: 0, filter: "blur(0px)" }, exit: { opacity: 0, y: -6, filter: "blur(4px)" } };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12 sm:py-16" style={{ background: STAGE }}>
      <AuthSignIn key={run} onSubmit={onSubmit} onSuccess={() => setSignedIn(true)} onForgotPassword={() => undefined} />
      <div className="mt-6 flex min-h-11 max-w-[400px] flex-wrap items-center justify-center gap-x-3 gap-y-1 px-2 text-center font-mono text-[11px] uppercase leading-[1.6] tracking-[0.12em] text-[#7d7d86]">
        <AnimatePresence mode="popLayout">
          {signedIn ? (
            <motion.button
              key="reset"
              type="button"
              {...fade}
              transition={{ duration: MOTION.swap, ease: EASE_OUT }}
              onClick={() => {
                setSignedIn(false);
                setRun((r) => r + 1);
              }}
              className="inline-flex h-9 items-center rounded-full px-4 text-[#cfcfd4] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] transition-[background-color,transform] duration-150 hover:bg-white/[0.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ededef] active:scale-[0.97]"
            >
              Reset demo
            </motion.button>
          ) : (
            <motion.p key="hint" {...fade} transition={{ duration: MOTION.block, ease: EASE_OUT, delay: reduce ? 0 : 0.7 }}>
              Password <span className="normal-case tracking-[0.04em] text-[#cfcfd4]">{DEMO_PASSWORD}</span> · 3 misses locks
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
