import { check as queue } from "../review/block-music-queue.mjs";
import { check as likes } from "../review/block-music-likes.mjs";
import { check as rowPause } from "../review/block-music-row-pause.mjs";
import { check as queueContract } from "../review/block-music-queue-contract.mjs";
import { check as brand } from "../review/block-music-brand.mjs";
import { check as selection } from "../review/block-music-selection.mjs";
import { check as blankRelease } from "../review/block-music-blank-release.mjs";
import { check as behavior } from "../review/block-music-behavior.mjs";
import { check as edges } from "../review/block-music-edges.mjs";
import { check as motion } from "../review/block-music-motion.mjs";
export async function check(context) {
  const viewport = context.page.viewportSize();
  const reduced = await context.page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  try {
    for (const check of [queue, likes, rowPause, queueContract, brand, selection, blankRelease, behavior, edges, motion]) await check(context);
  } finally {
    if (viewport) await context.page.setViewportSize(viewport);
    await context.page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
  }
}
