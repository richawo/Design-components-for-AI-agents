"use client";
import {
  type CSSProperties,
  forwardRef,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  usePresence,
  usePresenceData,
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

const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeToMotion(change: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}
function useMotionPreference() {
  return useSyncExternalStore(
    subscribeToMotion,
    () => window.matchMedia(motionQuery).matches,
    () => false,
  );
}
function useEntrance(reduced: boolean, duration: number) {
  const controls = useAnimationControls();
  useLayoutEffect(() => {
    controls.stop();
    const target = { opacity: 1, y: 0 };
    if (reduced) controls.set(target);
    else void controls.start({ ...target, transition: { duration, ease: EASE } });
    return () => controls.stop();
  }, [controls, reduced, duration]);
  return controls;
}
function useSlotAnimation(
  reduced: boolean,
  present: boolean,
  direction: number,
  remove?: (() => void) | null,
) {
  const controls = useAnimationControls();
  useLayoutEffect(() => {
    let active = true;
    controls.stop();
    const target = { opacity: present ? 1 : 0, y: present || reduced ? 0 : -direction * 4 };
    if (reduced) controls.set(target);
    else void controls.start({
      ...target,
      transition: { duration: 0.26, ease: EASE, opacity: { duration: 0.12 } },
    }).then(() => { if (active && !present) remove?.(); });
    return () => { active = false; controls.stop(); };
  }, [controls, reduced, present, direction, remove]);
  useEffect(() => {
    if (reduced && !present) remove?.();
  }, [reduced, present, remove]);
  return controls;
}
function PageCaption({ caption, direction }: { caption: string; direction: number }) {
  const reduced = useMotionPreference();
  const entrance = useEntrance(reduced, 0.18);
  return (
    <motion.span
      aria-hidden="true"
      initial={{ opacity: 0, y: reduced ? 0 : direction * 3 }}
      animate={entrance}
      className="block tabular-nums"
    >
      {caption}
    </motion.span>
  );
}
const compactInteger = new Intl.NumberFormat("en-US", {
  notation: "compact", maximumFractionDigits: 0,
});
function pageLabel(page: number) {
  if (page < 10000) return String(page);
  const precise = compact.format(page);
  if (precise.length <= 4) return precise;
  const rounded = compactInteger.format(page);
  return rounded.length <= 4 ? rounded : page.toExponential(0).replace("+", "");
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
  const reduced = useMotionPreference();
  const entrance = useEntrance(reduced, 0.28);
  const count = Number.isFinite(pageCount)
    ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(pageCount)))
    : 0;
  const [local, setLocal] = useState(defaultPage);
  const raw = page ?? local;
  const readOnly = page !== undefined && !onPageChange;
  const current = count
    ? Math.min(count, Math.max(1, Number.isFinite(raw) ? Math.floor(raw) : 1))
    : 0;
  const [travel, setTravel] = useState({ page: current, direction: 1 });
  if (travel.page !== current)
    setTravel({ page: current, direction: current > travel.page ? 1 : -1 });
  const navigation = useRef<HTMLElement>(null);
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
      (!tokens.includes(focused) || readOnly) &&
      (document.activeElement === document.body || rail.current?.contains(document.activeElement))
    ) {
      const target = buttons.current.get(current);
      if (target && !target.disabled) target.focus();
      else navigation.current?.focus();
    }
  }, [current, slots, count, readOnly]);

  function choose(next: number) {
    if (readOnly || next < 1 || next > count || next === current) return;
    if (page === undefined) setLocal(next);
    onPageChange?.(next);
  }
  return (
    <motion.nav
      ref={navigation}
      tabIndex={-1}
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={entrance}
      aria-label={`${label} pagination`}
      style={colors(theme)}
      className="@container w-full max-w-2xl rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-1 pb-4">
        <span className="text-sm font-medium">{label}</span>
        <span role="status" className={`relative font-mono text-xs ${muted}`}>
          <span className="sr-only">{caption}</span>
          <PageCaption key={caption} caption={caption} direction={travel.direction} />
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
                direction={travel.direction}
                onChoose={choose}
                readOnly={readOnly}
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
            disabled={readOnly || current <= 1}
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
            disabled={readOnly || !count || current >= count}
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
    direction: number;
    onChoose: (page: number) => void;
    readOnly: boolean;
    buttonRef: (button: HTMLButtonElement | null) => void;
    onFocus: () => void;
    onBlur: () => void;
  }
>(function PageSlot(
  {
    token,
    selected,
    layoutId,
    direction,
    onChoose,
    readOnly,
    buttonRef,
    onFocus,
    onBlur,
  },
  ref,
) {
  const [present, remove] = usePresence();
  const reduced = useMotionPreference();
  const custom: unknown = usePresenceData();
  const exitDirection = typeof custom === "number" ? custom : direction;
  const controls = useSlotAnimation(reduced, present, exitDirection, remove);
  return (
    <motion.li
      ref={ref}
      inert={!present}
      aria-hidden={!present || typeof token !== "number" ? true : undefined}
      layout={reduced ? false : "position"}
      custom={direction}
      initial={{ opacity: 0, y: reduced ? 0 : direction * 4 }}
      animate={controls}
      transition={{ layout: { duration: 0.26, ease: EASE } }}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center motion-reduce:transform-none!"
    >
      {typeof token === "number" ? (
        <button
          ref={buttonRef}
          type="button"
          data-demo={`page-${token}`}
          aria-label={`Page ${token}`}
          aria-current={selected ? "page" : undefined}
          disabled={readOnly}
          onClick={() => onChoose(token)}
          onFocus={onFocus}
          onBlur={onBlur}
          title={token >= 10000 ? String(token) : undefined}
          className={`${control} relative w-full px-0 font-mono tabular-nums`}
          style={{ color: selected ? "var(--ink)" : "var(--muted)" }}
        >
          {selected && (reduced ? (
            <span aria-hidden="true" className="absolute inset-0 rounded-lg bg-[var(--selected)] shadow-[inset_0_0_0_1px_var(--ink)]" />
          ) : (
            <motion.span
              aria-hidden="true"
              layoutId={layoutId}
              transition={{ duration: 0.28, ease: EASE }}
              className="absolute inset-0 rounded-lg bg-[var(--selected)] shadow-[inset_0_0_0_1px_var(--ink)] motion-reduce:transform-none!"
            />
          ))}
          <span className="relative whitespace-nowrap">
            {pageLabel(token)}
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
