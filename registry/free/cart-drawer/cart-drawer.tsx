"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
  useVelocity,
  type DragControls,
  type MotionValue,
  type PanInfo,
  type Variants,
} from "motion/react";
import { Check, Lock, Minus, Plus, ShoppingBag, Truck, X } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type CartArt = "notebook" | "mug" | "socks" | "pencil";

export type CartItem = {
  id: string;
  name: string;
  /** Colour, size or edition, shown under the name. */
  variant: string;
  price: number;
  qty: number;
  art: CartArt;
  /** Main colour of the drawn thumbnail: the product's own colour. */
  color: string;
};

export type CartUpsell = Omit<CartItem, "qty"> & { pitch: string };

export type CartDrawerProps = {
  items?: CartItem[];
  upsell?: CartUpsell | null;
  /** Spend that unlocks free shipping. */
  freeShippingThreshold?: number;
  shippingFee?: number;
  currency?: string;
  locale?: string;
  title?: string;
  /** Line under the title, after the item count. */
  shipsFrom?: string;
  /** Reassurance under the checkout button. */
  note?: string;
  /** Controlled open state. Leave undefined to let the component manage it. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCheckout?: (items: CartItem[]) => void;
  /** "fixed" covers the viewport; "absolute" stays inside the nearest positioned parent. */
  strategy?: "fixed" | "absolute";
  /** Seconds the undo bar stays after removing an item. */
  undoSeconds?: number;
  /** The one signal colour: the total capsule on the checkout button. */
  accent?: string;
  theme?: "dark" | "light";
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const PALETTE = {
  dark: {
    panel: "#0b0b0c",
    raised: "#1a1a1d",
    thumb: "#161618",
    ink: "#f4f4f5",
    onInk: "#0b0b0c",
    scrim: "rgba(0,0,0,0.6)",
    shadow: "-24px 0 60px -24px rgba(0,0,0,0.8), inset 1px 0 0 rgba(255,255,255,0.08)",
  },
  light: {
    panel: "#ffffff",
    raised: "#f1f1f2",
    thumb: "#f1f1f2",
    ink: "#111113",
    onInk: "#ffffff",
    scrim: "rgba(17,17,19,0.32)",
    shadow: "-24px 0 60px -24px rgba(17,17,19,0.35), inset 1px 0 0 rgba(17,17,19,0.06)",
  },
} as const;

const DEFAULT_ACCENT = "#d7e3a4";
/** Text on the accent capsule. The default accent is pale, so it takes near-black. */
const ON_ACCENT = "#0b0b0c";
const EASE = [0.22, 1, 0.36, 1] as const;
const SPRING_PANEL = { type: "spring", stiffness: 340, damping: 36, mass: 0.9 } as const;
const SPRING_METER = { type: "spring", stiffness: 120, damping: 20 } as const;
/** Bottom sheet: dismiss past this drag distance (px) or flick speed (px/s). */
const SHEET_DISMISS = { offset: 140, velocity: 700 } as const;
const MAX_QTY = 9;
const PHONE_QUERY = "(max-width: 639px)";

/**
 * Every time the drawer opens, in seconds from the panel starting to move.
 * The panel travels first; then the header, the shipping card, the items
 * one by one, the upsell and the footer. The meter fills once its card has
 * landed, and the subtotal and total count up last.
 */
const T = {
  header: 0.12,
  meter: 0.17,
  meterFill: 0.36,
  items: 0.22,
  itemStep: 0.06,
  /** A row added after the drawer has settled. */
  added: 0.08,
  upsell: 0.42,
  footer: 0.3,
  count: 0.4,
  countDur: 0.6,
} as const;

const reveal: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(8px)" },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.5, ease: EASE, delay },
    transitionEnd: { filter: "none" },
  }),
};
const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
};
/** The panel slides from the right on desktop and up from the bottom on phones. Both axes reset so a resize mid-flight never strands it. */
const panelMotion = (mobile: boolean, reduce: boolean): Variants =>
  reduce
    ? { hidden: { opacity: 0 }, show: { opacity: 1, x: 0, y: 0, transition: { duration: 0.15 } }, exit: { opacity: 0, transition: { duration: 0.12 } } }
    : mobile
      ? { hidden: { y: "100%", x: 0 }, show: { y: 0, x: 0, transition: SPRING_PANEL }, exit: { y: "100%", transition: { ...SPRING_PANEL, stiffness: 420 } } }
      : { hidden: { x: "100%", y: 0 }, show: { x: 0, y: 0, transition: SPRING_PANEL }, exit: { x: "100%", transition: { ...SPRING_PANEL, stiffness: 420 } } };

