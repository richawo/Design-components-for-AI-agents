"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform, type AnimationPlaybackControls } from "motion/react";
import { ArrowRight, Check, ChevronDown, Download, Link2, LoaderCircle, Settings2, Share2, Trash2 } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

export type ButtonSize = "sm" | "md" | "lg";
export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

const ease = [0.2, 0.8, 0.2, 1] as const;

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-[13px]",
  md: "h-10 gap-2 px-4 text-[14px]",
  lg: "h-12 gap-2 px-5 text-[15px]",
};
const radiusClass: Record<ButtonSize, string> = { sm: "rounded-[8px]", md: "rounded-[10px]", lg: "rounded-[12px]" };
const squareClass: Record<ButtonSize, string> = {
  sm: "size-8 rounded-[8px]",
  md: "size-10 rounded-[10px]",
  lg: "size-12 rounded-[12px]",
};
const iconSize: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 18 };

const base =
  "relative inline-flex select-none items-center justify-center whitespace-nowrap font-sans font-medium tracking-[-0.01em] outline-none transition-[background-color,box-shadow,color,transform] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b45ff] active:translate-y-px disabled:pointer-events-none disabled:opacity-45";

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-[#2b45ff] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,40,0.25),0_1px_2px_rgba(20,30,120,0.35)] hover:bg-[#2238e6]",
  secondary:
    "bg-white text-[#111113] shadow-[inset_0_0_0_1px_rgba(17,17,19,0.12),0_1px_2px_rgba(17,17,19,0.06)] hover:bg-[#f7f7f4] hover:shadow-[inset_0_0_0_1px_rgba(17,17,19,0.2),0_1px_2px_rgba(17,17,19,0.08)]",
  ghost: "bg-transparent text-[#111113] hover:bg-[#111113]/[0.06]",
  destructive:
    "bg-[#d23a2c] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(60,0,0,0.25),0_1px_2px_rgba(120,20,10,0.3)] hover:bg-[#bb3023]",
};

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Swaps the label for a spinner without changing the button's width. */
  loading?: boolean;
  /** Square button. Pass an aria-label. */
  iconOnly?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", leading, trailing, loading = false, iconOnly = false, className = "", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-busy={loading || undefined}
      {...rest}
      className={`${base} ${iconOnly ? squareClass[size] : `${sizeClass[size]} ${radiusClass[size]}`} ${variantClass[variant]} ${loading ? "cursor-progress" : ""} ${className}`}
    >
      <span className={`inline-flex items-center gap-[inherit] transition-opacity duration-150 ${loading ? "opacity-0" : "opacity-100"}`}>
        {leading}
        {children}
        {trailing}
      </span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <LoaderCircle size={iconSize[size]} strokeWidth={2.25} className="animate-spin" />
        </span>
      )}
    </button>
  );
});

/* ------------------------------------------------------------------ */
/* Loading demo                                                        */
/* ------------------------------------------------------------------ */

