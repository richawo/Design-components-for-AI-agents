import { describe, expect, it } from "vitest";
import { catalogueOrderHref, newestFirst, readCatalogueOrder } from "@/lib/catalogue-order";
import { galleryFilters } from "@/lib/gallery-sidebar";

describe("new component browsing", () => {
  it("orders additions chronologically without changing featured or same-day order", () => {
    const cards = [
      { slug: "old-featured", added: "2026-01-09" },
      { slug: "new-featured", added: "2026-10-14" },
      { slug: "same-day", added: "2026-10-14" },
      { slug: "previous-day", added: "2026-10-13" },
    ];
    const before = [...cards];
    expect(newestFirst(cards).map(card => card.slug)).toEqual(["new-featured", "same-day", "previous-day", "old-featured"]);
    expect(cards).toEqual(before);
  });

  it("keeps category, tier and search when sharing or leaving the new order", () => {
    const href = catalogueOrderHref("?category=hero&tier=free&q=scroll", "new");
    const search = new URLSearchParams(href.split("?")[1]);
    expect(readCatalogueOrder(search)).toBe("new");
    expect(search.get("category")).toBe("hero");
    expect(search.get("tier")).toBe("free");
    expect(search.get("q")).toBe("scroll");
    expect(catalogueOrderHref(search.toString(), "featured")).toBe("/components?category=hero&tier=free&q=scroll");
    expect(readCatalogueOrder(new URLSearchParams("sort=unknown"))).toBe("featured");
  });

  it("opens an explicit new catalogue link without restoring an unrelated remembered search", () => {
    const saved = JSON.stringify({ q: "portfolio", tier: "free" });
    expect(galleryFilters(new URLSearchParams("sort=new"), saved)).toEqual({ q: "", tier: "all" });
    expect(galleryFilters(new URLSearchParams("sort=new&q=hero&tier=pro"), saved)).toEqual({ q: "hero", tier: "pro" });
  });
});
