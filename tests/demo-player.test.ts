import { describe, expect, it } from "vitest";
import { supportsFocusVisibleOption } from "@/lib/demo/player";
import { mirrorSelector } from "@/lib/demo/pseudo-state";

describe("demo :hover / :active mirroring", () => {
  it("swaps the pseudo-classes for the demo attributes", () => {
    expect(mirrorSelector(".row:hover")).toBe(".row[data-demo-hover]");
    expect(mirrorSelector("button:active > span")).toBe("button[data-demo-active] > span");
    expect(mirrorSelector(".a:hover::after, .b")).toBe(".a[data-demo-hover]::after, .b");
    expect(mirrorSelector("&:hover")).toBe("&[data-demo-hover]");
  });

  it("handles Tailwind's escaped variant class names", () => {
    expect(mirrorSelector(".hover\\:bg-white\\/5:hover")).toBe(".hover\\:bg-white\\/5[data-demo-hover]");
    expect(mirrorSelector(".group-hover\\:opacity-100:is(:where(.group):hover *)")).toBe(".group-hover\\:opacity-100:is(:where(.group)[data-demo-hover] *)");
    expect(mirrorSelector(".active\\:scale-\\[0\\.97\\]:active")).toBe(".active\\:scale-\\[0\\.97\\][data-demo-active]");
    expect(mirrorSelector(".\\[\\&\\:hover\\]\\:x")).toBeNull();
  });

  it("leaves rules without the pseudo-classes alone", () => {
    expect(mirrorSelector(".hover\\:bg-x")).toBeNull();
    expect(mirrorSelector(".card:focus-visible")).toBeNull();
    expect(mirrorSelector(".tab:is([data-active])")).toBeNull();
  });
});

describe("pointer focus", () => {
  const element = (readsOption: boolean) => {
    const target = { focus: (o?: { focusVisible?: boolean }) => (readsOption ? void o?.focusVisible : undefined) };
    return { ownerDocument: { createElement: () => target } } as unknown as Element;
  };

  it("detects whether focus() reads focusVisible", () => {
    expect(supportsFocusVisibleOption(element(true))).toBe(true);
    expect(supportsFocusVisibleOption(element(false))).toBe(false);
  });
});