function LoadingButton({ size, label, autoplay = false }: { size: ButtonSize; label: string; autoplay?: boolean }) {
  const [loading, setLoading] = useState(autoplay);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const run = useCallback((ms: number) => {
    setLoading(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setLoading(false), ms);
  }, []);
  useEffect(() => {
    if (autoplay) run(3200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [autoplay, run]);
  return (
    <>
      <Button variant="secondary" size={size} loading={loading} onClick={() => !loading && run(1800)}>
        {label}
      </Button>
      <span className="sr-only" aria-live="polite">
        {loading ? `${label}: saving` : ""}
      </span>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Split button                                                        */
/* ------------------------------------------------------------------ */

export type SplitOption = { id: string; label: string; hint: string };

export function SplitButton({
  size = "md",
  options,
  onAction,
}: {
  size?: ButtonSize;
  options: SplitOption[];
  onAction?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(options[0]?.id ?? "");
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();
  const reduce = useReducedMotion();
  const current = options.find((o) => o.id === selected) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) itemRefs.current[active]?.focus();
  }, [open, active]);

  const openMenu = (index: number) => {
    setActive(index);
    setOpen(true);
  };

  const onMenuKey = (e: ReactKeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + options.length) % options.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === "Escape" || e.key === "Tab") {
      if (e.key === "Escape") e.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    }
  };

  const radius = size === "sm" ? "8px" : size === "md" ? "10px" : "12px";

  return (
    <div ref={wrap} className="relative inline-flex">
      <button
        type="button"
        onClick={() => onAction?.(current.id)}
        className={`${base} ${sizeClass[size]} ${variantClass.primary}`}
        style={{ borderRadius: `${radius} 0 0 ${radius}` }}
      >
        {current.label}
      </button>
      <span className="w-px self-stretch bg-[#1a2fd0]" aria-hidden="true" />
      <button
        ref={trigger}
        type="button"
        aria-label="More publish options"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? setOpen(false) : openMenu(Math.max(0, options.findIndex((o) => o.id === selected))))}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            openMenu(e.key === "ArrowDown" ? 0 : options.length - 1);
          }
        }}
        className={`${base} ${variantClass.primary} ${size === "sm" ? "h-8 w-7" : size === "md" ? "h-10 w-9" : "h-12 w-11"}`}
        style={{ borderRadius: `0 ${radius} ${radius} 0` }}
      >
        <ChevronDown size={iconSize[size]} strokeWidth={2.25} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            role="menu"
            aria-label="Publish options"
            onKeyDown={onMenuKey}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease }}
            className="absolute left-0 top-[calc(100%+6px)] z-30 w-64 origin-top-left rounded-[12px] bg-white p-1.5 shadow-[0_0_0_1px_rgba(17,17,19,0.08),0_12px_32px_-8px_rgba(17,17,19,0.28)]"
          >
            {options.map((o, i) => (
              <button
                key={o.id}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={o.id === selected}
                tabIndex={i === active ? 0 : -1}
                onMouseEnter={() => setActive(i)}
                onClick={() => {
                  setSelected(o.id);
                  setOpen(false);
                  trigger.current?.focus();
                }}
                className="flex w-full items-start gap-2.5 rounded-[8px] px-2.5 py-2 text-left outline-none focus:bg-[#111113]/[0.05]"
              >
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-[#2b45ff]">
                  {o.id === selected && <Check size={14} strokeWidth={2.5} aria-hidden="true" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-[#111113]">{o.label}</span>
                  <span className="block text-[12px] leading-snug text-[#111113]/55">{o.hint}</span>
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Magnetic button                                                     */
/* ------------------------------------------------------------------ */

export function MagneticButton({
  size = "md",
  children,
  strength = 0.32,
  onClick,
}: {
  size?: ButtonSize;
  children: ReactNode;
  /** How far the button follows the pointer, as a share of the offset. */
  strength?: number;
  onClick?: () => void;
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 260, damping: 18, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 260, damping: 18, mass: 0.6 });
  const lx = useTransform(sx, (v) => v * 0.22);
  const ly = useTransform(sy, (v) => v * 0.22);
  const pad = size === "sm" ? 14 : size === "md" ? 18 : 22;

  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const leave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    // The padded wrapper is the magnetic field: it catches the pointer before it reaches the button.
    <div className="-m-[var(--pad)] inline-flex p-[var(--pad)]" style={{ ["--pad" as string]: `${pad}px` }} onPointerMove={move} onPointerLeave={leave}>
      <motion.button
        type="button"
        onClick={onClick}
        style={{ x: sx, y: sy }}
        className={`${base} ${sizeClass[size]} rounded-full bg-[#111113] text-[#f4f4f0] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_6px_16px_-6px_rgba(17,17,19,0.5)] hover:bg-[#111113]`}
      >
        <motion.span style={{ x: lx, y: ly }} className="inline-flex items-center gap-[inherit]">
          {children}
          <span className={`inline-flex items-center justify-center rounded-full bg-[#2b45ff] text-white ${size === "sm" ? "-mr-1.5 size-5" : size === "md" ? "-mr-2 size-6" : "-mr-2.5 size-7"}`}>
            <ArrowRight size={iconSize[size] - 3} strokeWidth={2.5} aria-hidden="true" />
          </span>
        </motion.span>
      </motion.button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hold to confirm                                                     */
/* ------------------------------------------------------------------ */

export function HoldToConfirmButton({
  size = "md",
  label = "Hold to delete",
  doneLabel = "Deleted",
  duration = 1200,
  onConfirm,
}: {
  size?: ButtonSize;
  label?: string;
  doneLabel?: string;
  /** Milliseconds the button must be held. */
  duration?: number;
  onConfirm?: () => void;
}) {
  const progress = useMotionValue(0);
  const clip = useTransform(progress, (p) => `inset(0 ${100 - p * 100}% 0 0)`);
  const controls = useRef<AnimationPlaybackControls | null>(null);
  const [done, setDone] = useState(false);
  const [holding, setHolding] = useState(false);
  const reset = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      controls.current?.stop();
      if (reset.current) clearTimeout(reset.current);
    },
    [],
  );

  const start = () => {
    if (done) return;
    setHolding(true);
    controls.current?.stop();
    controls.current = animate(progress, 1, {
      duration: ((1 - progress.get()) * duration) / 1000,
      ease: "linear",
      onComplete: () => {
        setHolding(false);
        setDone(true);
        onConfirm?.();
        reset.current = setTimeout(() => {
          setDone(false);
          animate(progress, 0, { duration: 0.4, ease });
        }, 2200);
      },
    });
  };
  const cancel = () => {
    if (done || progress.get() >= 1) return;
    setHolding(false);
    controls.current?.stop();
    controls.current = animate(progress, 0, { duration: 0.35, ease });
  };

  const content = (tone: "base" | "fill") => (
    <span className={`inline-flex items-center gap-[inherit] ${tone === "fill" ? "text-white" : "text-[#b52a1e]"}`}>
      {done ? <Check size={iconSize[size]} strokeWidth={2.5} aria-hidden="true" /> : <Trash2 size={iconSize[size]} strokeWidth={2} aria-hidden="true" />}
      {done ? doneLabel : label}
    </span>
  );

  return (
    <button
      type="button"
      aria-label={done ? doneLabel : `${label}. Press and hold to confirm.`}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        start();
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") cancel();
      }}
      onBlur={cancel}
      onContextMenu={(e) => e.preventDefault()}
      className={`${base} ${sizeClass[size]} ${radiusClass[size]} touch-none overflow-hidden shadow-[inset_0_0_0_1px_rgba(210,58,44,0.28)] ${done ? "bg-[#d23a2c]" : "bg-[#d23a2c]/[0.09] hover:bg-[#d23a2c]/[0.13]"} ${holding ? "scale-[0.97]" : ""}`}
    >
      {content("base")}
      <motion.span aria-hidden="true" style={{ clipPath: clip }} className="absolute inset-0 flex items-center justify-center gap-[inherit] bg-[#d23a2c]">
        {content("fill")}
      </motion.span>
      <span className="sr-only" aria-live="assertive">
        {done ? doneLabel : ""}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Specimen sheet                                                      */
/* ------------------------------------------------------------------ */

export type ButtonCollectionProps = {
  kicker?: string;
  edition?: string;
  title?: string;
  titleItalic?: string;
  intro?: string;
  /** Notes printed under each specimen's name, keyed by row id. */
  notes?: Partial<Record<RowId, string>>;
  splitOptions?: SplitOption[];
  footnote?: string;
};

type RowId =
  | "primary"
  | "secondary"
  | "ghost"
  | "destructive"
  | "icon"
  | "leading"
  | "trailing"
  | "loading"
  | "split"
  | "magnetic"
  | "hold";

const defaultNotes: Record<RowId, string> = {
  primary: "One per view. The thing you’d do if you only did one thing.",
  secondary: "The polite alternative. Sits next to a primary without arguing.",
  ghost: "For cancel, back and close. Present, never loud.",
  destructive: "Red means it. Pair it with a confirm or an undo.",
  icon: "Square, same height as its siblings, always labelled for screen readers.",
  leading: "Icon first when the icon names the action.",
  trailing: "Arrow last when the button moves you forward.",
  loading: "The spinner takes the label’s place. The width never changes.",
  split: "One default action, the rest one click away. Arrow keys work.",
  magnetic: "Leans toward the cursor. Save it for the hero.",
  hold: "Press and hold, or hold Space. Let go early and nothing happens.",
};

const rowNames: Record<RowId, string> = {
  primary: "Primary",
  secondary: "Secondary",
  ghost: "Ghost",
  destructive: "Destructive",
  icon: "Icon only",
  leading: "Leading icon",
  trailing: "Trailing icon",
  loading: "Loading",
  split: "Split",
  magnetic: "Magnetic",
  hold: "Hold to confirm",
};

const sizes: { id: ButtonSize; label: string; spec: string }[] = [
  { id: "sm", label: "Small", spec: "32 / 13" },
  { id: "md", label: "Medium", spec: "40 / 14" },
  { id: "lg", label: "Large", spec: "48 / 15" },
];

const iconSet = [
  { Icon: Link2, label: "Copy link" },
  { Icon: Share2, label: "Share" },
  { Icon: Settings2, label: "Settings" },
];

export function ButtonCollection({
  kicker = "Specimen № 04",
  edition = "Buttons — set in Geist, three sizes",
  title = "Buttons,",
  titleItalic = "pressed with care.",
  intro = "Eleven buttons for the moments that matter: the default, the alternative, the escape hatch and the point of no return. Every one has hover, focus, active and disabled states. Try them.",
  notes,
  splitOptions = [
    { id: "publish", label: "Publish", hint: "Goes live to 4,120 subscribers now." },
    { id: "schedule", label: "Schedule", hint: "Thursday 9:00, when they open things." },
    { id: "draft", label: "Save draft", hint: "Keep it to yourself a little longer." },
  ],
  footnote = "Heights 32 · 40 · 48. Radii 8 · 10 · 12. Focus ring 2px #2B45FF at 2px offset.",
}: ButtonCollectionProps) {
  const n = { ...defaultNotes, ...notes };

  const render = (row: RowId, size: ButtonSize, col: number): ReactNode => {
    const ic = iconSize[size];
    switch (row) {
      case "primary":
        return <Button size={size}>Publish issue</Button>;
      case "secondary":
        return (
          <Button size={size} variant="secondary">
            Preview
          </Button>
        );
      case "ghost":
        return (
          <Button size={size} variant="ghost">
            Cancel
          </Button>
        );
      case "destructive":
        return (
          <Button size={size} variant="destructive">
            Delete issue
          </Button>
        );
      case "icon": {
        const { Icon, label } = iconSet[col];
        return (
          <span className="inline-flex gap-2">
            <Button size={size} variant="secondary" iconOnly aria-label={label}>
              <Icon size={ic} strokeWidth={2} aria-hidden="true" />
            </Button>
            <Button size={size} variant="ghost" iconOnly aria-label={`${label} (ghost)`}>
              <Icon size={ic} strokeWidth={2} aria-hidden="true" />
            </Button>
          </span>
        );
      }
      case "leading":
        return (
          <Button size={size} variant="secondary" leading={<Download size={ic} strokeWidth={2} aria-hidden="true" />}>
            Export CSV
          </Button>
        );
      case "trailing":
        return (
          <Button size={size} trailing={<ArrowRight size={ic} strokeWidth={2.25} aria-hidden="true" className="-mr-0.5" />}>
            Continue
          </Button>
        );
      case "loading":
        return <LoadingButton size={size} label="Save changes" autoplay={size === "md"} />;
      case "split":
        return <SplitButton size={size} options={splitOptions} />;
      case "magnetic":
        return <MagneticButton size={size}>Start a project</MagneticButton>;
      case "hold":
        return <HoldToConfirmButton size={size} />;
    }
  };

  const rows = Object.keys(rowNames) as RowId[];

  return (
    <section className="bg-[#ecebe6] text-[#111113]">
      <div className="mx-auto max-w-[76rem] px-5 pb-16 pt-10 sm:px-8 lg:px-12 lg:pb-24 lg:pt-14">
        {/* Masthead */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-[#111113] pb-3 font-mono text-[11px] uppercase tracking-[0.14em] sm:text-xs">
          <p>{kicker}</p>
          <p className="text-[#111113]/55">{edition}</p>
        </div>

        <div className="grid gap-8 pt-10 md:grid-cols-12 md:items-end md:pt-14">
          <h2 className="font-display text-[clamp(3rem,1.6rem+5.6vw,6.75rem)] font-bold leading-[0.9] tracking-[-0.05em] md:col-span-8">
            {title}
            <br />
            <span className="font-serif font-normal italic tracking-[-0.03em] text-[#2b45ff]">{titleItalic}</span>
          </h2>
          <p className="max-w-[44ch] text-[16px] leading-[1.6] text-[#111113]/70 md:col-span-4 md:pb-3">{intro}</p>
        </div>

        {/* Column heads */}
        <div className="mt-12 hidden grid-cols-3 gap-x-6 border-b border-[#111113]/15 pb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[#111113]/55 md:grid lg:mt-16 lg:grid-cols-[minmax(0,15rem)_repeat(3,minmax(0,1fr))]">
          <span className="hidden lg:block">Style</span>
          {sizes.map((s) => (
            <span key={s.id} className="flex items-baseline gap-2">
              <span className="text-[#111113]">{s.label}</span>
              <span className="tabular-nums">{s.spec}</span>
            </span>
          ))}
        </div>

        <ol className="mt-8 md:mt-0">
          {rows.map((row, i) => (
            <li
              key={row}
              className="grid gap-x-6 gap-y-5 border-b border-[#111113]/10 py-6 md:grid-cols-3 md:items-center md:py-7 lg:grid-cols-[minmax(0,15rem)_repeat(3,minmax(0,1fr))]"
            >
              <div className="flex gap-4 md:col-span-3 lg:col-span-1 lg:pr-4">
                <span className="w-6 shrink-0 pt-[3px] font-mono text-[11px] tabular-nums text-[#111113]/45">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="font-display text-[19px] font-semibold leading-tight tracking-[-0.02em]">{rowNames[row]}</h3>
                  <p className="mt-1 max-w-[34ch] text-[13px] leading-[1.5] text-[#111113]/60">{n[row]}</p>
                </div>
              </div>
              {/* Mobile: one captioned line per size. From md: one grid cell per size. */}
              <div className="flex flex-col gap-3 pl-10 md:contents">
                {sizes.map((s, col) => (
                  <div key={s.id} className="flex min-h-12 items-center gap-4 md:block md:min-h-0">
                    <span className="w-14 shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-[#111113]/40 md:hidden">{s.label}</span>
                    {render(row, s.id, col)}
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-8 font-mono text-[11px] uppercase leading-[1.8] tracking-[0.12em] text-[#111113]/55">{footnote}</p>
      </div>
    </section>
  );
}

export default ButtonCollection;
