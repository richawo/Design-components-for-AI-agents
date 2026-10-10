"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from "motion/react";
import { Mail } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type FloatingLabelFieldState = "default" | "error" | "success" | "disabled";
export type FloatingLabelFieldSize = "md" | "lg";
export type FloatingLabelFieldTheme = "dark" | "light";

export type FloatingLabelFieldProps = {
  /** Resting label. It rises onto the top hairline when the field is focused or filled. */
  label?: string;
  /** Helper text under the field, shown in the resting, focused and filled states. */
  helper?: string;
  /** Replaces the helper once the typed value has rested as an invalid email. */
  errorText?: string;
  /** Replaces the helper once the value is a valid email. */
  successText?: string;
  /** Forces a state. Leave it unset and the field follows what is typed. */
  state?: FloatingLabelFieldState;
  /** Shows the limit at rest, then the live count from 80% of it. */
  counter?: boolean;
  /** Longest value the field accepts. The input stops at this length. */
  maxLength?: number;
  /** Shows the mail glyph in the leading slot. */
  prefix?: boolean;
  /** Trailing slot, for a unit or a short action. The success tick takes it over while valid. */
  suffix?: ReactNode;
  size?: FloatingLabelFieldSize;
  theme?: FloatingLabelFieldTheme;
  /** Value on first render. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

type Tone = {
  surface: string;
  ink: string;
  line: string;
  lineHover: string;
  lineFocus: string;
  muted: string;
  icon: string;
  error: string;
  success: string;
  ring: string;
};

const TONES: Record<FloatingLabelFieldTheme, Tone> = {
  dark: {
    surface: "#0b0b0c",
    ink: "#f4f4f5",
    line: "rgba(244,244,245,0.14)",
    lineHover: "rgba(244,244,245,0.3)",
    lineFocus: "rgba(244,244,245,0.9)",
    muted: "rgba(244,244,245,0.58)",
    icon: "rgba(244,244,245,0.42)",
    error: "#f0937a",
    success: "#8fd7a6",
    ring: "rgba(244,244,245,0.26)",
  },
  light: {
    surface: "#ffffff",
    ink: "#111113",
    line: "rgba(17,17,19,0.14)",
    lineHover: "rgba(17,17,19,0.3)",
    lineFocus: "rgba(17,17,19,0.9)",
    muted: "rgba(17,17,19,0.6)",
    icon: "rgba(17,17,19,0.45)",
    error: "#b3432a",
    success: "#2c7a45",
    ring: "rgba(17,17,19,0.22)",
  },
};

const SIZES: Record<FloatingLabelFieldSize, { height: number; pad: number; text: number; label: number }> = {
  md: { height: 56, pad: 16, text: 16, label: 15 },
  lg: { height: 64, pad: 18, text: 18, label: 17 },
};

/** Ease-out for every arrival: the label, the notch and the messages. */
const EASE = [0.22, 1, 0.36, 1] as const;
/** Seconds for the label to rise and the notch to open. */
const RISE_S = 0.32;
/** Line box of the label, in px. Used to centre it vertically at rest and on the line when floated. */
const LABEL_BOX = 20;
/** Resting label size relative to its floated size. The label scales rather than re-laying out. */
const FLOAT_SCALE = 0.76;
/** Space between the label and the edge of the cut. Kept above the corner radius so the cut never reaches a corner. */
const NOTCH_GAP = 4;
/** Width reserved for the leading icon: 16px glyph plus a 10px gap. */
const PREFIX_SLOT = 26;
/** Width reserved for the trailing slot. */
const SUFFIX_SLOT = 26;
/** How long a typed value must rest before an invalid address is called out. */
const IDLE_MS = 800;
/** Share of the limit at which the counter switches from the limit to the live count. */
const COUNTER_NEAR = 0.8;
/** Deliberately simple: a local part, an @, a domain and a top-level domain of two or more letters. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

/**
 * Styles that need selectors or pseudo-classes, which inline styles cannot express.
 * The notch is a mask on the border: the top hairline is split at --fl-nl and --fl-nr,
 * which are written imperatively while the label moves. Until the first write the
 * fallbacks give a closed, unbroken border.
 */
const FIELD_CSS = `
.fl-field { position: relative; width: 100%; border-radius: 12px; }
.fl-field:focus-within { outline: 2px solid var(--fl-ring); outline-offset: 3px; }
.fl-surface { position: absolute; inset: 0; border-radius: 12px; background: var(--fl-surface); }
.fl-border {
  position: absolute; inset: 0; border-radius: 12px;
  box-shadow: inset 0 0 0 1px var(--fl-line);
  transition: box-shadow 180ms ease-out;
  -webkit-mask:
    linear-gradient(#000 0 0) 0 0 / var(--fl-nl, 100%) 2px no-repeat,
    linear-gradient(#000 0 0) var(--fl-nr, 100%) 0 / calc(100% - var(--fl-nr, 100%)) 2px no-repeat,
    linear-gradient(#000 0 0) 0 2px / 100% calc(100% - 2px) no-repeat;
          mask:
    linear-gradient(#000 0 0) 0 0 / var(--fl-nl, 100%) 2px no-repeat,
    linear-gradient(#000 0 0) var(--fl-nr, 100%) 0 / calc(100% - var(--fl-nr, 100%)) 2px no-repeat,
    linear-gradient(#000 0 0) 0 2px / 100% calc(100% - 2px) no-repeat;
}
.fl-field:hover .fl-border { box-shadow: inset 0 0 0 1px var(--fl-line-hover); }
.fl-field:focus-within .fl-border { box-shadow: inset 0 0 0 1px var(--fl-line-focus); }
.fl-root[data-state="error"] .fl-border { box-shadow: inset 0 0 0 1px var(--fl-error); }
.fl-root[data-state="success"] .fl-border { box-shadow: inset 0 0 0 1px var(--fl-success); }
.fl-root[data-state="disabled"] .fl-field { opacity: 0.42; cursor: not-allowed; }
.fl-root[data-state="disabled"] .fl-border { box-shadow: inset 0 0 0 1px var(--fl-line); }
@media (prefers-reduced-motion: reduce) { .fl-border { transition: none; } }
`;

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

/** A tick that draws itself in once the value is valid. Drawn, not faded, so the arrival reads as a confirmation. */
function SuccessTick({ color, reduce }: { color: string; reduce: boolean }) {
  return (
    <motion.svg
      aria-hidden="true"
      width={18}
      height={18}
      viewBox="0 0 18 18"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ opacity: 0, scale: reduce ? 1 : 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.24, ease: EASE }}
    >
      <motion.path
        d="M3.8 9.4 7.3 12.8 14.2 5.6"
        initial={{ pathLength: reduce ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.42, ease: EASE, delay: reduce ? 0 : 0.1 }}
      />
    </motion.svg>
  );
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function FloatingLabelField({
  label = "Work email",
  helper = "We’ll send receipts and invoices here.",
  errorText = "Add a domain, like ana@studio.co",
  successText = "Looks good. Receipts go here.",
  state,
  counter = true,
  maxLength = 40,
  prefix = true,
  suffix,
  size = "md",
  theme = "dark",
  defaultValue = "",
  onValueChange,
  className,
}: FloatingLabelFieldProps) {
  const id = useId();
  const inputId = `${id}-input`;
  const messageId = `${id}-message`;
  const reduce = useReducedMotion() ?? false;
  const tone = TONES[theme];
  const dims = SIZES[size];

  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { once: true, amount: 0.3 });
  const fieldRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLLabelElement>(null);

  const [value, setValue] = useState(defaultValue);
  const [focused, setFocused] = useState(false);
  /** An invalid value is only called out once it has rested or the field has been left. */
  const [touched, setTouched] = useState(false);
  const [labelWidth, setLabelWidth] = useState(0);

  const valid = EMAIL.test(value.trim());
  const auto: FloatingLabelFieldState = !value ? "default" : valid ? "success" : touched ? "error" : "default";
  const resolved = state ?? auto;
  const disabled = resolved === "disabled";
  const floated = focused || value.length > 0;

  const labelX = dims.pad + (prefix ? PREFIX_SLOT : 0);
  const showSuffix = resolved === "success" || Boolean(suffix);
  const inputPadRight = dims.pad + (showSuffix ? SUFFIX_SLOT : 0);
  const near = value.length >= maxLength * COUNTER_NEAR;
  const message =
    resolved === "error"
      ? { kind: "error", text: errorText, color: tone.error }
      : resolved === "success"
        ? { kind: "success", text: successText, color: tone.success }
        : { kind: "helper", text: helper, color: tone.muted };

  // Call out an invalid address only after the typing pauses, so the error never flickers in mid-word.
  useEffect(() => {
    if (!value || valid) return;
    const timer = window.setTimeout(() => setTouched(true), IDLE_MS);
    return () => window.clearTimeout(timer);
  }, [value, valid]);

  // The notch is cut to the label's real width, so measure it and follow it when the text changes.
  useLayoutEffect(() => {
    const el = labelRef.current;
    if (!el) return;
    const measure = () => setLabelWidth(el.offsetWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [label]);

  // The notch opens from the label's own start and closes back to a point. It is written straight to the
  // element's CSS variables so the 60 fps move never re-renders React.
  const notch = useRef({ start: labelX, end: labelX });
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const open = floated && labelWidth > 0;
    const target = open
      ? { start: labelX - NOTCH_GAP, end: labelX + labelWidth * FLOAT_SCALE + NOTCH_GAP }
      : { start: labelX, end: labelX };
    const paint = (start: number, end: number) => {
      el.style.setProperty("--fl-nl", `${start}px`);
      el.style.setProperty("--fl-nr", `${end}px`);
    };
    const current = notch.current;
    paint(current.start, current.end);
    if (reduce) {
      notch.current = target;
      paint(target.start, target.end);
      return;
    }
    // Both edges animate from wherever the notch is now, so a reversed focus turns mid-flight.
    const startAnim = animate(current.start, target.start, {
      duration: RISE_S,
      ease: EASE,
      onUpdate: (v) => {
        notch.current = { ...notch.current, start: v };
        paint(v, notch.current.end);
      },
    });
    const endAnim = animate(current.end, target.end, {
      duration: RISE_S,
      ease: EASE,
      onUpdate: (v) => {
        notch.current = { ...notch.current, end: v };
        paint(notch.current.start, v);
      },
    });
    return () => {
      startAnim.stop();
      endAnim.stop();
    };
  }, [floated, labelX, labelWidth, reduce]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setValue(next);
    if (!next) setTouched(false);
    onValueChange?.(next);
  };

  const handleBlur = () => {
    setFocused(false);
    if (value && !valid) setTouched(true);
  };

  const tokens: Record<string, string> = {
    "--fl-surface": tone.surface,
    "--fl-line": tone.line,
    "--fl-line-hover": tone.lineHover,
    "--fl-line-focus": tone.lineFocus,
    "--fl-error": tone.error,
    "--fl-success": tone.success,
    "--fl-ring": tone.ring,
  };

  const labelColor = resolved === "error" ? tone.error : focused ? tone.ink : tone.muted;

  return (
    <>
      <style>{FIELD_CSS}</style>
      <motion.div
        ref={rootRef}
        data-state={resolved}
        className={`fl-root @container relative w-full max-w-[420px] font-sans${className ? ` ${className}` : ""}`}
        style={tokens as CSSProperties}
        initial={reduce ? false : { opacity: 0, y: 10, filter: "blur(6px)" }}
        animate={inView || reduce ? { opacity: 1, y: 0, filter: "blur(0px)" } : undefined}
        transition={{ duration: reduce ? 0.15 : 0.6, ease: EASE }}
      >
        <div ref={fieldRef} className="fl-field" style={{ height: dims.height }}>
          <div aria-hidden="true" className="fl-surface" />
          <div aria-hidden="true" className="fl-border" />

          <motion.label
            ref={labelRef}
            htmlFor={inputId}
            className="pointer-events-none absolute z-[1] whitespace-nowrap leading-5"
            style={{
              left: labelX,
              top: 0,
              fontSize: dims.label,
              color: labelColor,
              transformOrigin: "left center",
            }}
            animate={{
              y: floated ? -LABEL_BOX / 2 : (dims.height - LABEL_BOX) / 2,
              scale: floated ? FLOAT_SCALE : 1,
              color: labelColor,
            }}
            transition={{ duration: reduce ? 0.15 : RISE_S, ease: EASE }}
          >
            {label}
          </motion.label>

          <AnimatePresence initial={false}>
            {prefix && (
              <motion.span
                key="prefix"
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 z-[1] -translate-y-1/2 leading-none"
                style={{ left: dims.pad, color: tone.icon }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Mail size={16} strokeWidth={1.6} />
              </motion.span>
            )}
          </AnimatePresence>

          <input
            id={inputId}
            data-demo="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            maxLength={maxLength}
            value={value}
            disabled={disabled}
            aria-invalid={resolved === "error" || undefined}
            aria-describedby={messageId}
            onChange={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={handleBlur}
            className="absolute inset-0 z-0 h-full w-full min-w-0 bg-transparent font-sans outline-none disabled:cursor-not-allowed"
            style={{
              paddingLeft: labelX,
              paddingRight: inputPadRight,
              fontSize: dims.text,
              color: tone.ink,
              caretColor: tone.ink,
            }}
          />

          <div
            className="pointer-events-none absolute top-1/2 z-[1] flex -translate-y-1/2 items-center"
            style={{ right: dims.pad, color: tone.muted }}
          >
            <AnimatePresence initial={false}>
              {resolved === "success" ? (
                <SuccessTick key="tick" color={tone.success} reduce={reduce} />
              ) : suffix ? (
                <motion.span key="suffix" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {suffix}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        <div
          className="mt-2.5 flex items-start justify-between gap-4"
          style={{ paddingLeft: dims.pad, paddingRight: dims.pad }}
        >
          <div id={messageId} aria-live="polite" className="relative min-w-0 flex-1">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.p
                key={message.kind}
                className="font-sans text-[13px] leading-[1.45] @sm:text-[13.5px]"
                style={{ color: message.color }}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(3px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(3px)" }}
                transition={{ duration: reduce ? 0.15 : 0.26, ease: EASE }}
              >
                {message.text}
              </motion.p>
            </AnimatePresence>
          </div>

          {counter && (
            <span
              className="shrink-0 pt-px font-mono text-[12px] leading-[1.45] tabular-nums"
              style={{ color: near ? tone.ink : tone.muted }}
            >
              {near ? `${value.length} / ${maxLength}` : `Max ${maxLength}`}
            </span>
          )}
        </div>
      </motion.div>
    </>
  );
}

/** The component on a quiet stage. Overrides are spread onto the featured instance so every control reaches it. */
export default function FloatingLabelFieldDemo(overrides: Partial<FloatingLabelFieldProps> = {}) {
  const light = overrides.theme === "light";
  return (
    <div
      className={`flex min-h-dvh w-full items-center justify-center px-5 py-16 sm:px-8 ${light ? "bg-[#f4f4f5]" : "bg-black"}`}
    >
      <FloatingLabelField {...overrides} />
    </div>
  );
}
