import { describe, expect, it } from "vitest";
import {
  galleryHref,
  groupRowId,
  itemRowId,
  moveSidebarRow,
  openGroup,
  parseCollapsed,
  parseFilters,
  parseScroll,
  readCategoryParam,
  scrollDelta,
  sidebarMaxHeight,
  toggleCollapsed,
  typeaheadRow,
  type SidebarRow,
} from "@/lib/gallery-sidebar";

const valid = new Set(["charts", "devtools", "editors"]);

const rows: SidebarRow[] = [
  { id: "all", label: "All components", kind: "all" },
  { id: groupRowId("App UI"), label: "App UI", kind: "group", open: false },
  { id: groupRowId("Lead"), label: "Lead", kind: "group", open: true },
  { id: itemRowId("hero"), label: "Heroes", kind: "item", key: "hero", group: "Lead" },
  { id: itemRowId("ai"), label: "AI chat & assistants", kind: "item", key: "ai", group: "Lead" },
];

describe("gallery category URL", () => {
  it("reads a known category and ignores anything else", () => {
    expect(readCategoryParam("charts", valid)).toBe("charts");
    expect(readCategoryParam(["devtools", "charts"], valid)).toBe("devtools");
    expect(readCategoryParam("nope", valid)).toBe("all");
    expect(readCategoryParam("  ", valid)).toBe("all");
    expect(readCategoryParam(undefined, valid)).toBe("all");
  });

  it("writes the category into the query and keeps unrelated params", () => {
    expect(galleryHref("", "charts")).toBe("/components?category=charts");
    expect(galleryHref("?category=charts", "all")).toBe("/components");
    expect(galleryHref("?q=pricing&category=charts", "editors")).toBe("/components?q=pricing&category=editors");
  });
});

describe("collapsed groups", () => {
  it("parses stored labels and ignores bad payloads", () => {
    expect(parseCollapsed('["Lead","Lead",1,null]')).toEqual(["Lead"]);
    expect(parseCollapsed("nope")).toEqual([]);
    expect(parseCollapsed(null)).toEqual([]);
  });

  it("toggles without dropping a group that was collapsed in the same turn", () => {
    expect(toggleCollapsed(toggleCollapsed([], "Lead"), "App UI")).toEqual(["Lead", "App UI"]);
    expect(toggleCollapsed(["Lead", "App UI"], "Lead")).toEqual(["App UI"]);
  });

  it("opens the group that holds the selected category", () => {
    expect(openGroup(["Lead", "App UI"], "Lead")).toEqual(["App UI"]);
    expect(openGroup(["App UI"], "Lead")).toEqual(["App UI"]);
    expect(openGroup(["App UI"], undefined)).toEqual(["App UI"]);
  });
});

describe("gallery filters", () => {
  it("restores a search and tier, and ignores junk", () => {
    expect(parseFilters('{"q":"chart","tier":"pro"}')).toEqual({ q: "chart", tier: "pro" });
    expect(parseFilters('{"q":"chart","tier":"nope"}')).toEqual({ q: "chart", tier: "all" });
    expect(parseFilters("nope")).toEqual({ q: "", tier: "all" });
    expect(parseFilters(null)).toEqual({ q: "", tier: "all" });
  });
});

describe("sidebar scroll", () => {
  it("parses a saved offset", () => {
    expect(parseScroll('{"cat":"charts","top":420}')).toEqual({ cat: "charts", top: 420 });
    expect(parseScroll('{"cat":"charts","top":-8}')).toEqual({ cat: "charts", top: 0 });
    expect(parseScroll('{"top":12}')).toBeNull();
    expect(parseScroll("[]")).toBeNull();
  });

  it("shortens the list to the visible viewport before the sidebar sticks", () => {
    expect(sidebarMaxHeight(442, 900)).toBe(434);
    expect(sidebarMaxHeight(96, 900)).toBe(780);
    expect(sidebarMaxHeight(20, 900)).toBe(780);
    expect(sidebarMaxHeight(1200, 900)).toBe(0);
  });

  it("scrolls only far enough to clear the fade", () => {
    expect(scrollDelta(100, 400, 80, 110)).toBe(-44);
    expect(scrollDelta(100, 400, 370, 410)).toBe(34);
    expect(scrollDelta(100, 400, 140, 180)).toBe(0);
  });
});

describe("sidebar keyboard", () => {
  it("moves with arrows, home and end", () => {
    expect(moveSidebarRow(rows, "all", "ArrowDown")).toEqual({ type: "focus", id: groupRowId("App UI") });
    expect(moveSidebarRow(rows, itemRowId("ai"), "ArrowUp")?.type).toBe("focus");
    expect(moveSidebarRow(rows, itemRowId("ai"), "Home")).toEqual({ type: "focus", id: "all" });
    expect(moveSidebarRow(rows, "all", "End")?.id).toBe(itemRowId("ai"));
    expect(moveSidebarRow(rows, "all", "ArrowUp")).toBeNull();
    expect(moveSidebarRow(rows, "all", "Enter")).toBeNull();
  });

  it("opens and closes groups and moves to the parent", () => {
    expect(moveSidebarRow(rows, groupRowId("App UI"), "ArrowRight")).toEqual({
      type: "toggle",
      id: groupRowId("App UI"),
      label: "App UI",
      open: true,
    });
    expect(moveSidebarRow(rows, groupRowId("Lead"), "ArrowRight")).toEqual({ type: "focus", id: itemRowId("hero") });
    expect(moveSidebarRow(rows, groupRowId("Lead"), "ArrowLeft")).toEqual({
      type: "toggle",
      id: groupRowId("Lead"),
      label: "Lead",
      open: false,
    });
    expect(moveSidebarRow(rows, itemRowId("ai"), "ArrowLeft")).toEqual({ type: "focus", id: groupRowId("Lead") });
  });

  it("typeahead wraps to the next matching label", () => {
    expect(typeaheadRow(rows, "all", "a")).toBe(groupRowId("App UI"));
    expect(typeaheadRow(rows, groupRowId("App UI"), "a")).toBe(itemRowId("ai"));
    expect(typeaheadRow(rows, itemRowId("ai"), "a")).toBe("all");
    expect(typeaheadRow(rows, "all", "zzz")).toBeNull();
  });
});
