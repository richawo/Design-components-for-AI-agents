import { check as queue } from "../review/block-music-queue.mjs";
import { check as likes } from "../review/block-music-likes.mjs";
export async function check(context) {
  const viewport = context.page.viewportSize();
  try { await queue(context); await likes(context); }
  finally { if (viewport) await context.page.setViewportSize(viewport); }
}
