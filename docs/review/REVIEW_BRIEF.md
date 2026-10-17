# Review-and-rebuild brief: bring the later additions up to the library's bar

Design for AI (design.yaps.ai) is a premium, paid component library for AI coding agents. Repo: `/home/user/Design-components-for-AI-agents` (public, free components in `registry/free/`). Pro components are in `registry/pro/`, a nested private git repo. Read `AGENTS.md` and `docs/COMPONENT_SPEC.md` in full before touching anything; they are the contract. Also skim `docs/COMPONENT_QA.md`.

## Why you're here

About 290 components were added by another model over 10–14 October. The owner's verdict: "some were ok"; the rest are lacking against "the standard of the first 100 or so components". Your job is a solid review of the components assigned to you and to fix each up to that standard. Where the problems are structural, redesign it. Work like a demanding product designer and senior engineer at once.

## The standard: study these first (open their source and their `/preview/<slug>`)

Web: `registry/pro/dashboard-kpi-cards`, `registry/pro/chart-revenue-trend`, `registry/free/settings-panel`, `registry/free/auth-sign-in`, `registry/free/pricing-three-tier`, `registry/pro/header-morph-mega`, `registry/pro/chart-allocation`, `registry/pro/agent-approval-gate`, `registry/pro/devtools-api-playground`, `registry/pro/chart-treemap-drill`, `registry/pro/collab-comment-thread`.
Mobile: `registry/free/mobile-tab-bar`, `registry/pro/mobile-wallet-stack`, `registry/pro/mobile-checkout-sheet`, `registry/pro/mobile-now-playing`, `registry/pro/mobile-bottom-sheet`.

What they share: a point of view and a signature moment; the working content is the hero; generous type with a real scale; depth from hairlines, inset light and layered translucent surfaces; monochrome chrome with one accent; whole-frame choreography (blocks stagger from a blur, figures count up, charts and rings draw, progress fills after landing, every view/state animates); every state designed; copy that reads like a real product with specific, plausible content; code that reads like a senior engineer wrote it.

## What's wrong with the later additions (the lead's review; verify for each of yours)

