"use client";
import {
  type CSSProperties,
  forwardRef,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
} from "motion/react";

const EASE = [0.22, 1, 0.36, 1] as const;
const control =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-[background-color,color,opacity] duration-150 hover:bg-[var(--wash)] disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40";
const muted = "text-[var(--muted)]";
const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
function colors(theme: "dark" | "light"): CSSProperties {
  return {
    overflowWrap: "anywhere",
    "--panel": theme === "dark" ? "#111111" : "#ffffff",
    "--ink": theme === "dark" ? "#f5f5f5" : "#171717",
    "--muted": theme === "dark" ? "#a3a3a3" : "#525252",
    "--line": theme === "dark" ? "#333333" : "#d4d4d4",
    "--wash": theme === "dark" ? "#242424" : "#f0f0f0",
    "--selected": theme === "dark" ? "#303030" : "#e4e4e4",
  } as CSSProperties;
}

type PageToken = number | "before" | "after";
/** Keep the same number of slots at either end and through the middle of the result set. */
function pageWindow(current: number, count: number, slots: 5 | 7): PageToken[] {
  if (count <= slots) return Array.from({ length: count }, (_, i) => i + 1);
  if (current <= slots - 3) {
    return [
      ...Array.from({ length: slots - 2 }, (_, i) => i + 1),
      "after",
      count,
    ];
  }
  if (current >= count - slots + 4) {
    return [
      1,
      "before",
      ...Array.from({ length: slots - 2 }, (_, i) => count - slots + 3 + i),
    ];
  }
  const radius = (slots - 5) / 2;
  return [
    1,
    "before",
    ...Array.from({ length: slots - 4 }, (_, i) => current - radius + i),
    "after",
    count,
  ];
}

export type PaginationWindowProps = {
  label?: string;
  page?: number;
  defaultPage?: number;
  pageCount?: number;
  onPageChange?: (page: number) => void;
  theme?: "dark" | "light";
};
export function PaginationWindow({
  label = "Results",
  page,
  defaultPage = 1,
  pageCount = 24,
  onPageChange,
  theme = "dark",
}: PaginationWindowProps) {
  const id = useId();
  const reduced = !!useReducedMotion();
  const count = Number.isFinite(pageCount)
    ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(pageCount)))
    : 0;
  const [local, setLocal] = useState(defaultPage);
  const raw = page ?? local;
  const current = count
    ? Math.min(count, Math.max(1, Number.isFinite(raw) ? Math.floor(raw) : 1))
    : 0;
  const [travel, setTravel] = useState({ page: current, direction: 1 });
  if (travel.page !== current)
    setTravel({ page: current, direction: current > travel.page ? 1 : -1 });
  const rail = useRef<HTMLOListElement>(null);
  const buttons = useRef(new Map<number, HTMLButtonElement>());
  const focusedPage = useRef<number | null>(null);
  const [slots, setSlots] = useState<5 | 7>(5);
  const tokens = pageWindow(current, count, slots);
  const caption = count ? `Page ${current} of ${count}` : "No pages";

  useLayoutEffect(() => {
    const node = rail.current;
    if (!node) return;
    const measure = () => setSlots(node.clientWidth >= 320 ? 7 : 5);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    // A controlled update can remove the focused page. Keep focus within the pagination landmark.
    const focused = focusedPage.current;
    if (
      focused !== null &&
      !tokens.includes(focused) &&
      (document.activeElement === document.body || rail.current?.contains(document.activeElement))
    ) {
      buttons.current.get(current)?.focus();
    }
  }, [current, slots, count]);

  function choose(next: number) {
    if (next < 1 || next > count || next === current) return;
    if (page === undefined) setLocal(next);
    onPageChange?.(next);
  }
  return (
    <motion.nav
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0.12 : 0.28, ease: EASE }}
      aria-label={`${label} pagination`}
      style={colors(theme)}
      className="@container w-full max-w-2xl rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 text-[var(--ink)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-1 pb-4">
        <span className="text-sm font-medium">{label}</span>
        <span role="status" className={`relative font-mono text-xs ${muted}`}>
          <span className="sr-only">{caption}</span>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              aria-hidden="true"
              key={caption}
              initial={{ opacity: 0, y: reduced ? 0 : travel.direction * 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0.1 : 0.18, ease: EASE }}
              className="block tabular-nums"
            >
              {caption}
            </motion.span>
          </AnimatePresence>
        </span>
      </div>
      <div className="mt-4">
        <ol
          ref={rail}
          className="relative flex min-h-11 justify-center gap-0.5"
          aria-label="Pages"
        >
          <AnimatePresence
            initial={false}
            mode="popLayout"
            custom={travel.direction}
          >
            {tokens.map((token) => (
              <PageSlot
                key={token}
                token={token}
                selected={token === current}
                layoutId={`${id}-selected`}
                reduced={reduced}
                direction={travel.direction}
                onChoose={choose}
                buttonRef={(button) => {
                  if (typeof token !== "number") return;
                  if (button) buttons.current.set(token, button);
                  else buttons.current.delete(token);
                }}
                onFocus={() => {
                  if (typeof token === "number") focusedPage.current = token;
                }}
                onBlur={() => {
                  focusedPage.current = null;
                }}
              />
            ))}
          </AnimatePresence>
        </ol>
        <div className="mt-3 flex items-center justify-between gap-3">
          <button
            type="button"
            data-demo="previous"
            aria-label="Previous page"
            disabled={current <= 1}
            onClick={() => choose(current - 1)}
            className={control}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Previous</span>
          </button>
          <button
            type="button"
            data-demo="next"
            aria-label="Next page"
            disabled={!count || current >= count}
            onClick={() => choose(current + 1)}
            className={control}
          >
            <span>Next</span>
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </motion.nav>
  );
}

