"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type AnimationEvent,
  type ChangeEvent,
  type CSSProperties,
  type FocusEvent,
  type InputHTMLAttributes,
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

/**
 * A native text input with a floating label. Every other input attribute (type, name, required,
 * autoComplete, inputMode, onFocus, onBlur, data-*) is passed straight through to the <input>.
 */
export type FloatingLabelFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "size" | "prefix" | "value" | "defaultValue" | "maxLength" | "className" | "style"
> & {
  /** Resting label. It rises onto the top hairline when the field is focused or filled. */
  label?: string;
  /** Helper text under the field, shown in the resting, focused and filled states. */
  helper?: string;
  /** Replaces the helper once a value has rested and failed `validate`. */
  errorText?: string;
  /** Replaces the helper once a value passes `validate`. */
  successText?: string;
  /** Forces a state. Unset, the field follows what is typed. "default" forces the resting look. */
  state?: FloatingLabelFieldState;
  /**
   * Decides whether a value is acceptable. Without it the field never calls out an error and
   * never shows the success tick, so a plain text field stays quiet.
   */
  validate?: (value: string) => boolean;
  /** Shows the count once the value passes 80% of `maxLength`. Needs `maxLength`. */
  counter?: boolean;
  /** Longest value the field accepts. The input stops at this length. */
  maxLength?: number;
  /** Leading slot, such as an icon. Its width sets where the label and the text start. */
  prefix?: ReactNode;
  /** Trailing slot, such as a unit or a short word. The success tick sits beside it, not over it. */
  suffix?: ReactNode;
  size?: FloatingLabelFieldSize;
  theme?: FloatingLabelFieldTheme;
  /** Uncontrolled: the value on first render. */
  defaultValue?: string;
  /** Controlled: the value. Pair it with `onValueChange`. */
  value?: string;
  /** Called on every change with the new value. */
  onValueChange?: (value: string) => void;
  /** Extra classes on the root, for width or margin in the host layout. */
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
  /** The error colour at 80%, for the label while the errored field is not focused. */
  errorMuted: string;
  success: string;
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
    errorMuted: "rgba(240,147,122,0.8)",
    success: "#8fd7a6",
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
    errorMuted: "rgba(179,67,42,0.8)",
    success: "#2c7a45",
  },
};

const SIZES: Record<FloatingLabelFieldSize, { height: number; pad: number; text: number; label: number }> = {
  md: { height: 56, pad: 16, text: 16, label: 15 },
  lg: { height: 64, pad: 18, text: 18, label: 17 },
};

/** Ease-out for every arrival: the label, the notch, the messages and the count. */
const EASE = [0.22, 1, 0.36, 1] as const;
/** Seconds for the label to rise and the notch to open. */
const RISE_S = 0.32;
/** Seconds for the messages to cross-fade, and for the reduced-motion colour and opacity changes. */
const MESSAGE_S = 0.26;
const FADE_S = 0.15;
/** Seconds for the count to roll from its previous value to the new one. */
const COUNT_S = 0.18;
/** Line box of the label, in px. Used to centre it vertically at rest and on the line when floated. */
const LABEL_BOX = 20;
/** Resting label size relative to its floated size. The label scales rather than re-laying out. */
const FLOAT_SCALE = 0.76;
/** Space between the label and the edge of the cut. Kept above the corner radius so the cut never reaches a corner. */
const NOTCH_GAP = 4;
/** Space between a measured slot and the text beside it. */
const SLOT_GAP = 10;
/** How long a typed value must rest before an invalid value is called out. */
const IDLE_MS = 800;
/** Share of `maxLength` at which the counter appears. */
const COUNTER_NEAR = 0.8;
/** Corner radius of the field, in px. Matches `border-radius` in FIELD_CSS. The notch stops short of it. */
const CORNER = 12;
/** Name of the keyframes the autofill hook listens for. Chrome fires animationstart when it fills a field. */
const AUTOFILL_ANIMATION = "ifl-autofill";

/**
 * Styles that need selectors or pseudo-classes, which inline styles cannot express. Everything is
 * namespaced to `ifl-` so it cannot collide with a host page's own classes.
 *
 * The notch is a mask on the border: the top hairline is split at --ifl-nl and --ifl-nr, which the
 * component writes imperatively while the label moves. Before the first write the fallbacks give
 * a closed, unbroken border.
 *
 * Focus is shown on the masked border itself, not on an outer outline, so the ring respects the
 * notch instead of running a second line over it.
 */
