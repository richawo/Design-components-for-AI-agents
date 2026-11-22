"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { analyticsEnabled, flush, track } from "@/lib/analytics/client";
import { classifyPath } from "@/lib/analytics/events";

/**
 * Page-level funnel tracking for the human site: page views, engaged time,
 * scroll depth, blog reading progress and link clicks. It renders nothing
 * and does its work after the page is interactive.
 */

const ENGAGED_MS = 10_000;
const BLOG_DEPTHS = [25, 50, 75, 90];

type PageState = {
  path: string;
  pageType: string;
  slug: string | null;
  visibleSince: number | null;
  engaged: number;
  reported: number;
  maxScroll: number;
  engagedSent: boolean;
  depths: Set<number>;
};

function scrollPercent() {
  const doc = document.documentElement;
  const max = doc.scrollHeight - window.innerHeight;
  if (max <= 0) return 100;
  return Math.min(100, Math.round((window.scrollY / max) * 100));
}

function region(element: Element) {
  const marked = element.closest("[data-track-section]")?.getAttribute("data-track-section");
  if (marked) return marked;
  if (element.closest("header")) return "header";
  if (element.closest("footer")) return "footer";
  if (element.closest("nav")) return "nav";
  if (element.closest("aside")) return "aside";
  return "main";
}

export function SiteAnalytics() {
  const pathname = usePathname();
  const page = useRef<PageState | null>(null);
  const previousPath = useRef<string | null>(null);

  // Report engaged time accumulated since the last report.
  const report = () => {
    const state = page.current;
    if (!state) return;
    const now = Date.now();
    if (state.visibleSince !== null) { state.engaged += now - state.visibleSince; state.visibleSince = document.visibilityState === "visible" ? now : null; }
    const delta = state.engaged - state.reported;
    if (delta < 250) return;
    state.reported = state.engaged;
    // Route changes report after the URL has moved on, so name the page explicitly.
    track("page_engagement", {
      engaged_ms: delta, total_engaged_ms: state.engaged, max_scroll_pct: state.maxScroll,
      path: state.path, $current_url: window.location.origin + state.path, page_type: state.pageType, slug: state.slug,
    });
  };

  useEffect(() => {
    if (!analyticsEnabled()) return;
    const { pageType, slug } = classifyPath(pathname);
    if (page.current?.path === pathname) {
      // A remount of the same page (React development checks, layout changes) is not a new view.
      if (page.current.visibleSince === null && document.visibilityState === "visible") page.current.visibleSince = Date.now();
    } else {
      const referrerPath = previousPath.current;
      previousPath.current = pathname;
      page.current = {
        path: pathname, pageType, slug, visibleSince: document.visibilityState === "visible" ? Date.now() : null,
        engaged: 0, reported: 0, maxScroll: 0, engagedSent: false, depths: new Set(),
      };
      track("page_view", { previous_path: referrerPath }, { newPage: true });
      if (pageType === "pricing" && new URLSearchParams(window.location.search).has("cancelled")) track("checkout_cancelled", {});
    }

    const measure = () => {
      const state = page.current;
      if (!state || state.path !== pathname) return;
      const depth = scrollPercent();
      if (depth > state.maxScroll) state.maxScroll = depth;
      if (state.pageType === "blog_post") {
        for (const mark of BLOG_DEPTHS) {
          if (depth >= mark && !state.depths.has(mark)) { state.depths.add(mark); track("blog_read_progress", { depth: mark }); }
        }
      }
    };
    // Time-based throttle: animation frames pause in background tabs.
    let lastMeasure = 0;
    let trailing: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      const now = Date.now();
      clearTimeout(trailing);
      if (now - lastMeasure > 200) { lastMeasure = now; measure(); }
      else trailing = setTimeout(measure, 250);
    };
    const engagedTimer = window.setInterval(() => {
      const state = page.current;
      if (!state || state.engagedSent) return;
      const live = state.engaged + (state.visibleSince !== null ? Date.now() - state.visibleSince : 0);
      if (live >= ENGAGED_MS) { state.engagedSent = true; track("content_engaged", { engaged_ms: live, max_scroll_pct: state.maxScroll }); }
    }, 2000);
    window.addEventListener("scroll", onScroll, { passive: true });
    const settle = window.setTimeout(measure, 1200);
    return () => {
      // Close out this page before the next page view (or before a same-page remount resumes it).
      report();
      window.removeEventListener("scroll", onScroll);
      window.clearInterval(engagedTimer);
      window.clearTimeout(settle);
      clearTimeout(trailing);
    };
  }, [pathname]);

  useEffect(() => {
    if (!analyticsEnabled()) return;
    const onVisibility = () => {
      const state = page.current;
      if (!state) return;
      if (document.visibilityState === "hidden") { report(); flush(); }
      else if (state.visibleSince === null) state.visibleSince = Date.now();
    };
    const onHide = () => { report(); flush(); };
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      let url: URL;
      try { url = new URL(link.href, window.location.href); } catch { return; }
      if (!/^https?:$/.test(url.protocol)) return;
      const outbound = url.origin !== window.location.origin;
      const label = (link.getAttribute("aria-label") || link.innerText || link.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);
      track("link_clicked", {
        target: outbound ? url.hostname + url.pathname : url.pathname,
        target_page_type: outbound ? "outbound" : classifyPath(url.pathname).pageType,
        outbound, label, section: region(link),
      });
      if (outbound) flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    document.addEventListener("click", onClick, { capture: true });
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("click", onClick, { capture: true });
    };
  }, []);

  return null;
}
