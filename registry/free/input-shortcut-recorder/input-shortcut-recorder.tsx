"use client";
import {
  type CSSProperties,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Command, RotateCcw } from "lucide-react";
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

export type ShortcutRecorderProps = {
  label?: string;
  description?: string;
  value?: string[];
  defaultValue?: string[];
  onChange?: (keys: string[]) => void;
  disabled?: boolean;
  theme?: "dark" | "light";
};
const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeToMotion(change: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}

export function ShortcutRecorder({
  label = "Quick capture",
  description = "Choose a key combination for opening a new note.",
  value,
  defaultValue = ["Control", "Shift", "K"],
  onChange,
  disabled = false,
  theme = "dark",
}: ShortcutRecorderProps) {
  const id = useId();
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
  const [local, setLocal] = useState(() => [...defaultValue]);
  const [recording, setRecording] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; keys?: string[] }>({ text: "" });
  const trigger = useRef<HTMLButtonElement>(null);
  const keys = value ?? local;
  const feedbackMatches = !feedback.keys || (
    feedback.keys.length === keys.length && feedback.keys.every((key, i) => key === keys[i])
  );
  const notice = feedbackMatches ? feedback.text : "";
  function setNotice(text: string, forKeys?: string[]) {
    setFeedback({ text, keys: forKeys && [...forKeys] });
  }
  const readOnly = value !== undefined && !onChange;
  useLayoutEffect(() => {
    if (disabled || readOnly) setRecording(false);
  }, [disabled, readOnly]);
  function change(next: string[]) {
    setLocal(next);
    onChange?.([...next]);
  }
  return (
    <motion.section
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={entrance}
      aria-labelledby={id}
      style={colors(theme)}
      className="@container w-full max-w-lg rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 text-[var(--ink)]"
    >
      <Command size={26} strokeWidth={1.3} aria-hidden="true" />
      <h2 id={id} className="mt-5 text-xl font-medium tracking-tight">
        {label}
      </h2>
      <p className={`mt-2 text-sm leading-relaxed ${muted}`}>{description}</p>
      <button
        ref={trigger}
        type="button"
        data-demo="record-shortcut"
        disabled={disabled || readOnly}
        aria-label={
          recording
            ? "Recording shortcut. Escape to cancel."
            : `Record shortcut. Current: ${keys.join(" plus ") || "not set"}`
        }
        aria-describedby={`${id}-hint`}
        onClick={() => {
          if (disabled || readOnly) return;
          setRecording(true);
          setNotice("");
        }}
        onBlur={() => setRecording(false)}
        onKeyDown={(e) => {
          if (!recording || disabled || readOnly || e.nativeEvent.isComposing) return;
          if (e.key === "Escape") {
            e.preventDefault();
            setRecording(false);
            setNotice("Recording cancelled.");
            return;
          }
          if (e.key === "Tab") {
            setRecording(false);
            return;
          }
          if (
            ["Control", "Shift", "Alt", "Meta", "Dead", "Process"].includes(
              e.key,
            )
          )
            return;
          e.preventDefault();
          e.stopPropagation();
          if (
            !e.ctrlKey &&
            !e.altKey &&
            !e.metaKey &&
            !/^F([1-9]|1[0-2])$/.test(e.key)
          ) {
            setNotice(
              "Include Control, Alt or Command, or use a function key.",
            );
            return;
          }
          const next = [
            ...(e.ctrlKey ? ["Control"] : []),
            ...(e.altKey ? ["Alt"] : []),
            ...(e.shiftKey ? ["Shift"] : []),
            ...(e.metaKey ? ["Meta"] : []),
            e.key.length === 1 ? e.key.toUpperCase() : e.key,
          ];
          change(next);
          setRecording(false);
          setNotice("Shortcut recorded.", next);
        }}
        className={`${control} mt-6 flex min-h-24 w-full flex-wrap border border-dashed border-[var(--line)] px-4 py-4 ${recording ? "bg-[var(--wash)]" : ""}`}
      >
        {recording ? (
          <span className="text-sm">Press a key combination…</span>
        ) : keys.length ? (
          keys.map((key, i) => (
            <kbd
              key={i}
              className="rounded-md border border-[var(--line)] bg-[var(--wash)] px-3 py-2 font-mono text-sm shadow-[0_3px_0_var(--line)]"
            >
              {key}
            </kbd>
          ))
        ) : (
          <span className={muted}>Click to record</span>
        )}
      </button>
      <div className="mt-4 flex items-start justify-between gap-3">
        <p
          id={`${id}-hint`}
          role="status"
          className={`max-w-xs text-xs leading-relaxed ${muted}`}
        >
          {notice ||
            (recording
              ? "Escape cancels. Tab leaves without changing the shortcut."
              : "Click the keycaps to change the combination.")}
        </p>
        <button
          type="button"
          data-demo="reset-shortcut"
          disabled={disabled || readOnly}
          aria-label="Reset shortcut"
          onClick={() => {
            if (disabled || readOnly) return;
            const next = [...defaultValue];
            change(next);
            setRecording(false);
            setNotice("Shortcut reset.", next);
            trigger.current?.focus();
          }}
          className={`${control} -mt-2 shrink-0 p-0`}
        >
          <RotateCcw size={16} aria-hidden="true" />
        </button>
      </div>
    </motion.section>
  );
}

export default function ShortcutRecorderDemo(
  overrides: Partial<ShortcutRecorderProps> = {},
) {
  return (
    <div
      className="flex min-h-[560px] w-full items-center justify-center p-4 @container sm:p-8"
      style={{
        background: overrides.theme === "light" ? "#f3f3f3" : "#080808",
      }}
    >
      <ShortcutRecorder {...overrides} />
    </div>
  );
}
