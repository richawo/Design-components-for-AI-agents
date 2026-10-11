"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion, type Variants } from "motion/react";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type SavedCard = {
  id: string;
  last4: string;
  /** Already formatted, e.g. "08/28". */
  expiry: string;
  holder: string;
};

export type PaymentView = "cards" | "add";

export type PaymentMethodsProps = {
  cards?: SavedCard[];
  /** Which card pays. Its id. */
  defaultCardId?: string;
  /** "add" opens the new-card form. Omit `view` and the list keeps its own. */
  view?: PaymentView;
  onViewChange?: (view: PaymentView) => void;
  onDefaultChange?: (id: string) => void;
  /** Called after a card is removed. Undo is local until the row is gone for good. */
  onRemove?: (card: SavedCard) => void;
  onAdd?: (card: SavedCard) => void;
  /** Printed in small caps on every card. */
  workspace?: string;
  locale?: string;
  /** The one accent: the default card's outline, and Add once the draft is valid. */
  accent?: string;
  theme?: "dark" | "light";
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

const DEFAULT_ACCENT = "#7dd3a8";
const EASE = [0.22, 1, 0.36, 1] as const;
const SPRING_UI = { type: "spring", stiffness: 420, damping: 36 } as const;

const PALETTE = {
  dark: {
    surface: "#131317",
    raised: "#1a1a1f",
    track: "#24242b",
    line: "rgba(255,255,255,0.08)",
    ink: "#f4f4f5",
    muted: "#8a8a93",
    onAccent: "#07130d",
    shadow: "inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.05), 0 40px 80px -40px rgba(0,0,0,0.9)",
  },
  light: {
    surface: "#ffffff",
    raised: "#f6f6f7",
    track: "#ececef",
    line: "rgba(24,24,27,0.09)",
    ink: "#18181b",
    muted: "#6b6b75",
    onAccent: "#07130d",
    shadow: "inset 0 0 0 1px rgba(24,24,27,0.08), 0 1px 2px rgba(24,24,27,0.05), 0 40px 80px -40px rgba(24,24,27,0.25)",
  },
} as const;

const DEFAULT_CARDS: SavedCard[] = [
  { id: "4242", last4: "4242", expiry: "08/28", holder: "Ines Varga" },
  { id: "1881", last4: "1881", expiry: "04/28", holder: "Jonah Adeyemi" },
];

const T = { header: 0, cards: 0.1, footer: 0.2 } as const;

const reveal: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(8px)" },
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

const EXPIRY = /^(0[1-9]|1[0-2])\/\d{2}$/;
const LAST4 = /^\d{4}$/;

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

type Removed = { card: SavedCard; index: number; wasDefault: boolean };

export function PaymentMethods({
  cards: cardsProp = DEFAULT_CARDS,
  defaultCardId = "4242",
  view: viewProp,
  onViewChange,
  onDefaultChange,
  onRemove,
  onAdd,
  workspace = "Copperline",
  accent = DEFAULT_ACCENT,
  theme = "dark",
  className = "",
}: PaymentMethodsProps) {
  const reduce = !!useReducedMotion();
  const headingId = useId();
  const ringId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const inView = useInView(rootRef, { once: true, amount: 0.25 });
  const p = PALETTE[theme];
  const [cards, setCards] = useState(cardsProp);
  const [defaultId, setDefaultId] = useState(defaultCardId);
  const [removed, setRemoved] = useState<Removed | null>(null);
  const [localView, setLocalView] = useState<PaymentView>("cards");
  const view = viewProp ?? localView;

  const current = cards.find((c) => c.id === defaultId) ?? cards[0];

  const setView = (next: PaymentView) => {
    if (viewProp === undefined) setLocalView(next);
    onViewChange?.(next);
  };
  const makeDefault = (id: string) => {
    setDefaultId(id);
    onDefaultChange?.(id);
  };
  const remove = (card: SavedCard) => {
    const index = cards.findIndex((c) => c.id === card.id);
    if (index < 0) return;
    const wasDefault = card.id === defaultId;
    const next = cards.filter((c) => c.id !== card.id);
    setCards(next);
    setRemoved({ card, index, wasDefault });
    if (wasDefault) setDefaultId(next[0]?.id ?? "");
    onRemove?.(card);
  };
  const undo = () => {
    if (!removed) return;
    setCards((currentCards) => {
      const next = [...currentCards];
      next.splice(Math.min(removed.index, next.length), 0, removed.card);
      return next;
    });
    if (removed.wasDefault) setDefaultId(removed.card.id);
    setRemoved(null);
  };
  const add = (card: SavedCard) => {
    setCards((currentCards) => [...currentCards, card]);
    setView("cards");
    onAdd?.(card);
  };

  const vars = {
    "--pay-surface": p.surface,
    "--pay-raised": p.raised,
    "--pay-track": p.track,
    "--pay-line": p.line,
    "--pay-ink": p.ink,
    "--pay-muted": p.muted,
    "--pay-accent": accent,
    "--pay-on-accent": p.onAccent,
    "--pay-accent-text": theme === "dark" ? accent : `color-mix(in oklch, ${accent} 45%, ${p.ink})`,
    "--pay-shadow": p.shadow,
  } as CSSProperties;
  const v = (variants: Variants) => (reduce ? fade : variants);

  return (
    <motion.section
      ref={rootRef}
      aria-labelledby={headingId}
      style={vars}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      className={`@container relative w-full max-w-[560px] rounded-[20px] bg-(--pay-surface) p-5 text-(--pay-ink) shadow-(--pay-shadow) @sm:p-7 ${className}`}
    >
      <motion.header variants={v(reveal)} custom={T.header}>
        <p className="font-mono text-[11px] font-medium tracking-[0.08em] text-(--pay-muted) uppercase">Billing</p>
        <h3 id={headingId} className="mt-2 font-display text-[22px] leading-[1.1] font-semibold tracking-[-0.025em]">
          Cards
        </h3>
        <p className="mt-1.5 text-[13.5px] text-(--pay-muted)" aria-live="polite">
          {current ? (
            <>
              Default is <span className="text-(--pay-ink) tabular-nums">•••• {current.last4}</span>
            </>
          ) : (
            "No card on file"
          )}
        </p>
      </motion.header>

      <motion.div variants={v(reveal)} custom={T.cards} className="mt-6">
        <ul className="grid grid-cols-1 gap-5 @md:grid-cols-2">
          <AnimatePresence initial={false}>
            {cards.map((card) => (
              <CardItem key={card.id} card={card} workspace={workspace} isDefault={card.id === current?.id} ringId={ringId} reduce={reduce} onDefault={() => makeDefault(card.id)} onRemove={() => remove(card)} />
            ))}
          </AnimatePresence>
        </ul>
        <AnimatePresence initial={false}>
          {removed && (
            <motion.div
              key={removed.card.id}
              role="status"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.24, ease: EASE }}
              className="mt-4 flex items-center justify-between gap-3 rounded-[14px] px-3.5 py-2.5 shadow-[inset_0_0_0_1px_var(--pay-line)]"
            >
              <p className="min-w-0 text-[13.5px]">
                <span className="tabular-nums">•••• {removed.card.last4}</span> removed
              </p>
              <button
                type="button"
                data-demo="undo"
                onClick={undo}
                className="[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 h-9 shrink-0 rounded-full px-3 text-[13px] font-medium text-(--pay-accent-text) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pay-ink)"
              >
                Undo
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        {cards.length === 0 && !removed && <p className="py-8 text-center text-[14px] text-(--pay-muted)">Add a card to pay for Studio.</p>}
      </motion.div>

      <motion.div variants={v(reveal)} custom={T.footer} className="mt-5">
        {view === "add" ? (
          <AddForm cards={cards} onCancel={() => setView("cards")} onAdd={add} reduce={reduce} />
        ) : (
          <button
            type="button"
            data-demo="add"
            onClick={() => setView("add")}
            className="[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 flex h-12 w-full items-center justify-center rounded-[12px] text-[14.5px] font-medium shadow-[inset_0_0_0_1px_var(--pay-line)] transition-colors duration-150 hover:bg-(--pay-raised) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pay-ink) active:scale-[0.985]"
          >
            Add a card
          </button>
        )}
      </motion.div>
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* A saved card                                                        */
/* ------------------------------------------------------------------ */

function CardItem({
  card,
  workspace,
  isDefault,
  ringId,
  reduce,
  onDefault,
  onRemove,
}: {
  card: SavedCard;
  workspace: string;
  isDefault: boolean;
  ringId: string;
  reduce: boolean;
  onDefault: () => void;
  onRemove: () => void;
}) {
  return (
    <motion.li layout={!reduce} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: reduce ? 1 : 0.98, transition: { duration: 0.18 } }} transition={{ duration: 0.28, ease: EASE }} className="min-w-0">
      <div className="relative">
        {isDefault && (
          <motion.span
            layoutId={ringId}
            aria-hidden="true"
            className="pointer-events-none absolute -inset-1 rounded-[18px] shadow-[0_0_0_1.5px_var(--pay-accent)]"
            transition={reduce ? { duration: 0 } : SPRING_UI}
          />
        )}
        <CardFace workspace={workspace} last4={card.last4} expiry={card.expiry} holder={card.holder} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        {isDefault ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-(--pay-accent-text)">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-(--pay-accent)" />
            Default
          </span>
        ) : (
          <button
            type="button"
            data-demo={`set-default-${card.last4}`}
            onClick={onDefault}
            className="[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 h-9 rounded-full px-1 text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pay-ink)"
          >
            Set default
          </button>
        )}
        <button
          type="button"
          data-demo={`remove-${card.last4}`}
          onClick={onRemove}
          className="[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 h-9 rounded-full px-2 text-[13px] text-(--pay-muted) hover:text-(--pay-ink) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pay-ink)"
        >
          Remove
        </button>
      </div>
    </motion.li>
  );
}

