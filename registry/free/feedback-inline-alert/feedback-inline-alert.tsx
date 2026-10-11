"use client";
import { type CSSProperties, useEffect, useId, useRef, useState } from "react";
import { Info, AlertTriangle, CheckCircle2, X, ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

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

export type InlineAlertProps = {
  title?: string;
  description?: string;
  tone?: "info" | "warning" | "success";
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  onDismiss?: () => void;
  errorMessage?: string;
  theme?: "dark" | "light";
};
export function InlineAlert({
  title = "Your export is ready",
  description = "The archive includes all 24 documents and their original attachments.",
  tone = "success",
  actionLabel = "Open archive",
  onAction,
  onDismiss,
  errorMessage = "The action could not be completed. Please try again.",
  theme = "dark",
}: InlineAlertProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const alive = useRef(true);
  const busy = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function run() {
    if (!onAction || busy.current) return;
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      await onAction();
    } catch {
      if (alive.current) setMessage(errorMessage);
    } finally {
      busy.current = false;
      if (alive.current) setPending(false);
    }
  }
  const Icon =
    tone === "warning"
      ? AlertTriangle
      : tone === "success"
        ? CheckCircle2
        : Info;
  return (
    <motion.section
      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      aria-labelledby={id}
      style={colors(theme)}
      className="@container w-full max-w-2xl rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 text-[var(--ink)]"
    >
      <div className="flex items-start gap-4">
        <Icon size={22} aria-hidden="true" className="mt-1 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 id={id} className="text-base font-medium tracking-tight">
            {title}
          </h2>
          <p className={`mt-1 text-sm leading-relaxed ${muted}`}>
            {description}
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            data-demo="dismiss"
            aria-label="Dismiss notification"
            disabled={pending}
            onClick={onDismiss}
            className={`${control} -mr-2 -mt-2 shrink-0 p-0`}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      {onAction && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-3">
          <button
            type="button"
            data-demo="alert-action"
            aria-busy={pending}
            disabled={pending}
            onClick={() => void run()}
            className={`${control} border border-[var(--line)]`}
          >
            {pending ? "Working…" : actionLabel}
            <ArrowRight size={15} aria-hidden="true" />
          </button>
          <p role="status" className={`text-sm ${muted}`}>
            {message}
          </p>
        </div>
      )}
    </motion.section>
  );
}
export default function InlineAlertDemo(
  overrides: Partial<InlineAlertProps> = {},
) {
  const [opened, setOpened] = useState(false);
  return (
    <div
      className="flex min-h-[560px] items-center justify-center p-4 sm:p-8"
      style={{
        background: overrides.theme === "light" ? "#f3f3f3" : "#080808",
      }}
    >
      <InlineAlert
        title={opened ? "Archive opened" : "Your export is ready"}
        description={
          opened
            ? "In your application, this action opens the completed export."
            : undefined
        }
        onAction={() => setOpened(!opened)}
        actionLabel={opened ? "Back to export" : "Open archive"}
        {...overrides}
      />
    </div>
  );
}
