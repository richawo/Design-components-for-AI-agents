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


## Expanded review after enabling the paid MCP

The second pass implements the owner's request to improve the website wherever there is a high-confidence benefit. The paid MCP is connected and was used to retrieve the design principles, search authentication and segmented-control candidates, and inspect component briefs, props and source. This pass keeps the authentication model and visual identity, while substantially improving the interaction and presentation of sign-in.

### Component choices and implemented improvements

| Area | Evidence and decision | Implemented result |
|---|---|---|
| Email-code sign-in | The MCP's `auth-otp` and `auth-magic-link` briefs fit the site's real email-code flow. Password, passkey and SSO demos would need different backend capabilities. | A focused email step followed by a six-cell code step. One native input supports keyboard selection, paste and the one-time-code autocomplete hint. Completing six digits starts verification automatically. |
| Authentication recovery | Users need to distinguish an incorrect code from a connection failure, and successful verification must survive a subsequent account-load failure. | Wrong-code errors clear the code and return focus; connection errors retain it. A verified session can retry account loading without consuming the same code again. Email editing preserves the address. Resend reflects the backend's 30-second cooldown and the screen explains the 15-minute expiry. |
| Account presentation | The old form and equal-weight information cards obscured the primary action. | One primary sign-in card, quieter explanatory content and an existing-key disclosure. The destination email occupies its own readable line. Mobile inputs use 16px text. Account-load failures expose a retry instead of silently looking signed out. |
| Billing and gallery filters | Two bespoke segmented controls duplicated a pattern already available in the library. | Import the free `segmented-control` directly. Arrow keys, Home/End, radio semantics and moving selection now come from the library. Site-specific sizing preserves 44px targets and readable labels. |
| Text contrast | The tertiary text token was too dim for small metadata and helper text on the dark surfaces. | Raise the shared token from `#6a6a72` to `#8a8a94`. This improves navigation, labels and supporting text across page templates. |
| Preview toolbar | Compact width selectors and replay/open actions were difficult touch targets; radio choices lacked conventional arrow-key handling. | Larger targets, roving radio focus and arrow/Home/End selection. |
| Reduced motion | Some site Motion effects did not inherit a shared preference. | Wrap the site in `MotionConfig reducedMotion="user"`, and remove gallery blur/scale and price-suffix blur when reduced motion is requested. |
| Documentation | Installation commands required manual selection; mobile readers lost context when opening the docs menu or jumping between pages. | Copy buttons on fenced code blocks, 44px navigation links, current-page text in the phone menu, close-on-navigation with heading focus, and a mobile/tablet contents disclosure. The Markdown tree remains intact, including nested lists and quotations. |
| Search recovery | A long unbroken query could push the empty-state text outside a narrow layout. The clear button was nested in the search label. | Explicit input/label association, query wrapping, smaller phone padding and a larger reset target. |
| Missing pages | The original fallback offered little context or choice. | A branded 404 with a direct explanation and clear routes to the component library and documentation. |
| Tablet navigation | At 768px the full navigation squeezed the logo onto two lines. | Keep the compact menu below 1024px, align resize/focus handling with that breakpoint, and prevent the brand from shrinking or wrapping. |

The sign-in implementation is a site-specific adaptation of the retrieved design briefs. Proprietary Pro source was not copied into the public repository. Existing commerce endpoints, session handling, licence checks and billing actions remain the source of truth.

### Coverage and design judgment

The review covered the live homepage, library/gallery, representative component detail, pricing, account entry, installation and MCP documentation, blog index and article templates, site header/footer, and missing-page handling. Browser work was combined with source review of the shared components and their loading/error states.

The homepage's strong hierarchy, gallery/category structure, component preview/source distinction, and blog editorial layout were retained. Replacing them simply to use another component would not have established a better user outcome. The main opportunities were authentication, legibility, input ergonomics, navigation and recovery. This is a review of the website's page templates and key journeys, not a certification of every demonstration in the component catalogue or every translated article.

### Verification completed

- `npx tsc --noEmit`: passed.
- `npx next build`: passed, including TypeScript and generation of 616 pages. Rebuilt after the tablet navigation adjustment.
- Strict registry validation in dry-run mode for all 104 tracked local component slugs: passed. Unpublished draft directories were excluded because they contain incomplete metadata; the generated manifest and private checkout were preserved.
- Full Vitest suite: 524 passed, 2 existing failures. `tests/registry.test.ts` rejects an interface export in the pre-existing untracked `dropdown-menu-nested` draft. `tests/blog-seo.test.ts` finds a 185-character translated description against its 170-character limit in the local private content. Neither failure is introduced by these site changes.
- Added four account-client tests covering code normalization/paste replacement, preserved HTTP status, network failure and non-JSON error responses.
- Controlled local account fixture: invalid code, subsequent successful sign-in, changing the email, formatted whole-code paste, successful verification followed by account-load failure, and retry into the signed-in licence view.
- Documentation: the copied installation command was pasted into the browser address field and matched exactly; choosing another document closed the phone navigation and moved focus to its heading. Client-side navigation rendered new command-copy controls successfully.
- Pricing: keyboard Tab then Right selected Yearly and updated the price. The tablet menu opened and Escape returned focus to its trigger.
- Responsive checks across representative pages at 320, 390, 768, 1024, 1440 and 1920px. Phone sign-in, long-search wrapping/reset, tablet pricing/navigation, desktop docs and wide-screen blog were visually inspected. The full matrix was not repeated for every URL.
- Production account page was inspected after automatic deployment and displayed the new sign-in experience.

Native mobile email/SMS autofill and physical-device keyboards were not exercised. The appropriate autocomplete and input-mode attributes are present. No production test emails, purchases, Team invitations or billing changes were performed. Browser automation had unreliable viewport overrides during the first pass; final captures used a fresh Chrome window and its native responsive tools against the compiled production preview.

Local evidence is in `chit-chat/output/design-site-polish-20261011/`, including `account-code-phone-final.png`, `pricing-tablet-768-final.png`, `docs-desktop-1440-final.png`, test logs and production-build logs. These local captures and fixtures are intentionally uncommitted.

### Delivery

Changes were committed and pushed to `origin/main` in these reviewable slices:

- `0185ff0`: library controls, contrast, touch targets and reduced motion.
- `dc38d96`: MCP-informed email-code sign-in and recovery.
- `73a4f99`: documentation navigation/copying and search/404 recovery.
- `84e9d63`: readable phone email destinations and licence entry.
- `06fc14e`: tablet navigation and single-line brand.

Cloudflare Workers Builds deploys pushes to main. Local draft components, preview assets, the existing Pro manifest edits and the divergent private component checkout were preserved and excluded from these commits.
