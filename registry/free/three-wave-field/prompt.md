Build a wave field in React 19 + plain Three.js (no react-three-fiber) + Tailwind v4 + motion/react: a field of grey points rolling toward the viewer in long swells, like contour lines of the sea. It is one focused 3D object on true black, monochrome, with a single accent that only appears where the visitor touches the water.

**Geometry**
- One `THREE.Points` grid, 18 units wide and 14 deep.
- Dense along x and spaced along z (380×80 on desktop, 200×96 under 640px), so the field reads as contour lines of swell rather than noise.
- On narrow hosts, start the field 1.5 units further from the camera so near rows don't spread apart.

**Camera**
- PerspectiveCamera at (0, 1.45, 5.2). Landscape: fov 42, looking at (0, −0.4, −3). Portrait: fov 58, looking at (0, −1.1, −3). Either way the horizon lands in the upper third.
- DPR capped at 2; ResizeObserver on the host; the lens is refitted on every resize.

**Vertex shader**
- Height = two sine swells + a broad 2D simplex noise drifting toward the viewer + a fine chop, × `amplitude`.
- The pointer, ray-cast onto the y=0 plane, adds a Gaussian mound (0.38) that follows with a 0.08 lerp per 60 fps frame (scaled by dt). Its strength eases in on move, out on leave.
- `pointerdown` drops a ring that travels outward at 3.2 units/s and decays over about 3s.
- Point size ≈ 15 × DPR ÷ depth.
- Pass height, depth, an edge fade on |x|, a centre spotlight (45%→100%), a touch amount (mound × 0.7 + ring × 2.2) and the reveal values to the fragment shader.

**Colour (monochrome first)**
- Points run from grey `#c2c2c2` to white `#ffffff` as height rises from 0.04 to 0.42, sinking toward `#333333` in the deepest troughs.
- `accent` (default `#ff7a45`) is mixed in by the touch amount only: the mound under the pointer and the dropped ring. At rest the field has no hue at all.
- Alpha combines fog (depth 5→16), a near-camera fade, the edge fade, the spotlight and a crest boost. Additive blending with depthWrite off, so dense crests bloom without post-processing. No radial glow behind the field.

**First-view reveal (shader-driven)**
- A `uReveal` uniform goes 0→1 over 1.6s of wall-clock time from the moment the host is first seen (IntersectionObserver), so a slow first frame never stretches it.
- Per row: `local = clamp(uReveal·1.6 − row·0.6)`, where row is 0 nearest the viewer and 1 at the horizon. Height is multiplied by `1 − (1 − local)³` and alpha by `smoothstep(0, 0.4, local)`, so a front rolls from the viewer to the horizon and each row swells up from flat as it passes. The front carries a little extra white (`local·(1 − local)·4 × 0.35`).

**Code shape**
- Shader strings and token objects (`COLOR`, `MOTION`, `FIELD`) at the top.
- `useRenderer(hostRef)` owns the renderer, camera fit, ResizeObserver, IntersectionObserver, `visibilitychange` and a rAF loop that only runs while visible; it exposes `setTick` and `invalidate` and disposes everything on unmount.
- `useWaveField(stage, props)` builds the points (`buildField`) and pointer (`bindPointer`), registers the per-frame tick, and reads accent/amplitude/speed from a ref so prop changes never rebuild geometry.

**Demo stage**
- Black, 760px tall, `@container`; the field fills it. No headline, no buttons.
- A buoy readout bottom-left over a black-to-transparent gradient (224px): a mono eyebrow “Tidewater buoy 41 · Rockall Trough” (11px, 0.2em, white/45), then three readings — Swell 2.4 m, Period 11.2 s, Heading 248° — as mono 10.5px labels over Geist 500 figures (`clamp(1.5rem, 1.2rem + 1.4cqi, 2.25rem)`, −0.04em, tabular) with a white/45 unit. The hint (“Move to lift the swell · click to drop a stone”, or “Tap to drop a stone” on touch) sits bottom-right (stacked under 672px).
- Choreography: once the readout is 30% in view, the eyebrow, each reading and the hint rise 12px from an 8px blur over 600ms, starting at 350ms and 60ms apart; each figure counts up from zero over 900ms with a 4px blur clearing as it lands. Motion values drive the numbers; React never re-renders per frame.

**Behaviour**
- Pause offscreen and in hidden tabs.
- `prefers-reduced-motion`: one still frame (reveal complete), no pointer response; the caption fades in under 150ms and numbers are set instantly.
- Dispose of geometry, material and renderer on unmount. If WebGL can't start, the host stays empty.

**Avoid**
- Coloured points at rest, warm/cool tints or a glow blob behind the horizon.
- A hero headline or CTA buttons inside the component.
- Wireframe meshes, bloom passes, OrbitControls.
- Fast or choppy motion, or a CSS opacity fade standing in for the reveal.
