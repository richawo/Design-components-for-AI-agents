"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useDragControls, useReducedMotion, type DragControls, type PanInfo } from "motion/react";
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
  /** Main colour of the drawn thumbnail. */
  color: string;
};

export type CartUpsell = {
  id: string;
  name: string;
  pitch: string;
  price: number;
  art: CartArt;
  color: string;
  variant: string;
};

export type CartDrawerProps = {
  items?: CartItem[];
  upsell?: CartUpsell | null;
  /** Spend that unlocks free shipping. */
  freeShippingThreshold?: number;
  shippingFee?: number;
  currency?: string;
  locale?: string;
  title?: string;
  /** Controlled open state. Leave undefined to let the component manage it. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCheckout?: (items: CartItem[]) => void;
  /** "fixed" covers the viewport; "absolute" stays inside the nearest positioned parent. */
  strategy?: "fixed" | "absolute";
  /** Seconds the undo bar stays after removing an item. */
  undoSeconds?: number;
};

const ease = [0.2, 0.8, 0.2, 1] as const;

const defaultItems: CartItem[] = [
  { id: "nb", name: "Waxed field notebook", variant: "A5 · Olive · Dot grid", price: 18, qty: 2, art: "notebook", color: "#6b7440" },
  { id: "mug", name: "Enamel camp mug", variant: "350 ml · Bone", price: 16, qty: 1, art: "mug", color: "#efe8da" },
  { id: "sock", name: "Merino trail socks", variant: "Rust · Size M", price: 14, qty: 1, art: "socks", color: "#b65a32" },
];

