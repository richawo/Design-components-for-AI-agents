# Component browser QA

Run from the public repository with private Pro sources checked out if the change touches Pro. Use a supported Node LTS release and a local Chromium installation. `scripts/lib/browser.mjs` locates Chromium, or set `CHROMIUM_PATH` explicitly.

Start the preview server in a separate terminal:

```sh
npm run dev -- -p 3100
```

Run the source checks before each commit:

```sh
node scripts/build-registry.mjs --strict
npm run typecheck
npm test
```

## Responsive rendering and accessibility

```sh
npm run audit:components -- --since=2026-10-10
npm run audit:components -- ai-composer-minimal chart-waffle
```

With no selection, the audit covers every locally available component. `--since` uses the metadata's `added` date. `--base`, `--out`, and `--workers` select the server, evidence directory, and browser concurrency. The default server is `http://localhost:3100`; output goes to ignored `test-results/quality/`.

The audit saves per-component screenshots and JSON. Web previews run at 320, 390, 768, 1024, 1440, and 1920 pixels. Native previews run at 360, 390, and 430 pixels. Coarse-pointer previews run in both available themes at 390 and 320 pixels. The measured CSS viewport must equal the requested width, preventing a mobile browser's fallback viewport from silently invalidating the check.

Failures include browser exceptions, document overflow, duplicate IDs, axe WCAG A/AA violations, and CSS/Web Animations still running after reduced motion is requested. Accessibility scans cover desktop and each available touch theme. If a scan catches an entrance fade, the audit retains that first observation and scans again after settling. Review both observations when diagnosing a failure.

Screenshots still require human review for hierarchy, spacing, density, alignment, truncation, and meaningful states. Axe is an automated check, not a claim of complete WCAG conformance. The animation check does not prove that every canvas, timer, or React Native animation honors reduced motion. Native browser previews do not replace iOS and Android testing.

## Interaction regressions

```sh
npm run test:components
npm run test:component-data -- --since=2026-10-10
```

`PREVIEW_BASE` can point these commands at another running server. Fixtures bundle the real component through esbuild and exercise its named export without writing bundled Pro code into the public repository.

The targeted suite covers failed and stale composer submissions, clipboard failures, keyboard selection, IME composition, controlled follow state, table callbacks, chart recovery, and available Pro integrations such as webhook retries and hidden-panel focus. Pro cases are skipped when their private sources are absent.

The data sweep renders two instances of every selected web component, checks for duplicate IDs and exceptions, and passes empty arrays to documented array props individually and together. It records blank output and overflow for inspection. It fails on exceptions or duplicate IDs. Nested data schemas still need dedicated cases, such as empty cohorts or insufficient radar axes.

## Demo and release checks

```sh
node scripts/check-component.mjs <slug> --no-video --keep-going --base=http://localhost:3100
node scripts/record-demos.mjs <slug> --sheet=test-results/demo-sheets --base=http://localhost:3100 --isolated-source
```

Use `--isolated-source` for component recordings made against a development server. It bundles the checked-out default demo with production React and keeps the preview’s real CSS and same-origin fonts, so development hydration and hot reload do not contaminate motion capture. It does not write bundled Pro source into the public tree. The normal recording mode remains available for checking the actual preview page, and `--page-path` uses that mode for whole-page recordings. Source isolation does not replace a deployed preview smoke check. The fixture requires the requested preview and its loaded source before taking styles, so a missing preview or an HTTP200 streamed fallback cannot silently produce an unstyled audit.

Inspect the recording's contact sheet. For demos that expand beyond the initial card, pass `--frame-viewport` to keep the entire preview visible; this also refreshes its matching poster. Then commit the matching source and preview updates. Keep scratch recordings, JSON evidence, and browser captures in `test-results/`.

Stop the development server before `npm run build`, because development and production builds share `.next`. Start the production server and smoke-test the changed previews after a successful build.


## Optional WebKit verification

The Pro workflow and scroll batch also has a second-engine smoke test. Install the Playwright WebKit runtime once, then use the same stable preview server:

```sh
npx playwright-core install webkit
node tests/browser/pro-webkit-render-probe.mjs
SCROLL_BROWSER=webkit node tests/browser/pro-scroll-probe.mjs
```

The rendering probe exercises the 50 workflow components and six scroll components at desktop and phone widths, checking nonempty content, runtime errors and document overflow. The scroll probe checks native progress, reversal, motion-preference changes, long-content fallbacks and video playback handling. The regular `npm run test:components` command keeps Chromium as its default. Playwright WebKit coverage does not replace testing the Safari application or physical iOS devices.