1. **One template everywhere.** A mono eyebrow ("SUITE / TOOL NAME"), a title, a grey subtitle, then list-left / detail-right in flat outlined wells. Dozens of workflows look identical, with no idea of their own. Kill the template: compose each around what the user is actually doing and give it a signature interaction or visual (a ledger that balances as you match, a timeline you can scrub, a canvas you drag on, a document that marks itself up). The specimen leads; headers are compact tool chrome, not editorial headlines (see AGENTS.md "Visual direction").
2. **Tiny, dense, low-contrast type.** 10–12px body, grey on grey, cramped wells. Use the spec's scale: body 14–16px in tools (15–18 marketing), 12–13px mono metadata, real headings, AA contrast, generous spacing on a 4/8 rhythm.
3. **Flat.** Outlined boxes with no depth or light. Use layered surfaces, hairlines, inset highlights, soft deep shadows, glass only where content overlaps.
4. **Copy that talks about the demo.** "Supplied …", "Illustrative …", "Original generic illustration", "This preview …", "No records leave this preview", disclaimers rendered in the UI (≈780 occurrences library-wide). A component must read like a real product with real-feeling content. Remove all demo-meta and disclaimer copy from the rendered UI and from default props. Host-data notes belong in `prompt.md` / `guides.json`, not on screen.
5. **Under-choreographed.** Apply spec §2 "Polish the whole frame" and §3 to every view and state: staggered blur-in, count-ups (both directions), drawn charts, fills after landing, keyed crossfades between states, interruptible, reduced motion respected.
6. **Code.** Lines up to 4,000 characters, crammed JSX, monolith functions. Rewrite to the spec's "Write brilliant code": formatted (≤ 120-char lines), small named sub-components and hooks, tokens in one object, memoised motion values, effects that clean up, no dead code.
7. **Mobile.** Plain lists with no glass, gradients, springs or signature; 60–130 lines of crammed code. Hold them to the mobile bar (`MOBILE_BRIEF.md` and `MOBILE_BRIEF_2.md` in the scratchpad folder are the lead's earlier mobile briefs: read them; their RN-web gotchas are essential).

Some components are already close (the posters of several charts, the material/3D pieces, the scroll pieces): for those, do a precise polish pass rather than a rebuild. Decide per component and say why.

## Rules of the rebuild

- Keep the slug, tier, category and the job the component does. You may change layout, visual design, copy, interactions and the props API to reach the bar; keep the API sensible, typed and documented (`meta.props`), with realistic defaults. If you rename/remove props, update `meta.usage`, `controls`, `demo`, prompts and `content/components/guides.json` (the guide entry: `useWhen`, `avoidWhen`, `integration`, `related` with valid published slugs).
- Everything in `docs/COMPONENT_SPEC.md` applies: allowed imports only; one self-contained file; `data-demo` targets; default export takes `overrides` when there are controls; `demo` (3–8 s, shows the idea in one breath) and `controls` (props that visibly change it) valid; sliders/checkboxes/radios/switches/steppers come from the control kit (`docs/controls/`, embedded via `node scripts/sync-controls.mjs`); dark default with a `theme` prop where light is worth keeping; one `accent` prop; monochrome chrome.
- Industry components (commerce, fashion, finance, HR, legal, SaaS) are Pro and must feel like the best vertical SaaS (Linear, Ramp, Mercury, Shopify admin at its best, Rippling, Ironclad): purposeful density, precise figures, the actual work object front and centre.
- Real states: hover, focus-visible, press, selected, disabled, loading, empty, error, success, and rejected-callback recovery with drafts preserved (spec "Workflow polish checks").
- Responsive at 320/390/768/1024/1440/1920, zero overflow; container queries.

## Verify (each component)

Dev server: `http://localhost:3100` (shared; don't start or stop it; it may be slow). For each slug:

1. `node scripts/build-registry.mjs --only=<slug> --dry-run` and then `node scripts/build-registry.mjs` (shared, takes a lock; fine to run).
2. `npx tsc --noEmit 2>&1 | grep -v '^\.next/' | grep error` (ignore stale `.next/` type errors).
3. `npx vitest run tests/demo-contract.test.ts tests/component-guidance.test.ts tests/registry.test.ts` (note: on the baseline, guidance and four demo contracts already fail; fix any that are yours).
4. `node scripts/check-component.mjs <slug> --base=http://localhost:3100 --no-video --keep-going` while iterating (screenshots at 1440/768/390, control flips). Read every screenshot it writes in `test-results/check/<slug>/` and critique it.
5. Your own Playwright captures for states and mid-entrance frames (import from `/home/user/Design-components-for-AI-agents/node_modules/playwright-core/index.mjs`; `scripts/lib/browser.mjs` finds Chromium; `page.clock` doesn't drive Web Animations, so delete `Element.prototype.animate` with `page.addInitScript` for paused-clock frames). Check reduced motion and 320/390 widths.
6. When the component is final, refresh its poster: `node scripts/screenshot.mjs <slug> --base=http://localhost:3100` (writes `public/previews/<slug>.webp`) and look at it. **Don't record the video**: the machine is shared by many agents and the recorder rejects frame stalls under load; the lead re-records videos serially later. Make sure `meta.demo` plays correctly live (check it with your own Playwright run or `check-component --no-video`).

## Boundaries

Only touch your assigned slug folders, their `content/components/guides.json` entries, their `public/previews/<slug>.{webp,mp4}`, and the generated registry files that `build-registry` writes. Don't touch other components, site code, package.json or git (no commits; the lead reviews and commits each component). Don't start/stop servers. Scratch: `<scratch>/<your-agent-name>/` (never write scratch into the repo; `test-results/` is gitignored and fine).

## Report back (concise)

Per component: verdict (rebuild or polish, and why), the idea/signature now, what changed (composition, type, depth, copy, motion, states, code, API), compromises, and absolute paths to: the poster, a contact sheet of settled states, and a contact sheet of mid-entrance frames. List any API changes.
