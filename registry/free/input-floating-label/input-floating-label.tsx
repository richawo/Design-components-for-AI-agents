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
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
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
/** Characters left at which the count steps up from muted to full ink. At the limit it turns to the error colour. */
const COUNTER_CLOSE = 3;
/** Thin space, so the count reads as one figure ("33 / 40") rather than three words. */
const THIN = "\u2009";
/** Below this field width the field is in a narrow column: padding and the resting label tighten. */
const COMPACT_BELOW = 300;
/** How much the side padding tightens in a narrow column, in px. */
const COMPACT_PAD_STEP = 4;
/** maxWidth before the field is measured. Large enough to never clip, and still a number motion can tween from. */
const UNMEASURED = 100_000;
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
  return <>{`${shown}${THIN}/${THIN}${max}`}</>;
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
  const suffixId = `${id}-suffix`;
  const reduce = useReducedMotion() ?? false;
  const tone = TONES[theme];
  const dims = SIZES[size];

  const fieldRef = useRef<HTMLDivElement | null>(null);
  const [setFieldNode, fieldWidth] = useMeasuredWidth();
  const attachField = useCallback(
    (node: HTMLDivElement | null) => {
      fieldRef.current = node;
      setFieldNode(node);
    },
    [setFieldNode],
  );
  // The label's natural width comes from an unclipped twin, so it never changes while the real label's
  // clip width is moving. The notch is sized from it.
  const [setLabelTwin, labelNaturalWidth] = useMeasuredWidth();
  const [setPrefixNode, prefixWidth] = useMeasuredWidth();
  const [setTrailingNode, trailingWidth] = useMeasuredWidth();

  const [internal, setInternal] = useState(defaultValue);
  const value = valueProp ?? internal;
  const [focused, setFocused] = useState(false);
  /** Set when Chrome fills the field from saved details, which React does not otherwise hear about. */
  const [autofilled, setAutofilled] = useState(false);
  /** An invalid value is only called out once it has rested or the field has been left. */
  const [touched, setTouched] = useState(false);

  const isValid = (candidate: string) => candidate.length > 0 && (validate?.(candidate) ?? false);
  const hasValue = value.length > 0;
  const valid = isValid(value);
  const invalid = hasValue && validate !== undefined && !valid;
  const auto: FloatingLabelFieldState = valid ? "success" : invalid && touched ? "error" : "default";
  const resolved: FloatingLabelFieldState = disabledProp || state === "disabled" ? "disabled" : (state ?? auto);
  const disabled = resolved === "disabled";
  const floated = focused || hasValue || autofilled;
  const hasSuffix = suffix !== undefined && suffix !== null && suffix !== false;

  // A narrow column (a sidebar, a 320px phone with page padding) gets tighter padding and a smaller
  // resting label, so the text keeps its room instead of the frame eating it.
  const compact = fieldWidth > 0 && fieldWidth < COMPACT_BELOW;
  const pad = compact ? dims.pad - COMPACT_PAD_STEP : dims.pad;
  const labelSize = compact ? dims.label - 1 : dims.label;

  const labelX = pad + slotOffset(prefixWidth);
  const inputPadRight = pad + slotOffset(trailingWidth);
  const measured = fieldWidth > 0;
  // At rest the label may run as far as the text, then ends in an ellipsis before the trailing slot.
  const restMax = measured ? Math.max(0, fieldWidth - labelX - inputPadRight) : UNMEASURED;
  // Floated, it sits on the top line, clear of the trailing slot, and stops a gap short of the
  // corner so the notch always has a closing edge.
  const floatMax = measured
    ? Math.max(0, Math.min(fieldWidth - inputPadRight, fieldWidth - CORNER - 2 * NOTCH_GAP) - labelX)
    : UNMEASURED;
  /** On-screen width of the floated label, which is what the notch has to clear. */
  const floatedWidth = Math.min(labelNaturalWidth * FLOAT_SCALE, floatMax);

  const remaining = maxLength === undefined ? Infinity : maxLength - value.length;
  const showCount = counter && maxLength !== undefined && value.length >= maxLength * COUNTER_NEAR;
  // The count gets louder as the limit gets closer: muted, then ink for the last few, then error at the limit.
  const countColor = remaining <= 0 ? tone.error : remaining <= COUNTER_CLOSE ? tone.ink : tone.muted;
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

  // A forced error counts as called out, so handing the field back keeps the error until the value is fixed.
  useEffect(() => {
    if (state === "error") setTouched(true);
  }, [state]);

  // The label is clipped before it is scaled, so its clip width is widened by 1 / FLOAT_SCALE as it
  // rises. The clip tweens with the scale (same curve, same moment), so the on-screen width never
  // overshoots into the trailing slot mid-flight. A resize or a tick arriving moves it at once.
  const labelMaxWidth = useMotionValue(UNMEASURED);
  const wasFloated = useRef(floated);
  const clipSized = useRef(false);
  useLayoutEffect(() => {
    if (!measured) return;
    const target = floated ? floatMax / FLOAT_SCALE : restMax;
    const rising = wasFloated.current !== floated;
    wasFloated.current = floated;
    if (!clipSized.current || !rising || reduce) {
      clipSized.current = true;
      labelMaxWidth.set(target);
      return;
    }
    const controls = animate(labelMaxWidth, target, { duration: RISE_S, ease: EASE });
    return () => controls.stop();
  }, [floated, floatMax, restMax, measured, reduce, labelMaxWidth]);

  // The notch opens from the label's own start and closes back to a point. It is written straight to the
  // element's CSS variables so the 60 fps move never re-renders React.
  const notch = useRef({ start: labelX, end: labelX });
  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    // The cut stops short of the right corner, so it never reaches the rounded end of the hairline.
    const roomEnd = fieldWidth > 0 ? fieldWidth - CORNER - NOTCH_GAP : Infinity;
    const open = floated && labelNaturalWidth > 0;
    const target = open
      ? { start: labelX - NOTCH_GAP, end: Math.min(labelX + floatedWidth + NOTCH_GAP, roomEnd) }
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
  }, [floated, labelX, labelNaturalWidth, floatedWidth, fieldWidth, reduce]);

  // Controlled fields report upward and leave the value to the host. Uncontrolled ones keep it here too.
  const commit = (next: string) => {
    if (valueProp === undefined) setInternal(next);
    onValueChange?.(next);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setAutofilled(false);
    // Reward early, punish late. An error already called out stays while the value is still wrong, so
    // fixing it goes straight from error to success with no helper in between. An emptied or valid value
    // starts over, so the next mistake waits for a pause again.
    if (next.length === 0 || isValid(next)) setTouched(false);
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
  // Swapped text (the message and the count) enters from below and leaves upward, with a light blur.
  const swapIn = reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(3px)" };
  const swapSettle = reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" };
  const swapOut = reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(3px)" };
  const swapTransition = { duration: reduce ? FADE_S : MESSAGE_S, ease: EASE };
  // The suffix ("Optional", a unit) is part of what the field means, so it is read with the field, before the message.
  const describedBy = [hasSuffix ? suffixId : undefined, messageId, ariaDescribedBy].filter(Boolean).join(" ");

  return (
    <>
      <style href="input-floating-label-styles" precedence="default">
        {FIELD_CSS}
      </style>
      <div
        data-state={resolved}
        aria-disabled={disabled || undefined}
        className={`ifl-root @container relative w-full max-w-[420px] font-sans${className ? ` ${className}` : ""}`}
        style={cssVars}
      >
        <div className="ifl-body">
          <div ref={attachField} className="ifl-field" style={{ height: dims.height }}>
            <div aria-hidden="true" className="ifl-surface" />
            <div aria-hidden="true" className="ifl-border" />

            {/* Unclipped twin of the label, measured for the notch. Its own box clips it, so it never widens the page. */}
            <div aria-hidden="true" className="pointer-events-none invisible absolute inset-0 overflow-hidden">
              <span
                ref={setLabelTwin}
                className="absolute left-0 top-0 whitespace-nowrap leading-5"
                style={{ fontSize: labelSize }}
              >
                {label}
              </span>
            </div>

            <motion.label
              htmlFor={inputId}
              className="pointer-events-none absolute z-[1] whitespace-nowrap leading-5"
              style={{
                left: labelX,
                top: 0,
                maxWidth: labelMaxWidth,
                fontSize: labelSize,
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
              style={{ left: pad, top: "50%", transform: "translateY(-50%)", color: tone.icon }}
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

            {/* Hidden from the reading order; the suffix reaches assistive technology through aria-describedby. */}
            <div
              ref={setTrailingNode}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 z-[1] flex -translate-y-1/2 items-center gap-2.5"
              style={{ right: pad, color: tone.muted }}
            >
              {hasSuffix && (
                <span id={suffixId} className="leading-none" style={{ fontSize: 13 }}>
                  {suffix}
                </span>
              )}
              <AnimatePresence initial={false}>
                {resolved === "success" && <SuccessTick key="tick" color={tone.success} reduce={reduce} />}
              </AnimatePresence>
            </div>
          </div>

          <div
            className="mt-2.5 flex items-start justify-between gap-3 @xs:gap-4"
            style={{ paddingLeft: pad, paddingRight: pad }}
          >
            <div id={messageId} aria-live="polite" className="relative min-w-0 flex-1">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.p
                  key={message.kind}
                  className="font-sans text-[13px] leading-[1.45] @sm:text-[13.5px]"
                  style={{ color: message.color }}
                  initial={swapIn}
                  animate={swapSettle}
                  exit={swapOut}
                  transition={swapTransition}
                >
                  {message.text}
                </motion.p>
              </AnimatePresence>
            </div>

            {counter && maxLength !== undefined && (
              <div className="grid shrink-0 justify-items-end font-mono text-[12px] leading-[1.45] tabular-nums">
                {/* Holds the count's width from the start, so the message never reflows when the count arrives. */}
                <span aria-hidden="true" className="invisible col-start-1 row-start-1">
                  {`${maxLength}${THIN}/${THIN}${maxLength}`}
                </span>
                <AnimatePresence initial={false}>
                  {showCount && (
                    <motion.span
                      key="count"
                      className="col-start-1 row-start-1"
                      initial={{ ...swapIn, color: countColor }}
                      animate={{ ...swapSettle, color: countColor }}
                      exit={swapOut}
                      transition={swapTransition}
                    >
                      <CharCount count={value.length} max={maxLength} reduce={reduce} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>
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
 * What the field shows while a state is forced from the controls, given what the visitor typed, so each
 * state describes what is on screen: a half-typed address for the error, a finished one for success,
 * and a filled field for disabled so its dimmed, floated look is visible. "Default" shows what was typed.
 */
const STATE_VALUES: Record<FloatingLabelFieldState, (typed: string) => string> = {
  default: (typed) => typed,
  error: () => "ana.lumen@",
  success: () => "ana.lumen@studio.co",
  disabled: (typed) => typed || "ana.lumen@studio.co",
};

/**
 * The component on a quiet stage. The featured field is an email field; overrides are spread onto it
 * so every control reaches it. The demo owns the value, and the state control both pins a state and
 * fills the field to match it. "Default" hands the field back to what the visitor typed.
 *
 * The first-view entrance lives here, on the stage, not in the field: a form primitive should be
 * visible the moment it mounts.
 */
export default function FloatingLabelFieldDemo({
  state: forced,
  prefix,
  suffix,
  defaultValue = "",
  onValueChange,
  ...overrides
}: Partial<FloatingLabelFieldProps> = {}) {
  const reduce = useReducedMotion() ?? false;
  const [value, setValue] = useState(defaultValue);
  /** The visitor's own value. A forced state shows a sample beside it but never overwrites it. */
  const typed = useRef(defaultValue);
  const [state, setState] = useState<FloatingLabelFieldState | undefined>(forced);
  useEffect(() => {
    setState(forced);
    setValue(STATE_VALUES[forced ?? "default"](typed.current));
  }, [forced]);

  const handleValueChange = (next: string) => {
    typed.current = next;
    setValue(next);
    onValueChange?.(next);
  };

  const light = overrides.theme === "light";
  // The controls send booleans for the slots. A true suffix shows a short word, so the trailing slot is visible.
  const glyph =
    prefix === undefined || prefix === true ? <Mail size={16} strokeWidth={1.6} /> : prefix === false ? null : prefix;
  const word = suffix === true ? "Optional" : suffix === false ? undefined : suffix;

  return (
    <div
      className={`flex min-h-dvh w-full items-center justify-center px-5 py-16 sm:px-8 ${light ? "bg-[#f4f4f5]" : "bg-black"}`}
    >
      <motion.div
        className="w-full max-w-[420px]"
        initial={reduce ? false : { opacity: 0, y: 10, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.6, ease: EASE }}
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
          value={value}
          onValueChange={handleValueChange}
          state={state === "default" ? undefined : state}
        />
      </motion.div>
    </div>
  );
}
