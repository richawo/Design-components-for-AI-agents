"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
  type ReactNode,
  type RefObject,
} from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react";

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
  /** Called when "Forgot?" is clicked, with whatever is in the email field. Call `preventDefault` yourself via the href if you route client-side. */
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
  className?: string;
};

type FieldName = "email" | "password";
type Status = "idle" | "loading" | "success";

/* ------------------------------------------------------------------ */
/* Tokens                                                               */
/* ------------------------------------------------------------------ */

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;

const C = {
  card: "#0a0a0b",
  fg: "#ededef",
  fg2: "#a0a0a8",
  fg3: "#6e6e76",
  error: "#ff6b5e",
  errorText: "#ff8f84",
  warn: "#f5c451",
  ok: "#3ddc97",
};

const PROVIDER_LABEL: Record<SsoProvider, string> = { google: "Google", github: "GitHub", apple: "Apple" };

const focusRing = "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ededef]";

function emailProblem(v: string): string | null {
  const s = v.trim();
  if (!s) return "Enter the email you use for Halyard.";
  if (!s.includes("@")) return "That’s missing an @. Emails need one.";
  const [local, domain = ""] = s.split("@");
  if (!local) return "Add the part before the @.";
  if (!domain || !/^[^\s@]+\.[^\s@]{2,}$/.test(domain)) return "Add the domain, like name@company.com.";
  if (/\s/.test(s)) return "Emails can’t contain spaces.";
  return null;
}