function CardFace({ workspace, last4, expiry, holder }: { workspace: string; last4: string; expiry: string; holder: string }) {
  return (
    <div className="relative aspect-[1.7/1] overflow-hidden rounded-[14px] bg-[linear-gradient(155deg,#2c2c34_0%,#16161b_62%,#121216_100%)] p-3.5 text-[#f4f4f5] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16),inset_0_1px_0_rgba(255,255,255,0.22)] @md:p-4">
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.14),transparent_42%)]" />
      <div className="relative flex items-start justify-between gap-3">
        <span className="font-mono text-[10.5px] tracking-[0.14em] text-white/70 uppercase">{workspace}</span>
        <Chip />
      </div>
      <p className="relative mt-4 font-mono text-[13px] tracking-[0.14em] tabular-nums @md:mt-5 @md:text-[14px]">•••• {last4}</p>
      <div className="relative mt-3 flex items-end justify-between gap-2 @md:mt-4">
        <span className="min-w-0 truncate font-mono text-[10.5px] tracking-[0.12em] uppercase">{holder}</span>
        <span className="shrink-0 font-mono text-[10.5px] tabular-nums">{expiry}</span>
      </div>
    </div>
  );
}

function Chip() {
  return (
    <span aria-hidden="true" className="relative block h-5 w-7 shrink-0 rounded-[3px] bg-[#d9c7a3] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.22)]">
      <span className="absolute inset-y-[18%] left-1/2 w-px -translate-x-1/2 bg-black/25" />
      <span className="absolute inset-x-[18%] top-1/2 h-px -translate-y-1/2 bg-black/25" />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Add                                                                 */
/* ------------------------------------------------------------------ */

function AddForm({ cards, onCancel, onAdd, reduce }: { cards: SavedCard[]; onCancel: () => void; onAdd: (card: SavedCard) => void; reduce: boolean }) {
  const [holder, setHolder] = useState("");
  const [last4, setLast4] = useState("");
  const [expiry, setExpiry] = useState("");
  const [error, setError] = useState("");
  const ready = holder.trim().length > 1 && LAST4.test(last4) && EXPIRY.test(expiry);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ready) {
      setError(holder.trim().length < 2 ? "Add the name on the card." : !LAST4.test(last4) ? "Last 4 needs four digits." : "Expiry is MM/YY.");
      return;
    }
    if (cards.some((c) => c.last4 === last4)) {
      setError("That card is already here.");
      return;
    }
    onAdd({ id: last4, last4, expiry, holder: holder.trim() });
  };
  return (
    <form onSubmit={submit} className="rounded-[14px] p-4 shadow-[inset_0_0_0_1px_var(--pay-line)]">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[11px] font-medium tracking-[0.08em] text-(--pay-muted) uppercase">New card</p>
        <button type="button" onClick={onCancel} className="[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 text-[13px] text-(--pay-muted) hover:text-(--pay-ink) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pay-ink)">
          Cancel
        </button>
      </div>
      <Field label="Name on card" value={holder} onChange={setHolder} autoComplete="cc-name" demo="add-name" />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Last 4" value={last4} onChange={(v) => setLast4(v.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="cc-number" demo="add-last4" />
        <Field label="Expiry" value={expiry} onChange={(v) => setExpiry(formatExpiry(v))} inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" demo="add-expiry" />
      </div>
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-(--pay-ink)">
          {error}
        </p>
      )}
      <motion.button
        type="submit"
        data-demo="add-card"
        whileTap={reduce ? undefined : { scale: 0.98 }}
        className={`[@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:min-w-11 mt-4 flex h-11 w-full items-center justify-center rounded-[12px] text-[14px] font-medium transition-[background-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pay-ink) ${ready ? "bg-(--pay-accent) text-(--pay-on-accent)" : "bg-(--pay-raised) text-(--pay-muted) shadow-[inset_0_0_0_1px_var(--pay-line)]"}`}
      >
        Add card
      </motion.button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  demo,
  inputMode,
  autoComplete,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  demo: string;
  inputMode?: "numeric" | "text";
  autoComplete?: string;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="mt-3 block">
      <span className="text-[13px] text-(--pay-muted)">{label}</span>
      <input
        id={id}
        data-demo={demo}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-11 w-full rounded-[10px] bg-(--pay-raised) px-3 text-[14px] text-(--pay-ink) shadow-[inset_0_0_0_1px_var(--pay-line)] outline-none placeholder:text-(--pay-muted) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pay-ink)"
      />
    </label>
  );
}

/** Keeps a typed expiry as MM/YY while the digits come in. */
function formatExpiry(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/* ------------------------------------------------------------------ */
/* Demo                                                                */
/* ------------------------------------------------------------------ */

/** The cards on a quiet stage. `view` is demo state, so Customize can open the form and Add still works. */
export default function PaymentMethodsDemo({ view: forced, ...overrides }: Partial<PaymentMethodsProps> = {}) {
  const [view, setView] = useState<PaymentView>(forced ?? "cards");
  useEffect(() => {
    if (forced) setView(forced);
  }, [forced]);
  return (
    <div className={`flex min-h-dvh w-full items-center justify-center px-4 py-14 sm:px-8 ${overrides.theme === "light" ? "bg-[#f4f4f5]" : "bg-[#060607]"}`}>
      <PaymentMethods {...overrides} view={view} onViewChange={setView} />
    </div>
  );
}
