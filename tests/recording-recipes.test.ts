import fs from "node:fs";
import { expect, it } from "vitest";
import { parseSteps, demoDuration } from "../lib/demo/schema.mjs";
import { gallerySteps } from "../scripts/lib/recording-quality.mjs";
import { VISUAL_STYLE_IDS } from "../lib/visual-styles";

it("keeps reviewed style recipes replayable against registered components and valid recording bounds", () => {
  const catalogue = JSON.parse(fs.readFileSync("registry/__generated__/index.json", "utf8"));
  const recipes = JSON.parse(fs.readFileSync("scripts/recording-recipes.json", "utf8"));
  for (const [style, scenes] of Object.entries(recipes)) {
    expect(VISUAL_STYLE_IDS).toContain(style);
    for (const [slug, scene] of Object.entries(scenes as Record<string, { steps?: string[]; ambientMs?: number; viewport?: { width: number; height: number }; frameViewport?: boolean }>)) {
      expect(catalogue.some((entry: { slug: string }) => entry.slug === slug)).toBe(true);
      expect(Boolean(scene.steps) !== Boolean(scene.ambientMs)).toBe(true);
      if (scene.steps) expect(demoDuration(gallerySteps(parseSteps(scene.steps)))).toBeLessThan(9500);
      if (scene.ambientMs) { expect(scene.ambientMs).toBeGreaterThanOrEqual(3000); expect(scene.ambientMs).toBeLessThanOrEqual(6000); }
      if (scene.viewport) {
        expect(scene.viewport.width).toBeGreaterThanOrEqual(320); expect(scene.viewport.width).toBeLessThanOrEqual(1920);
        expect(scene.viewport.height).toBeGreaterThanOrEqual(360); expect(scene.viewport.height).toBeLessThanOrEqual(1600);
      }
      if(scene.frameViewport!==undefined)expect(scene.frameViewport).toBe(true);
    }
  }
});
