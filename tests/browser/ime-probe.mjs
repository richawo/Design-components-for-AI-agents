import assert from "node:assert/strict";
import fs from "node:fs";
const base = (process.env.PREVIEW_BASE || "http://localhost:3100").replace(
  /\/$/,
  "",
);
import { launchChromium } from "../../scripts/lib/browser.mjs";
const b = await launchChromium();
const p = await b.newPage({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
let checked = 0;
for (const slug of [
  "input-search-scoped",
  "collab-mention-input",
  "collab-comment-thread",
  "collab-invite-people",
  "collab-share-access",
  "combobox-async",
  "multiselect-chips",
  "editor-rich-text",
]) {
  if (
    !fs.existsSync(`registry/free/${slug}`) &&
    !fs.existsSync(`registry/pro/${slug}`)
  )
    continue;
  await p.goto(`${base}/preview/${slug}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  const field = p
    .locator(
      'textarea,input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]),[contenteditable="true"]',
    )
    .filter({ visible: true })
    .first();
  assert.ok(await field.count(), slug);
  await field.focus();
  const result = await field.evaluate((el) => {
    const before = el.value ?? el.innerHTML;
    const e = new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      bubbles: true,
      cancelable: true,
      isComposing: true,
      keyCode: 229,
    });
    el.dispatchEvent(e);
    return {
      prevented: e.defaultPrevented,
      before,
      after: el.value ?? el.innerHTML,
    };
  });
  assert.equal(result.prevented, false, slug);
  assert.equal(result.before, result.after, slug);
  checked++;
}
console.log(
  `${checked} live input paths preserve IME Enter without submitting or selecting.`,
);
await b.close();