const FIELD_CSS = `
.ifl-body { position: relative; }
.ifl-field { position: relative; width: 100%; border-radius: 12px; }
.ifl-surface { position: absolute; inset: 0; border-radius: 12px; background: var(--ifl-surface); }
.ifl-border {
  position: absolute; inset: 0; border-radius: 12px;
  box-shadow: inset 0 0 0 1px var(--ifl-line);
  transition: box-shadow 180ms ease-out;
  -webkit-mask:
    linear-gradient(#000 0 0) 0 0 / var(--ifl-nl, 100%) 2px no-repeat,
    linear-gradient(#000 0 0) var(--ifl-nr, 100%) 0 / calc(100% - var(--ifl-nr, 100%)) 2px no-repeat,
    linear-gradient(#000 0 0) 0 2px / 100% calc(100% - 2px) no-repeat;
          mask:
    linear-gradient(#000 0 0) 0 0 / var(--ifl-nl, 100%) 2px no-repeat,
    linear-gradient(#000 0 0) var(--ifl-nr, 100%) 0 / calc(100% - var(--ifl-nr, 100%)) 2px no-repeat,
    linear-gradient(#000 0 0) 0 2px / 100% calc(100% - 2px) no-repeat;
}
@media (hover: hover) and (pointer: fine) {
  .ifl-field:hover .ifl-border { box-shadow: inset 0 0 0 1px var(--ifl-line-hover); }
}
.ifl-field:focus-within .ifl-border { box-shadow: inset 0 0 0 1.5px var(--ifl-line-focus); }
.ifl-root[data-state="error"] .ifl-border { box-shadow: inset 0 0 0 1.5px var(--ifl-error); }
.ifl-root[data-state="success"] .ifl-border { box-shadow: inset 0 0 0 1.5px var(--ifl-success); }
/* Focus on a state colour keeps the colour and steps up to 2px, so a focused field never looks idle. */
.ifl-root[data-state="error"] .ifl-field:focus-within .ifl-border { box-shadow: inset 0 0 0 2px var(--ifl-error); }
.ifl-root[data-state="success"] .ifl-field:focus-within .ifl-border { box-shadow: inset 0 0 0 2px var(--ifl-success); }
.ifl-root[data-state="disabled"] .ifl-field { cursor: not-allowed; }
.ifl-root[data-state="disabled"] .ifl-border { box-shadow: inset 0 0 0 1px var(--ifl-line); }
.ifl-root[data-state="disabled"] .ifl-body { opacity: 0.42; }
.ifl-input:-webkit-autofill,
.ifl-input:-webkit-autofill:hover,
.ifl-input:-webkit-autofill:focus {
  animation-name: ifl-autofill;
  animation-duration: 1ms;
  -webkit-box-shadow: 0 0 0 1000px var(--ifl-surface) inset;
  -webkit-text-fill-color: var(--ifl-ink);
  caret-color: var(--ifl-ink);
  transition: background-color 9999s ease-out 0s;
}
@keyframes ifl-autofill { from {} to {} }
@media (prefers-reduced-motion: reduce) { .ifl-border { transition: none; } }
`;

/* ------------------------------------------------------------------ */
/* Hooks and pieces                                                    */
/* ------------------------------------------------------------------ */

/** Width a slot takes up, including the gap that separates it from the text. Zero when the slot is empty. */
const slotOffset = (width: number) => (width > 0 ? width + SLOT_GAP : 0);

/**
 * Measures an element's laid-out width and follows it as it resizes. Returns a callback ref to put on
 * the element and the current width. Measured before paint, so the notch and the text never jump.
 */
function useMeasuredWidth(): [(node: HTMLElement | null) => void, number] {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!node) {
      setWidth(0);
      return;
    }
    const measure = () => setWidth(node.offsetWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [setNode, width];
}

