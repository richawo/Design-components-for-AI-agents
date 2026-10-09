"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useAnimate,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
  type Variants,
} from "motion/react";

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
  /** Small line under the form. `{readers}` is replaced by `readers`, which counts up on reveal. */
  note?: string;
  readers?: number;
  socials?: FooterNewsletterLink[];
  legal?: string;
  legalLinks?: FooterNewsletterLink[];
  /** Near-black (default) or warm paper. */
  theme?: "dark" | "light";
  className?: string;
};

type Phase = "idle" | "invalid" | "loading" | "success" | "already" | "error";

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

/**
 * Both themes in one place. `rgb` channels feed the shell's animated shadows
 * (motion can't tween CSS variables inside a box-shadow). The "solid" state
 * (loading, success) is simply the ink colour, so the field inverts.
 */
const PALETTE = {
  dark: { bg: "#0a0a0a", ink: "#f4f4f2", field: "#141414", inkRgb: "244 244 242", solidHover: "#dcdcd8", rose: "#f97066", shadow: "0 0 0 / 0.5" },
  light: { bg: "#f4f2ed", ink: "#141413", field: "#ffffff", inkRgb: "20 20 19", solidHover: "#2b2b29", rose: "#b42318", shadow: "20 20 19 / 0.12" },
} as const;

const EASE = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;
const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

/**
 * Entrance timeline, in seconds from the moment the footer is revealed.
 * Rules draw first, then the copy in reading order, then the field, and the
 * reader count only once its line has landed. The bottom row lands last.
 */
const T = {
  rule: 0,
  kicker: 0.06,
  title: 0.12,
  word: 0.035,
  body: 0.3,
  field: 0.38,
  note: 0.46,
  count: 0.62,
  countDur: 0.7,
  bottom: 0.5,
  social: 0.06,
  socialStep: 0.04,
  legal: 0.24,
  dur: 0.6,
  drawDur: 0.8,
} as const;

/** Share of a block that must be on screen before it reveals. */
const REVEAL_AMOUNT = 0.25;
/** Loading holds at least this long, so the spinner never flickers. */
const MIN_LOADING_MS = 700;
const SHAKE = [0, -7, 6, -4, 2, 0];

const reveal: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(8px)" },
  show: (delay: number) => ({ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: T.dur, ease: EASE, delay }, transitionEnd: { filter: "none" } }),
};
/** Hairlines draw outward from the centre, like the column they frame. */
const drawX: Variants = {
  hidden: { scaleX: 0 },
  show: (delay: number) => ({ scaleX: 1, transition: { duration: T.drawDur, ease: EASE, delay } }),
};
/** Reduced motion: one short fade, no transforms, blur or stagger. */
const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
};

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

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--fn-ink)";
const TEXT_BUTTON = `inline-flex min-h-8 items-center rounded-md px-1 font-medium text-(--fn-ink) underline decoration-(--fn-ink)/25 underline-offset-[3px] transition-[text-decoration-color] duration-150 hover:decoration-(--fn-ink) active:translate-y-px ${FOCUS}`;
const SOLID_BUTTON = `inline-flex h-11 shrink-0 items-center rounded-full bg-(--fn-ink) text-[14px] font-medium text-(--fn-bg) transition-[background-color,opacity,scale] duration-150 ${FOCUS}`;

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

/**
 * Scroll reveal for one block. A block waits until a quarter of it is on
 * screen, but never runs ahead of its slot in the shared timeline: blocks that
 * arrive together play in order, and one scrolled to later starts at once
 * instead of waiting out its slot. Returns the block's delay, or null while hidden.
 */
function useReveal(ref: RefObject<Element | null>, slot: number, clock: RefObject<number | null>) {
  const inView = useInView(ref, { once: true, amount: REVEAL_AMOUNT });
  const [start, setStart] = useState<number | null>(null);
  useEffect(() => {
    if (!inView) return;
    const now = performance.now() / 1000;
    clock.current ??= now;
    setStart(Math.max(0, slot - (now - clock.current)));
  }, [inView, slot, clock]);
  return start;
}

