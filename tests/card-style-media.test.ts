import { expect, it } from "vitest";
import { cardStyleMedia } from "../lib/card-style-media";

const original = { thumb: "/previews/example.webp", srcSet: "/small.webp 480w", video: { mp4: "/example.mp4", webm: null } };
const crayon = { thumb: "/style-previews/crayon/example.webp?v=123", video: { mp4: "/style-previews/crayon/example.mp4?v=456", webm: null } };

it("keeps the selected style animated with its own recording and matching poster", () => {
  expect(cardStyleMedia(original, { crayon }, "crayon")).toEqual({
    ...crayon, srcSet: undefined, compact: false,
  });
  expect(original.srcSet).toBe("/small.webp 480w");
  expect(original.video).not.toBeNull();
});

it("restores Original media and keeps a usable fallback if style pixels are absent", () => {
  expect(cardStyleMedia(original, { crayon }, "original")).toBe(original);
  expect(cardStyleMedia(original, undefined, "crayon")).toBe(original);
});

it("keeps an older prefetched poster map usable during a deployment", () => {
  expect(cardStyleMedia(original, { crayon: crayon.thumb }, "crayon")).toEqual({
    thumb: crayon.thumb, srcSet: undefined, video: null, compact: false,
  });
});

it("never covers a styled poster with an Original recording when a public clone lacks a take", () => {
  expect(cardStyleMedia(original, { crayon: { ...crayon, video: null } }, "crayon").video).toBeNull();
});

it("uses the smaller styled take in a conveyor and accounts full-size fallbacks honestly", () => {
  const conveyorVideo = { mp4: "/style-previews/crayon/conveyor/example.hash.mp4", webm: null };
  expect(cardStyleMedia({ ...original, compact: true }, { crayon: { ...crayon, conveyorVideo } }, "crayon")).toEqual({
    thumb: crayon.thumb, srcSet: undefined, video: conveyorVideo, compact: true,
  });
  expect(cardStyleMedia({ ...original, compact: true }, { crayon }, "crayon")).toEqual({
    ...crayon, srcSet: undefined, compact: false,
  });
  expect(cardStyleMedia(original, { crayon: { ...crayon, conveyorVideo } }, "crayon").video).toBe(crayon.video);
});