const defaultUpsell: CartUpsell = {
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

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return mobile;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/* ------------------------------------------------------------------ */
/* CartDrawer                                                          */
/* ------------------------------------------------------------------ */

export function CartDrawer({
  items: initialItems = defaultItems,
  upsell = defaultUpsell,
  freeShippingThreshold = 75,
  shippingFee = 4.95,
  currency = "GBP",
  locale = "en-GB",
  title = "Your bag",
  open: openProp,
  defaultOpen = true,
  onOpenChange,
  onCheckout,
  strategy = "fixed",
  undoSeconds = 5,
}: CartDrawerProps) {
  const [items, setItems] = useState(initialItems);
  const [removed, setRemoved] = useState<Record<string, { item: CartItem; index: number }>>({});
  const [upsellAdded, setUpsellAdded] = useState(false);
  const [openState, setOpenState] = useState(defaultOpen);
  const open = openProp ?? openState;
  const setOpen = useCallback(
    (v: boolean) => {
      if (openProp === undefined) setOpenState(v);
      onOpenChange?.(v);
    },
    [openProp, onOpenChange],
  );

  const reduce = useReducedMotion();
  const mobile = useIsMobile();
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dragControls = useDragControls();
  const titleId = useId();
  const statusId = useId();
  const [announce, setAnnounce] = useState("");

  const fmt = useMemo(() => new Intl.NumberFormat(locale, { style: "currency", currency }), [locale, currency]);
  const money = (n: number) => fmt.format(n);

  const live = items.filter((i) => !removed[i.id]);
  const count = live.reduce((a, i) => a + i.qty, 0);
  const subtotal = live.reduce((a, i) => a + i.qty * i.price, 0);
  const remaining = Math.max(0, freeShippingThreshold - subtotal);
  const unlocked = remaining === 0 && subtotal > 0;
  const progress = Math.min(1, subtotal / freeShippingThreshold);

  /* Focus management: trap inside the panel, Esc closes, focus returns to the trigger. */
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open) {
      // Focus the dialog itself (not the close button) so no stray focus ring appears on open.
      const t = setTimeout(() => panel.current?.focus(), reduce ? 0 : 60);
      wasOpen.current = true;
      return () => clearTimeout(t);
    }
    if (wasOpen.current) trigger.current?.focus();
    wasOpen.current = false;
  }, [open, reduce]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const nodes = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  // Lock page scroll while a fixed drawer is open.
  useEffect(() => {
    if (!open || strategy !== "fixed") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, strategy]);

  /* Cart actions */
  const setQty = (id: string, qty: number) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    if (qty < 1) return remove(id);
    setItems((list) => list.map((i) => (i.id === id ? { ...i, qty: Math.min(qty, 9) } : i)));
    setAnnounce(`${item.name}, quantity ${Math.min(qty, 9)}`);
  };
  const remove = (id: string) => {
    const index = items.findIndex((i) => i.id === id);
    if (index < 0) return;
    setRemoved((r) => ({ ...r, [id]: { item: items[index], index } }));
    setAnnounce(`Removed ${items[index].name}. Undo available.`);
  };
  const undo = (id: string) => {
    setRemoved(({ [id]: restored, ...rest }) => {
      if (restored) setAnnounce(`Restored ${restored.item.name}`);
      return rest;
    });
  };
  const finalize = useCallback((id: string) => {
    setItems((list) => list.filter((i) => i.id !== id));
    setRemoved(({ [id]: _gone, ...rest }) => rest);
  }, []);
  const addUpsell = () => {
    if (!upsell) return;
    setItems((list) => [...list, { id: upsell.id, name: upsell.name, variant: upsell.variant, price: upsell.price, qty: 1, art: upsell.art, color: upsell.color }]);
    setUpsellAdded(true);
    setAnnounce(`Added ${upsell.name}`);
  };
  const showUpsell = upsell && !upsellAdded && !items.some((i) => i.id === upsell.id);

  const pos = strategy === "fixed" ? "fixed" : "absolute";

  const onSheetDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 140 || info.velocity.y > 700) setOpen(false);
  };

  // Animate both axes to 0 so switching between drawer and sheet mid-flight never strands the panel.
  const panelMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1, x: 0, y: 0 }, exit: { opacity: 0 } }
    : mobile
      ? { initial: { y: "100%", x: 0 }, animate: { y: 0, x: 0 }, exit: { y: "100%" } }
      : { initial: { x: "100%", y: 0 }, animate: { x: 0, y: 0 }, exit: { x: "100%" } };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex h-11 items-center gap-2.5 rounded-full bg-white pl-4 pr-2 text-[14px] font-medium text-black outline-none transition-transform hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#efe9dc]"
      >
        <ShoppingBag size={16} strokeWidth={2} aria-hidden="true" />
        Bag
        <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-[#d7e3a4] px-2 font-mono text-[12px] tabular-nums text-black">{count}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="scrim"
            className={`${pos} inset-0 z-40 bg-black/60 backdrop-blur-[2px]`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        )}
        {open && (
          <motion.div
            key="panel"
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={statusId}
            {...panelMotion}
            transition={reduce ? { duration: 0.15 } : { type: "spring", stiffness: 340, damping: 36, mass: 0.9 }}
            tabIndex={-1}
            drag={mobile && !reduce ? "y" : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={onSheetDragEnd}
            className={`${pos} inset-x-0 outline-none bottom-0 top-3 z-50 flex flex-col overflow-hidden rounded-t-[22px] bg-[#0b0b0c] text-white shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.9),inset_1px_0_0_rgba(255,255,255,0.08)] sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 sm:w-[440px] sm:rounded-none sm:shadow-[-24px_0_60px_-24px_rgba(13,26,18,0.45)]`}
          >
            <SheetHandle mobile={mobile} reduce={!!reduce} controls={dragControls} />

            {/* Header */}
            <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-2 sm:px-7 sm:pt-6">
              <div>
                <h2 id={titleId} className="font-display text-[28px] font-bold leading-none tracking-[-0.035em]">
                  {title}
                </h2>
                <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/55">
                  {count} {count === 1 ? "item" : "items"} · ships from Hebden Bridge
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close bag"
                className="-mr-2 -mt-1 flex size-11 items-center justify-center rounded-full text-white outline-none transition-colors hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-white"
              >
                <X size={20} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            {/* Free shipping */}
            <div id={statusId} className="mx-5 rounded-[14px] bg-white/[0.04] px-4 py-3.5 sm:mx-7">
              <p className="flex items-center gap-2 text-[13px] leading-snug" aria-live="polite">
                {unlocked ? (
                  <>
                    <span className="flex size-5 items-center justify-center rounded-full bg-[#d7e3a4] text-black">
                      <Check size={12} strokeWidth={3} aria-hidden="true" />
                    </span>
                    <span>
                      <strong className="font-semibold">Free shipping unlocked.</strong> Nicely done.
                    </span>
                  </>
                ) : (
                  <span>
                    You’re <strong className="font-semibold tabular-nums">{money(remaining)}</strong> away from free shipping.
                  </span>
                )}
              </p>
              <div
                className="relative mt-3 h-2 rounded-full bg-white/[0.1]"
                role="progressbar"
                aria-label="Progress to free shipping"
                aria-valuemin={0}
                aria-valuemax={freeShippingThreshold}
                aria-valuenow={Math.min(subtotal, freeShippingThreshold)}
              >
                <motion.div
                  className={`absolute inset-y-0 left-0 rounded-full ${unlocked ? "bg-[#d7e3a4]" : "bg-white"}`}
                  initial={false}
                  animate={{ width: `${progress * 100}%` }}
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20 }}
                />
                <motion.div
                  className="absolute top-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#0b0b0c] text-white shadow-[0_0_0_1.5px_#ffffff]"
                  initial={false}
                  animate={{ left: `${Math.max(progress, 0.04) * 100}%`, rotate: unlocked ? [0, -8, 0] : 0 }}
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 20 }}
                  aria-hidden="true"
                >
                  <Truck size={14} strokeWidth={2} />
                </motion.div>
              </div>
              <div className="mt-2.5 flex justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-white/50 tabular-nums">
                <span>{money(0)}</span>
                <span>Free over {money(freeShippingThreshold)}</span>
              </div>
            </div>

            {/* Items */}
            <div className="mt-2 flex-1 overflow-y-auto overscroll-contain px-5 sm:px-7">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                  <ShoppingBag size={28} strokeWidth={1.5} aria-hidden="true" className="text-white/40" />
                  <p className="mt-4 font-display text-[20px] font-semibold tracking-[-0.02em]">Nothing in here yet.</p>
                  <p className="mt-1 text-[14px] text-white/60">The notebooks are a good place to start.</p>
                </div>
              ) : (
                <ul className="divide-y divide-white/10">
                  <AnimatePresence initial={false}>
                    {items.map((item) =>
                      removed[item.id] ? (
                        <UndoRow key={`${item.id}-undo`} item={item} seconds={undoSeconds} onUndo={() => undo(item.id)} onExpire={() => finalize(item.id)} reduce={!!reduce} />
                      ) : (
                        <motion.li
                          key={item.id}
                          layout={!reduce}
                          initial={reduce ? false : { opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                          transition={{ duration: 0.3, ease }}
                          className="overflow-hidden"
                        >
                          <div className="flex gap-4 py-4">
                            <Thumb art={item.art} color={item.color} />
                            <div className="flex min-w-0 flex-1 flex-col">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[15px] font-semibold leading-snug tracking-[-0.01em]">{item.name}</p>
                                  <p className="mt-0.5 text-[13px] text-white/60">{item.variant}</p>
                                </div>
                                <Price value={item.price * item.qty} format={money} reduce={!!reduce} />
                              </div>
                              <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                                <Stepper value={item.qty} name={item.name} onChange={(q) => setQty(item.id, q)} />
                                <button
                                  type="button"
                                  onClick={() => remove(item.id)}
                                  className="h-11 rounded-full px-2 text-[13px] text-white/60 underline decoration-white/25 underline-offset-4 outline-none transition-colors hover:text-white hover:decoration-white focus-visible:ring-2 focus-visible:ring-white sm:h-9"
                                  aria-label={`Remove ${item.name}`}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.li>
                      ),
                    )}
                  </AnimatePresence>
                </ul>
              )}

              {/* Upsell */}
              <AnimatePresence initial={false}>
                {showUpsell && upsell && (
                  <motion.div
                    key="upsell"
                    initial={false}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.3, ease }}
                    className="mb-5 overflow-hidden"
                  >
                    <div className="flex items-center gap-3.5 rounded-[14px] border border-dashed border-white/25 p-3">
                      <Thumb art={upsell.art} color={upsell.color} small />
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#d7e3a4]">Pairs well</p>
                        <p className="mt-0.5 text-[14px] font-semibold leading-snug">{upsell.name}</p>
                        <p className="text-[12px] leading-snug text-white/60">{upsell.pitch}</p>
                      </div>
                      <button
                        type="button"
                        onClick={addUpsell}
                        className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.07] px-3.5 text-[13px] font-semibold outline-none transition-colors hover:bg-white hover:text-black focus-visible:ring-2 focus-visible:ring-white sm:h-9"
                        aria-label={`Add ${upsell.name} for ${money(upsell.price)}`}
                      >
                        <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
                        {money(upsell.price)}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="border-t border-white/10 bg-[#0b0b0c] px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-4 sm:px-7 sm:pb-7">
              <dl className="space-y-1.5 text-[14px]">
                <div className="flex justify-between">
                  <dt className="text-white/65">Subtotal</dt>
                  <dd className="tabular-nums">
                    <Price value={subtotal} format={money} reduce={!!reduce} plain />
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-white/65">Shipping</dt>
                  <dd className="tabular-nums">{subtotal === 0 ? "—" : unlocked ? <span className="font-medium text-[#d7e3a4]">Free</span> : money(shippingFee)}</dd>
                </div>
              </dl>
              <button
                type="button"
                disabled={live.length === 0}
                onClick={() => onCheckout?.(live)}
                className="group mt-4 flex h-14 w-full items-center justify-between rounded-full bg-white pl-6 pr-2 text-[15px] font-semibold text-black outline-none transition-[background-color,transform] hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0c] active:translate-y-px disabled:opacity-40"
              >
                <span className="flex items-center gap-2">
                  <Lock size={15} strokeWidth={2.25} aria-hidden="true" />
                  Checkout
                </span>
                <span className="flex h-10 items-center rounded-full bg-[#d7e3a4] px-4 tabular-nums text-black">
                  {money(subtotal + (unlocked || subtotal === 0 ? 0 : shippingFee))}
                </span>
              </button>
              <p className="mt-3 text-center text-[12px] text-white/55">VAT included. Free returns within 60 days, no questions.</p>
            </div>
            <span className="sr-only" aria-live="polite">
              {announce}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

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
      <span className="h-1 w-10 rounded-full bg-white/25" />
    </div>
  );
}

