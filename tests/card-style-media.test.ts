import { expect, it } from "vitest";
import { cardStyleMedia } from "../lib/card-style-media";

const original = { thumb: "/previews/example.webp", srcSet: "/small.webp 480w", video: { mp4: "/example.mp4", webm: null } };

it("uses styled pixels without loading Original responsive candidates or playing its recording over them", () => {
  expect(cardStyleMedia(original, { crayon: "/style-previews/crayon/example.webp?v=123" }, "crayon")).toEqual({
    thumb: "/style-previews/crayon/example.webp?v=123", srcSet: undefined, video: null,
  });
  expect(original.srcSet).toBe("/small.webp 480w");
  expect(original.video).not.toBeNull();
});

it("restores Original media and keeps a usable fallback if style pixels are absent", () => {
  expect(cardStyleMedia(original, { crayon: "/crayon.webp" }, "original")).toBe(original);
  expect(cardStyleMedia(original, undefined, "crayon")).toBe(original);
});
