# Component styles

The header selector and component toolbar share one selection. Original is the
default. A paid selection is remembered in this browser and follows navigation.
The public menu contains a small illustrative sample, without serving licensed
component material. Catalogue recordings retain Original for comparison.

The current catalogue offers Original and Crayon. Register future options in
`lib/visual-styles.ts`, with a name, licence tier and short description. The
selector renders this collection rather than a fixed pair of controls. Remote
MCP schemas derive their style IDs from the same collection; update the packaged
stdio schema alongside it when adding an option.

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