const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-(--cd-ink)";

const DEFAULT_ITEMS: CartItem[] = [
  { id: "nb", name: "Waxed field notebook", variant: "A5 · Olive · Dot grid", price: 18, qty: 2, art: "notebook", color: "#6b7440" },
  { id: "mug", name: "Enamel camp mug", variant: "350 ml · Bone", price: 16, qty: 1, art: "mug", color: "#efe8da" },
  { id: "sock", name: "Merino trail socks", variant: "Rust · Size M", price: 14, qty: 1, art: "socks", color: "#b65a32" },
];

const DEFAULT_UPSELL: CartUpsell = {
  id: "pencil",
  name: "Brass bullet pencil",
  pitch: "Lives in the notebook’s spine.",
  price: 12,
  art: "pencil",
  color: "#c79a3c",
  variant: "Brass · HB",
};

/* ------------------------------------------------------------------ */
/* Hooks                                                               */
/* ------------------------------------------------------------------ */

function useMediaQuery(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const sync = () => setMatch(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [query]);
  return match;
}

/** Cart state: items, pending removals (undoable), the upsell, totals and a line for the live region. */
function useCart(initialItems: CartItem[], upsell: CartUpsell | null, threshold: number) {
  const [items, setItems] = useState(initialItems);
  const [removed, setRemoved] = useState<Record<string, true>>({});
  const [announce, setAnnounce] = useState("");

  const live = items.filter((i) => !removed[i.id]);
  const count = live.reduce((a, i) => a + i.qty, 0);
  const subtotal = live.reduce((a, i) => a + i.qty * i.price, 0);
  const remaining = Math.max(0, threshold - subtotal);

  const remove = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    setRemoved((r) => ({ ...r, [id]: true }));
    setAnnounce(`Removed ${item.name}. Undo available.`);
  };
  const setQty = (id: string, qty: number) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    if (qty < 1) return remove(id);
    const next = Math.min(qty, MAX_QTY);
    setItems((list) => list.map((i) => (i.id === id ? { ...i, qty: next } : i)));
    setAnnounce(`${item.name}, quantity ${next}`);
  };
  const undo = (id: string) => {
    const item = items.find((i) => i.id === id);
    setRemoved(({ [id]: _restored, ...rest }) => rest);
    if (item) setAnnounce(`Restored ${item.name}`);
  };
  /** The undo window closed: drop the item for good. */
  const finalize = useCallback((id: string) => {
    setItems((list) => list.filter((i) => i.id !== id));
    setRemoved(({ [id]: _gone, ...rest }) => rest);
  }, []);
  const addUpsell = () => {
    if (!upsell || items.some((i) => i.id === upsell.id)) return;
    const { pitch: _pitch, ...item } = upsell;
    setItems((list) => [...list, { ...item, qty: 1 }]);
    setAnnounce(`Added ${upsell.name}`);
  };

  return {
    items,
    removed,
    live,
    count,
    subtotal,
    remaining,
    unlocked: remaining === 0 && subtotal > 0,
    progress: threshold > 0 ? Math.min(1, subtotal / threshold) : 1,
    showUpsell: !!upsell && !items.some((i) => i.id === upsell.id),
    announce,
    setQty,
    remove,
    undo,
    finalize,
    addUpsell,
  };
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/** Modal focus: move focus into the panel on open, trap Tab, close on Esc, and return focus to the trigger. */
function useDialogFocus(open: boolean, panel: RefObject<HTMLDivElement | null>, trigger: RefObject<HTMLButtonElement | null>, close: () => void) {
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      // The panel itself takes focus (not the close button), so no stray ring appears on open.
      const frame = requestAnimationFrame(() => panel.current?.focus());
      return () => cancelAnimationFrame(frame);
    }
    if (wasOpen.current) trigger.current?.focus();
    wasOpen.current = false;
  }, [open, panel, trigger]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      const root = panel.current;
      if (e.key !== "Tab" || !root) return;
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !root.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, panel, close]);
}

function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}

/**
 * A figure in a motion value. It counts up from zero when it first mounts
 * (after `delay`), then tweens to each new value. Reduced motion sets it.
 */
