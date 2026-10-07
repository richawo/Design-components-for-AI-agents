"use client";

import { useEffect, useState, type ComponentType } from "react";
import { previews } from "@/registry/__generated__/previews";

/**
 * Renders a registry component live by slug. Pro components are only present
 * when the private source was synced at build time; otherwise the fallback shows.
 */
export function LiveSlot({
  slug,
  exportName,
  props,
  fallback = null,
}: {
  slug: string;
  exportName?: string;
  props?: Record<string, unknown>;
  fallback?: React.ReactNode;
}) {
  const [Comp, setComp] = useState<ComponentType<Record<string, unknown>> | null>(null);
  useEffect(() => {
    let live = true;
    const load = previews[slug];
    if (!load) return;
    load().then((m) => {
      const mod = m as unknown as Record<string, ComponentType<Record<string, unknown>>>;
      if (live) setComp(() => (exportName && mod[exportName]) || mod.default);
    });
    return () => {
      live = false;
    };
  }, [slug, exportName]);
  if (!previews[slug]) return <>{fallback}</>;
  return Comp ? <Comp {...props} /> : null;
}
