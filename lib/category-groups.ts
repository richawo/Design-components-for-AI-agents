import type { Category } from "./registry-types";

/** Gallery sidebar sections, from docs/CATALOGUE_ROADMAP.md section 1. Categories missing here land under "More". */
export const CATEGORY_GROUPS: { label: string; categories: Category[] }[] = [
  { label: "Lead", categories: ["hero", "ai", "agents"] },
  {
    label: "Marketing sections",
    categories: ["backgrounds", "features", "pricing", "social-proof", "cta", "headers", "footers", "content", "media", "portfolio", "commerce", "auth"],
  },
  { label: "Visual", categories: ["text", "three-d", "pixel", "effects"] },
  { label: "Controls", categories: ["buttons", "inputs", "selects", "date-time", "forms"] },
  { label: "Surfaces & feedback", categories: ["overlays", "feedback", "progress", "cards", "primitives"] },
  { label: "App UI", categories: ["navigation", "onboarding", "app", "data", "charts"] },
  { label: "Platforms", categories: ["mobile"] },
];

/** Groups `items` (already in gallery order) by section, dropping empty sections. */
export function groupCategories<T extends { key: string }>(items: T[]): { label: string; items: T[] }[] {
  const byKey = new Map(items.map((c) => [c.key, c]));
  const placed = new Set<string>();
  const groups = CATEGORY_GROUPS.map((g) => ({
    label: g.label,
    items: g.categories.flatMap((k) => {
      const c = byKey.get(k);
      if (!c) return [];
      placed.add(k);
      return [c];
    }),
  }));
  const rest = items.filter((c) => !placed.has(c.key));
  if (rest.length) groups.push({ label: "More", items: rest });
  return groups.filter((g) => g.items.length);
}