/** Tweens a whole number toward its target. Starts from wherever the last tween stopped, so keystrokes never jump. */
function useTweenedNumber(target: number, reduce: boolean): number {
  const [shown, setShown] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    if (reduce) {
      current.current = target;
      setShown(target);
      return;
    }
    const controls = animate(current.current, target, {
      duration: COUNT_S,
      ease: EASE,
      onUpdate: (v) => {
        current.current = v;
        setShown(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [target, reduce]);
  return shown;
}

/** The count, rolling to its new value rather than jumping. */
function CharCount({ count, max, reduce }: { count: number; max: number; reduce: boolean }) {
  const shown = useTweenedNumber(count, reduce);
  return (
    <>
      {shown} / {max}
    </>
  );
}

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
      transition={{ duration: reduce ? FADE_S : 0.24, ease: EASE }}
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
  label = "Label",
  helper,
  errorText = "Enter a valid value",
  successText = "Looks good.",
  state,
  validate,
  counter = true,
  maxLength,
  prefix,
  suffix,
  size = "md",
  theme = "dark",
  defaultValue = "",
  value: valueProp,
  onValueChange,
  className,
  id: idProp,
  disabled: disabledProp,
  onChange,
  onFocus,
  onBlur,
  onAnimationStart,
  "aria-describedby": ariaDescribedBy,
  ...inputProps
}: FloatingLabelFieldProps) {
  const id = useId();
  const inputId = idProp ?? `${id}-input`;
  const messageId = `${id}-message`;
  const reduce = useReducedMotion() ?? false;
  const tone = TONES[theme];
  const dims = SIZES[size];

  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { once: true, amount: 0.3 });
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const [setFieldNode, fieldWidth] = useMeasuredWidth();
  const attachField = useCallback(
    (node: HTMLDivElement | null) => {
      fieldRef.current = node;
      setFieldNode(node);
    },
    [setFieldNode],
  );
  const [setLabelNode, labelWidth] = useMeasuredWidth();
  const [setPrefixNode, prefixWidth] = useMeasuredWidth();
  const [setTrailingNode, trailingWidth] = useMeasuredWidth();

  const [internal, setInternal] = useState(defaultValue);
  const value = valueProp ?? internal;
  const [focused, setFocused] = useState(false);
  /** Set when Chrome fills the field from saved details, which React does not otherwise hear about. */
  const [autofilled, setAutofilled] = useState(false);
  /** An invalid value is only called out once it has rested or the field has been left. */
  const [touched, setTouched] = useState(false);

  const hasValue = value.length > 0;
  const valid = hasValue && (validate?.(value) ?? false);
  const invalid = hasValue && validate !== undefined && !valid;
  const auto: FloatingLabelFieldState = valid ? "success" : invalid && touched ? "error" : "default";
  const resolved: FloatingLabelFieldState = disabledProp || state === "disabled" ? "disabled" : (state ?? auto);
  const disabled = resolved === "disabled";
  const floated = focused || hasValue || autofilled;

  const labelX = dims.pad + slotOffset(prefixWidth);
  const inputPadRight = dims.pad + slotOffset(trailingWidth);
  // The label may run as far as the text. A longer label ends in an ellipsis before the trailing slot.
  const labelMax = fieldWidth > 0 ? Math.max(0, fieldWidth - labelX - inputPadRight) : undefined;
  const showCount = counter && maxLength !== undefined && value.length >= maxLength * COUNTER_NEAR;
  const countColor = maxLength !== undefined && value.length >= maxLength ? tone.error : tone.ink;
  const message =
    resolved === "error"
      ? { kind: "error", text: errorText, color: tone.error }
      : resolved === "success"
        ? { kind: "success", text: successText, color: tone.success }
        : { kind: "helper", text: helper ?? "", color: tone.muted };

  // Call out an invalid value only after typing pauses, so the error never flickers in mid-word.
  useEffect(() => {
    if (!invalid) return;
    const timer = window.setTimeout(() => setTouched(true), IDLE_MS);
    return () => window.clearTimeout(timer);
  }, [value, invalid]);

  // The notch opens from the label's own start and closes back to a point. It is written straight to the
  // element's CSS variables so the 60 fps move never re-renders React.
  const notch = useRef({ start: labelX, end: labelX });
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    // The cut stops short of the right corner, so it never reaches the rounded end of the hairline.
    const roomEnd = fieldWidth > 0 ? fieldWidth - CORNER - NOTCH_GAP : Infinity;
    const open = floated && labelWidth > 0;
    const target = open
      ? { start: labelX - NOTCH_GAP, end: Math.min(labelX + labelWidth * FLOAT_SCALE + NOTCH_GAP, roomEnd) }
      : { start: labelX, end: labelX };
    const paint = (start: number, end: number) => {
      el.style.setProperty("--ifl-nl", `${start}px`);
      el.style.setProperty("--ifl-nr", `${end}px`);
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
  }, [floated, labelX, labelWidth, fieldWidth, reduce]);

  // Controlled fields report upward and leave the value to the host. Uncontrolled ones keep it here too.
  const commit = (next: string) => {
    if (valueProp === undefined) setInternal(next);
    onValueChange?.(next);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setAutofilled(false);
    // Every edit drops the error back to rest, so it only returns once the value has settled again.
    setTouched(false);
    commit(next);
    onChange?.(event);
  };

  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    onFocus?.(event);
  };

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    setFocused(false);
    if (invalid) setTouched(true);
    onBlur?.(event);
  };

  // Autofill is the only signal Chrome gives for a value it filled in itself. Read the value from the DOM.
  const handleAnimationStart = (event: AnimationEvent<HTMLInputElement>) => {
    if (event.animationName === AUTOFILL_ANIMATION) {
      setAutofilled(true);
      if (event.currentTarget.value !== value) commit(event.currentTarget.value);
    }
    onAnimationStart?.(event);
  };

  const cssVars = {
    "--ifl-surface": tone.surface,
    "--ifl-ink": tone.ink,
    "--ifl-line": tone.line,
    "--ifl-line-hover": tone.lineHover,
    "--ifl-line-focus": tone.lineFocus,
    "--ifl-error": tone.error,
    "--ifl-success": tone.success,
  } as CSSProperties;

  // An errored label is full strength while focused and eases to 80% at rest, so focus still reads on it.
  const labelColor =
    resolved === "error" ? (focused ? tone.error : tone.errorMuted) : focused ? tone.ink : tone.muted;
  // Under reduced motion the label moves instantly and only its colour fades, which is the one change that stays.
  const labelTransition = reduce
    ? { y: { duration: 0 }, scale: { duration: 0 }, color: { duration: FADE_S, ease: EASE } }
    : { duration: RISE_S, ease: EASE };
  const describedBy = [messageId, ariaDescribedBy].filter(Boolean).join(" ");

  return (
    <>
      <style href="input-floating-label-styles" precedence="default">
        {FIELD_CSS}
      </style>
      <motion.div
        ref={rootRef}
        data-state={resolved}
        aria-disabled={disabled || undefined}
        className={`ifl-root @container relative w-full max-w-[420px] font-sans${className ? ` ${className}` : ""}`}
        style={cssVars}
        initial={reduce ? false : { opacity: 0, y: 10, filter: "blur(6px)" }}
        animate={inView || reduce ? { opacity: 1, y: 0, filter: "blur(0px)" } : undefined}
        transition={{ duration: reduce ? FADE_S : 0.6, ease: EASE }}
      >
        <div className="ifl-body">
          <div ref={attachField} className="ifl-field" style={{ height: dims.height }}>
            <div aria-hidden="true" className="ifl-surface" />
            <div aria-hidden="true" className="ifl-border" />

            <motion.label
              ref={setLabelNode}
              htmlFor={inputId}
              className="pointer-events-none absolute z-[1] whitespace-nowrap leading-5"
              style={{
                left: labelX,
                top: 0,
                maxWidth: labelMax,
                fontSize: dims.label,
                color: labelColor,
                transformOrigin: "left center",
                // Ellipsis needs overflow clipping. The padding and matching negative margin widen the clip box
                // by 3px top and bottom, so descenders are never cut, and the text stays where it was.
                overflow: "hidden",
                textOverflow: "ellipsis",
                paddingBlock: 3,
                marginBlock: -3,
              }}
              animate={{
                y: floated ? -LABEL_BOX / 2 : (dims.height - LABEL_BOX) / 2,
                scale: floated ? FLOAT_SCALE : 1,
                color: labelColor,
              }}
              transition={labelTransition}
            >
              {label}
            </motion.label>

            <span
              ref={setPrefixNode}
              aria-hidden="true"
              className="pointer-events-none absolute z-[1] flex items-center leading-none"
              style={{ left: dims.pad, top: "50%", transform: "translateY(-50%)", color: tone.icon }}
            >
              {prefix}
            </span>

            <input
              {...inputProps}
              id={inputId}
              className="ifl-input absolute inset-0 z-0 h-full w-full min-w-0 bg-transparent font-sans outline-none"
              style={{
                paddingLeft: labelX,
                paddingRight: inputPadRight,
                fontSize: dims.text,
                color: tone.ink,
                caretColor: tone.ink,
              }}
              value={value}
              disabled={disabled}
              maxLength={maxLength}
              aria-invalid={resolved === "error" || undefined}
              aria-describedby={describedBy}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onAnimationStart={handleAnimationStart}
            />

            <div
              ref={setTrailingNode}
              className="pointer-events-none absolute top-1/2 z-[1] flex -translate-y-1/2 items-center gap-2.5"
              style={{ right: dims.pad, color: tone.muted }}
            >
              {suffix !== undefined && suffix !== null && suffix !== false && (
                <span className="leading-none" style={{ fontSize: 13 }}>
                  {suffix}
                </span>
              )}
              <AnimatePresence initial={false}>
                {resolved === "success" && <SuccessTick key="tick" color={tone.success} reduce={reduce} />}
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
                  animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(3px)" }}
                  transition={{ duration: reduce ? FADE_S : MESSAGE_S, ease: EASE }}
                >
                  {message.text}
                </motion.p>
              </AnimatePresence>
            </div>

            {counter && maxLength !== undefined && (
              <div className="grid shrink-0 justify-items-end font-mono text-[12px] leading-[1.45] tabular-nums">
                {/* Holds the count's width from the start, so the message never reflows when the count arrives. */}
                <span aria-hidden="true" className="invisible col-start-1 row-start-1">
                  {maxLength} / {maxLength}
                </span>
                <AnimatePresence initial={false}>
                  {showCount && (
                    <motion.span
                      key="count"
                      className="col-start-1 row-start-1"
                      style={{ color: countColor }}
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(3px)" }}
                      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(3px)" }}
                      transition={{ duration: reduce ? FADE_S : MESSAGE_S, ease: EASE }}
                    >
                      <CharCount count={value.length} max={maxLength} reduce={reduce} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Demo                                                                */
/* ------------------------------------------------------------------ */

/** Deliberately simple: a local part, an @, a domain and a top-level domain of two or more letters. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const isEmail = (value: string) => EMAIL.test(value.trim());

/**
 * The component on a quiet stage. The featured field is an email field; overrides are spread onto it
 * so every control reaches it. The state control forces a state at runtime, so it is synced into the
 * demo's own state and "Default" hands the field back to what is typed.
 */
export default function FloatingLabelFieldDemo({
  state: forced,
  prefix,
  suffix,
  ...overrides
}: Partial<FloatingLabelFieldProps> = {}) {
  const [state, setState] = useState<FloatingLabelFieldState | undefined>(forced);
  useEffect(() => setState(forced), [forced]);

  const light = overrides.theme === "light";
  // The controls send booleans for the slots. A true suffix shows a short word, so the trailing slot is visible.
  const glyph =
    prefix === undefined || prefix === true ? <Mail size={16} strokeWidth={1.6} /> : prefix === false ? null : prefix;
  const word = suffix === true ? "Optional" : suffix === false ? undefined : suffix;

  return (
    <div
      className={`flex min-h-dvh w-full items-center justify-center px-5 py-16 sm:px-8 ${light ? "bg-[#f4f4f5]" : "bg-black"}`}
    >
      <FloatingLabelField
        type="email"
        inputMode="email"
        autoComplete="email"
        spellCheck={false}
        data-demo="email"
        label="Work email"
        helper="We’ll send receipts and invoices here."
        errorText="Add a domain, like ana@studio.co"
        successText="Looks good. Receipts go here."
        validate={isEmail}
        maxLength={40}
        prefix={glyph}
        suffix={word}
        {...overrides}
        state={state === "default" ? undefined : state}
      />
    </div>
  );
}
