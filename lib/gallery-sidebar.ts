/** Gallery sidebar state that is easier to test outside the component. */

export const COLLAPSED_KEY = "dfa:browser-collapsed-groups";
export const SCROLL_KEY = "dfa:browser-sidebar-scroll";
export const FILTER_KEY = "dfa:browser-filters";

export const ALL_ROW_ID = "all";

export function groupRowId(label: string) {
  return `group:${label}`;
}

export function itemRowId(key: string) {
  return `item:${key}`;
}

/** A known category key, or "all" when the query is missing or not in the gallery. */
export function readCategoryParam(raw: string | string[] | undefined | null, valid: ReadonlySet<string>): string {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (!value || !valid.has(value)) return "all";
  return value;
}

/** `/components`, with `category` set and every other query param left as it was. */
export function galleryHref(search: string, category: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (!category || category === "all") params.delete("category");
  else params.set("category", category);
  const qs = params.toString();
  return qs ? `/components?${qs}` : "/components";
}

export function parseCollapsed(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const saved = JSON.parse(raw) as unknown;
    if (!Array.isArray(saved)) return [];
    return [...new Set(saved.filter((item): item is string => typeof item === "string"))];
  } catch {
    return [];
  }
}

export function toggleCollapsed(collapsed: readonly string[], label: string): string[] {
  return collapsed.includes(label) ? collapsed.filter((item) => item !== label) : [...collapsed, label];
}

/** Drop `label` from the collapsed set so that group is open. */
export function openGroup(collapsed: readonly string[], label: string | undefined): string[] {
  if (!label || !collapsed.includes(label)) return [...collapsed];
  return collapsed.filter((item) => item !== label);
}

export function parseFilters(raw: string | null): { q: string; tier: "all" | "free" | "pro" } {
  const empty = { q: "", tier: "all" as const };
  if (!raw) return empty;
  try {
    const saved = JSON.parse(raw) as { q?: unknown; tier?: unknown };
    const tier = saved?.tier === "free" || saved?.tier === "pro" ? saved.tier : "all";
    const q = typeof saved?.q === "string" ? saved.q : "";
    return { q, tier };
  } catch {
    return empty;
  }
}

export function parseScroll(raw: string | null): { cat: string; top: number } | null {
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as { cat?: unknown; top?: unknown };
    if (typeof saved?.cat !== "string" || typeof saved.top !== "number" || !Number.isFinite(saved.top)) return null;
    return { cat: saved.cat, top: Math.max(0, saved.top) };
  } catch {
    return null;
  }
}

/**
 * Height that keeps the sticky sidebar inside the viewport.
 * Before it sticks, `top` is lower on the page, so the list would otherwise
 * run off the bottom of the screen and scroll into a hidden region.
 * `stick` is the `lg:top-24` offset (96px); `gap` is the space left under the list.
 */
export function sidebarMaxHeight(top: number, viewport: number, stick = 96, gap = 24): number {
  const origin = Math.max(stick, Math.min(top, viewport));
  return Math.max(0, Math.round(viewport - origin - gap));
}

/**
 * Window scroll that puts the result count just under the sticky header.
 * Null when that count is already on screen, so picking a category does not
 * jump a list the reader can already see.
 */
export function resultsScrollTop(elementTop: number, scrollY: number, viewport: number, header = 96): number | null {
  if (elementTop >= header && elementTop <= viewport * 0.7) return null;
  return Math.max(0, Math.round(scrollY + elementTop - header));
}

/** How many pixels to add to a scrollport so `row` clears `pad` inside it. */
export function scrollDelta(containerTop: number, containerBottom: number, rowTop: number, rowBottom: number, pad = 24): number {
  if (rowTop < containerTop + pad) return rowTop - (containerTop + pad);
  if (rowBottom > containerBottom - pad) return rowBottom - (containerBottom - pad);
  return 0;
}

export type SidebarRow = {
  id: string;
  label: string;
  kind: "all" | "group" | "item";
  open?: boolean;
  key?: string;
  group?: string;
};

export type RowMove = { type: "focus"; id: string } | { type: "toggle"; id: string; label: string; open: boolean };

/** Arrow, Home and End movement for the category list. Unhandled keys return null. */
export function moveSidebarRow(rows: readonly SidebarRow[], currentId: string, key: string): RowMove | null {
  if (!rows.length) return null;
  const index = rows.findIndex((row) => row.id === currentId);
  const i = index === -1 ? 0 : index;
  const row = rows[i];
  if (key === "ArrowDown") {
    const next = rows[i + 1];
    return next ? { type: "focus", id: next.id } : null;
  }
  if (key === "ArrowUp") {
    const prev = rows[i - 1];
    return prev ? { type: "focus", id: prev.id } : null;
  }
  if (key === "Home") return row.id === rows[0].id ? null : { type: "focus", id: rows[0].id };
  if (key === "End") {
    const last = rows[rows.length - 1];
    return row.id === last.id ? null : { type: "focus", id: last.id };
  }
  if (key === "ArrowRight" && row.kind === "group") {
    if (!row.open) return { type: "toggle", id: row.id, label: row.label, open: true };
    const child = rows[i + 1];
    if (child?.kind === "item" && child.group === row.label) return { type: "focus", id: child.id };
    return null;
  }
  if (key === "ArrowLeft") {
    if (row.kind === "group" && row.open) return { type: "toggle", id: row.id, label: row.label, open: false };
    if (row.kind === "item" && row.group) {
      const parent = rows.find((candidate) => candidate.kind === "group" && candidate.label === row.group);
      if (parent) return { type: "focus", id: parent.id };
    }
  }
  return null;
}

/** Next visible row whose label starts with `buffer`, wrapping past the current row. */
export function typeaheadRow(rows: readonly SidebarRow[], fromId: string, buffer: string): string | null {
  const query = buffer.trim().toLowerCase();
  if (!query) return null;
  const start = Math.max(0, rows.findIndex((row) => row.id === fromId));
  const ordered = [...rows.slice(start + 1), ...rows.slice(0, start + 1)];
  return ordered.find((row) => row.label.toLowerCase().startsWith(query))?.id ?? null;
}