function Stepper({ value, name, onChange }: { value: number; name: string; onChange: (v: number) => void }) {
  const btn =
    "flex size-11 items-center justify-center rounded-full text-white outline-none transition-colors hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-white disabled:opacity-30 sm:size-9";
  return (
    <div className="flex items-center rounded-full bg-white/[0.04] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]" role="group" aria-label={`Quantity of ${name}`}>
      <button type="button" className={btn} onClick={() => onChange(value - 1)} aria-label={value === 1 ? `Remove ${name}` : `Decrease quantity of ${name}`}>
        <Minus size={14} strokeWidth={2.25} aria-hidden="true" />
      </button>
      <span className="w-6 text-center font-mono text-[13px] tabular-nums" aria-live="off">
        {value}
      </span>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= 9} aria-label={`Increase quantity of ${name}`}>
        <Plus size={14} strokeWidth={2.25} aria-hidden="true" />
      </button>
    </div>
  );
}

function Price({ value, format, reduce, plain = false }: { value: number; format: (n: number) => string; reduce: boolean; plain?: boolean }) {
  return (
    <span className={`relative inline-flex overflow-hidden tabular-nums ${plain ? "" : "text-[15px] font-medium"}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={reduce ? { opacity: 0 } : { y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { y: "-100%", opacity: 0 }}
          transition={{ duration: 0.28, ease }}
        >
          {format(value)}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function UndoRow({ item, seconds, onUndo, onExpire, reduce }: { item: CartItem; seconds: number; onUndo: () => void; onExpire: () => void; reduce: boolean }) {
  const [paused, setPaused] = useState(false);
  const left = useRef(seconds * 1000);
  useEffect(() => {
    if (paused) return;
    const start = performance.now();
    const t = setTimeout(onExpire, left.current);
    return () => {
      clearTimeout(t);
      left.current -= performance.now() - start;
    };
  }, [paused, onExpire]);
  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease }}
      className="overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative my-3 flex items-center justify-between gap-3 overflow-hidden rounded-[12px] bg-[#1c1c1f] py-2 pl-4 pr-2 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <p className="min-w-0 truncate text-[13px]">
          Removed <span className="font-semibold">{item.name}</span>
        </p>
        <button
          type="button"
          onClick={onUndo}
          className="h-9 shrink-0 rounded-full bg-[#d7e3a4] px-4 text-[13px] font-semibold text-black outline-none focus-visible:ring-2 focus-visible:ring-[#d7e3a4] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c1c1f]"
        >
          Undo
        </button>
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-[#d7e3a4]/70"
          style={{ animation: `tm-cart-drawer-undo ${seconds}s linear forwards`, animationPlayState: paused ? "paused" : "running" }}
        />
      </div>
    </motion.li>
  );
}

/* ------------------------------------------------------------------ */
/* Thumbnails, drawn rather than photographed                          */
/* ------------------------------------------------------------------ */

function Thumb({ art, color, small = false }: { art: CartArt; color: string; small?: boolean }) {
  const id = useId();
  const box = small ? "h-16 w-14" : "h-[84px] w-[72px]";
  const ink = "#14261c";
  let drawing: ReactNode = null;
  if (art === "notebook") {
    drawing = (
      <>
        <rect x="16" y="12" width="44" height="60" rx="3" fill={color} />
        <rect x="16" y="12" width="44" height="60" rx="3" fill={`url(#${id}-sheen)`} />
        <rect x="16" y="12" width="5" height="60" rx="2" fill="#000" opacity="0.18" />
        <rect x="50" y="12" width="3" height="60" fill="#1b1b18" opacity="0.75" />
        <rect x="27" y="26" width="18" height="10" rx="1.5" fill="#efe8da" />
        <path d="M30 30h12M30 33h8" stroke={ink} strokeWidth="0.9" opacity="0.5" />
        <path d="M60 15v54" stroke="#fff" strokeWidth="0.8" opacity="0.35" />
      </>
    );
  } else if (art === "mug") {
    drawing = (
      <>
        <path d="M56 36h4a8 8 0 0 1 0 16h-4" fill="none" stroke={color} strokeWidth="4.5" />
        <path d="M56 36h4a8 8 0 0 1 0 16h-4" fill="none" stroke="#000" strokeOpacity="0.12" strokeWidth="4.5" />
        <path d="M18 28h40v32a8 8 0 0 1-8 8H26a8 8 0 0 1-8-8z" fill={color} />
        <path d="M18 28h40v32a8 8 0 0 1-8 8H26a8 8 0 0 1-8-8z" fill={`url(#${id}-sheen)`} />
        <ellipse cx="38" cy="28" rx="20" ry="3.4" fill="#2d3b33" />
        <ellipse cx="38" cy="28" rx="18" ry="2.4" fill="#3d4c43" />
        <path d="M18 28h40" stroke="#1f2a24" strokeWidth="1.6" />
        <circle cx="38" cy="48" r="5" fill="none" stroke={ink} strokeWidth="1" opacity="0.4" />
        <path d="M35.5 49.5 38 45l2.5 4.5z" fill={ink} opacity="0.4" />
      </>
    );
  } else if (art === "socks") {
    drawing = (
      <>
        <path d="M30 10h20v34c0 4 2 6 6 9l4 3c5 4 3 12-4 12-3 0-5-1-8-3l-12-9c-4-3-6-7-6-12z" fill={color} />
        <path d="M30 10h20v34c0 4 2 6 6 9l4 3c5 4 3 12-4 12-3 0-5-1-8-3l-12-9c-4-3-6-7-6-12z" fill={`url(#${id}-sheen)`} />
        <path d="M30 10h20v8H30z" fill="#efe8da" />
        <path d="M30 13h20M30 16h20" stroke={color} strokeWidth="1" opacity="0.6" />
        <path d="M30 24h20M30 28h20" stroke="#000" strokeOpacity="0.12" strokeWidth="1" />
        <path d="M50 60c3 3 7 4 10 2" fill="none" stroke="#efe8da" strokeWidth="5" strokeLinecap="round" opacity="0.9" />
      </>
    );
  } else {
    drawing = (
      <>
        <g transform="rotate(-38 38 42)">
          <rect x="12" y="38" width="46" height="9" rx="4.5" fill={color} />
          <rect x="12" y="38" width="46" height="9" rx="4.5" fill={`url(#${id}-sheen)`} />
          <path d="M58 38.6 68 42.5 58 46.4z" fill="#e8d9b5" />
          <path d="M65 41.4 68 42.5 65 43.6z" fill="#2a2a26" />
          <path d="M20 38v9M23 38v9" stroke="#000" strokeOpacity="0.2" strokeWidth="1" />
          <path d="M14 40h42" stroke="#fff" strokeOpacity="0.45" strokeWidth="1" />
        </g>
      </>
    );
  }
  return (
    <div className={`${box} shrink-0 overflow-hidden rounded-[10px] bg-[#161618]`} aria-hidden="true">
      <svg viewBox="0 0 76 84" className="size-full">
        <defs>
          <linearGradient id={`${id}-sheen`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0.18" />
            <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.16" />
          </linearGradient>
        </defs>
        <ellipse cx="38" cy="76" rx="24" ry="3" fill="#000" opacity="0.08" />
        {drawing}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Demo: a store page with the drawer open                             */
/* ------------------------------------------------------------------ */

export function CartDrawerDemo(props: CartDrawerProps) {
  return (
    <div className="relative h-dvh min-h-[720px] overflow-hidden bg-[#09090b] text-white">
      <style>{`@keyframes tm-cart-drawer-undo { from { transform: scaleX(1); } to { transform: scaleX(0); } }`}</style>
      <header className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-8">
        <div className="flex items-baseline gap-8">
          <p className="font-display text-[22px] font-bold tracking-[-0.04em]">
            Fieldwork<span className="font-normal opacity-45"> Supply</span>
          </p>
          <nav aria-label="Shop" className="hidden gap-6 text-[14px] text-white/70 md:flex">
            <a href="#paper" className="hover:text-white">
              Paper
            </a>
            <a href="#camp" className="hover:text-white">
              Camp
            </a>
            <a href="#wear" className="hover:text-white">
              Wear
            </a>
            <a href="#journal" className="hover:text-white">
              Journal
            </a>
          </nav>
        </div>
        <CartDrawer strategy="absolute" {...props} />
      </header>
      <main className="px-5 pt-10 sm:px-8" aria-hidden="true">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/55">Autumn field kit · 24 pieces</p>
        <h1 className="mt-3 max-w-[14ch] font-display text-[clamp(2.5rem,1.4rem+4vw,4.75rem)] font-bold leading-[0.95] tracking-[-0.045em]">Goods for long walks and short notes.</h1>
        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            ["#6b7440", "notebook"],
            ["#efe8da", "mug"],
            ["#b65a32", "socks"],
            ["#c79a3c", "pencil"],
          ].map(([c, a]) => (
            <div key={a} className="flex aspect-[4/5] items-center justify-center rounded-[16px] bg-[#161618]">
              <div className="scale-[1.9]">
                <Thumb art={a as CartArt} color={c} />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default CartDrawerDemo;
