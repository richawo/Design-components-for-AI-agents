# Catalogue polish follow-up, 12 October 2026

The catalogue contains 244 individual components: 100 Free and 144 Pro. Eight complete page blocks remain Pro, giving 252 entries overall. The owner clarified the target as 100 Free components. Thirty-two common patterns moved from Pro to Free; industry suites, the cart drawer, the live bento grid and all blocks remain Pro.

## Findings and repairs

| Area | Result |
| --- | --- |
| Underline tabs | Fractional geometry, scale correction, stable presses, measured panel height and inert exits. |
| Pagination | Stable five or seven slot windows, interpolated retained positions, caption fades and retained focus. |
| Tooltip groups | Cold arrivals contain only their own label; unfinished springs stop, stale triggers close and cancelled touch presses release. The default preview opens on interaction. |
| Shared navigation | Segmented and header hover surfaces use fractional coordinates and observe individual label geometry. |
| Announcement slides | Unique message IDs and immediate removal of exiting links from interaction and accessibility. |
| Terminal | Local Home/End, Page and arrow scrolling; auto-follow pauses when reading older output. |
| Rich text editor | Outline motion is scoped per instance and jumps under reduced motion. |
| 3D keycaps | Projected hit areas are clipped to the scene, preventing phone-width document overflow. |
| Live demos | Reorder drags land at a fixed destination; cancelled mousedown preserves combobox focus. |
| Authentication and subscription actions | Missing handlers cannot manufacture successful authentication, email delivery, purchase, restore or subscription states. Simulated handlers live explicitly in the default demos. |
| Billing, code application and retries | Confirmation, application and retry callbacks are required before reporting completion. |
| Invitations | Sending and withdrawal await acknowledgement; rejected requests retain drafts or pending invitations. |
| AI prompt input | An unwired submit cannot consume the draft; device dictation cannot insert a sample transcript, and empty transcripts preserve text. |
| Native empty data | Missing health data, onboarding steps, tracks, updates or checkout options produce clear unavailable states. Missing playback outputs disable routing while retaining the player. |

## Coverage

The sweep covers every catalogue entry at desktop and narrow widths, coarse pointer layouts, supported themes and reduced motion. All 252 entries have layout and accessibility results, with focused reruns for repaired issues and late startup fades. Every one of the 239 web entries passed repeated-instance and empty-collection checks. The combined final layout, accessibility and reduced-motion audit passes 252 of 252 entries. React Native components were additionally exercised through their actual code on the web; all 37 empty-collection and recovery cases across 13 native entries pass against a clean committed snapshot.

All 251 entries with demo metadata were replayed. The sweep found a reorder destination chase and a multi-select focus loss; the shared player repairs were verified with the affected demonstrations and native interaction assertions. The remaining entry has no scripted demo. Registry validation, type checking and all 913 unit tests pass. The isolated production build and Worker dry run pass, with a 56,443,564-byte Worker below the 64 MiB limit. All 51 functional browser suites pass in the complete final run. Targeted production checks pass for the repaired behaviour, and Cloudflare has successfully deployed the verified public and private revisions.

Visual review includes a desktop overview of all 252 entries, targeted full-size captures, light and dark phone layouts, motion frame sampling and refreshed tab, tooltip and pagination recordings. The tab walkthrough is 7.4 seconds. WebKit verifies the repaired controls and related navigation surfaces; production HTML also verifies catalogue counts, old install aliases and retained licence gates. Captures and logs stay in ignored test-results/polish-sweep-20261012.

## Free tier moves

These moves prioritize useful common building blocks, including inputs, account entry, calendars, developer utilities, charts and collaboration. They do not lower the release bar.

| Component | Pattern |
| --- | --- |
| Magnetic CTA | button-magnetic |
| One-time Code | auth-otp |
| Source File Dropzone | input-file-dropzone |
| Keyboard Shortcut Recorder | input-shortcut-recorder |
| Booking Slot Selector | date-booking-slots |
| Weekly Agenda | date-week-agenda |
| Workspace Setup Checklist | onboarding-setup-checklist |
| Communication Preferences | forms-preference-center |
| Editorial Release Notes | content-release-notes |
| Project File Explorer | data-file-explorer |
| Structured JSON Inspector | devtools-json-inspector |
| Status Page | devtools-status-page |
| Environment Variables | devtools-env-vars |
| Feature Flags | devtools-feature-flags |
| Signature Pad | editor-signature-pad |
| Workspace Shell | layout-workspace-shell |
| Before and After Comparator | media-before-after |
| Editorial Story Deck | media-story-deck |
| Text Decode | text-decode |
| ASCII Wordmark Footer | footer-ascii-wordmark |
| Product Stack Hero | hero-product-stack |
| Sticky Scroll Story | feature-sticky-scroll |
| Comparison Matrix | pricing-comparison-matrix |
| Bullet Target Comparison | chart-bullet-targets |
| Period Slope Comparison | chart-slope-comparison |
| Channel Breakdown | chart-channel-breakdown |
| Invite People | collab-invite-people |
| Share Access Panel | collab-share-access |
| Activity Feed | collab-activity-feed |
| Commit Card | agent-commit-card |
| Agent Tool Call | agent-tool-call |
| Reasoning Trace | ai-reasoning-trace |

Existing URLs are preserved. Old Pro registry URLs for these components resolve to the public install payload; remaining Pro downloads retain their licence gate. Block dependency imports and installer dependency locations follow the new tiers.

## Scope of the evidence

Automated accessibility checks and visual review are not a claim of full WCAG certification. Native checks use React Native Web previews and isolated fixtures, not physical iOS or Android devices or a screen reader. Host callbacks must still implement real service behaviour; the library now makes missing capability explicit instead of simulating fulfilment.

Unrelated local changes were preserved. Source changes were committed and pushed in coherent slices on the existing main branches. The production build uses an isolated copy of committed source so uncommitted local edits do not become publication inputs.
