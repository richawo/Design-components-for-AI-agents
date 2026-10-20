"use client";

import Link, { useLinkStatus } from "next/link";
import { createPortal } from "react-dom";
import type { ComponentProps } from "react";
import { useSiteI18n } from "./site-i18n";

/** Keep native Next link semantics, including modifiers, redirects and cancellation. */
export function SiteLink({ children, ...props }: ComponentProps<typeof Link>) {
  const { localize, href } = useSiteI18n();
  const target = typeof props.href === "string" ? href(props.href) : { ...props.href, ...(props.href.pathname ? { pathname: href(props.href.pathname) } : {}) };
  return localize(<Link {...props} href={target}>{children}<NavigationFeedback /></Link>);
}

function NavigationFeedback() {
  const { t } = useSiteI18n();
  const { pending } = useLinkStatus();
  if (!pending) return null;
  // Next owns the most recent pending link. No document-wide click listener,
  // guessed timeout or URL comparison can leave this running after cancellation.
  return createPortal(
    <div data-route-pending="true" role="status" className="site-navigation-feedback pointer-events-none fixed inset-x-0 top-0 z-[110] h-0.5 overflow-hidden bg-site-line">
      <span className="sr-only">{t("Opening page…")}</span>
      <span aria-hidden="true" className="site-navigation-bar absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-transparent via-site-accent to-site-accent" />
    </div>,
    document.body,
  );
}
