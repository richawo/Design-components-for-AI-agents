# Component styles

The header selector and component toolbar share one selection. Original is the
default. The preview selection is remembered in this browser and follows navigation.
Catalogue and component URLs also follow the selected style and theme without
dropping search filters.
Recorded previews are public. Live Crayon material, source, prompts and installs
remain Pro-only, including when the original component is free.
Original browsing does not request account state. Opening the style menu or restoring Crayon checks Pro access. This keeps public cache hits from initializing the licensed server just to display the header.

The public menu contains a small illustrative sample, without serving licensed
component material. Catalogue cards use a matched recording and first-frame
poster for the selected style. Both Original and Crayon play their actual
component interactions. The existing viewport scheduler limits active decoders,
unloads offscreen clips and respects reduced motion and Save-Data. Cards load no
live component code or style source.

Capture supported style recordings with `scripts/record-demos.mjs --visual-style=crayon`
and an existing Pro key in `DESIGN_FOR_AI_LICENSE`. Set `--base=` to the intended
site or local test server. Recording also refreshes the matching first-frame
poster. Use `--ambient-ms=4000` for an ambient specimen without an input script,
or `--steps-file=path.json` with one named specimen and a reviewed JSON array of
demo steps. Neither option changes the shipped component metadata.
Reviewed gallery recipes in `scripts/recording-recipes.json` make the full Crayon
pass repeatable, including ambient components and demos without metadata scripts.
Explicit capture flags and `--steps-file` take precedence.
The key is scoped to that origin and is never stored in the output. Recordings
and posters are public pixels; CSS, source, briefs and installation remain
protected. Strict registry generation rejects missing styled recordings or
posters. Each URL includes its own content hash, so refreshing after a release
cannot reuse an older take. `scripts/screenshot.mjs --visual-style=crayon` remains
available for still-image reviews; refresh the recording afterwards before publishing.

Run `node scripts/build-conveyor-videos.mjs --visual-style=crayon` after recording
to prepare the homepage's smaller takes. Their fingerprints bind them to the
full-size recordings. The shared player uses the smaller decoder budget only
for an available matching derivative, and the homepage Pause control disables
playback in either style.

The current catalogue offers Original and Crayon. Register future options in
`lib/visual-styles.ts`, with a name, licence tier and short description. The
selector renders this collection rather than a fixed pair of controls. Remote
MCP schemas derive their style IDs from the same collection; update the packaged
stdio schema alongside it when adding an option.

Crayon shares Original's neutral light and dark colour family: near-white paper
and white surfaces in Light, with a true-black canvas and graphite surfaces in Dark.
Measured wax-pencil contours, card-corner hatching and handwritten type define
the style. Containers, buttons, selected controls and fields receive their own
drawn treatment. Headings write on without changing their text or line breaks,
then finish with a pencil underline. Focus and press draw a fresh trace. Existing
component animations keep their timing; reduced motion leaves the complete
drawing and text visible. Purposeful component accents,
imagery, contracts and interactions are preserved. Fixed receipt paper keeps its authored
ink and inverse-label colours, including contrasting drawn edges, in both themes.
Calculated accent labels retain their contrasting foreground. Fixed canvas artwork
keeps a local dark material for its overlays and controls inside either host theme.
Nested standalone roots inherit that painted context, with explicit theme overrides
preserved. Selected controls with a separate bright fill retain dark labels and pencil.
Scoped web material follows the host `.light` /
`.dark` class or `data-theme` attribute; `data-dfa-theme` on a component root
overrides that host. MCP `get_component` and `install_command`, source APIs and
the licensed registry accept `theme: "light" | "dark"` (a `theme` query string
for HTTP). Both palettes remain in the returned source. Native source keeps its
primitives and chooses its installation default with `DFA_CRAYON_THEME`. Existing
native theme props keep separate light and dark palettes and remain reactive.
Source metadata, controls and explicit theme values in usage examples describe
the selected installation.
Preview URLs accept the same theme query. Record the dark catalogue with
`scripts/record-demos.mjs --visual-style=crayon --theme=dark`, and its smaller
homepage takes with `scripts/build-conveyor-videos.mjs --visual-style=crayon --theme=dark`.
The current material uses `public/style-previews/crayon/v4/light/` and
`public/style-previews/crayon/v4/dark/`. The public style pin's `previewVersion`
selects a complete matching movie, poster and compact-media set. Earlier sets
remain available to open sessions during the release. Source and live material
retain Pro authorization in both themes.

Each paid option also needs its own private art direction, font assets and
component material, an immutable source pin, a build compiler and protected
preview/source/install handlers. Do not publish an active option before those
pieces work. See DEPLOY.md for the independent private source pin.

Crayon compiles the existing source without changing its imports, data contract,
callbacks or demo scripts. Web exports receive scoped material on their returned
roots, including SVG, custom roots and portals. React Native exports retain
native primitives, compose their original layout and press callbacks, and draw
real `react-native-svg` contours over those same gesture owners. Native headings
settle into full ink. Native previews adapt the web rendering after authorization;
they retain gestures and
leave actual imagery and coloured data alone. Native heading fallbacks are
Chalkboard SE on iOS and casual on Android. Hosts can load Caveat as DFA Crayon
when they want the same custom font on every platform.

The base component keeps its existing licence. All styled source, prompts and
install files require Pro, even for a free base component. The browser selection
is a preference, never authorization. Every material request rechecks the
existing commerce entitlement. Responses are private and no-store. Generated
packs store source-bound edits, retain a hash of the original code, and restore only the requested variant. They stay server-only, compressed and lazy; public registry files and client
bundles contain neither the licensed material nor styled component source.

Verify guest discovery, paid selection across navigation, deep links, source and
prompt switching, a working web form, native interactions, narrow preview widths
and standalone downloads. Run the style build, access, source-pin and MCP tests,
the full suite, strict registry generation and the prepared Worker size guards.
Review a native and web screenshot for colour and text contrast. Keep the
existing component navigation and bounded preview recovery checks intact.
