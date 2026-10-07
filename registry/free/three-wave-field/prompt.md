Build a wave-field hero background in React + plain Three.js: a field of light points rolling toward the viewer in long swells. It should feel calm and expensive, respond to the pointer, and never compete with the copy above it.

**Geometry**
- One `THREE.Points` grid, 18 units wide and 14 deep.
- Make it dense along x and spaced along z (380×80 on desktop, 200×96 under 640px), so the field reads as contour lines of swell rather than noise.
- On small screens, start the field 1.5 units further from the camera so near rows don't spread apart.

**Camera**
- PerspectiveCamera fov 42 (58 on portrait boxes) at (0, 1.2, 5.2), looking at (0, 0.75, −3).
- The horizon lands just below the middle of the frame.
- DPR capped at 2; ResizeObserver on the host.

**Vertex shader**
- Height is two sine swells, plus a broad 2D simplex noise drifting toward the viewer, plus a fine chop, multiplied by `amplitude`.
- The pointer, ray-cast onto the y=0 plane, adds a Gaussian mound (0.38) that follows with a 0.08 lerp. Its strength eases in on move and out on leave.
- `pointerdown` drops a ring that travels outward at 3.2 units/s and decays over about 3s.
- Point size is about 15 × DPR ÷ depth.
- Pass height, depth, an edge fade on |x| and a centre spotlight (45%→100%) to the fragment shader.

**Fragment shader**
- Soft round points.
- Colour runs from warm white `#e9e4dc` to accent `#ff7a45` as height rises from 0.04 to 0.42, sinking toward `#5b1a2e` in the deepest troughs.
- Alpha combines fog (depth 5→16), a near-camera fade, the edge fade, the spotlight and a crest boost.
- Additive blending with depthWrite off, so dense crests bloom without post-processing.

**Entrance and buttons**
- First view: the canvas fades up over 900ms while the amplitude rises from flat to full over 1.6s (ease-out), so the sea swells into place.
- The white pill keeps its colour on hover and deepens its glow; both pills scale to 0.97 while pressed.

**Behaviour**
- Pause offscreen (IntersectionObserver) and in hidden tabs.
- Under `prefers-reduced-motion`, render one static frame with no pointer response.
- Dispose of the geometry, material and renderer on unmount.

**Demo hero**
- Black section, 760px minimum height, with the field absolutely filling it.
- A black-to-transparent gradient over the top half keeps the copy clean. A faint warm radial wash sits behind the horizon.
- Centred copy:
  - A mono eyebrow with an accent dot ("Tidewater · Ocean telemetry").
  - A Geist 600 headline (`clamp(2.75rem, 1.6rem + 4.6vw, 5.75rem)`, −0.055em, leading 0.98) with a white/45 second clause.
  - A 16–17px white/60 body.
  - A white pill button and a hairline ghost pill.
- A hint at the bottom in a black/60 pill, with different copy for touch devices.

**Props**
- `colors` [base, crest, trough], `amplitude`, `speed`, `interactive`, `className`.

**Avoid**
- Wireframe meshes.
- Bloom passes.
- Purple-blue gradients.
- Fast or choppy motion.
- OrbitControls.
- Body copy over the moving field without a gradient.
