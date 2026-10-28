# Component styles

The header selector and component toolbar share one selection. Original is the
default. A paid selection is remembered in this browser and follows navigation.
Original browsing does not request account state. Opening the style menu or restoring a paid selection checks Pro access. This keeps public cache hits from initializing the licensed server just to display the header.

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

Crayon includes light paper and dark charcoal palettes, with the same component
contracts and interactions. Scoped web material follows the host `.light` /
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
Dark media lives under `public/style-previews/crayon/dark/`; light URLs remain
stable. Neither theme bypasses Pro authorization.

Each paid option also needs its own private art direction, font assets and
component material, an immutable source pin, a build compiler and protected
preview/source/install handlers. Do not publish an active option before those
pieces work. See DEPLOY.md for the independent private source pin.

Crayon compiles the existing source without changing its imports, data contract,
callbacks or demo scripts. Web exports receive scoped material on their returned
roots, including SVG, custom roots and portals. React Native exports retain
native primitives and adapt neutral palettes and heading typography. Native
previews adapt the web rendering after authorization; they retain gestures and
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