const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

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
  className = "",
}: AuthSignInProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ids = {
    email: `${uid}-email`,
    password: `${uid}-password`,
    emailMsg: `${uid}-email-msg`,
    passwordMsg: `${uid}-password-msg`,
    banner: `${uid}-banner`,
    title: `${uid}-title`,
  };

  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(defaultRemember);
  const [revealed, setRevealed] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [ssoBusy, setSsoBusy] = useState<SsoProvider | null>(null);
  const [ssoDone, setSsoDone] = useState<SsoProvider | null>(null);
  const [banner, setBanner] = useState<{ kind: "error"; text: string } | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [caps, setCaps] = useState(false);
  const [focused, setFocused] = useState<FieldName | null>(null);
  const [announce, setAnnounce] = useState("");

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const emailShake = useRef<HTMLDivElement>(null);
  const passwordShake = useRef<HTMLDivElement>(null);

  const busy = status === "loading" || ssoBusy !== null;
  const done = status === "success" || ssoDone !== null;
  const lockLeft = lockedUntil ? Math.max(0, Math.ceil((lockedUntil - now) / 1000)) : 0;
  const locked = lockLeft > 0;

  /* Lockout countdown */
  useEffect(() => {
    if (!lockedUntil) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= lockedUntil) {
        setLockedUntil(null);
        setAnnounce("You can try signing in again.");
      }
    }, 250);
    return () => clearInterval(t);
  }, [lockedUntil]);

  useEffect(() => {
    if (autoFocus) emailRef.current?.focus();
  }, [autoFocus]);

  const shake = useCallback(
    (field: FieldName) => {
      const el = field === "email" ? emailShake.current : passwordShake.current;
      if (!el || reduce) return;
      animate(el, { x: [0, -7, 6, -4, 2, 0] }, { duration: 0.42, ease: "easeOut" });
    },
    [reduce],
  );

  const validate = (v: { email: string; password: string }) => {
    const next: Partial<Record<FieldName, string>> = {};
    const e = emailProblem(v.email);
    if (e) next.email = e;
    if (!v.password) next.password = "Enter your password.";
    return next;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || done || locked) return;
    setBanner(null);
    const next = validate({ email, password });
    setErrors(next);
    const bad = (["email", "password"] as const).filter((k) => next[k]);
    if (bad.length) {
      bad.forEach(shake);
      (bad[0] === "email" ? emailRef : passwordRef).current?.focus();
      return;
    }
    setStatus("loading");
    setAnnounce("Signing in…");
    let res: SignInResult | void;
    try {
      res = await (onSubmit ? onSubmit({ email: email.trim(), password, remember }) : new Promise<SignInResult>((r) => setTimeout(() => r({ ok: true }), 1100)));
    } catch {
      setStatus("idle");
      setBanner({ kind: "error", text: `Couldn’t reach ${productName}. Check your connection and try again.` });
      setAnnounce("");
      return;
    }
    if (!res || res.ok) {
      setStatus("success");
      setAnnounce(res?.message ?? "Signed in. Opening your workspace.");
      setTimeout(() => onSuccess?.("password"), reduce ? 0 : 700);
      return;
    }
    setStatus("idle");
    setAnnounce("");
    if (res.reason === "locked") {
      setLockedUntil(Date.now() + res.retryAfter * 1000);
      setNow(Date.now());
      setPassword("");
      setErrors({});
      return;
    }
    if (res.reason === "unknown_email") {
      setErrors({ email: res.message ?? `No ${productName} account uses this email. Check for typos, or create one below.` });
      shake("email");
      emailRef.current?.focus();
      return;
    }
    const left = res.attemptsLeft;
    setErrors({
      password:
        res.message ??
        (left === undefined
          ? "That password doesn’t match this account."
          : left === 1
            ? "That password doesn’t match. One more try before we pause sign-in."
            : `That password doesn’t match. ${left} tries left.`),
    });
    shake("password");
    passwordRef.current?.focus();
    passwordRef.current?.select();
  };

  const sso = async (p: SsoProvider) => {
    if (busy || done || locked) return;
    setBanner(null);
    setSsoBusy(p);
    setAnnounce(`Opening ${PROVIDER_LABEL[p]}…`);
    try {
      const res = await (onSso ? onSso(p) : new Promise<void>((r) => setTimeout(r, 1300)));
      if (res && !res.ok) {
        setBanner({ kind: "error", text: res.message ?? `${PROVIDER_LABEL[p]} didn’t confirm your account. Try again, or use your email.` });
        setSsoBusy(null);
        return;
      }
      setSsoBusy(null);
      setSsoDone(p);
      setAnnounce(`Signed in with ${PROVIDER_LABEL[p]}.`);
      setTimeout(() => onSuccess?.(p), reduce ? 0 : 700);
    } catch {
      setSsoBusy(null);
      setBanner({ kind: "error", text: `The ${PROVIDER_LABEL[p]} window closed before we heard back. Try again?` });
    }
  };

  const onEmailChange = (v: string) => {
    setEmail(v);
    // Reward early, punish late: typing only clears or refines an error that is already showing.
    if (errors.email) setErrors((er) => ({ ...er, email: emailProblem(v) ?? undefined }));
  };

  const onPasswordChange = (v: string) => {
    setPassword(v);
    if (errors.password) setErrors((er) => ({ ...er, password: v ? undefined : er.password }));
  };

  const capsCheck = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === "function") setCaps(e.getModifierState("CapsLock"));
  };

  const disabledForm = busy || done;

  return (
    <div className={`@container w-full max-w-[400px] font-sans text-[#ededef] antialiased [color-scheme:dark] ${className}`}>
      <style>{`
        @keyframes auth-sign-in-spin { to { transform: rotate(360deg); } }
      `}</style>
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: reduce ? 0.15 : 0.6, ease: EASE_OUT }}
        className="relative rounded-[20px] bg-[#0a0a0b] px-5 pb-6 pt-7 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),inset_0_1px_0_0_rgba(255,255,255,0.06),0_32px_80px_-32px_rgba(0,0,0,0.9)] @[22rem]:px-7 @sm:px-8 @sm:pb-8 @sm:pt-9"
      >
        {/* Brand + heading */}
        <Mark />
        <h1 id={ids.title} className="mt-6 text-[clamp(1.375rem,1.2rem+0.6cqi,1.5rem)] font-semibold leading-[1.15] tracking-[-0.025em] text-[#ededef]">
          {title}
        </h1>
        <p className="mt-2 text-pretty text-[14.5px] leading-[1.55] text-[#a0a0a8]">{subtitle}</p>

        {/* Banner: lockout or failure */}
        <AnimatePresence initial={false}>
          {(locked || banner) && (
            <motion.div
              key={locked ? "locked" : "banner"}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: reduce ? 0.12 : 0.32, ease: EASE_OUT }}
              className="overflow-hidden"
            >
              <div
                id={ids.banner}
                role="alert"
                className={`mt-6 flex items-start gap-3 rounded-[12px] px-3.5 py-3 text-[13.5px] leading-[1.5] ${
                  locked ? "bg-[#f5c451]/[0.07] shadow-[inset_0_0_0_1px_rgba(245,196,81,0.22)]" : "bg-[#ff6b5e]/[0.07] shadow-[inset_0_0_0_1px_rgba(255,107,94,0.24)]"
                }`}
              >
                <span className="mt-[1px] shrink-0" aria-hidden="true">
                  {locked ? <LockGlyph /> : <AlertGlyph />}
                </span>
                {locked ? (
                  <p className="min-w-0 text-[#e9e2cf]">
                    <span className="font-medium text-[#f5c451]">Sign-in paused.</span> Too many wrong passwords, so we’re giving this account a breather. Try again in{" "}
                    <RollingText value={fmtClock(lockLeft)} reduce={reduce} className="font-medium tabular-nums text-[#ededef]" />.
                  </p>
                ) : (
                  <p className="min-w-0 text-[#f2d6d2]">{banner?.text}</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SSO */}
        {providers.length > 0 && (
          <>
            <div className={`mt-7 grid gap-2`} style={{ gridTemplateColumns: `repeat(${providers.length}, minmax(0, 1fr))` }}>
              {providers.map((p) => (
                <SsoButton
                  key={p}
                  provider={p}
                  state={ssoBusy === p ? "loading" : ssoDone === p ? "success" : "idle"}
                  disabled={(busy && ssoBusy !== p) || (done && ssoDone !== p) || locked}
                  onClick={() => void sso(p)}
                  reduce={reduce}
                />
              ))}
            </div>
            <div className="mt-6 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
              <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#6e6e76]">{dividerLabel}</span>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
            </div>
          </>
        )}

        <form noValidate method="post" onSubmit={submit} aria-labelledby={ids.title} className="mt-6">
          {/* Email */}
          <div>
            <label htmlFor={ids.email} className="mb-2 block text-[13px] font-medium leading-5 text-[#cfcfd4]">
              {emailLabel}
            </label>
            <div ref={emailShake}>
              <FieldShell focused={focused === "email"} invalid={!!errors.email} disabled={disabledForm} reduce={reduce}>
                <input
                  ref={emailRef}
                  id={ids.email}
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={emailPlaceholder}
                  value={email}
                  readOnly={disabledForm}
                  aria-invalid={!!errors.email || undefined}
                  aria-describedby={errors.email ? ids.emailMsg : undefined}
                  onChange={(e) => onEmailChange(e.target.value)}
                  onFocus={() => setFocused("email")}
                  onBlur={() => {
                    setFocused(null);
                    if (email.trim() && emailProblem(email)) setErrors((er) => ({ ...er, email: emailProblem(email) ?? undefined }));
                  }}
                  className="h-11 w-full min-w-0 rounded-[11px] bg-transparent px-3.5 text-[16px] text-[#ededef] outline-none placeholder:text-[#5c5c64] @sm:text-[15px]"
                />
              </FieldShell>
            </div>
            <FieldMessage id={ids.emailMsg} text={errors.email} tone="error" reduce={reduce} />
          </div>

          {/* Password */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor={ids.password} className="block text-[13px] font-medium leading-5 text-[#cfcfd4]">
                {passwordLabel}
              </label>
              <a
                href={forgotHref}
                onClick={() => onForgotPassword?.(email.trim())}
                className={`-my-2 -mr-1.5 inline-flex h-9 items-center rounded-md px-1.5 text-[13px] text-[#a0a0a8] transition-[color,transform] duration-150 hover:text-[#ededef] active:scale-[0.97] ${focusRing}`}
              >
                {forgotLabel}
              </a>
            </div>
            <div ref={passwordShake}>
              <FieldShell focused={focused === "password"} invalid={!!errors.password} disabled={disabledForm} reduce={reduce}>
                <PasswordInput
                  inputRef={passwordRef}
                  id={ids.password}
                  value={password}
                  revealed={revealed}
                  readOnly={disabledForm}
                  invalid={!!errors.password}
                  describedBy={[errors.password ? ids.passwordMsg : "", caps ? `${ids.passwordMsg}-caps` : ""].filter(Boolean).join(" ") || undefined}
                  onChange={onPasswordChange}
                  onFocus={() => setFocused("password")}
                  onBlur={() => {
                    setFocused(null);
                    setCaps(false);
                  }}
                  onKey={capsCheck}
                  reduce={reduce}
                />
                <RevealButton revealed={revealed} onToggle={() => setRevealed((r) => !r)} keepFocus={focused === "password"} disabled={disabledForm} reduce={reduce} />
              </FieldShell>
            </div>
            <FieldMessage id={ids.passwordMsg} text={errors.password} tone="error" reduce={reduce} />
            <FieldMessage id={`${ids.passwordMsg}-caps`} text={caps && focused === "password" ? "Caps Lock is on." : undefined} tone="warn" reduce={reduce} />
          </div>

          {/* Remember me */}
          <Checkbox id={`${uid}-remember`} checked={remember} onChange={setRemember} disabled={disabledForm} label={rememberLabel} reduce={reduce} />

          {/* Submit */}
          <SubmitButton
            state={status === "loading" ? "loading" : status === "success" ? "success" : "idle"}
            label={
              locked ? (
                <>
                  Try again in&nbsp;
                  <RollingText value={fmtClock(lockLeft)} reduce={reduce} />
                </>
              ) : (
                submitLabel
              )
            }
            labelKey={locked ? "locked" : "idle"}
            disabled={locked || ssoBusy !== null || ssoDone !== null}
            reduce={reduce}
          />
        </form>

        <p className="mt-6 text-center text-[13.5px] leading-5 text-[#8a8a92]">
          {signUpPrompt}{" "}
          <a
            href={signUpHref}
            className={`rounded-sm font-medium text-[#ededef] underline decoration-white/25 underline-offset-[3px] transition-[text-decoration-color] duration-150 hover:decoration-white/70 ${focusRing}`}
          >
            {signUpLabel}
          </a>
        </p>

        <p className="sr-only" aria-live="polite" role="status">
          {announce}
        </p>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Field shell + travelling light                                       */
/* ------------------------------------------------------------------ */

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
          ? "bg-[#ff6b5e]/[0.04] shadow-[inset_0_0_0_1px_rgba(255,107,94,0.55)]"
          : focused
            ? "bg-white/[0.035] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12),0_0_0_4px_rgba(255,255,255,0.04)]"
            : "bg-white/[0.025] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.17)]"
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
 * ring behind it, then fades, leaving the ring settled.
 */
function FocusLight({ active, invalid, startX, reduce }: { active: boolean; invalid: boolean; startX: MutableRefObject<number | null>; reduce: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [box, setBox] = useState({ w: 0, h: 0 });
  const t = useMotionValue(0);
  const start = useMotionValue(0);
  const per = useMotionValue(0);
  const widthRef = useRef(0);

  const hostRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    setBox({ w: el.offsetWidth, h: el.offsetHeight });
    return () => ro.disconnect();
  }, []);

  const R = 11;
  const sw = 1.5;
  const i = sw / 2;
  const w = box.w;
  const h = box.h;
  const r = R - i;
  const P = w && h ? 2 * (w - 2 * i - 2 * r) + 2 * (h - 2 * i - 2 * r) + 2 * Math.PI * r : 0;
  widthRef.current = w;
  useEffect(() => per.set(P), [P, per]);

  useEffect(() => {
    if (!active) return;
    // Light starts on the top edge, under the pointer if there was one.
    const x = startX.current;
    startX.current = null;
    start.set(x === null ? 0 : Math.max(0, Math.min(widthRef.current - 2 * R, x - R)));
    if (reduce) {
      t.set(1);
      return;
    }
    t.set(0);
    const c = animate(t, 1, { duration: 0.78, ease: EASE_IN_OUT });
    return () => c.stop();
  }, [active, reduce, t, start, startX]);

  const ringDash = useTransform([t, per], ([v, L]: number[]) => `${v * L} ${L - v * L + 0.001}`);
  const ringOffset = useTransform(start, (s) => -s);
  const tailLen = Math.min(64, P / 3);
  const tailDash = `${tailLen} ${P}`;
  const headDash = `12 ${P}`;
  const tailOffset = useTransform([t, start, per], ([v, s, L]: number[]) => -(s + v * L - Math.min(64, L / 3)));
  const headOffset = useTransform([t, start, per], ([v, s, L]: number[]) => -(s + v * L - 12));
  const cometOpacity = useTransform(t, [0, 0.06, 0.82, 1], [0, 1, 1, 0]);

  const d = `M${i + r} ${i} H${w - i - r} A${r} ${r} 0 0 1 ${w - i} ${i + r} V${h - i - r} A${r} ${r} 0 0 1 ${w - i - r} ${h - i} H${i + r} A${r} ${r} 0 0 1 ${i} ${h - i - r} V${i + r} A${r} ${r} 0 0 1 ${i + r} ${i} Z`;
  const ring = invalid ? "rgba(255,107,94,0.9)" : "rgba(255,255,255,0.62)";
  const light = invalid ? "#ffb3aa" : "#ffffff";

  return (
    <span ref={hostRef} aria-hidden="true" className="pointer-events-none absolute inset-0">
      {P > 0 && (
        <motion.svg
          aria-hidden="true"
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          className="pointer-events-none absolute inset-0 overflow-visible"
          initial={false}
          animate={{ opacity: active ? 1 : 0 }}
          transition={{ duration: active ? 0 : 0.18 }}
        >
          <defs>
            <filter id={`${uid}-glow`} x="-20%" y="-50%" width="140%" height="200%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>
          <motion.path d={d} fill="none" stroke={ring} strokeWidth={sw} style={{ strokeDasharray: ringDash, strokeDashoffset: ringOffset }} />
          {!reduce && (
            <motion.g style={{ opacity: cometOpacity }}>
              <motion.path
                d={d}
                fill="none"
                stroke={light}
                strokeOpacity={0.35}
                strokeWidth={sw}
                strokeLinecap="round"
                style={{ strokeDasharray: tailDash, strokeDashoffset: tailOffset }}
              />
              <motion.path
                d={d}
                fill="none"
                stroke={light}
                strokeWidth={5}
                strokeLinecap="round"
                filter={`url(#${uid}-glow)`}
                style={{ strokeDasharray: headDash, strokeDashoffset: headOffset }}
              />
              <motion.path d={d} fill="none" stroke={light} strokeWidth={2} strokeLinecap="round" style={{ strokeDasharray: headDash, strokeDashoffset: headOffset }} />
            </motion.g>
          )}
        </motion.svg>
      )}
    </span>
  );
}

function FieldMessage({ id, text, tone, reduce }: { id: string; text?: string; tone: "error" | "warn"; reduce: boolean }) {
  return (
    <AnimatePresence initial={false}>
      {text && (
        <motion.div
          key={tone}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0, transition: { duration: reduce ? 0.1 : 0.2, ease: [0.4, 0, 1, 1] } }}
          transition={{ duration: reduce ? 0.12 : 0.3, ease: EASE_OUT }}
          className="overflow-hidden"
        >
          <motion.p
            id={id}
            role={tone === "error" ? "alert" : "status"}
            initial={reduce ? false : { y: -6 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className={`flex items-start gap-1.5 pt-2 text-[13px] leading-[1.45] ${tone === "error" ? "text-[#ff8f84]" : "text-[#f5c451]"}`}
          >
            <span className="mt-[3px] shrink-0" aria-hidden="true">
              {tone === "error" ? <SmallAlert /> : <CapsGlyph />}
            </span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={text}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(2px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(2px)" }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
                className="min-w-0"
              >
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
  const [ghost, setGhost] = useState<null | { type: "password" | "text"; n: number }>(null);
  const first = useRef(true);
  const ghostRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduce || !value) return;
    setGhost((g) => ({ type: revealed ? "password" : "text", n: (g?.n ?? 0) + 1 }));
    p.set(0);
    const c = animate(p, 1, { duration: 0.46, ease: EASE_IN_OUT, onComplete: () => setGhost(null) });
    return () => c.stop();
    // value intentionally excluded: only the toggle starts a wipe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  useLayoutEffect(() => {
    if (ghost && ghostRef.current && inputRef.current) ghostRef.current.scrollLeft = inputRef.current.scrollLeft;
  }, [ghost, inputRef]);

  const realMask = useMask(p, false);
  const ghostMask = useMask(p, true);
  const cls = "h-11 w-full min-w-0 rounded-[11px] bg-transparent pl-3.5 pr-12 text-[16px] tracking-[0.01em] text-[#ededef] outline-none placeholder:text-[#5c5c64] @sm:text-[15px]";

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

function useMask(p: MotionValue<number>, inverse: boolean) {
  return useTransform(p, (v) => {
    const a = v * 140 - 20;
    return inverse ? `linear-gradient(90deg, transparent ${a - 20}%, #000 ${a + 20}%)` : `linear-gradient(90deg, #000 ${a - 20}%, transparent ${a + 20}%)`;
  });
}

function RevealButton({ revealed, onToggle, keepFocus, disabled, reduce }: { revealed: boolean; onToggle: () => void; keepFocus: boolean; disabled: boolean; reduce: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const tr = reduce ? { duration: 0 } : { duration: 0.32, ease: EASE_IN_OUT };
  return (
    <button
      type="button"
      aria-label="Show password"
      aria-pressed={revealed}
      disabled={disabled}
      // Keep the caret in the field when toggling with a pointer.
      onMouseDown={(e) => keepFocus && e.preventDefault()}
      onClick={onToggle}
      className={`absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-[8px] text-[#8a8a92] transition-[color,background-color,transform] duration-150 hover:bg-white/[0.06] hover:text-[#ededef] active:scale-[0.94] disabled:pointer-events-none ${focusRing} focus-visible:outline-offset-0`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <defs>
          <mask id={`${uid}-m`} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
            <rect width="24" height="24" fill="#fff" />
            <motion.path d="M4.5 3.5 L20.5 19.5" stroke="#000" strokeWidth="4.2" initial={false} animate={{ pathLength: revealed ? 1 : 0 }} transition={tr} />
          </mask>
        </defs>
        <g mask={`url(#${uid}-m)`}>
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
          transition={reduce ? { duration: 0 } : { duration: 0.32, ease: EASE_IN_OUT, opacity: { duration: 0.08 } }}
        />
      </svg>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Controls                                                             */
/* ------------------------------------------------------------------ */

function Checkbox({
  id,
  checked,
  onChange,
  disabled,
  label,
  reduce,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
  label: string;
  reduce: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={`group/cb mt-4 flex min-h-11 cursor-pointer select-none items-center gap-3 text-[13.5px] text-[#a0a0a8] ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <input id={id} type="checkbox" name="remember" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={`relative flex size-[18px] shrink-0 items-center justify-center rounded-[5px] transition-[background-color,box-shadow,transform] duration-150 group-active/cb:scale-[0.92] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#ededef] ${
          checked
            ? "bg-[#ededef] shadow-[inset_0_0_0_1px_#ededef]"
            : "bg-white/[0.03] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)] group-hover/cb:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.32)]"
        }`}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <motion.path
            d="M2.6 6.3 L5 8.6 L9.6 3.6"
            stroke="#0a0a0b"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.22, ease: EASE_OUT, opacity: { duration: 0.05 } }}
          />
        </svg>
      </span>
      <span className="transition-colors duration-150 group-hover/cb:text-[#cfcfd4]">{label}</span>
    </label>
  );
}

function SubmitButton({
  state,
  label,
  labelKey,
  disabled,
  reduce,
}: {
  state: "idle" | "loading" | "success";
  label: ReactNode;
  labelKey: string;
  disabled: boolean;
  reduce: boolean;
}) {
  const swap = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 8, filter: "blur(3px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" },
        exit: { opacity: 0, y: -8, filter: "blur(3px)", transition: { duration: 0.14, ease: [0.4, 0, 1, 1] as const } },
      };
  const busy = state !== "idle";
  return (
    <button
      type="submit"
      disabled={disabled}
      aria-disabled={busy || undefined}
      className={`relative mt-5 flex h-11 w-full items-center justify-center overflow-hidden rounded-[11px] text-[14.5px] font-medium tracking-[-0.005em] transition-[background-color,color,transform,box-shadow] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${focusRing} ${
        state === "success"
          ? "bg-[#3ddc97] text-[#04140c] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
          : "bg-[#ededef] text-[#0a0a0b] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-1px_0_rgba(0,0,0,0.12)] enabled:hover:bg-white"
      } ${busy ? "pointer-events-none" : ""}`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {state === "idle" && (
          <motion.span key={labelKey} {...swap} transition={{ duration: 0.22, ease: EASE_OUT }} className="flex items-center tabular-nums">
            {label}
          </motion.span>
        )}
        {state === "loading" && (
          <motion.span key="spin" {...swap} transition={{ duration: 0.22, ease: EASE_OUT }} className="flex items-center gap-2.5">
            <Spinner />
            <span>Signing in…</span>
          </motion.span>
        )}
        {state === "success" && (
          <motion.span key="ok" {...swap} transition={{ duration: 0.22, ease: EASE_OUT }} className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <motion.path
                d="M4 9.4 L7.4 12.6 L14 5.6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: reduce ? 1 : 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.36, delay: 0.08, ease: EASE_OUT }}
              />
            </svg>
            <span>Signed in</span>
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

function SsoButton({
  provider,
  state,
  disabled,
  onClick,
  reduce,
}: {
  provider: SsoProvider;
  state: "idle" | "loading" | "success";
  disabled: boolean;
  onClick: () => void;
  reduce: boolean;
}) {
  const label = PROVIDER_LABEL[provider];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Continue with ${label}`}
      aria-busy={state === "loading" || undefined}
      className={`group/sso relative flex h-11 min-w-0 items-center justify-center gap-2 rounded-[11px] bg-white/[0.03] px-2 text-[13.5px] font-medium text-[#dcdce0] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09),inset_0_1px_0_rgba(255,255,255,0.04)] transition-[background-color,box-shadow,opacity,transform] duration-150 enabled:hover:bg-white/[0.06] enabled:hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14),inset_0_1px_0_rgba(255,255,255,0.05)] enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ${focusRing} ${
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
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="flex"
          >
            {state === "loading" ? (
              <Spinner size={16} />
            ) : state === "success" ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3.5 8.4 L6.6 11.3 L12.5 4.8" stroke="#3ddc97" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <ProviderMark provider={provider} />
            )}
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
function RollingText({ value, reduce, className = "" }: { value: string; reduce: boolean; className?: string }) {
  return (
    <span className={`inline-flex ${className}`} aria-label={value}>
      {value.split("").map((ch, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="relative inline-flex h-[1.5em] overflow-hidden align-bottom leading-[1.5em]"
          style={{ width: /\d/.test(ch) ? "1ch" : undefined }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={ch}
              initial={reduce ? { opacity: 0 } : { y: "-70%", opacity: 0, filter: "blur(1.5px)" }}
              animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
              exit={reduce ? { opacity: 0 } : { y: "70%", opacity: 0, filter: "blur(1.5px)" }}
              transition={{ duration: 0.32, ease: EASE_OUT }}
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

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ animation: "auth-sign-in-spin 0.7s linear infinite" }}>
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeOpacity="0.22" strokeWidth="1.75" />
      <path d="M8 1.75 A6.25 6.25 0 0 1 14.25 8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function Mark() {
  return (
    <span
      className="flex size-10 items-center justify-center rounded-[11px] bg-[#141416] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09),inset_0_1px_0_rgba(255,255,255,0.07)]"
      aria-hidden="true"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M9.2 2.5 V15 H3.2 Z" fill="#ededef" />
        <path d="M10.8 5.5 L16.6 15 H10.8 Z" fill="#ededef" fillOpacity="0.45" />
        <path d="M2.5 17.2 H17.5" stroke="#ededef" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

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
      <svg width="16" height="16" viewBox="0 0 16 16" fill="#ededef" aria-hidden="true">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
      </svg>
    );
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#ededef" aria-hidden="true">
      <path d="M16.37 12.78c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.89-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.8 1.3 10.35.86 1.25 1.89 2.65 3.24 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.38.81 1.4-.02 2.29-1.27 3.14-2.53.99-1.45 1.4-2.86 1.42-2.93-.03-.01-2.72-1.04-2.75-4.13zM13.78 5.16c.72-.87 1.2-2.07 1.07-3.27-1.03.04-2.28.69-3.02 1.55-.66.77-1.24 1.99-1.09 3.17 1.15.09 2.32-.58 3.04-1.45z" />
    </svg>
  );
}

function LockGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#f5c451" strokeWidth="1.5" strokeLinecap="round">
      <rect x="3" y="7" width="10" height="7" rx="2" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

function AlertGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#ff6b5e" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 4.8v3.6M8 11h.01" />
    </svg>
  );
}

function SmallAlert() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <circle cx="8" cy="8" r="6.4" />
      <path d="M8 4.8v3.6M8 11h.01" />
    </svg>
  );
}

function CapsGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
      <path d="M8 2.5 L13.5 8.2 H10.5 V11 H5.5 V8.2 H2.5 Z" />
      <path d="M5.5 13.6 H10.5" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                 */
/* ------------------------------------------------------------------ */

const DEMO_PASSWORD = "correct-horse";

export default function AuthSignInDemo() {
  const misses = useRef(0);
  const [run, setRun] = useState(0);
  const [signedIn, setSignedIn] = useState(false);

  const onSubmit = (v: SignInValues) =>
    new Promise<SignInResult>((resolve) =>
      setTimeout(() => {
        if (v.email.toLowerCase().startsWith("nobody@")) return resolve({ ok: false, reason: "unknown_email" });
        if (v.password === DEMO_PASSWORD) {
          misses.current = 0;
          return resolve({ ok: true });
        }
        misses.current += 1;
        if (misses.current >= 3) {
          misses.current = 0;
          return resolve({ ok: false, reason: "locked", retryAfter: 30 });
        }
        resolve({ ok: false, reason: "invalid_credentials", attemptsLeft: 3 - misses.current });
      }, 1150),
    );

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-black px-4 py-12 sm:py-16">
      <AuthSignIn key={run} onSubmit={onSubmit} onSuccess={() => setSignedIn(true)} onForgotPassword={() => undefined} />
      <div className="mt-6 flex min-h-11 max-w-[400px] flex-wrap items-center justify-center gap-x-3 gap-y-1 px-2 text-center font-mono text-[11px] uppercase leading-[1.6] tracking-[0.12em] text-[#6e6e76]">
        <AnimatePresence mode="popLayout" initial={false}>
          {signedIn ? (
            <motion.button
              key="reset"
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              onClick={() => {
                setSignedIn(false);
                setRun((r) => r + 1);
              }}
              className={`inline-flex h-9 items-center rounded-full px-4 text-[#cfcfd4] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] transition-[background-color,transform] duration-150 hover:bg-white/[0.05] active:scale-[0.97] ${focusRing}`}
            >
              Reset demo
            </motion.button>
          ) : (
            <motion.p key="hint" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              Password <span className="normal-case tracking-[0.04em] text-[#cfcfd4]">{DEMO_PASSWORD}</span> · 3 misses locks
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
