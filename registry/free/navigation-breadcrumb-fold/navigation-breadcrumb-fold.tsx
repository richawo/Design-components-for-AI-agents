"use client";
import { type CSSProperties, useId, useState, useRef, useLayoutEffect, useSyncExternalStore } from "react";
import { ChevronRight, Folder, MoreHorizontal } from "lucide-react";
import { motion, useAnimationControls } from "motion/react";

const control =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-[background,transform] duration-150 hover:bg-[var(--wash)] disabled:hover:bg-transparent active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 motion-reduce:transform-none";
const muted = "text-[var(--muted)]";
function colors(theme: "dark" | "light"): CSSProperties {
  return {
    overflowWrap: "anywhere",
    "--panel": theme === "dark" ? "#111111" : "#ffffff",
    "--ink": theme === "dark" ? "#f5f5f5" : "#171717",
    "--muted": theme === "dark" ? "#a3a3a3" : "#525252",
    "--line": theme === "dark" ? "#333333" : "#d4d4d4",
    "--wash": theme === "dark" ? "#242424" : "#f0f0f0",
  } as CSSProperties;
}

export type BreadcrumbItem = { label: string; href: string };
export type BreadcrumbFoldProps = {
  items?: BreadcrumbItem[];
  label?: string;
  theme?: "dark" | "light";
};
const defaults: BreadcrumbItem[] = [
  { label: "Workspace", href: "#workspace" },
  { label: "Projects", href: "#projects" },
  { label: "Studio", href: "#studio" },
  { label: "Identity", href: "#identity" },
  { label: "Type specimens", href: "#specimens" },
];
const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeToMotion(change: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}
function useCardEntry() {
  const reduced = useSyncExternalStore(
    subscribeToMotion,
    () => window.matchMedia(motionQuery).matches,
    () => false,
  );
  const entrance = useAnimationControls();
  useLayoutEffect(() => {
    entrance.stop();
    const target = { opacity: 1, y: 0 };
    if (reduced) entrance.set(target);
    else void entrance.start({ ...target, transition: { duration: 0.32 } });
    return () => entrance.stop();
  }, [entrance, reduced]);
  return { reduced, entrance };
}

export function BreadcrumbFold({
  items = defaults,
  label = "Breadcrumb",
  theme = "dark",
}: BreadcrumbFoldProps) {
  const id = useId();
  const { reduced, entrance } = useCardEntry();
  const [expanded, setExpanded] = useState(false);
  const nav = useRef<HTMLElement>(null);
  const moveFocus = useRef(false);
  const focused = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const active = document.activeElement;
    const inside = active === document.body || !!nav.current?.contains(active);
    if (moveFocus.current) {
      moveFocus.current = false;
      if (!inside) return;
      const target = nav.current?.querySelector<HTMLButtonElement>(
        expanded ? "[data-demo=collapse-path]" : "[data-demo=expand-path]",
      );
      (target ?? nav.current)?.focus();
    } else if (focused.current && !focused.current.isConnected && inside) {
      nav.current?.focus();
    }
  });
  const occurrences = new Map<string, number>();
  const keyedItems = items.map((item) => {
    const occurrence = occurrences.get(item.href) ?? 0;
    occurrences.set(item.href, occurrence + 1);
    return { ...item, key: JSON.stringify([item.href, occurrence]) };
  });
  const folded = items.length > 3 && !expanded;
  return (
    <motion.nav
      ref={nav}
      tabIndex={-1}
      onFocusCapture={(event) => {
        if (event.target instanceof HTMLElement) focused.current = event.target;
      }}
      onBlurCapture={(event) => {
        if (!(event.relatedTarget instanceof Node) || !nav.current?.contains(event.relatedTarget)) {
          focused.current = null;
        }
      }}
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={entrance}
      aria-label={label}
      style={colors(theme)}
      className="@container w-full max-w-3xl rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 text-[var(--ink)] shadow-xl shadow-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
    >
      {items.length ? (
        <ol id={id} className="flex flex-wrap items-center gap-1">
          {keyedItems.map((item, i) => {
            if (folded && i > 0 && i < items.length - 2) {
              return i === 1 ? (
                <li key="fold" className="flex items-center">
                  <button
                    type="button"
                    data-demo="expand-path"
                    aria-label="Show full path"
                    aria-expanded={expanded}
                    aria-controls={id}
                    onClick={() => {
                      moveFocus.current = true;
                      setExpanded(true);
                    }}
                    className={control}
                  >
                    <MoreHorizontal size={18} aria-hidden="true" />
                  </button>
                  <ChevronRight
                    size={14}
                    className={muted}
                    aria-hidden="true"
                  />
                </li>
              ) : null;
            }
            return (
              <li
                key={item.key}
                className="flex min-w-0 max-w-full items-center"
              >
                {i === items.length - 1 ? (
                  <span
                    aria-current="page"
                    className="px-3 py-3 text-sm font-medium break-words"
                  >
                    {item.label}
                  </span>
                ) : (
                  <>
                    <a
                      href={item.href}
                      className={`${control} min-w-0 py-2 text-[var(--muted)]`}
                    >
                      <span className="min-w-0 break-words">
                        {i === 0 && (
                          <Folder
                            size={15}
                            className="mr-2 inline"
                            aria-hidden="true"
                          />
                        )}
                        {item.label}
                      </span>
                    </a>
                    <ChevronRight
                      size={14}
                      className={`shrink-0 ${muted}`}
                      aria-hidden="true"
                    />
                  </>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className={`px-3 py-2 text-sm ${muted}`}>No location selected</p>
      )}
      {expanded && items.length > 3 && (
        <button
          type="button"
          data-demo="collapse-path"
          onClick={() => {
            moveFocus.current = true;
            setExpanded(false);
          }}
          className={`${control} mt-2 text-[var(--muted)]`}
        >
          Collapse path
        </button>
      )}
    </motion.nav>
  );
}

export default function BreadcrumbFoldDemo(
  overrides: Partial<BreadcrumbFoldProps> = {},
) {
  return (
    <div
      className="flex min-h-[560px] w-full items-center justify-center p-4 @container sm:p-8"
      style={{
        background: overrides.theme === "light" ? "#f3f3f3" : "#080808",
      }}
    >
      <BreadcrumbFold {...overrides} />
    </div>
  );
}
