import { SiteLink as Link } from "@/components/site/site-link";

/** Mark: a tile in the brand accent holding three primitives (square, circle, quarter). */
export function LogoMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
      <rect width="28" height="28" rx="8" className="fill-site-accent" />
      <rect x="6.5" y="6.5" width="6.5" height="6.5" rx="1.6" className="fill-site-on-accent" />
      <circle cx="18.25" cy="9.75" r="3.25" className="fill-site-on-accent" />
      <path d="M6.5 15h6.5v6.5A6.5 6.5 0 0 1 6.5 15Z" className="fill-site-on-accent" />
      <rect x="15" y="15" width="6.5" height="6.5" rx="3.25" className="fill-site-on-accent" opacity="0.35" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="group inline-flex shrink-0 items-center whitespace-nowrap gap-2.5 rounded-lg" aria-label="Design for AI home">
      <LogoMark className="size-7 transition-transform duration-300 ease-site group-hover:rotate-[-6deg] group-active:scale-95" />
      <span className="text-[15px] font-semibold tracking-[-0.025em] text-site-fg">
        Design for AI
      </span>
    </Link>
  );
}
