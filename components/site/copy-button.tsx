"use client";

import { useEffect, useRef, useState } from "react";

export function CopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied",
  className = "",
  variant = "dark",
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  variant?: "dark" | "light" | "accent";
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const styles = {
    dark: "bg-white/[0.07] text-site-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-white/[0.12]",
    light: "bg-white text-black hover:bg-white/90",
    accent: "bg-gradient-to-b from-[#ff8a52] to-[#ff6a3d] text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] hover:brightness-110",
  }[variant];
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1600);
      }}
      className={`inline-flex h-8 select-none items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition duration-200 ease-[cubic-bezier(.2,.8,.2,1)] active:scale-[0.95] active:duration-75 ${styles} ${className}`}
      aria-live="polite"
    >
      {copied ? (
        <svg key="check" viewBox="0 0 16 16" className="site-pop size-3.5" fill="none" aria-hidden="true">
          <path className="site-draw" d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg key="copy" viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden="true">
          <rect x="5" y="5" width="8.5" height="8.5" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M10.5 5V3.8c0-.7-.6-1.3-1.3-1.3H3.8c-.7 0-1.3.6-1.3 1.3v5.4c0 .7.6 1.3 1.3 1.3H5" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      )}
      {copied ? copiedLabel : label}
    </button>
  );
}
