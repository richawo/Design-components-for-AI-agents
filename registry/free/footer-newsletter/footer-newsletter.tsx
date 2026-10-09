"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";

export type SubscribeResult = "subscribed" | "already-subscribed";
export type FooterNewsletterLink = { label: string; href: string; external?: boolean };

export type FooterNewsletterProps = {
  kicker?: string;
  title?: string;
  body?: string;
  placeholder?: string;
  buttonLabel?: string;
  /** Called with a valid address. Resolve "already-subscribed" for known readers; reject to show the error state. */
  onSubscribe?: (email: string) => Promise<SubscribeResult | void>;
  /** Start in the already-subscribed state, e.g. for a signed-in reader. */
  alreadySubscribed?: boolean;
  successText?: string;
  alreadyText?: string;
  errorText?: string;
  /** Small line under the form. */
  note?: string;
  socials?: FooterNewsletterLink[];
  legal?: string;
  legalLinks?: FooterNewsletterLink[];
  className?: string;
};

type Phase = "idle" | "invalid" | "loading" | "success" | "already" | "error";

const EASE = [0.22, 1, 0.36, 1] as const;
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
const INK = "#141413";
const PAPER = "#f4f2ed";
const ROSE = "#b42318";

const TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gnail.com": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "yahooo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "outlok.com": "outlook.com",
  "outlook.co": "outlook.com",
  "icloud.co": "icloud.com",
  "iclod.com": "icloud.com",
};

/** A specific, kind reason, or null when the address looks deliverable. */
function problem(v: string): string | null {
  const e = v.trim();
  if (!e) return "Add your email first.";
  if (/\s/.test(e)) return "Email addresses can’t contain spaces.";
  if (!e.includes("@")) return "That’s missing an @.";
  const [local, domain = ""] = e.split("@");
  if (!local) return "Add the part before the @.";
  if (e.split("@").length > 2) return "That has one @ too many.";
  if (!domain || !/^[^.]+(\.[^.]+)+$/.test(domain) || /\.$/.test(domain)) return "Almost: add the domain after the @.";
  return null;
}

function suggestion(v: string): string | null {
  const m = v.trim().toLowerCase().match(/^([^@\s]+)@([^@\s]+)$/);
  if (!m) return null;
  const fix = TYPOS[m[2]];
  return fix ? `${m[1]}@${fix}` : null;
}