/** A number that counts up from zero once, after `delay`. Owned here so remounting its line never recounts. */
function useCountUp(value: number, delay: number | null, reduce: boolean) {
  const mv = useMotionValue(0);
  useEffect(() => {
    if (delay === null) return;
    if (reduce) {
      mv.jump(value);
      return;
    }
    const controls = animate(mv, value, { duration: T.countDur, delay, ease: EASE });
    return () => controls.stop();
  }, [delay, value, reduce, mv]);
  return mv;
}

/** setTimeout as a promise, cleared on unmount so a late reply never lands in a dead component. */
function useSleep() {
  const timers = useRef(new Set<number>());
  useEffect(() => {
    const live = timers.current;
    return () => live.forEach((t) => window.clearTimeout(t));
  }, []);
  return useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        const t = window.setTimeout(() => {
          timers.current.delete(t);
          resolve();
        }, ms);
        timers.current.add(t);
      }),
    [],
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function FooterNewsletter({
  kicker = "The Thursday Letter · Issue 112",
  title = "One good email, every Thursday.",
  body = "Field notes on making software people keep. Four minutes to read, no tracking pixels, one‑click unsubscribe.",
  placeholder = "you@work.com",
  buttonLabel = "Subscribe",
  onSubscribe,
  alreadySubscribed = false,
  successText = "You’re on the list. First issue Thursday.",
  alreadyText = "You’re already on the list. See you Thursday.",
  errorText = "Couldn’t reach our mail server.",
  note = "Join {readers} readers. Unsubscribe whenever.",
  readers = 4812,
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
  theme = "dark",
  className = "",
}: FooterNewsletterProps) {
  const reduce = !!useReducedMotion();
  const p = PALETTE[theme];
  const vars = {
    "--fn-bg": p.bg,
    "--fn-ink": p.ink,
    "--fn-field": p.field,
    "--fn-ink-rgb": p.inkRgb,
    "--fn-solid-hover": p.solidHover,
    "--fn-rose": p.rose,
  } as CSSProperties;

  const clock = useRef<number | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const captureAt = useReveal(captureRef, 0, clock);
  const bottomAt = useReveal(bottomRef, T.bottom, clock);
  const readersMv = useCountUp(readers, captureAt === null ? null : captureAt + T.count, reduce);

  const v = reduce ? fade : reveal;
  const draw = reduce ? fade : drawX;
  const at = (start: number | null, offset: number) => (start ?? 0) + offset;
  const words = title.split(" ");

  return (
    <footer style={vars} className={`@container relative bg-(--fn-bg) text-(--fn-ink) ${className}`}>
      <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center px-5 pb-8 pt-16 @2xl:px-10 @2xl:pt-24">
        <motion.div ref={captureRef} initial="hidden" animate={captureAt === null ? "hidden" : "show"} className="flex w-full max-w-[560px] flex-col items-center text-center">
          {/* The top rule spans the footer, not just the column. */}
          <motion.span aria-hidden="true" variants={draw} custom={at(captureAt, T.rule)} className="absolute inset-x-0 top-0 h-px bg-(--fn-ink)/10" />
          <motion.p variants={v} custom={at(captureAt, T.kicker)} className="font-mono text-[11px] uppercase tracking-[0.16em] text-(--fn-ink)/55">
            {kicker}
          </motion.p>
          <h2 className="mt-5 text-balance font-serif text-[clamp(2.5rem,1.7rem+3.2cqi,3.9rem)] leading-[0.98] tracking-[-0.02em]">
            <span className="sr-only">{title}</span>
            {/* Words stagger in, so the title reads as it arrives. */}
            <span aria-hidden="true">
              {words.map((w, i) => (
                <span key={`${w}-${i}`}>
                  <motion.span variants={v} custom={at(captureAt, T.title + i * T.word)} className="inline-block">
                    {w}
                  </motion.span>
                  {i < words.length - 1 ? " " : null}
                </span>
              ))}
            </span>
          </h2>
          <motion.p variants={v} custom={at(captureAt, T.body)} className="mt-5 max-w-[46ch] text-pretty text-[16px] leading-[1.6] text-(--fn-ink)/65">
            {body}
          </motion.p>
          <motion.div variants={v} custom={at(captureAt, T.field)} className="mt-9 w-full">
            <Capture
              palette={p}
              reduce={reduce}
              placeholder={placeholder}
              buttonLabel={buttonLabel}
              onSubscribe={onSubscribe}
              alreadySubscribed={alreadySubscribed}
              successText={successText}
              alreadyText={alreadyText}
              errorText={errorText}
              note={<Note template={note} count={readersMv} total={readers} />}
              noteVariants={v}
              noteDelay={at(captureAt, T.note)}
            />
          </motion.div>
        </motion.div>

        <BottomRow ref={bottomRef} start={bottomAt} reduce={reduce} socials={socials} legal={legal} legalLinks={legalLinks} />
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* The capture: one shell that morphs field → spinner → result         */
/* ------------------------------------------------------------------ */

type CaptureProps = Pick<
  FooterNewsletterProps,
  "placeholder" | "buttonLabel" | "onSubscribe" | "alreadySubscribed" | "successText" | "alreadyText" | "errorText"
> & {
  palette: (typeof PALETTE)[keyof typeof PALETTE];
  reduce: boolean;
  note: ReactNode;
  noteVariants: Variants;
  noteDelay: number;
};

function Capture({
  palette: p,
  reduce,
  placeholder,
  buttonLabel,
  onSubscribe,
  alreadySubscribed = false,
  successText = "",
  alreadyText = "",
  errorText = "",
  note,
  noteVariants,
  noteDelay,
}: CaptureProps) {
  const id = useId();
  const sleep = useSleep();
  const [phase, setPhase] = useState<Phase>(alreadySubscribed ? "already" : "idle");
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const msgRef = useRef<HTMLDivElement>(null);
  /** Set when the field should take focus as soon as it is back on screen. */
  const refocus = useRef(false);
  const [scope, animateShell] = useAnimate<HTMLDivElement>();

  useEffect(() => {
    if (alreadySubscribed) setPhase("already");
  }, [alreadySubscribed]);

  // Move focus to the control that replaces the one that just disappeared.
  useEffect(() => {
    if (phase === "error") retryRef.current?.focus({ preventScroll: true });
    // On success the field is gone: park focus on the (announced) message line, without a ring.
    if (phase === "success" || phase === "already") msgRef.current?.focus({ preventScroll: true });
    if (phase === "idle" && refocus.current) {
      refocus.current = false;
      inputRef.current?.focus();
    }
  }, [phase]);

  const fix = phase === "idle" || phase === "invalid" ? suggestion(value) : null;

  const send = async (email: string) => {
    setSubmitted(email);
    setPhase("loading");
    setMessage("");
    const started = performance.now();
    const hold = () => sleep(Math.max(0, MIN_LOADING_MS - (performance.now() - started)));
    try {
      const res = await (onSubscribe ? onSubscribe(email) : sleep(900));
      await hold();
      setPhase(res === "already-subscribed" ? "already" : "success");
    } catch {
      await hold();
      setPhase("error");
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (phase === "loading") return;
    const why = problem(value);
    if (!why) return void send(value.trim());
    setPhase("invalid");
    setMessage(why);
    if (!reduce && scope.current) animateShell(scope.current, { x: SHAKE }, { duration: 0.42, ease: "easeOut" });
    inputRef.current?.focus();
  };

  const backToField = (next: string) => {
    refocus.current = true;
    setValue(next);
    setMessage("");
    setPhase("idle");
  };

  const formPhase = phase === "idle" || phase === "invalid";
  const solid = phase === "loading" || phase === "success" || phase === "already";
  const ring = (a: number) => `rgb(${p.inkRgb} / ${a})`;
  const shellShadow =
    phase === "invalid"
      ? `inset 0 0 0 1px ${p.rose}99, 0 0 0 4px ${p.rose}1f, 0 1px 2px rgb(${p.shadow})`
      : phase === "error"
        ? `inset 0 0 0 1px ${p.rose}66, 0 0 0 0px ${p.rose}00, 0 1px 2px rgb(${p.shadow})`
        : solid
          ? `inset 0 0 0 1px ${p.ink}, 0 0 0 0px ${ring(0)}, 0 12px 32px -12px rgb(${p.shadow})`
          : `inset 0 0 0 1px ${ring(0.13)}, 0 0 0 0px ${ring(0)}, 0 1px 2px rgb(${p.shadow})`;
  const layoutT = reduce ? { duration: 0 } : { duration: 0.5, ease: EASE_IN_OUT };
  const swapIn = reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(4px)" };

  return (
    <form noValidate onSubmit={submit} className="flex w-full flex-col items-center" aria-describedby={`${id}-msg`}>
      <div ref={scope} className="flex w-full justify-center">
        <motion.div
          layout
          transition={{ layout: layoutT }}
          style={{ borderRadius: 28 }}
          initial={false}
          animate={{ backgroundColor: solid ? p.ink : p.field, boxShadow: shellShadow }}
          className={`relative flex min-h-14 items-center overflow-hidden ${formPhase || phase === "loading" ? "h-14" : ""} ${
            formPhase ? "w-full max-w-[460px]" : phase === "loading" ? "w-14" : "w-auto max-w-full"
          } ${phase === "idle" ? "focus-within:shadow-[inset_0_0_0_1px_rgb(var(--fn-ink-rgb)/0.34),0_0_0_4px_rgb(var(--fn-ink-rgb)/0.08)]!" : ""}`}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {formPhase ? (
              <motion.div
                key="form"
                layout="position"
                className="flex h-full w-full items-center gap-2 py-1.5 pl-5 pr-1.5"
                initial={swapIn}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(4px)", transition: { duration: 0.18, ease: EASE_IN } }}
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
                  className="h-full min-w-0 flex-1 bg-transparent text-[16px] tracking-[-0.005em] text-(--fn-ink) caret-(--fn-ink) outline-none placeholder:text-(--fn-ink)/35"
                />
                <button
                  type="submit"
                  disabled={!value.trim()}
                  className={`group/btn gap-2 px-5 enabled:hover:bg-(--fn-solid-hover) enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ${SOLID_BUTTON}`}
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
                // The spinner waits until the pill has finished shrinking to a circle.
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
                initial={swapIn}
                animate={{ opacity: 1, filter: "blur(0px)", transition: { delay: reduce ? 0 : 0.2, duration: 0.3, ease: EASE } }}
                exit={{ opacity: 0, transition: { duration: 0.14 } }}
              >
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-(--fn-rose)" />
                <span className="truncate text-[14.5px] text-(--fn-ink)/80">{errorText}</span>
                <button
                  ref={retryRef}
                  type="button"
                  onClick={() => send(submitted)}
                  className={`group/retry gap-1.5 px-4 hover:bg-(--fn-solid-hover) active:scale-[0.97] ${SOLID_BUTTON}`}
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
      <div ref={msgRef} tabIndex={-1} id={`${id}-msg`} aria-live="polite" className="mt-3 flex min-h-11 w-full items-start justify-center text-[13.5px] outline-none">
        <AnimatePresence mode="popLayout" initial={false}>
          {phase === "invalid" ? (
            <Line key={`inv-${message}`} reduce={reduce} className="pt-1 font-medium text-(--fn-rose)">
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
                className={`inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 text-(--fn-ink)/65 transition-[color] duration-150 hover:text-(--fn-ink) active:translate-y-px ${FOCUS}`}
              >
                <span>
                  Did you mean <span className="font-medium text-(--fn-ink) underline decoration-(--fn-ink)/25 underline-offset-[3px]">{fix}</span>?
                </span>
              </button>
            </Line>
          ) : phase === "loading" ? (
            <Line key="loading" reduce={reduce} className="pt-1 text-(--fn-ink)/55">
              Adding {submitted}…
            </Line>
          ) : phase === "error" ? (
            <Line key="error" reduce={reduce} className="text-(--fn-ink)/60">
              Nothing was saved.{" "}
              <button type="button" onClick={() => backToField(submitted)} className={TEXT_BUTTON}>
                Edit the address
              </button>
            </Line>
          ) : phase === "success" || phase === "already" ? (
            <Line key="done" reduce={reduce} className="text-(--fn-ink)/60" delay={0.35}>
              {submitted ? <span className="hidden @md:inline">Sent to {submitted}. </span> : null}
              <button type="button" onClick={() => backToField("")} className={TEXT_BUTTON}>
                Use a different email
              </button>
            </Line>
          ) : (
            // The note is the only line that also takes part in the footer's entrance.
            <motion.p
              key="note"
              variants={noteVariants}
              custom={noteDelay}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              className="pt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-(--fn-ink)/50"
            >
              {note}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Parts                                                               */
/* ------------------------------------------------------------------ */

const fmtCount = new Intl.NumberFormat("en-US");

/** The note with its reader count, which sharpens out of a light blur as it counts up to `total`. */
function Note({ template, count, total }: { template: string; count: MotionValue<number>; total: number }) {
  const text = useTransform(count, (n) => fmtCount.format(Math.round(n)));
  const filter = useTransform(count, (n) => `blur(${(1 - Math.min(1, n / Math.max(1, total))) * 3}px)`);
  const [before, after] = template.includes("{readers}") ? template.split("{readers}") : [template, null];
  return (
    <>
      {before}
      {after !== null ? (
        <>
          <motion.span className="inline-block tabular-nums" style={{ filter }}>
            {text}
          </motion.span>
          {after}
        </>
      ) : null}
    </>
  );
}

function BottomRow({
  ref,
  start,
  reduce,
  socials,
  legal,
  legalLinks,
}: {
  ref: RefObject<HTMLDivElement | null>;
  start: number | null;
  reduce: boolean;
  socials: FooterNewsletterLink[];
  legal: string;
  legalLinks: FooterNewsletterLink[];
}) {
  const v = reduce ? fade : reveal;
  const at = (offset: number) => (start ?? 0) + offset;
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={start === null ? "hidden" : "show"}
      className="relative mt-14 flex w-full flex-col items-center gap-3 pt-6 @4xl:mt-20 @4xl:flex-row @4xl:justify-between"
    >
      <motion.span aria-hidden="true" variants={reduce ? fade : drawX} custom={at(0)} className="absolute inset-x-0 top-0 h-px bg-(--fn-ink)/10" />
      <ul className="group/soc flex flex-wrap items-center justify-center gap-x-1">
        {socials.map((s, i) => (
          <motion.li key={s.label} variants={v} custom={at(T.social + i * T.socialStep)}>
            <a
              href={s.href}
              target={s.external ? "_blank" : undefined}
              rel={s.external ? "noreferrer" : undefined}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2.5 text-[13.5px] text-(--fn-ink)/65 transition-[color] duration-150 group-has-[a:hover]/soc:text-(--fn-ink)/40 hover:text-(--fn-ink)! focus-visible:text-(--fn-ink)! focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-(--fn-ink) active:translate-y-px @4xl:min-h-9"
            >
              {s.label === "RSS" ? <RssIcon /> : null}
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
          </motion.li>
        ))}
      </ul>
      <motion.div variants={v} custom={at(T.legal)} className="flex flex-col items-center gap-1 text-center text-[12.5px] text-(--fn-ink)/55 @lg:flex-row @lg:gap-4">
        <span>{legal}</span>
        <span className="flex">
          {legalLinks.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className={`inline-flex min-h-11 items-center rounded-md px-2 transition-[color] duration-150 hover:text-(--fn-ink) active:translate-y-px @4xl:min-h-9 ${FOCUS}`}
            >
              {l.label}
            </a>
          ))}
        </span>
      </motion.div>
    </motion.div>
  );
}

function Line({ children, reduce, className = "", delay = 0 }: { children: ReactNode; reduce: boolean; className?: string; delay?: number }) {
  return (
    <motion.p
      className={`text-pretty ${className}`}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(3px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.3, ease: EASE, delay: reduce ? 0 : delay } }}
      exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: -4, filter: "blur(3px)", transition: { duration: 0.16, ease: EASE_IN } }}
    >
      {children}
    </motion.p>
  );
}

/** Words arrive one after another, each sharpening out of a small blur. */
function MorphText({ text, reduce }: { text: string; reduce: boolean }) {
  const words = text.split(" ");
  return (
    <span className="relative block text-left text-[15px] font-medium leading-[1.35] tracking-[-0.01em] text-(--fn-bg)" aria-label={text}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={text} className="block" aria-hidden="true">
          {words.map((w, i) => (
            // The space sits outside the inline-block: trailing spaces inside one collapse away.
            <span key={`${w}-${i}`}>
              <motion.span
                className="inline-block"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 5, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, filter: "blur(4px)", transition: { duration: 0.15 } }}
                transition={{ duration: 0.36, ease: EASE, delay: reduce ? 0 : 0.28 + i * 0.035 }}
              >
                {w}
              </motion.span>
              {i < words.length - 1 ? " " : null}
            </span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function CheckBadge({ reduce }: { reduce: boolean }) {
  return (
    <motion.span
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-(--fn-bg) text-(--fn-ink)"
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
    <svg viewBox="0 0 24 24" fill="none" className={`size-5 text-(--fn-bg) ${reduce ? "" : "animate-spin [animation-duration:0.8s]"}`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function RssIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-3" aria-hidden="true">
      <circle cx="3.5" cy="12.5" r="1.5" fill="currentColor" />
      <path d="M2 7.2a6.8 6.8 0 0 1 6.8 6.8M2 2.2A11.8 11.8 0 0 1 13.8 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                */
/* ------------------------------------------------------------------ */

const DEMO_LATENCY_MS = 1200;
const STAGE = { dark: "#000000", light: "#ebe8e1" } as const;

/**
 * Demo: a pretend backend (ada@… is already subscribed, anything with "fail"
 * in it rejects, everything else succeeds) and a theme switch, above the
 * footer at the foot of the page.
 */
export default function FooterNewsletterDemo() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const sleep = useSleep();
  const fake = async (email: string): Promise<SubscribeResult> => {
    await sleep(DEMO_LATENCY_MS);
    if (email.includes("fail")) throw new Error("503");
    return email.startsWith("ada@") ? "already-subscribed" : "subscribed";
  };
  const ink = PALETTE[theme].ink;

  return (
    <div className="flex min-h-dvh flex-col justify-between transition-colors duration-300" style={{ background: STAGE[theme], color: ink }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-4 px-5 pb-12 pt-8 text-center font-mono text-[10.5px] uppercase leading-relaxed tracking-[0.14em]"
      >
        <div role="radiogroup" aria-label="Theme" className="flex rounded-full p-0.5" style={{ boxShadow: `inset 0 0 0 1px rgb(${PALETTE[theme].inkRgb} / 0.14)` }}>
          {(["dark", "light"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={theme === t}
              onClick={() => setTheme(t)}
              className="relative h-8 rounded-full px-3.5 uppercase tracking-[0.14em] transition-opacity duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-px"
              style={{ opacity: theme === t ? 0.9 : 0.5, outlineColor: ink }}
            >
              {theme === t ? (
                <motion.span
                  layoutId="fn-demo-theme"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  className="absolute inset-0 rounded-full"
                  style={{ background: `rgb(${PALETTE[theme].inkRgb} / 0.08)` }}
                />
              ) : null}
              <span className="relative">{t}</span>
            </button>
          ))}
        </div>
        <p className="opacity-45">Try ada@pressroom.co (already in) · you@fail.com (error) · sam@gmial.com (typo)</p>
      </motion.div>
      <FooterNewsletter onSubscribe={fake} theme={theme} />
    </div>
  );
}