function useTweened(value: number, reduce: boolean, delay: number, fromZero: boolean): MotionValue<number> {
  const mv = useMotionValue(fromZero && !reduce ? 0 : value);
  // Set when the first count lands (not when it starts), so an effect re-run in Strict Mode replays it rather than skipping it.
  const counted = useRef(!fromZero);
  useEffect(() => {
    if (reduce) {
      mv.jump(value);
      counted.current = true;
      return;
    }
    const controls = counted.current
      ? animate(mv, value, { duration: 0.35, ease: EASE })
      : animate(mv, value, { delay, duration: T.countDur, ease: EASE, onComplete: () => (counted.current = true) });
    return () => controls.stop();
    // The delay only applies to the first count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce, mv]);
  return mv;
}

/* ------------------------------------------------------------------ */
/* CartDrawer                                                          */
/* ------------------------------------------------------------------ */

export function CartDrawer({
  items: initialItems = DEFAULT_ITEMS,
  upsell = DEFAULT_UPSELL,
  freeShippingThreshold = 75,
  shippingFee = 4.95,
  currency = "GBP",
  locale = "en-GB",
  title = "Your bag",
  shipsFrom = "ships from Hebden Bridge",
  note = "VAT included. Free returns within 60 days, no questions.",
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  onCheckout,
  strategy = "fixed",
  undoSeconds = 5,
  accent = DEFAULT_ACCENT,
  theme = "dark",
}: CartDrawerProps) {
  const cart = useCart(initialItems, upsell, freeShippingThreshold);
  const [openState, setOpenState] = useState(defaultOpen);
  const open = openProp ?? openState;
  const setOpen = useCallback(
    (next: boolean) => {
      if (openProp === undefined) setOpenState(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );
  const close = useCallback(() => setOpen(false), [setOpen]);
  // Once the panel has landed, rows added later (the upsell) rise in at once instead of waiting for an entrance slot.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!open) setSettled(false);
  }, [open]);

  const reduce = !!useReducedMotion();
  const mobile = useMediaQuery(PHONE_QUERY);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dragControls = useDragControls();
  const titleId = useId();
  const statusId = useId();
  useDialogFocus(open, panel, trigger, close);
  useScrollLock(open && strategy === "fixed");

  const fmt = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency }), [locale, currency]);
  const money = useCallback((n: number) => fmt.format(n), [fmt]);
  const shipping = cart.unlocked || cart.subtotal === 0 ? 0 : shippingFee;
  const pos = strategy === "fixed" ? "fixed" : "absolute";
  const v = (variants: Variants) => (reduce ? fade : variants);

  const p = PALETTE[theme];
  const vars = {
    "--cd-panel": p.panel,
    "--cd-raised": p.raised,
    "--cd-thumb": p.thumb,
    "--cd-ink": p.ink,
    "--cd-on-ink": p.onInk,
    "--cd-scrim": p.scrim,
    "--cd-shadow": p.shadow,
    "--cd-accent": accent,
    "--cd-on-accent": ON_ACCENT,
  } as CSSProperties;

  const onSheetDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > SHEET_DISMISS.offset || info.velocity.y > SHEET_DISMISS.velocity) close();
  };

  return (
    <div style={vars} className="contents">
      <button
        ref={trigger}
        type="button"
        data-demo="bag"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`inline-flex h-11 items-center gap-2.5 rounded-full bg-(--cd-ink) pl-4 pr-1.5 text-[14px] font-medium text-(--cd-on-ink) transition-[transform,background-color] duration-150 hover:bg-(--cd-ink)/90 active:scale-[0.97] ${FOCUS} focus-visible:ring-offset-2 focus-visible:ring-offset-(--cd-panel)`}
      >
        <ShoppingBag size={16} strokeWidth={2} aria-hidden="true" />
        Bag
        <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-(--cd-on-ink) px-2 font-mono text-[12px] tabular-nums text-(--cd-ink)">{cart.count}</span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="scrim"
            className={`${pos} inset-0 z-40 bg-(--cd-scrim) backdrop-blur-[2px]`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            onClick={close}
            aria-hidden="true"
          />
        ) : null}
        {open ? (
          <motion.div
            key="panel"
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={statusId}
            tabIndex={-1}
            variants={panelMotion(mobile, reduce)}
            initial="hidden"
            animate="show"
            exit="exit"
            drag={mobile && !reduce ? "y" : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={onSheetDragEnd}
            onAnimationComplete={(definition) => definition === "show" && setSettled(true)}
            className={`${pos} inset-x-0 bottom-0 top-3 z-50 flex flex-col overflow-hidden rounded-t-[22px] bg-(--cd-panel) text-(--cd-ink) shadow-(--cd-shadow) outline-none sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 sm:w-[440px] sm:rounded-none`}
          >
            <SheetHandle mobile={mobile} reduce={reduce} controls={dragControls} />

            <motion.div variants={v(reveal)} custom={T.header} className="flex items-start justify-between gap-4 px-5 pb-4 pt-2 sm:px-7 sm:pt-6">
              <div>
                <h2 id={titleId} className="font-display text-[28px] font-bold leading-none tracking-[-0.035em]">
                  {title}
                </h2>
                <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-(--cd-ink)/55">
                  {cart.count} {cart.count === 1 ? "item" : "items"} · {shipsFrom}
                </p>
              </div>
              <button
                type="button"
                data-demo="close"
                onClick={close}
                aria-label="Close bag"
                className={`-mr-2 -mt-1 flex size-11 items-center justify-center rounded-full transition-[background-color,transform] duration-150 hover:bg-(--cd-ink)/[0.07] active:scale-[0.94] ${FOCUS}`}
              >
                <X size={20} strokeWidth={2} aria-hidden="true" />
              </button>
            </motion.div>

            <motion.div variants={v(reveal)} custom={T.meter} id={statusId} className="mx-5 rounded-[14px] bg-(--cd-ink)/[0.04] px-4 py-3.5 sm:mx-7">
              <ShippingMeter
                progress={cart.progress}
                unlocked={cart.unlocked}
                remaining={money(cart.remaining)}
                threshold={freeShippingThreshold}
                subtotal={cart.subtotal}
                money={money}
                reduce={reduce}
              />
            </motion.div>

            <div className="mt-2 flex-1 overflow-y-auto overscroll-contain px-5 sm:px-7">
              {cart.items.length === 0 ? (
                <EmptyBag variants={v} />
              ) : (
                <ul className="divide-y divide-(--cd-ink)/10">
                  {/* No initial={false} here: it would also skip each row's own entrance. Rows skip the height grow themselves until the panel settles. */}
                  <AnimatePresence>
                    {cart.items.map((item, i) =>
                      cart.removed[item.id] ? (
                        <UndoRow key={`${item.id}-undo`} item={item} seconds={undoSeconds} onUndo={() => cart.undo(item.id)} onExpire={() => cart.finalize(item.id)} reduce={reduce} />
                      ) : (
                        <LineItem
                          key={item.id}
                          item={item}
                          delay={settled ? T.added : T.items + i * T.itemStep}
                          grow={settled}
                          money={money}
                          reduce={reduce}
                          variants={v}
                          onQty={(q) => cart.setQty(item.id, q)}
                          onRemove={() => cart.remove(item.id)}
                        />
                      ),
                    )}
                  </AnimatePresence>
                </ul>
              )}

              <AnimatePresence>
                {cart.showUpsell && upsell ? <Upsell key="upsell" upsell={upsell} money={money} onAdd={cart.addUpsell} reduce={reduce} variants={v} /> : null}
              </AnimatePresence>
            </div>

            <motion.div variants={v(reveal)} custom={T.footer}>
              <CartFooter
                subtotal={cart.subtotal}
                shipping={shipping}
                unlocked={cart.unlocked}
                money={money}
                reduce={reduce}
                disabled={cart.live.length === 0}
                onCheckout={() => onCheckout?.(cart.live)}
                note={note}
              />
            </motion.div>

            <span className="sr-only" aria-live="polite">
              {cart.announce}
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

type VariantPicker = (v: Variants) => Variants;

function SheetHandle({ mobile, reduce, controls }: { mobile: boolean; reduce: boolean; controls: DragControls }) {
  if (!mobile) return null;
  return (
    <div
      className="flex h-7 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
      onPointerDown={(e) => {
        if (!reduce) controls.start(e);
      }}
      aria-hidden="true"
    >
      <span className="h-1 w-10 rounded-full bg-(--cd-ink)/25" />
    </div>
  );
}

/** A currency figure driven by a motion value: counts, never jumps, never re-renders per frame. A short blur rides the speed. */
function Money({
  value,
  money,
  reduce,
  delay = 0,
  fromZero = false,
  className = "",
}: {
  value: number;
  money: (n: number) => string;
  reduce: boolean;
  delay?: number;
  fromZero?: boolean;
  className?: string;
}) {
  const mv = useTweened(value, reduce, delay, fromZero);
  const text = useTransform(mv, (n) => money(Math.round(n * 100) / 100));
  const velocity = useVelocity(mv);
  const filter = useTransform(velocity, (s) => (reduce ? "none" : `blur(${Math.min(1.6, Math.abs(s) / 60).toFixed(2)}px)`));
  return (
    <motion.span className={`inline-block tabular-nums ${className}`} style={{ filter }}>
      {text}
    </motion.span>
  );
}

/** Free-shipping progress. One motion value drives the fill and the truck riding its end; it fills once the card has landed. */
function ShippingMeter({
  progress,
  unlocked,
  remaining,
  threshold,
  subtotal,
  money,
  reduce,
}: {
  progress: number;
  unlocked: boolean;
  remaining: string;
  threshold: number;
  subtotal: number;
  money: (n: number) => string;
  reduce: boolean;
}) {
  const fill = useMotionValue(reduce ? progress : 0);
  const filled = useRef(false);
  const width = useTransform(fill, (f) => `${f * 100}%`);
  // The truck never sits fully off the left end, so it's visible on an empty bag.
  const left = useTransform(fill, (f) => `${Math.max(f, 0.04) * 100}%`);
  const truckRotate = useMotionValue(0);

  useEffect(() => {
    if (reduce) {
      fill.jump(progress);
      return;
    }
    const controls = animate(fill, progress, filled.current ? SPRING_METER : { ...SPRING_METER, delay: T.meterFill, onComplete: () => (filled.current = true) });
    return () => controls.stop();
  }, [progress, reduce, fill]);

  // One small wiggle when free shipping unlocks.
  useEffect(() => {
    if (!unlocked || reduce) return;
    const controls = animate(truckRotate, [0, -8, 0], { duration: 0.4, ease: EASE, delay: 0.2 });
    return () => controls.stop();
  }, [unlocked, reduce, truckRotate]);

  return (
    <>
      <p className="flex min-h-5 items-center gap-2 text-[13px] leading-snug" aria-live="polite">
        {unlocked ? (
          <>
            <span className="flex size-5 items-center justify-center rounded-full bg-(--cd-ink) text-(--cd-on-ink)">
              <Check size={12} strokeWidth={3} aria-hidden="true" />
            </span>
            <span>
              <strong className="font-semibold">Free shipping unlocked.</strong> Nicely done.
            </span>
          </>
        ) : (
          <span>
            You’re <strong className="font-semibold tabular-nums">{remaining}</strong> away from free shipping.
          </span>
        )}
      </p>
      <div
        className="relative mt-3 h-2 rounded-full bg-(--cd-ink)/10"
        role="progressbar"
        aria-label="Progress to free shipping"
        aria-valuemin={0}
        aria-valuemax={threshold}
        aria-valuenow={Math.min(subtotal, threshold)}
      >
        <motion.div className="absolute inset-y-0 left-0 rounded-full bg-(--cd-ink)" style={{ width }} />
        <motion.div
          className="absolute top-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-(--cd-panel) shadow-[0_0_0_1.5px_var(--cd-ink)]"
          style={{ left, rotate: truckRotate }}
          aria-hidden="true"
        >
          <Truck size={14} strokeWidth={2} />
        </motion.div>
      </div>
      <div className="mt-2.5 flex justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-(--cd-ink)/50 tabular-nums">
        <span>{money(0)}</span>
        <span>Free over {money(threshold)}</span>
      </div>
    </>
  );
}

function LineItem({
  item,
  delay,
  grow,
  money,
  reduce,
  variants: v,
  onQty,
  onRemove,
}: {
  item: CartItem;
  delay: number;
  /** Grow in height from zero: only for rows added after the drawer has opened. */
  grow: boolean;
  money: (n: number) => string;
  reduce: boolean;
  variants: VariantPicker;
  onQty: (qty: number) => void;
  onRemove: () => void;
}) {
  return (
    // The row grows and collapses in height when added or removed; its content rises in on open.
    <motion.li
      layout={!reduce}
      initial={grow ? (reduce ? { opacity: 0 } : { opacity: 0, height: 0 }) : false}
      animate={{ opacity: 1, height: "auto" }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="overflow-hidden"
    >
      {/* Its own initial/animate: a row mounted after the panel has shown wouldn't pick up the entrance. */}
      <motion.div variants={v(reveal)} custom={delay} initial="hidden" animate="show" className="flex gap-4 py-4">
        <Thumb art={item.art} color={item.color} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold leading-snug tracking-[-0.01em]">{item.name}</p>
              <p className="mt-0.5 text-[13px] text-(--cd-ink)/60">{item.variant}</p>
            </div>
            <Money value={item.price * item.qty} money={money} reduce={reduce} className="text-[15px] font-medium" />
          </div>
          <div className="mt-auto flex items-center justify-between gap-3 pt-3">
            <Stepper value={item.qty} name={item.name} demoId={item.id} onChange={onQty} reduce={reduce} />
            <button
              type="button"
              data-demo={`remove-${item.id}`}
              onClick={onRemove}
              aria-label={`Remove ${item.name}`}
              className={`h-11 rounded-full px-2 text-[13px] text-(--cd-ink)/60 underline decoration-(--cd-ink)/25 underline-offset-4 transition-[color,text-decoration-color] duration-150 hover:text-(--cd-ink) hover:decoration-(--cd-ink) sm:h-9 ${FOCUS}`}
            >
              Remove
            </button>
          </div>
        </div>
      </motion.div>
    </motion.li>
  );
}

function Stepper({ value, name, demoId, onChange, reduce }: { value: number; name: string; demoId: string; onChange: (v: number) => void; reduce: boolean }) {
  const btn = `flex size-11 items-center justify-center rounded-full transition-[background-color,transform] duration-150 hover:bg-(--cd-ink)/[0.08] active:scale-90 disabled:opacity-30 disabled:active:scale-100 sm:size-9 ${FOCUS}`;
  // The number rolls up or down with the change, so the direction reads.
  const prev = useRef(value);
  const dir = value >= prev.current ? 1 : -1;
  useEffect(() => {
    prev.current = value;
  }, [value]);
  return (
    <div className="flex items-center rounded-full bg-(--cd-ink)/[0.04] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--cd-ink)_10%,transparent)]" role="group" aria-label={`Quantity of ${name}`}>
      <button type="button" className={btn} onClick={() => onChange(value - 1)} aria-label={value === 1 ? `Remove the last ${name}` : `Decrease quantity of ${name}`}>
        <Minus size={14} strokeWidth={2.25} aria-hidden="true" />
      </button>
      <span className="relative h-5 w-6 overflow-hidden text-center font-mono text-[13px] leading-5 tabular-nums" aria-live="off">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.span
            key={value}
            custom={dir}
            variants={{
              enter: (d: number) => (reduce ? { opacity: 0 } : { y: d * 14, opacity: 0, filter: "blur(2px)" }),
              center: { y: 0, opacity: 1, filter: "blur(0px)" },
              exit: (d: number) => (reduce ? { opacity: 0 } : { y: d * -14, opacity: 0, filter: "blur(2px)" }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: EASE }}
            className="block"
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
      <button type="button" data-demo={`qty-add-${demoId}`} className={btn} onClick={() => onChange(value + 1)} disabled={value >= MAX_QTY} aria-label={`Increase quantity of ${name}`}>
        <Plus size={14} strokeWidth={2.25} aria-hidden="true" />
      </button>
    </div>
  );
}

/** Undo lives where the item was. A hairline drains over the window; hover or focus pauses it, and it finalises when empty. */
function UndoRow({ item, seconds, onUndo, onExpire, reduce }: { item: CartItem; seconds: number; onUndo: () => void; onExpire: () => void; reduce: boolean }) {
  const [paused, setPaused] = useState(false);
  const drain = useMotionValue(1);
  useEffect(() => {
    if (paused) return;
    // Resume from wherever the drain was paused, for the time that's left.
    const controls = animate(drain, 0, { duration: drain.get() * seconds, ease: "linear", onComplete: onExpire });
    return () => controls.stop();
  }, [paused, seconds, drain, onExpire]);

  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative my-3 flex items-center justify-between gap-3 overflow-hidden rounded-[12px] bg-(--cd-raised) py-2 pl-4 pr-2 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--cd-ink)_6%,transparent)]">
        <p className="min-w-0 truncate text-[13px]">
          Removed <span className="font-semibold">{item.name}</span>
        </p>
        <button
          type="button"
          data-demo={`undo-${item.id}`}
          onClick={onUndo}
          className={`h-9 shrink-0 rounded-full bg-(--cd-ink) px-4 text-[13px] font-semibold text-(--cd-on-ink) transition-transform duration-150 active:scale-[0.96] ${FOCUS} focus-visible:ring-offset-2 focus-visible:ring-offset-(--cd-raised)`}
        >
          Undo
        </button>
        <motion.span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-(--cd-ink)/50" style={{ scaleX: drain }} />
      </div>
    </motion.li>
  );
}

function Upsell({
  upsell,
  money,
  onAdd,
  reduce,
  variants: v,
}: {
  upsell: CartUpsell;
  money: (n: number) => string;
  onAdd: () => void;
  reduce: boolean;
  variants: VariantPicker;
}) {
  return (
    <motion.div
      exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="mb-5 overflow-hidden"
    >
      <motion.div variants={v(reveal)} custom={T.upsell} initial="hidden" animate="show" className="flex items-center gap-3.5 rounded-[14px] border border-dashed border-(--cd-ink)/20 p-3">
        <Thumb art={upsell.art} color={upsell.color} small />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-(--cd-ink)/50">Pairs well</p>
          <p className="mt-0.5 text-[14px] font-semibold leading-snug">{upsell.name}</p>
          <p className="text-[12px] leading-snug text-(--cd-ink)/60">{upsell.pitch}</p>
        </div>
        <button
          type="button"
          data-demo="upsell-add"
          onClick={onAdd}
          aria-label={`Add ${upsell.name} for ${money(upsell.price)}`}
          className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-(--cd-ink)/[0.07] px-3.5 text-[13px] font-semibold transition-[background-color,color,transform] duration-150 hover:bg-(--cd-ink) hover:text-(--cd-on-ink) active:scale-[0.96] sm:h-9 ${FOCUS}`}
        >
          <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
          {money(upsell.price)}
        </button>
      </motion.div>
    </motion.div>
  );
}

function EmptyBag({ variants: v }: { variants: VariantPicker }) {
  return (
    <motion.div variants={v(reveal)} custom={T.items} initial="hidden" animate="show" className="flex h-full flex-col items-center justify-center py-16 text-center">
      <ShoppingBag size={28} strokeWidth={1.5} aria-hidden="true" className="text-(--cd-ink)/40" />
      <p className="mt-4 font-display text-[20px] font-semibold tracking-[-0.02em]">Nothing in here yet.</p>
      <p className="mt-1 text-[14px] text-(--cd-ink)/60">The notebooks are a good place to start.</p>
    </motion.div>
  );
}

function CartFooter({
  subtotal,
  shipping,
  unlocked,
  money,
  reduce,
  disabled,
  onCheckout,
  note,
}: {
  subtotal: number;
  shipping: number;
  unlocked: boolean;
  money: (n: number) => string;
  reduce: boolean;
  disabled: boolean;
  onCheckout: () => void;
  note: string;
}) {
  return (
    <div className="border-t border-(--cd-ink)/10 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-4 sm:px-7 sm:pb-7">
      <dl className="space-y-1.5 text-[14px]">
        <div className="flex justify-between">
          <dt className="text-(--cd-ink)/65">Subtotal</dt>
          <dd>
            <Money value={subtotal} money={money} reduce={reduce} delay={T.count} fromZero />
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-(--cd-ink)/65">Shipping</dt>
          <dd className="tabular-nums">{subtotal === 0 ? "—" : unlocked ? <span className="font-medium">Free</span> : money(shipping)}</dd>
        </div>
      </dl>
      <button
        type="button"
        data-demo="checkout"
        disabled={disabled}
        onClick={onCheckout}
        className={`group mt-4 flex h-14 w-full items-center justify-between rounded-full bg-(--cd-ink) pl-6 pr-2 text-[15px] font-semibold text-(--cd-on-ink) transition-[background-color,transform] duration-150 hover:bg-(--cd-ink)/92 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 ${FOCUS} focus-visible:ring-offset-2 focus-visible:ring-offset-(--cd-panel)`}
      >
        <span className="flex items-center gap-2">
          <Lock size={15} strokeWidth={2.25} aria-hidden="true" />
          Checkout
        </span>
        {/* The one accent: the amount you're about to pay. */}
        <span className="flex h-10 items-center rounded-full bg-(--cd-accent) px-4 text-(--cd-on-accent)">
          <Money value={subtotal + shipping} money={money} reduce={reduce} delay={T.count + 0.06} fromZero />
        </span>
      </button>
      <p className="mt-3 text-center text-[12px] text-(--cd-ink)/55">{note}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Thumbnails, drawn rather than photographed                          */
/* ------------------------------------------------------------------ */

/** Ink for printed marks on the goods (labels, stamps): part of the drawing, not the theme. */
const THUMB_INK = "#14261c";

function ThumbArt({ art, color, sheen }: { art: CartArt; color: string; sheen: string }) {
  const fillSheen = `url(#${sheen})`;
  switch (art) {
    case "notebook":
      return (
        <>
          <rect x="16" y="12" width="44" height="60" rx="3" fill={color} />
          <rect x="16" y="12" width="44" height="60" rx="3" fill={fillSheen} />
          <rect x="16" y="12" width="5" height="60" rx="2" fill="#000" opacity="0.18" />
          <rect x="50" y="12" width="3" height="60" fill="#1b1b18" opacity="0.75" />
          <rect x="27" y="26" width="18" height="10" rx="1.5" fill="#efe8da" />
          <path d="M30 30h12M30 33h8" stroke={THUMB_INK} strokeWidth="0.9" opacity="0.5" />
          <path d="M60 15v54" stroke="#fff" strokeWidth="0.8" opacity="0.35" />
        </>
      );
    case "mug":
      return (
        <>
          <path d="M56 36h4a8 8 0 0 1 0 16h-4" fill="none" stroke={color} strokeWidth="4.5" />
          <path d="M56 36h4a8 8 0 0 1 0 16h-4" fill="none" stroke="#000" strokeOpacity="0.12" strokeWidth="4.5" />
          <path d="M18 28h40v32a8 8 0 0 1-8 8H26a8 8 0 0 1-8-8z" fill={color} />
          <path d="M18 28h40v32a8 8 0 0 1-8 8H26a8 8 0 0 1-8-8z" fill={fillSheen} />
          <ellipse cx="38" cy="28" rx="20" ry="3.4" fill="#2d3b33" />
          <ellipse cx="38" cy="28" rx="18" ry="2.4" fill="#3d4c43" />
          <path d="M18 28h40" stroke="#1f2a24" strokeWidth="1.6" />
          <circle cx="38" cy="48" r="5" fill="none" stroke={THUMB_INK} strokeWidth="1" opacity="0.4" />
          <path d="M35.5 49.5 38 45l2.5 4.5z" fill={THUMB_INK} opacity="0.4" />
        </>
      );
    case "socks":
      return (
        <>
          <path d="M30 10h20v34c0 4 2 6 6 9l4 3c5 4 3 12-4 12-3 0-5-1-8-3l-12-9c-4-3-6-7-6-12z" fill={color} />
          <path d="M30 10h20v34c0 4 2 6 6 9l4 3c5 4 3 12-4 12-3 0-5-1-8-3l-12-9c-4-3-6-7-6-12z" fill={fillSheen} />
          <path d="M30 10h20v8H30z" fill="#efe8da" />
          <path d="M30 13h20M30 16h20" stroke={color} strokeWidth="1" opacity="0.6" />
          <path d="M30 24h20M30 28h20" stroke="#000" strokeOpacity="0.12" strokeWidth="1" />
          <path d="M50 60c3 3 7 4 10 2" fill="none" stroke="#efe8da" strokeWidth="5" strokeLinecap="round" opacity="0.9" />
        </>
      );
    case "pencil":
      return (
        <g transform="rotate(-38 38 42)">
          <rect x="12" y="38" width="46" height="9" rx="4.5" fill={color} />
          <rect x="12" y="38" width="46" height="9" rx="4.5" fill={fillSheen} />
          <path d="M58 38.6 68 42.5 58 46.4z" fill="#e8d9b5" />
          <path d="M65 41.4 68 42.5 65 43.6z" fill="#2a2a26" />
          <path d="M20 38v9M23 38v9" stroke="#000" strokeOpacity="0.2" strokeWidth="1" />
          <path d="M14 40h42" stroke="#fff" strokeOpacity="0.45" strokeWidth="1" />
        </g>
      );
  }
}

function Thumb({ art, color, small = false }: { art: CartArt; color: string; small?: boolean }) {
  const sheen = useId();
  return (
    <div className={`${small ? "h-16 w-14" : "h-[84px] w-[72px]"} shrink-0 overflow-hidden rounded-[10px] bg-(--cd-thumb)`} aria-hidden="true">
      <svg viewBox="0 0 76 84" className="size-full">
        <defs>
          <linearGradient id={sheen} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0.18" />
            <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.16" />
          </linearGradient>
        </defs>
        <ellipse cx="38" cy="76" rx="24" ry="3" fill="#000" opacity="0.08" />
        <ThumbArt art={art} color={color} sheen={sheen} />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Demo: the drawer open over a quiet stage                            */
/* ------------------------------------------------------------------ */

/**
 * The only context the drawer needs: the bar its trigger lives in. No storefront behind it.
 * `open` is lifted into the demo so a control can open and close the drawer while the
 * built-in trigger, the scrim and Esc keep working.
 */
export default function CartDrawerDemo({ open: forcedOpen, onOpenChange, ...overrides }: Partial<CartDrawerProps> = {}) {
  const [open, setOpen] = useState(forcedOpen ?? true);
  useEffect(() => {
    // Clearing the override returns to the demo's resting state: open.
    setOpen(forcedOpen ?? true);
  }, [forcedOpen]);
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };
  return (
    <Stage theme={overrides.theme}>
      <CartDrawer strategy="absolute" {...overrides} open={open} onOpenChange={handleOpenChange} />
    </Stage>
  );
}

export { CartDrawerDemo };

function Stage({ theme = "dark", children }: { theme?: "dark" | "light"; children: ReactNode }) {
  return (
    <div className={`relative h-dvh min-h-[720px] overflow-hidden transition-colors duration-300 ${theme === "light" ? "bg-[#f4f4f5]" : "bg-[#08080a]"}`}>
      <div className="flex justify-end px-5 py-4 sm:px-8">{children}</div>
    </div>
  );
}
