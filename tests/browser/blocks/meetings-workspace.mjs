import { check as pending } from "../review/block-meetings-pending.mjs";
import { check as rawNotes } from "../review/block-meetings-raw-notes.mjs";
import { check as behavior } from "../review/block-meetings-behavior.mjs";
import { check as edges } from "../review/block-meetings-edge.mjs";
import { check as focus } from "../review/block-meetings-focus.mjs";

export async function check(context) {
  const viewport = context.page.viewportSize();
  try {
    await pending(context);
    await rawNotes(context);
    await context.page.setViewportSize({ width: 1400, height: 940 });
    await behavior(context);
    await edges(context);
    await focus(context);
  } finally {
    if (viewport) await context.page.setViewportSize(viewport);
    await context.page.emulateMedia({ reducedMotion: "reduce" });
  }
}