const PageSlot = forwardRef<
  HTMLLIElement,
  {
    token: PageToken;
    selected: boolean;
    layoutId: string;
    reduced: boolean;
    direction: number;
    onChoose: (page: number) => void;
    buttonRef: (button: HTMLButtonElement | null) => void;
    onFocus: () => void;
    onBlur: () => void;
  }
>(function PageSlot(
  {
    token,
    selected,
    layoutId,
    reduced,
    direction,
    onChoose,
    buttonRef,
    onFocus,
    onBlur,
  },
  ref,
) {
  const present = useIsPresent();
  return (
    <motion.li
      ref={ref}
      inert={!present}
      aria-hidden={!present || typeof token !== "number" ? true : undefined}
      layout={reduced ? false : "position"}
      custom={direction}
      variants={{
        enter: (dir: number) => ({ opacity: 0, y: reduced ? 0 : dir * 4 }),
        exit: (dir: number) => ({ opacity: 0, y: reduced ? 0 : -dir * 4 }),
      }}
      initial="enter"
      animate={{ opacity: 1, y: 0 }}
      exit="exit"
      transition={{
        duration: reduced ? 0.1 : 0.26,
        ease: EASE,
        opacity: { duration: 0.12 },
      }}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center"
    >
      {typeof token === "number" ? (
        <button
          ref={buttonRef}
          type="button"
          data-demo={`page-${token}`}
          aria-label={`Page ${token}`}
          aria-current={selected ? "page" : undefined}
          onClick={() => onChoose(token)}
          onFocus={onFocus}
          onBlur={onBlur}
          title={token >= 10000 ? String(token) : undefined}
          className={`${control} relative w-full px-0 font-mono tabular-nums`}
          style={{ color: selected ? "var(--ink)" : "var(--muted)" }}
        >
          {selected && (
            <motion.span
              aria-hidden="true"
              layoutId={layoutId}
              transition={{ duration: reduced ? 0 : 0.28, ease: EASE }}
              className="absolute inset-0 rounded-lg bg-[var(--selected)] shadow-[inset_0_0_0_1px_var(--line)]"
            />
          )}
          <span className="relative whitespace-nowrap">
            {token >= 10000 ? compact.format(token) : token}
          </span>
        </button>
      ) : (
        <span className={muted}>…</span>
      )}
    </motion.li>
  );
});

export default function PaginationWindowDemo(
  overrides: Partial<PaginationWindowProps> = {},
) {
  return (
    <div
      className="flex min-h-[560px] w-full items-center justify-center p-4 @container sm:p-8"
      style={{
        background: overrides.theme === "light" ? "#f3f3f3" : "#080808",
      }}
    >
      <PaginationWindow {...overrides} />
    </div>
  );
}
