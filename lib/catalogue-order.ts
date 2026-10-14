export type CatalogueOrder = "featured" | "new";

export function readCatalogueOrder(search: URLSearchParams): CatalogueOrder {
  return search.get("sort") === "new" ? "new" : "featured";
}

/** ISO catalogue dates sort chronologically. Preserve curated order on the same day. */
export function newestFirst<T extends { added: string }>(cards: readonly T[]): T[] {
  return [...cards].sort((a, b) => b.added.localeCompare(a.added));
}

export function catalogueOrderHref(search: string, order: CatalogueOrder): string {
  const params = new URLSearchParams(search);
  if (order === "new") params.set("sort", "new");
  else params.delete("sort");
  const query = params.toString();
  return query ? `/components?${query}` : "/components";
}
