# Design for AI website interaction audit

11 October 2026

The website already demonstrates the library effectively. Keep its visual identity, component previews, category sidebar, price structure, and account flow. Five improvements have clear supporting evidence and can be implemented within the current components.

| Improvement | Existing behavior | Required result |
|---|---|---|
| Reliable copy feedback | CopyButton reports success after the legacy copy command even when that command returns false. | Confirm success only after an actual copy. Keep retry and manual selection available after failure. Preserve focus and selection during fallback. |
| Keyboard source tabs | Code, Prompt, JSON and Install advertise a tablist, but lack roving focus and arrow/Home/End navigation. Their IDs are shared by every instance. | One Tab stop, conventional keyboard navigation, unique linked panel IDs, and an accessible panel. |
| Honest Pro source recovery | Network errors and server failures resolve to the same null result as missing entitlement. SourceTabs and ControlsPanel therefore show purchase prompts for transient failures. | Retain server authorization checks; distinguish access denial from a load failure; provide an explicit retry for the latter in both source and configured-prompt views. |
| Complete phone menu behavior | Opening locks the document's scroll. Escape, focus containment, desktop resize closure and unmount restoration are missing. | Support keyboard entry/exit and Escape, restore earlier scroll state, close on desktop resize, and keep background content outside the modal interaction. |
| A dependable Free browsing path | Browse free components opens an unfiltered gallery. A remembered Pro filter can persist across that entry. Reading sessionStorage also has no error guard. | An explicit tier URL takes precedence over remembered filters. Free entry links select Free, tier changes keep the URL accurate, and unavailable storage does not break browsing. |

The audit inspected the live homepage, gallery, component detail, pricing, documentation and account entry, alongside current site source. Findings about clipboard rejection and transient source failure are established by the source paths and will be verified with controlled failure tests. No production email, purchase or permission change is needed for these checks.

The relevant implementation files are `components/site/copy-button.tsx`, `source-tabs.tsx`, `controls-panel.tsx`, `site-header.tsx`, `component-browser.tsx`, `pricing-plans.tsx`, and `lib/pro-source-client.ts`. The library's own header, select, feedback and segmented-control patterns provide references; preserve the current site components where a small behavior fix is sufficient.

## Areas to keep

- **Homepage:** the code, prompt and JSON examples explain how the library is used. Additional visual effects do not improve this task.
- **Gallery:** category groups, sticky scrolling, saved state, empty-state reset, reduced-motion card behavior and category URLs already exist. Preserve the upstream sidebar improvements.
- **Previews and customization:** responsive preview sizes, Replay, shareable controls and configured-copy actions support real component evaluation. Keep the separation between previews and licensed source.
- **Pricing:** Free, Pro and Team with yearly/one-time choices already expose the relevant purchase options. Preserve real checkout routing and existing error feedback.
- **Account:** the email-code, resend, licence recovery and billing management flows are domain-specific. Cosmetic replacement with a password or fictional checkout demo would reduce their accuracy.
- **Docs and blog:** keep Markdown alternatives, the agent integration documentation and multilingual content. Generated caches must follow the current route and content sources.

## Verification

Check clipboard success and rejection, fallback cleanup, source-tab selection and focus, entitlement denial versus retryable failures, phone-menu focus and scroll restoration, explicit Free entry versus saved Pro state, and storage denial. Inspect rendered pages at desktop and phone widths, including long labels and reduced motion. Run strict registry validation, TypeScript and the complete test suite before each push.

This audit complements the Yaps product review in `chit-chat/docs/research/DESIGN_FOR_AI_YAPS_UI_REVIEW_2026-10-11.md`. The five product improvements there and the five site improvements here form the implementation scope. Conditional mobile and source-evidence experiments remain separate.
