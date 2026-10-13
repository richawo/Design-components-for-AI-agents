"use client";

import Link, { useLinkStatus } from "next/link";
import { createPortal } from "react-dom";
import type { ComponentProps } from "react";

/** Keep native Next link semantics, including modifiers, redirects and cancellation. */
export function SiteLink({ children, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props}>{children}<NavigationFeedback /></Link>;
}

function NavigationFeedback() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  // Next owns the most recent pending link. No document-wide click listener,
  // guessed timeout or URL comparison can leave this running after cancellation.
  return createPortal(
    <div data-route-pending="true" role="status" className="site-navigation-feedback pointer-events-none fixed inset-x-0 top-0 z-[110] h-0.5 overflow-hidden bg-site-line">
      <span className="sr-only">Opening page…</span>
      <span aria-hidden="true" className="site-navigation-bar absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-site-accent to-site-accent" />
    </div>,
    document.body,
  );
}
