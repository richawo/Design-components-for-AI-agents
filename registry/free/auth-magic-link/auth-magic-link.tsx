"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";

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
  /** How long a link lives, for the copy ("15 minutes"). */
  linkLifetime?: string;
  /** Seconds before "Resend" unlocks. */
  resendAfter?: number;
  defaultEmail?: string;
  /** Open in the "your link expired" state, e.g. when the user lands from a dead link. */
  expired?: boolean;
  /** Send the link. Reject (with an Error message, optionally) to show the error banner. */
  onSend?: (email: string) => Promise<void>;
  alternateLabel?: string;
  alternateHref?: string;
  /** Override or extend provider detection: domain → provider. */
  providers?: Record<string, MailProvider>;
  className?: string;
};

type View = "form" | "sent";

/* ------------------------------------------------------------------ */
/* Tokens + helpers                                                     */
/* ------------------------------------------------------------------ */

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 500, damping: 40 } as const;
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ededef]";

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
  className = "",
}: AuthMagicLinkProps) {
  const reduce = useReducedMotion() ?? false;
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  const [view, setView] = useState<View>("form");
  const [email, setEmail] = useState(defaultEmail);
  const [sentTo, setSentTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [cooldownEnd, setCooldownEnd] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  const [replay, setReplay] = useState(0);
  const [showExpired, setShowExpired] = useState(expired);
  const [announce, setAnnounce] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const shakeRef = useRef<HTMLDivElement>(null);
  const returning = useRef(false);

  useEffect(() => setShowExpired(expired), [expired]);

  const left = Math.max(0, Math.ceil((cooldownEnd - now) / 1000));
  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [left, cooldownEnd]);

  // Coming back from "sent": refocus the field with the address selected, ready to retype.
  useEffect(() => {
    if (view !== "form" || !returning.current) return;
    returning.current = false;
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 60);
    return () => clearTimeout(t);
  }, [view]);

  const suggestion = error ? null : suggestFix(email);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    if (sending) return;
    const problem = emailProblem(email);
    setBanner(null);
    if (problem) {
      setError(problem);
      if (!reduce && shakeRef.current) animate(shakeRef.current, { x: [0, -7, 6, -4, 2, 0] }, { duration: 0.42, ease: "easeOut" });
      inputRef.current?.focus();
      return;
    }
    const target = email.trim();
    setError(null);
    setSending(true);
    setAnnounce("Sending your link…");
    try {
      await (onSend ? onSend(target) : new Promise<void>((r) => setTimeout(r, 1100)));
      setSentTo(target);
      setShowExpired(false);
      setCooldownEnd(Date.now() + resendAfter * 1000);
      setNow(Date.now());
      setView("sent");
      setAnnounce(`Link sent to ${target}. Check your inbox.`);
    } catch (err) {
      const m = err instanceof Error && err.message ? err.message : "We couldn’t send the email just now. Our mail server is having a moment, so try again in a few seconds.";
      setBanner(m);
      setAnnounce("");
    } finally {
      setSending(false);
    }
  };

  const resend = async () => {
    if (left > 0 || resendState !== "idle") return;
    setResendState("sending");
    try {
      await (onSend ? onSend(sentTo) : new Promise<void>((r) => setTimeout(r, 1000)));
      setResendState("sent");
      setReplay((r) => r + 1);
      setAnnounce(`Sent another link to ${sentTo}. Only the newest one works.`);
      setTimeout(() => {
        setResendState("idle");
        setCooldownEnd(Date.now() + resendAfter * 1000);
        setNow(Date.now());
      }, 1600);
    } catch {
      setResendState("idle");
      setAnnounce("Couldn’t resend. Try again in a moment.");
    }
  };

  const provider = sentTo ? detectProvider(sentTo, sender, providers) : null;

  const swap = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 10, filter: "blur(4px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" },
        exit: { opacity: 0, y: -8, filter: "blur(4px)", transition: { duration: 0.2, ease: [0.4, 0, 1, 1] as const } },
      };

  return (
    <div className={`@container w-full max-w-[400px] font-sans text-[#ededef] antialiased [color-scheme:dark] ${className}`}>
      <style>{`@keyframes auth-magic-link-spin { to { transform: rotate(360deg) } }`}</style>
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: reduce ? 0.15 : 0.6, ease: EASE_OUT }}
        className="relative overflow-hidden rounded-[20px] bg-[#0a0a0b] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),inset_0_1px_0_0_rgba(255,255,255,0.06),0_32px_80px_-32px_rgba(0,0,0,0.9)]"
      >
        <AutoHeight reduce={reduce}>
          <div className="px-5 pb-6 pt-7 @[22rem]:px-6 @sm:px-8 @sm:pb-8 @sm:pt-9">
            <AnimatePresence mode="popLayout" initial={false}>
              {view === "form" ? (
                <motion.div key="form" {...swap} transition={{ duration: 0.36, ease: EASE_OUT }}>
                  {showExpired ? <ExpiredGlyph /> : <Mark />}
                  <h1 className="mt-6 text-[clamp(1.375rem,1.2rem+0.6cqi,1.5rem)] font-semibold leading-[1.15] tracking-[-0.025em]">
                    {showExpired ? "That link has expired" : title}
                  </h1>
                  <p className="mt-2 text-pretty text-[14.5px] leading-[1.55] text-[#a0a0a8]">
                    {showExpired ? `Sign-in links work once and last ${linkLifetime}, so this one’s retired. We’ll send you a fresh one.` : subtitle}
                  </p>

                  <AnimatePresence initial={false}>
                    {banner && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: reduce ? 0.12 : 0.3, ease: EASE_OUT }}
                        className="overflow-hidden"
                      >
                        <div role="alert" className="mt-6 flex items-start gap-3 rounded-[12px] bg-[#ff6b5e]/[0.07] px-3.5 py-3 text-[13.5px] leading-[1.5] text-[#f2d6d2] shadow-[inset_0_0_0_1px_rgba(255,107,94,0.24)]">
                          <AlertGlyph />
                          <p className="min-w-0">{banner}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form noValidate onSubmit={send} className="mt-7">
                    <label htmlFor={`${uid}-email`} className="mb-2 block text-[13px] font-medium leading-5 text-[#cfcfd4]">
                      {emailLabel}
                    </label>
                    <div ref={shakeRef}>
                      <div
                        className={`rounded-[11px] transition-[background-color,box-shadow,opacity] duration-150 ${
                          error
                            ? "bg-[#ff6b5e]/[0.04] shadow-[inset_0_0_0_1px_rgba(255,107,94,0.6)] focus-within:shadow-[inset_0_0_0_1px_rgba(255,107,94,0.9),0_0_0_4px_rgba(255,107,94,0.08)]"
                            : "bg-white/[0.025] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.17)] focus-within:bg-white/[0.035] focus-within:!shadow-[inset_0_0_0_1px_rgba(237,237,239,0.62),0_0_0_4px_rgba(255,255,255,0.04)]"
                        } ${sending ? "opacity-60" : ""}`}
                      >
                        <input
                          ref={inputRef}
                          id={`${uid}-email`}
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
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (error) setError(emailProblem(e.target.value) ? error : null);
                          }}
                          onBlur={() => email.trim() && setError(emailProblem(email))}
                          className="h-11 w-full min-w-0 rounded-[11px] bg-transparent px-3.5 text-[16px] text-[#ededef] outline-none placeholder:text-[#5c5c64] @sm:text-[15px]"
                        />
                      </div>
                    </div>

                    {/* Error, or a typo suggestion */}
                    <AnimatePresence initial={false} mode="popLayout">
                      {(error || suggestion) && (
                        <motion.div
                          key={error ? "err" : "fix"}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0, transition: { duration: 0.16 } }}
                          transition={{ duration: reduce ? 0.12 : 0.3, ease: EASE_OUT }}
                          className="overflow-hidden"
                        >
                          {error ? (
                            <motion.p
                              id={`${uid}-err`}
                              role="alert"
                              initial={reduce ? false : { y: -6 }}
                              animate={{ y: 0 }}
                              transition={{ duration: 0.3, ease: EASE_OUT }}
                              className="flex items-start gap-1.5 pt-2 text-[13px] leading-[1.45] text-[#ff8f84]"
                            >
                              <span className="mt-[3px] shrink-0">
                                <SmallAlert />
                              </span>
                              {error}
                            </motion.p>
                          ) : (
                            <p id={`${uid}-fix`} className="pt-2 text-[13px] leading-[1.45] text-[#a0a0a8]">
                              Did you mean{" "}
                              <button
                                type="button"
                                onClick={() => {
                                  if (suggestion) setEmail(suggestion);
                                  inputRef.current?.focus();
                                }}
                                className={`rounded-sm font-medium text-[#ededef] underline decoration-white/30 underline-offset-[3px] transition-[text-decoration-color] duration-150 hover:decoration-white/80 ${focusRing}`}
                              >
                                {suggestion}
                              </button>
                              ?
                            </p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <PrimaryButton layoutId={`${uid}-cta`} type="submit" disabled={sending} reduce={reduce} className="mt-5">
                      <AnimatePresence mode="popLayout" initial={false}>
                        {sending ? (
                          <motion.span key="s" {...swap} transition={{ duration: 0.2, ease: EASE_OUT }} className="flex items-center gap-2.5">
                            <Spinner /> Sending link…
                          </motion.span>
                        ) : (
                          <motion.span key="l" {...swap} transition={{ duration: 0.2, ease: EASE_OUT }} className="flex items-center gap-2">
                            {showExpired ? "Send a new link" : submitLabel}
                            <ArrowRight />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </PrimaryButton>
                  </form>

                  <p className="mt-6 text-center text-[13.5px] leading-5">
                    <a
                      href={alternateHref}
                      className={`rounded-sm text-[#a0a0a8] underline decoration-white/20 underline-offset-[3px] transition-[color,text-decoration-color] duration-150 hover:text-[#ededef] hover:decoration-white/60 ${focusRing}`}
                    >
                      {alternateLabel}
                    </a>
                  </p>
                </motion.div>
              ) : (
                <motion.div key="sent" {...swap} transition={{ duration: 0.4, ease: EASE_OUT, delay: reduce ? 0 : 0.06 }}>
                  <Envelope key={replay} reduce={reduce} />
                  <h1 className="mt-6 text-center text-[clamp(1.375rem,1.2rem+0.6cqi,1.5rem)] font-semibold leading-[1.15] tracking-[-0.025em]">Check your inbox</h1>
                  <p className="mx-auto mt-2 max-w-[34ch] text-pretty text-center text-[14.5px] leading-[1.55] text-[#a0a0a8]">
                    We sent a sign-in link to <span className="break-all font-medium text-[#ededef]">{sentTo}</span>. It works once and expires in {linkLifetime}.
                  </p>

                  {provider ? (
                    <PrimaryButton layoutId={`${uid}-cta`} href={provider.href} reduce={reduce} className="mt-7">
                      <motion.span {...swap} transition={{ duration: 0.3, delay: 0.12, ease: EASE_OUT }} className="flex items-center gap-2">
                        Open {provider.name}
                        <ArrowUpRight />
                      </motion.span>
                    </PrimaryButton>
                  ) : (
                    <p className="mt-7 rounded-[11px] bg-white/[0.03] px-4 py-3 text-center text-[13.5px] leading-[1.5] text-[#a0a0a8] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]">
                      Look for an email from <span className="text-[#ededef]">{sender}</span>.
                    </p>
                  )}

                  <div className="mt-6 flex min-h-11 items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        returning.current = true;
                        setEmail(sentTo);
                        setView("form");
                        setAnnounce("");
                      }}
                      className={`group/back -ml-2 inline-flex h-11 items-center gap-1.5 rounded-[10px] px-2 text-[13.5px] text-[#a0a0a8] transition-[color,background-color,transform] duration-150 hover:bg-white/[0.04] hover:text-[#ededef] active:scale-[0.97] ${focusRing}`}
                    >
                      <span className="transition-transform duration-150 group-hover/back:-translate-x-0.5">
                        <ArrowLeft />
                      </span>
                      Use a different email
                    </button>
                    <ResendButton left={left} state={resendState} onClick={() => void resend()} reduce={reduce} />
                  </div>
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
/* Card height follows its content                                      */
/* ------------------------------------------------------------------ */

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
    <motion.div initial={false} animate={{ height: h }} transition={{ duration: reduce ? 0 : 0.42, ease: EASE_IN_OUT }} className="relative">
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Envelope: the letter slides in, the flap folds shut, it leaves a trail */
/* ------------------------------------------------------------------ */

function Envelope({ reduce }: { reduce: boolean }) {
  const fold = useMotionValue(reduce ? 1 : -1);
  const backOpacity = useTransform(fold, (v) => (v < 0 ? 1 : 0));
  const frontOpacity = useTransform(fold, (v) => (v >= 0 ? 1 : 0));
  const [phase, setPhase] = useState<"in" | "closed">(reduce ? "closed" : "in");

  useEffect(() => {
    if (reduce) return;
    const c = animate(fold, 1, { duration: 0.42, delay: 0.62, ease: EASE_IN_OUT, onComplete: () => setPhase("closed") });
    return () => c.stop();
  }, [fold, reduce]);

  const flap = "M14 30 L60 60 L106 30";
  return (
    <div className="flex justify-center" aria-hidden="true">
      <motion.svg
        width="132"
        height="104"
        viewBox="-6 -8 132 104"
        className="h-[104px] w-[132px] overflow-visible"
        initial={false}
        animate={phase === "closed" && !reduce ? { x: [0, 7, 0] } : { x: 0 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
      >
        {/* sent trail */}
        {!reduce &&
          [42, 56, 70].map((y, i) => (
            <motion.path
              key={y}
              d={`M${-2 - i * 3} ${y} H${8 - i * 2}`}
              stroke="#ededef"
              strokeWidth="1.5"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={phase === "closed" ? { pathLength: [0, 1, 1], opacity: [0, 0.55, 0], x: [6, 0, -8] } : { pathLength: 0, opacity: 0 }}
              transition={{ duration: 0.7, delay: i * 0.05, ease: EASE_OUT }}
            />
          ))}
        {/* back of envelope */}
        <rect x="14" y="30" width="92" height="58" rx="8" fill="#121214" stroke="rgba(255,255,255,0.14)" />
        {/* open flap (behind the letter) */}
        <motion.path
          d={`${flap} Z`}
          fill="#1a1a1d"
          stroke="rgba(255,255,255,0.16)"
          strokeLinejoin="round"
          style={{ scaleY: fold, opacity: backOpacity, originX: "50%", originY: "0%", transformBox: "fill-box" }}
        />
        {/* the letter */}
        <motion.g initial={reduce ? { y: 0 } : { y: -34 }} animate={{ y: 0 }} transition={{ duration: 0.5, delay: 0.14, ease: EASE_IN_OUT }}>
          <rect x="26" y="34" width="68" height="48" rx="4" fill="#ededef" />
          <path d="M36 46 H70 M36 54 H82 M36 62 H62" stroke="#a6a6ad" strokeWidth="2.4" strokeLinecap="round" />
        </motion.g>
        {/* front pocket */}
        <path d="M14.5 31 L60 61.5 L105.5 31 V80 A7.5 7.5 0 0 1 98 87.5 H22 A7.5 7.5 0 0 1 14.5 80 Z" fill="#161618" stroke="rgba(255,255,255,0.14)" strokeLinejoin="round" />
        {/* closed flap (in front) */}
        <motion.path
          d={`${flap} Z`}
          fill="#1d1d21"
          stroke="rgba(255,255,255,0.18)"
          strokeLinejoin="round"
          style={{ scaleY: fold, opacity: frontOpacity, originX: "50%", originY: "0%", transformBox: "fill-box" }}
        />
        {/* seal */}
        <motion.circle
          cx="60"
          cy="56"
          r="5"
          fill="#ededef"
          initial={reduce ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
          animate={phase === "closed" ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
          transition={{ duration: 0.28, ease: EASE_OUT }}
          style={{ originX: "50%", originY: "50%", transformBox: "fill-box" }}
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
}: {
  layoutId: string;
  children: ReactNode;
  type?: "submit" | "button";
  href?: string;
  disabled?: boolean;
  reduce: boolean;
  className?: string;
}) {
  const cls = `group/cta relative flex h-11 w-full items-center justify-center overflow-hidden rounded-[11px] bg-[#ededef] text-[14.5px] font-medium tracking-[-0.005em] text-[#0a0a0b] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-1px_0_rgba(0,0,0,0.12)] transition-[background-color] duration-150 hover:bg-white ${focusRing} ${className}`;
  const t = reduce ? { duration: 0 } : { layout: { duration: 0.42, ease: EASE_IN_OUT } };
  if (href)
    return (
      <motion.a layoutId={layoutId} transition={t} href={href} target="_blank" rel="noopener noreferrer" whileTap={reduce ? undefined : { scale: 0.98 }} className={cls}>
        {children}
      </motion.a>
    );
  return (
    <motion.button
      layoutId={layoutId}
      transition={t}
      type={type ?? "button"}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      whileTap={reduce || disabled ? undefined : { scale: 0.98 }}
      className={`${cls} disabled:pointer-events-none`}
    >
      {children}
    </motion.button>
  );
}

function ResendButton({ left, state, onClick, reduce }: { left: number; state: "idle" | "sending" | "sent"; onClick: () => void; reduce: boolean }) {
  const ready = left <= 0 && state === "idle";
  const key = state !== "idle" ? state : ready ? "ready" : "wait";
  const swap = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 6, filter: "blur(2px)" }, animate: { opacity: 1, y: 0, filter: "blur(0px)" }, exit: { opacity: 0, y: -6, filter: "blur(2px)" } };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!ready}
      className={`group/resend relative -mr-2 inline-flex h-11 shrink-0 items-center overflow-hidden rounded-[10px] px-2.5 text-[13.5px] font-medium transition-[background-color,color,transform] duration-150 enabled:hover:bg-white/[0.05] enabled:active:scale-[0.97] disabled:cursor-not-allowed ${focusRing} ${
        ready ? "text-[#ededef]" : "text-[#8a8a92]"
      }`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={key} {...swap} transition={{ duration: 0.2, ease: EASE_OUT }} className="flex items-center gap-1.5 whitespace-nowrap">
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
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <motion.path
                  d="M3.5 8.4 L6.6 11.3 L12.5 4.8"
                  stroke="#3ddc97"
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
    <span className="flex size-10 items-center justify-center rounded-[11px] bg-[#141416] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09),inset_0_1px_0_rgba(255,255,255,0.07)]" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M9.2 2.5 V15 H3.2 Z" fill="#ededef" />
        <path d="M10.8 5.5 L16.6 15 H10.8 Z" fill="#ededef" fillOpacity="0.45" />
        <path d="M2.5 17.2 H17.5" stroke="#ededef" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function ExpiredGlyph() {
  return (
    <span className="flex size-10 items-center justify-center rounded-[11px] bg-[#f5c451]/[0.08] shadow-[inset_0_0_0_1px_rgba(245,196,81,0.25)]" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#f5c451" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#ff6b5e" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" className="mt-[1px] shrink-0">
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

export default function AuthMagicLinkDemo() {
  const [mode, setMode] = useState<"fresh" | "expired">("fresh");
  const reduce = useReducedMotion() ?? false;

  const onSend = (email: string) =>
    new Promise<void>((resolve, reject) =>
      setTimeout(() => {
        if (email.toLowerCase().endsWith("@example.com")) reject(new Error("example.com is reserved and can’t receive mail. Try a real address."));
        else resolve();
      }, 1100),
    );

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-black px-4 py-12 sm:py-16">
      <AuthMagicLink key={mode} expired={mode === "expired"} defaultEmail={mode === "expired" ? "ines@proton.me" : ""} onSend={onSend} />
      <div className="mt-6 flex flex-col items-center gap-3">
        <div role="radiogroup" aria-label="Demo state" className="flex rounded-full p-1 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]">
          {(["fresh", "expired"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`relative h-9 rounded-full px-4 font-mono text-[11px] uppercase tracking-[0.12em] transition-[color,transform] duration-150 active:scale-[0.97] ${focusRing} ${
                mode === m ? "text-[#0a0a0b]" : "text-[#8a8a92] hover:text-[#ededef]"
              }`}
            >
              {mode === m && <motion.span layoutId="auth-magic-link-demo" transition={reduce ? { duration: 0 } : SPRING_UI} className="absolute inset-0 rounded-full bg-[#ededef]" />}
              <span className="relative">{m === "fresh" ? "New visit" : "Expired link"}</span>
            </button>
          ))}
        </div>
        <p className="max-w-[340px] text-center font-mono text-[11px] uppercase leading-[1.6] tracking-[0.12em] text-[#6e6e76]">
          Try gmail.com, outlook.com or proton.me · <span className="normal-case tracking-[0.04em]">@example.com</span> fails
        </p>
      </div>
    </div>
  );
}
