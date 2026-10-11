/** Bundle a local component in isolation for browser regression fixtures. Nothing is written to the registry. */
import { build } from "esbuild";

export async function mountFixture(page, slug, tier, fixture) {
  const base = (process.env.PREVIEW_BASE || "http://localhost:3100").replace(
    /\/$/,
    "",
  );
  const root = process.cwd();
  const compiled = await build({
    stdin: {
      contents: `import React, {useState} from 'react'; import {createRoot} from 'react-dom/client'; import * as Subject from './registry/${tier}/${slug}/${slug}.tsx'; ${fixture}`,
      resolveDir: root,
      loader: "tsx",
    },
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  await page.goto(`${base}/preview/${slug}`, { waitUntil: "networkidle" });
  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((l) => l.href));
  await page.route("**/__component_audit__", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="en"><head><title>Component audit</title>${styles.map((h) => `<link rel="stylesheet" href="${h}">`).join("")}</head><body style="margin:0;background:#09090b;color:#f4f4f5"><main style="padding:32px;max-width:720px;margin:auto" id="root"></main></body></html>`,
    }),
  );
  await page.goto(`${base}/__component_audit__`);
  await page.addScriptTag({ content: compiled.outputFiles[0].text });
  await page.waitForTimeout(700);
}
