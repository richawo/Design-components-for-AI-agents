"use client";

import { useEffect } from "react";

/** Gap between blocks that land together, and the most a batch will wait. */
const STAGGER_MS = 60;
const MAX_STAGGER_STEPS = 8;
/** A block lands once a fifth of it, or a fifth of the viewport, is showing. */
const VISIBLE_FRACTION = 0.2;

/**
 * Scroll reveals for the whole site, mounted once in the layout. Any element
 * with `site-reveal` that is below the fold at hydration is parked (hidden,
 * lowered, blurred) and lands once as it scrolls in. Blocks that enter in the
 * same frame stagger in reading order. Anything already on screen is left
 * alone, so content never blinks out and nothing depends on script to show.
 * The layout outlives navigations, so one observer serves every page.
 */
export function RevealObserver() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const landing = entries
          .filter((e) => e.isIntersecting && (e.intersectionRatio >= VISIBLE_FRACTION || e.intersectionRect.height >= window.innerHeight * VISIBLE_FRACTION))
          .map((e) => e.target as HTMLElement)
          .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
        landing.forEach((el, i) => {
          io.unobserve(el);
          el.style.setProperty("--reveal-delay", `${Math.min(i, MAX_STAGGER_STEPS) * STAGGER_MS}ms`);
          el.dataset.reveal = "shown";
          // Once landed, drop the transition so it never softens later changes.
          // Opacity is the longest leg; children's own transitions bubble here too.
          const settle = (e: TransitionEvent) => {
            if (e.target !== el || e.propertyName !== "opacity") return;
            el.dataset.reveal = "done";
            el.removeEventListener("transitionend", settle);
          };
          el.addEventListener("transitionend", settle);
        });
      },
      { threshold: [0, VISIBLE_FRACTION] },
    );

    // Blocks parked by an earlier observer (a remount, or Strict Mode's double
    // effect) are picked up again; observing twice is a no-op.
    const park = (root: ParentNode) => {
      root.querySelectorAll<HTMLElement>(".site-reveal:not([data-reveal]), .site-reveal[data-reveal='pending']").forEach((el) => {
        if (el.dataset.reveal === "pending") return io.observe(el);
        if (el.getBoundingClientRect().top < window.innerHeight) {
          el.dataset.reveal = "done";
          return;
        }
        el.dataset.reveal = "pending";
        io.observe(el);
      });
    };

    park(document);
    // New pages and late client content mount more blocks. Coalesce to one
    // scan per frame, after the router has restored the scroll position.
    let frame = 0;
    const mo = new MutationObserver(() => {
      if (!frame) frame = requestAnimationFrame(() => ((frame = 0), park(document)));
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return null;
}
