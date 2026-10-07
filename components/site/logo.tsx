import Link from "next/link";

/** Mark: a lit tile holding three primitives (square, circle, quarter). */
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="dfa-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe7d1" />
          <stop offset="0.45" stopColor="#ff8a52" />
          <stop offset="1" stopColor="#ff4d6d" />
        </linearGradient>
      </defs>
      <rect width="28" height="28" rx="8" fill="url(#dfa-mark)" />
      <rect x="6.5" y="6.5" width="6.5" height="6.5" rx="1.6" fill="#000" />
      <circle cx="18.25" cy="9.75" r="3.25" fill="#000" />
      <path d="M6.5 15h6.5v6.5A6.5 6.5 0 0 1 6.5 15Z" fill="#000" />
      <rect x="15" y="15" width="6.5" height="6.5" rx="3.25" fill="#000" opacity="0.35" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="group inline-flex items-center gap-2.5" aria-label="Design for AI home">
      <LogoMark className="size-7 transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:rotate-[-8deg]" />
      <span className="text-[15px] font-semibold tracking-[-0.025em] text-site-fg">
        Design for AI
      </span>
    </Link>
  );
}
