"use client";
import { type CSSProperties, useLayoutEffect, useSyncExternalStore, useId, useRef, useState } from "react";
import { X, CornerDownLeft } from "lucide-react";
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
    "--field-line": theme === "dark" ? "#727272" : "#8a8a8a",
    "--wash": theme === "dark" ? "#242424" : "#f0f0f0",
  } as CSSProperties;
}

export type TagEditorProps = {
  label?: string;
  hint?: string;
  placeholder?: string;
  value?: string[];
  defaultValue?: string[];
  maxTags?: number;
  disabled?: boolean;
  onChange?: (tags: string[]) => void;
  theme?: "dark" | "light";
};
export function TagEditor({
  label = "Topics",
  hint = "Add a topic, then press Enter or comma.",
  placeholder = "Add a topic",
  value,
  defaultValue = ["Design systems", "Interaction"],
  maxTags = 8,
  disabled = false,
  onChange,
  theme = "dark",
}: TagEditorProps) {
  const id = useId();
  const { reduced, entrance } = useLiveEntrance();
  const input = useRef<HTMLInputElement>(null);
  const [local, setLocal] = useState(() => [...defaultValue]);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const tags = value ?? local;
  const readOnly = value !== undefined && !onChange;
  const unavailable = disabled || readOnly;
  const limit = Number.isFinite(maxTags) ? Math.max(0, Math.floor(maxTags)) : 8;
  function change(next: string[]) {
    if (unavailable) return;
    setLocal([...next]);
    onChange?.([...next]);
  }
  function add(raw: string) {
    if (unavailable) return;
    const pieces = raw
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const next = [...tags];
    let rejected = 0;
    for (const p of pieces) {
      if (
        next.some((t) => t.toLocaleLowerCase() === p.toLocaleLowerCase()) ||
        next.length >= limit
      ) {
        rejected++;
        continue;
      }
      next.push(p);
    }
    if (next.length !== tags.length) change(next);
    setDraft("");
    input.current?.focus();
    setNotice(
      rejected
        ? "Duplicates or topics beyond the limit were skipped."
        : pieces.length
          ? value !== undefined
            ? "Topic changes requested."
            : "Topics added."
          : "",
    );
  }
  function remove(index: number) {
    if (unavailable) return;
    change(tags.filter((_, i) => i !== index));
    setNotice(value !== undefined ? "Topic changes requested." : `${tags[index]} removed.`);
    input.current?.focus();
  }
  return (
    <motion.section
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={entrance}
      style={colors(theme)}
      className="@container w-full max-w-lg rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--ink)]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-xl font-medium tracking-tight">
          {label}
        </label>
        <span className={`font-mono text-xs ${muted}`}>
          {tags.length} / {limit}
        </span>
      </div>
      <p id={`${id}-hint`} className={`mt-2 text-sm ${muted}`}>
        {hint}
      </p>
      <div className="mt-6 flex min-h-32 flex-wrap content-start gap-2 rounded-lg border border-[var(--field-line)] p-2 focus-within:ring-2 focus-within:ring-[var(--ink)]">
        {tags.map((tag, i) => (
          <motion.span
            layout={!reduced}
            transition={{ layout: { duration: reduced ? 0 : 0.2 } }}
            key={`${tag}-${i}`}
            className="inline-flex max-w-full items-center rounded-md bg-[var(--wash)] pl-3 text-sm"
          >
            <span className="min-w-0 break-words">{tag}</span>
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              data-demo={`remove-${i}`}
              disabled={unavailable}
              onClick={() => remove(i)}
              className={`${control} shrink-0 p-0`}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </motion.span>
        ))}
        <input
          ref={input}
          id={id}
          data-demo="tag-input"
          disabled={disabled}
          readOnly={readOnly || tags.length >= limit}
          aria-describedby={`${id}-hint`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text");
            if (/[,\n]/.test(text)) {
              e.preventDefault();
              add(text);
            }
          }}
          onKeyDown={(e) => {
            if (unavailable || e.nativeEvent.isComposing) return;
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            }
            if (e.key === "Backspace" && !draft && tags.length)
              remove(tags.length - 1);
          }}
          placeholder={placeholder}
          className="min-h-11 w-28 min-w-28 flex-1 bg-transparent px-2 text-base outline-none placeholder:text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-40"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p role="status" className={`min-h-5 text-xs ${muted}`}>
          {notice || `${Math.max(0, limit - tags.length)} topics available`}
        </p>
        <button
          type="button"
          data-demo="add-tag"
          disabled={unavailable || !draft.trim() || tags.length >= limit}
          onClick={() => add(draft)}
          className={control}
        >
          Add <CornerDownLeft size={14} aria-hidden="true" />
        </button>
      </div>
    </motion.section>
  );
}

const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeToMotion(change: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}
function useLiveEntrance() {
  const reduced = useSyncExternalStore(
    subscribeToMotion,
    () => window.matchMedia(motionQuery).matches,
    () => false,
  );
  const entrance = useAnimationControls();
  useLayoutEffect(() => {
    entrance.stop();
    if (reduced) entrance.set({ opacity: 1, y: 0 });
    else void entrance.start({ opacity: 1, y: 0, transition: { duration: 0.32 } });
    return () => entrance.stop();
  }, [entrance, reduced]);
  return { reduced, entrance };
}

export default function TagEditorDemo(overrides: Partial<TagEditorProps> = {}) {
  return (
    <div
      className="flex min-h-[560px] w-full items-center justify-center p-4 @container sm:p-8"
      style={{
        background: overrides.theme === "light" ? "#f3f3f3" : "#080808",
      }}
    >
      <TagEditor {...overrides} />
    </div>
  );
}
