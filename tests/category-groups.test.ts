import { describe, expect, it } from "vitest";
import { CATEGORY_GROUPS, groupCategories } from "@/lib/category-groups";
import { CATEGORIES } from "@/lib/registry-types";

describe("groupCategories", () => {
  it("only names real categories, each once", () => {
    const keys = CATEGORY_GROUPS.flatMap((g) => g.categories);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k in CATEGORIES).toBe(true);
  });

  it("keeps gallery order, drops empty groups and files unknown categories under More", () => {
    const groups = groupCategories([{ key: "hero" }, { key: "ai" }, { key: "mobile" }, { key: "brand-new" }]);
    expect(groups.map((g) => [g.label, g.items.map((c) => c.key)])).toEqual([
      ["Lead", ["hero", "ai"]],
      ["Platforms", ["mobile"]],
      ["More", ["brand-new"]],
    ]);
  });
});