export function FooterNewsletter({
  kicker = "The Thursday Letter · Issue 112",
  title = "One good email, every Thursday.",
  body = "Field notes on making software people keep. Four minutes to read, no tracking pixels, one\u2011click unsubscribe.",
  placeholder = "you@work.com",
  buttonLabel = "Subscribe",
  onSubscribe,
  alreadySubscribed = false,
  successText = "You’re on the list. First issue Thursday.",
  alreadyText = "You’re already on the list. See you Thursday.",
  errorText = "Couldn’t reach our mail server.",
  note = "Join 4,812 readers. Unsubscribe whenever.",
  socials = [
    { label: "RSS", href: "#rss" },
    { label: "Bluesky", href: "#bluesky", external: true },
    { label: "Mastodon", href: "#mastodon", external: true },
    { label: "LinkedIn", href: "#linkedin", external: true },
  ],
  legal = "© 2026 Pressroom Labs ApS. Written in Copenhagen.",
  legalLinks = [
    { label: "Privacy", href: "#privacy" },
    { label: "Terms", href: "#terms" },
  ],
  className = "",
}: FooterNewsletterProps) {
  const reduce = !!useReducedMotion();
  const id = useId();
  const [phase, setPhase] = useState<Phase>(alreadySubscribed ? "already" : "idle");
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const msgRef = useRef<HTMLDivElement>(null);
  const [scope, animate] = useAnimate<HTMLDivElement>();

  useEffect(() => {
    if (alreadySubscribed) setPhase("already");
  }, [alreadySubscribed]);

  // Move focus to the control that replaces the one that just disappeared.
  useEffect(() => {
    if (phase === "error") retryRef.current?.focus({ preventScroll: true });
    // On success the field is gone: park focus on the (announced) message line, without a ring.
    if (phase === "success" || phase === "already") msgRef.current?.focus({ preventScroll: true });
  }, [phase]);

  const fix = phase === "idle" || phase === "invalid" ? suggestion(value) : null;

  const shake = () => {
    if (reduce || !scope.current) return;
    animate(scope.current, { x: [0, -7, 6, -4, 2, 0] }, { duration: 0.42, ease: "easeOut" });
  };

  const send = async (email: string) => {
    setSubmitted(email);
    setPhase("loading");
    setMessage("");
    const started = performance.now();
    try {
      const res = await (onSubscribe ? onSubscribe(email) : new Promise<void>((r) => setTimeout(r, 900)));
      const wait = Math.max(0, 700 - (performance.now() - started));
      await new Promise((r) => setTimeout(r, wait));
      setPhase(res === "already-subscribed" ? "already" : "success");
    } catch {
      await new Promise((r) => setTimeout(r, Math.max(0, 700 - (performance.now() - started))));
      setPhase("error");
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (phase === "loading") return;
    const why = problem(value);
    if (why) {
      setPhase("invalid");
      setMessage(why);
      shake();
      inputRef.current?.focus();
      return;
    }
    send(value.trim());
  };

  const reset = () => {
    setPhase("idle");
    setMessage("");
    setValue("");
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const editEmail = () => {
    setPhase("idle");
    setValue(submitted);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const formPhase = phase === "idle" || phase === "invalid";
  const dark = phase === "loading" || phase === "success" || phase === "already";
  const shellShadow =
    phase === "invalid"
      ? `inset 0 0 0 1px ${ROSE}99, 0 0 0 4px ${ROSE}14, 0 1px 2px rgba(20,20,19,0.05)`
      : phase === "error"
        ? `inset 0 0 0 1px ${ROSE}55, 0 0 0 0px ${ROSE}00, 0 1px 2px rgba(20,20,19,0.05)`
        : dark
          ? `inset 0 0 0 1px ${INK}, 0 0 0 0px rgba(20,20,19,0), 0 10px 30px -12px rgba(20,20,19,0.45)`
          : `inset 0 0 0 1px rgba(20,20,19,0.13), 0 0 0 0px rgba(20,20,19,0), 0 1px 2px rgba(20,20,19,0.05)`;
  const layoutT = reduce ? { duration: 0 } : { duration: 0.5, ease: EASE_IN_OUT };

  return (
    <footer className={`@container relative border-t border-[#141413]/10 bg-[#f4f2ed] text-[#141413] ${className}`}>
      <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center px-5 pb-8 pt-16 @2xl:px-10 @2xl:pt-24">
        <div className="flex w-full max-w-[560px] flex-col items-center text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#141413]/50">{kicker}</p>
          <h2 className="mt-5 text-balance font-serif text-[clamp(2.5rem,1.7rem+3.2vw,3.9rem)] leading-[0.98] tracking-[-0.02em]">{title}</h2>
          <p className="mt-5 max-w-[46ch] text-pretty text-[16px] leading-[1.6] text-[#141413]/65">{body}</p>

          {/* The capture */}
          <form noValidate onSubmit={submit} className="mt-9 flex w-full flex-col items-center" aria-describedby={`${id}-msg`}>
            <div ref={scope} className="flex w-full justify-center">
              <motion.div
                layout
                transition={{ layout: layoutT }}
                style={{ borderRadius: 28 }}
                initial={false}
                animate={{ backgroundColor: dark ? INK : "#ffffff", boxShadow: shellShadow }}
                className={`group/shell relative flex min-h-14 items-center overflow-hidden ${formPhase || phase === "loading" ? "h-14" : ""} ${
                  formPhase ? "w-full max-w-[460px]" : phase === "loading" ? "w-14" : "w-auto max-w-full"
                } ${phase === "idle" ? "focus-within:shadow-[inset_0_0_0_1px_rgba(20,20,19,0.32),0_0_0_4px_rgba(20,20,19,0.07)]!" : ""}`}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  {formPhase ? (
                    <motion.div
                      key="form"
                      layout="position"
                      className="flex h-full w-full items-center gap-2 py-1.5 pl-5 pr-1.5"
                      initial={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(4px)" }}
                      animate={{ opacity: 1, filter: "blur(0px)" }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(4px)", transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
                      transition={{ duration: 0.3, ease: EASE }}
                    >
                      <label htmlFor={`${id}-email`} className="sr-only">
                        Email address
                      </label>
                      <input
                        ref={inputRef}
                        id={`${id}-email`}
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        spellCheck={false}
                        value={value}
                        placeholder={placeholder}
                        aria-invalid={phase === "invalid"}
                        aria-describedby={`${id}-msg`}
                        onChange={(e) => {
                          setValue(e.target.value);
                          if (phase === "invalid") {
                            setPhase("idle");
                            setMessage("");
                          }
                        }}
                        className="h-full min-w-0 flex-1 bg-transparent text-[16px] tracking-[-0.005em] text-[#141413] caret-[#141413] outline-none placeholder:text-[#141413]/35"
                      />
                      <button
                        type="submit"
                        disabled={!value.trim()}
                        className="group/btn inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-[#141413] px-5 text-[14px] font-medium text-[#f4f2ed] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(20,20,19,0.3)] transition-[background-color,opacity,scale] duration-150 enabled:hover:bg-[#2b2b29] enabled:active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141413] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {buttonLabel}
                        <svg viewBox="0 0 16 16" fill="none" className="size-3.5 transition-transform duration-150 group-enabled/btn:group-hover/btn:translate-x-0.5" aria-hidden="true">
                          <path d="M3 8h10m0 0L8.5 3.5M13 8l-4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </motion.div>
                  ) : phase === "loading" ? (
                    <motion.div
                      key="loading"
                      layout
                      className="absolute inset-0 flex items-center justify-center"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, transition: { delay: reduce ? 0 : 0.32, duration: 0.2 } }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                    >
                      <Spinner reduce={reduce} />
                    </motion.div>
                  ) : phase === "error" ? (
                    <motion.div
                      key="error"
                      layout="position"
                      className="flex h-full items-center gap-3 whitespace-nowrap py-1.5 pl-5 pr-1.5"
                      initial={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(4px)" }}
                      animate={{ opacity: 1, filter: "blur(0px)", transition: { delay: reduce ? 0 : 0.2, duration: 0.3, ease: EASE } }}
                      exit={{ opacity: 0, transition: { duration: 0.14 } }}
                    >
                      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{ background: ROSE }} />
                      <span className="truncate text-[14.5px] text-[#141413]/80">{errorText}</span>
                      <button
                        ref={retryRef}
                        type="button"
                        onClick={() => send(submitted)}
                        className="group/retry inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-[#141413] px-4 text-[14px] font-medium text-[#f4f2ed] transition-[background-color,scale] duration-150 hover:bg-[#2b2b29] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141413] active:scale-[0.97]"
                      >
                        <svg viewBox="0 0 16 16" fill="none" className="size-3.5 transition-transform duration-300 group-hover/retry:-rotate-90" aria-hidden="true">
                          <path d="M13 8a5 5 0 1 1-1.6-3.7M13 2.8v2.6h-2.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Retry
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="done"
                      layout="position"
                      className="flex min-h-14 items-center gap-3 py-2 pl-2 pr-6"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.14 } }}
                    >
                      <CheckBadge reduce={reduce} />
                      <MorphText text={phase === "already" ? alreadyText : successText} reduce={reduce} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>

            {/* Message line: errors, suggestions, status. Always reserves its height. */}
            <div ref={msgRef} tabIndex={-1} id={`${id}-msg`} aria-live="polite" className="mt-3 outline-none flex min-h-11 w-full items-start justify-center text-[13.5px]">
              <AnimatePresence mode="popLayout" initial={false}>
                {phase === "invalid" ? (
                  <Line key={`inv-${message}`} reduce={reduce} className="pt-1 font-medium" style={{ color: ROSE }}>
                    {message}
                  </Line>
                ) : fix ? (
                  <Line key="fix" reduce={reduce}>
                    <button
                      type="button"
                      onClick={() => {
                        setValue(fix);
                        inputRef.current?.focus();
                      }}
                      className="inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 text-[#141413]/65 transition-[color] duration-150 hover:text-[#141413] focus-visible:outline-2 focus-visible:outline-[#141413] active:translate-y-px"
                    >
                      <span>
                        Did you mean <span className="font-medium text-[#141413] underline decoration-[#141413]/25 underline-offset-[3px]">{fix}</span>?
                      </span>
                    </button>
                  </Line>
                ) : phase === "loading" ? (
                  <Line key="loading" reduce={reduce} className="pt-1 text-[#141413]/50">
                    Adding {submitted}…
                  </Line>
                ) : phase === "error" ? (
                  <Line key="error" reduce={reduce} className="text-[#141413]/55">
                    Nothing was saved.{" "}
                    <button
                      type="button"
                      onClick={editEmail}
                      className="inline-flex min-h-8 items-center rounded-md px-1 font-medium text-[#141413] underline decoration-[#141413]/25 underline-offset-[3px] transition-[text-decoration-color] duration-150 hover:decoration-[#141413] focus-visible:outline-2 focus-visible:outline-[#141413] active:translate-y-px"
                    >
                      Edit the address
                    </button>
                  </Line>
                ) : phase === "success" || phase === "already" ? (
                  <Line key="done" reduce={reduce} className="text-[#141413]/55" delay={0.35}>
                    {submitted ? <span className="hidden @md:inline">Sent to {submitted}. </span> : null}
                    <button
                      type="button"
                      onClick={reset}
                      className="inline-flex min-h-8 items-center rounded-md px-1 font-medium text-[#141413] underline decoration-[#141413]/25 underline-offset-[3px] transition-[text-decoration-color] duration-150 hover:decoration-[#141413] focus-visible:outline-2 focus-visible:outline-[#141413] active:translate-y-px"
                    >
                      Use a different email
                    </button>
                  </Line>
                ) : (
                  <Line key="note" reduce={reduce} className="pt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#141413]/45">
                    {note}
                  </Line>
                )}
              </AnimatePresence>
            </div>
          </form>
        </div>

        {/* Slim bottom row */}
        <div className="mt-14 flex w-full flex-col items-center gap-3 border-t border-[#141413]/10 pt-6 @4xl:mt-20 @4xl:flex-row @4xl:justify-between">
          <ul className="group/soc flex flex-wrap items-center justify-center gap-x-1">
            {socials.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  target={s.external ? "_blank" : undefined}
                  rel={s.external ? "noreferrer" : undefined}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2.5 text-[13.5px] text-[#141413]/65 transition-[color] duration-150 group-has-[a:hover]/soc:text-[#141413]/40 hover:text-[#141413]! focus-visible:text-[#141413]! focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[#141413] active:translate-y-px @4xl:min-h-9"
                >
                  {s.label === "RSS" ? (
                    <svg viewBox="0 0 16 16" fill="none" className="size-3" aria-hidden="true">
                      <circle cx="3.5" cy="12.5" r="1.5" fill="currentColor" />
                      <path d="M2 7.2a6.8 6.8 0 0 1 6.8 6.8M2 2.2A11.8 11.8 0 0 1 13.8 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  ) : null}
                  {s.label}
                  {s.external ? (
                    <>
                      <span aria-hidden="true" className="text-[10px] opacity-55">
                        ↗
                      </span>
                      <span className="sr-only">(opens in a new tab)</span>
                    </>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex flex-col items-center gap-1 text-center text-[12.5px] text-[#141413]/50 @lg:flex-row @lg:gap-4">
            <span>{legal}</span>
            <span className="flex">
              {legalLinks.map((l) => (
                <a
                  key={l.label}
                  href={l.href}
                  className="inline-flex min-h-11 items-center rounded-md px-2 transition-[color] duration-150 hover:text-[#141413] focus-visible:outline-2 focus-visible:outline-[#141413] active:translate-y-px @4xl:min-h-9"
                >
                  {l.label}
                </a>
              ))}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */

function Line({
  children,
  reduce,
  className = "",
  style,
  delay = 0,
}: {
  children: ReactNode;
  reduce: boolean;
  className?: string;
  style?: CSSProperties;
  delay?: number;
}) {
  return (
    <motion.p
      className={`text-pretty ${className}`}
      style={style}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(3px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.3, ease: EASE, delay: reduce ? 0 : delay } }}
      exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: -4, filter: "blur(3px)", transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } }}
    >
      {children}
    </motion.p>
  );
}

/** Words arrive one after another, each sharpening out of a small blur. */
function MorphText({ text, reduce }: { text: string; reduce: boolean }) {
  const words = text.split(" ");
  return (
    <span className="relative block text-left text-[15px] font-medium leading-[1.35] tracking-[-0.01em] text-[#f4f2ed]" aria-label={text}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={text} className="block" aria-hidden="true">
          {words.map((w, i) => (
            <motion.span
              key={`${w}-${i}`}
              className="inline-block"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 5, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(4px)", transition: { duration: 0.15 } }}
              transition={{ duration: 0.36, ease: EASE, delay: reduce ? 0 : 0.28 + i * 0.035 }}
            >
              {w}
              {i < words.length - 1 ? " " : ""}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function CheckBadge({ reduce }: { reduce: boolean }) {
  return (
    <motion.span
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f4f2ed] text-[#141413]"
      initial={reduce ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 32, delay: reduce ? 0 : 0.05 }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 16 16" fill="none" className="size-4">
        <motion.path
          d="M3.5 8.4 6.6 11.3 12.5 4.9"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.38, ease: EASE, delay: reduce ? 0 : 0.16 }}
        />
      </svg>
    </motion.span>
  );
}

function Spinner({ reduce }: { reduce: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`size-5 text-[#f4f2ed] ${reduce ? "" : "animate-spin"}`} style={{ animationDuration: "0.8s" }} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Demo: a pretend backend. ada@… is already subscribed, anything with
 * "fail" in it rejects, everything else succeeds after 1.2s.
 */
export default function FooterNewsletterDemo() {
  const fake = (email: string) =>
    new Promise<SubscribeResult>((resolve, reject) =>
      setTimeout(() => {
        if (email.includes("fail")) reject(new Error("503"));
        else resolve(email.startsWith("ada@") ? "already-subscribed" : "subscribed");
      }, 1200),
    );
  return (
    <div className="flex min-h-dvh flex-col justify-between bg-[#ebe8e1]">
      <p className="px-5 pt-8 text-center font-mono text-[10.5px] uppercase leading-relaxed tracking-[0.14em] text-[#141413]/40">
        Try ada@pressroom.co (already in) · you@fail.com (error) · sam@gmial.com (typo)
      </p>
      <FooterNewsletter onSubscribe={fake} />
    </div>
  );
}
