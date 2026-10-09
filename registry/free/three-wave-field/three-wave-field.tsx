"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform, type Variants } from "motion/react";
import * as THREE from "three";

export type ThreeWaveFieldProps = {
  /** The one colour in the field: the mound under the pointer and the ring a click drops. */
  accent?: string;
  /** Wave height multiplier. */
  amplitude?: number;
  /** Animation speed multiplier. */
  speed?: number;
  /** Lift the swell under the pointer and drop a ripple on click or tap. */
  interactive?: boolean;
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */

// Greys do the work; the accent only appears where the visitor touches the sea.
const COLOR = {
  base: "#c2c2c2",
  crest: "#ffffff",
  trough: "#333333",
  accent: "#ff7a45",
} as const;

type Bezier = readonly [number, number, number, number];
const EASE_OUT: Bezier = [0.22, 1, 0.36, 1];

const MOTION = {
  /** Seconds for the swell to roll in from the viewer to the horizon (wall clock). */
  reveal: 1.6,
  /** Seconds of simulated time before the first frame, so the sea starts mid-swell. */
  timeOffset: 3,
  /** Pointer mound follow rate per frame (60 fps basis) and strength ease. */
  follow: 0.08,
  strengthEase: 0.05,
  /** A dropped ring is forgotten after this many seconds. */
  rippleLife: 5,
} as const;

/** Field size in world units, and the grid that fills it. */
const FIELD = {
  halfWidth: 9,
  depth: 14,
  near: 4,
  /** Narrow hosts start the field further back so near rows don't spread apart. */
  nearCompact: 2.5,
  /** Dense along x, spaced along z: the field reads as contour lines of swell. */
  grid: { cols: 380, rows: 80 },
  gridCompact: { cols: 200, rows: 96 },
  pointSize: 15,
  pointSizeCompact: 13,
  fogNear: 5,
  fogFar: 16,
} as const;

const MAX_DPR = 2;
const COMPACT_BELOW = 640;

/* ------------------------------------------------------------------ */
/* Shaders                                                             */
/* ------------------------------------------------------------------ */

const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
float snoise(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy));
  vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
  vec4 x12=x0.xyxy+C.xxzz;
  x12.xy-=i1;
  i=mod289(i);
  vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
  m=m*m;m=m*m;
  vec3 x=2.0*fract(p*C.www)-1.0;
  vec3 h=abs(x)-0.5;
  vec3 ox=floor(x+0.5);
  vec3 a0=x-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g;
  g.x=a0.x*x0.x+h.x*x0.y;
  g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.0*dot(m,g);
}`;

const FIELD_VERT = /* glsl */ `
uniform float uTime;
uniform float uAmp;
uniform float uSize;
uniform float uPixelRatio;
uniform float uReveal;
uniform float uNearZ;
uniform vec2 uPointer;
uniform float uPointerStrength;
uniform float uRippleAge;
uniform vec2 uRippleAt;
varying float vHeight;
varying float vDepth;
varying float vEdge;
varying float vSpot;
varying float vTouch;
varying float vShown;
varying float vFront;
${NOISE_GLSL}
void main(){
  vec3 p = position;
  float t = uTime;
  // Two long swells and a fine chop, drifting toward the viewer.
  float h = sin(p.x * 0.55 + t * 0.6) * 0.18
          + sin(p.z * 0.8 - t * 0.9 + p.x * 0.2) * 0.14
          + snoise(vec2(p.x * 0.35, p.z * 0.35 - t * 0.25)) * 0.32
          + snoise(vec2(p.x * 1.1 + t * 0.2, p.z * 1.1)) * 0.06;

  // Reveal: a front rolls from the viewer to the horizon. Each row lifts from
  // flat and fades up as it passes, so the sea swells into place rather than
  // appearing all at once.
  float row = clamp((uNearZ - p.z) / ${FIELD.depth.toFixed(1)}, 0.0, 1.0);
  float local = clamp(uReveal * 1.6 - row * 0.6, 0.0, 1.0);
  h *= 1.0 - pow(1.0 - local, 3.0);
  vShown = smoothstep(0.0, 0.4, local);
  vFront = local * (1.0 - local) * 4.0 * step(uReveal, 0.999);

  // The pointer lifts a soft mound that follows it.
  float d = distance(p.xz, uPointer);
  float mound = exp(-d * d * 1.6) * uPointerStrength;
  h += mound * 0.38;
  // A click or tap sends a ring outward.
  float rd = distance(p.xz, uRippleAt);
  float ring = rd - uRippleAge * 3.2;
  float wave = exp(-ring * ring * 6.0) * exp(-uRippleAge * 1.1) * step(0.0, uRippleAge);
  h += wave * 0.32;
  vTouch = clamp(mound * 0.7 + wave * 2.2, 0.0, 1.0);

  p.y += h * uAmp;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vHeight = h;
  vDepth = -mv.z;
  // Fade the left/right edges so the field has no hard border.
  vEdge = 1.0 - smoothstep(0.62, 1.0, abs(position.x) / ${FIELD.halfWidth.toFixed(1)});
  // A soft spotlight down the middle gives the field a focal point.
  vSpot = 0.45 + 0.55 * exp(-position.x * position.x / 18.0);
  gl_PointSize = uSize * uPixelRatio / -mv.z;
}`;

const FIELD_FRAG = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uCrest;
uniform vec3 uTrough;
uniform vec3 uAccent;
uniform float uNear;
uniform float uFar;
varying float vHeight;
varying float vDepth;
varying float vEdge;
varying float vSpot;
varying float vTouch;
varying float vShown;
varying float vFront;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float soft = smoothstep(0.5, 0.0, d);
  float crest = smoothstep(0.04, 0.42, vHeight);
  float trough = smoothstep(0.05, -0.4, vHeight);
  vec3 col = mix(uBase, uCrest, crest);
  col = mix(col, uTrough, trough * 0.8);
  col = mix(col, uAccent, vTouch * 0.85);
  // The travelling reveal front carries a little extra light.
  col += uCrest * vFront * 0.35;
  float fog = 1.0 - smoothstep(uNear, uFar, vDepth);
  float near = smoothstep(0.4, 1.6, vDepth);
  float a = soft * fog * near * vEdge * vSpot * (0.75 + crest * 0.7 + vTouch * 0.5) * vShown;
  gl_FragColor = vec4(col, a);
}`;

/* ------------------------------------------------------------------ */
/* Renderer: sizing, the frame loop, visibility and disposal           */
/* ------------------------------------------------------------------ */

/** Called every frame. `sinceReveal` is wall-clock seconds since the host was first seen. */
type Tick = (dt: number, sinceReveal: number) => void;

type Stage = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  host: HTMLDivElement;
  dpr: number;
  compact: boolean;
  /** Reduced motion: no loop, one still frame per change. */
  still: boolean;
  setTick: (tick: Tick | null) => void;
  /** Draw one frame now unless the loop is about to anyway. */
  invalidate: () => void;
};

/** Fits the camera to the host's aspect. Module-level so the renderer is built once. */
function fitLens(camera: THREE.PerspectiveCamera, aspect: number) {
  const portrait = aspect < 1;
  camera.aspect = aspect;
  // Narrow boxes: widen the lens so the field still spans the frame, and tip it
  // down so the horizon sits in the upper third instead of mid-screen.
  camera.fov = portrait ? 58 : 42;
  camera.position.set(0, 1.45, 5.2);
  camera.lookAt(0, portrait ? -1.1 : -0.4, -3);
  camera.updateProjectionMatrix();
}

function useRenderer(hostRef: RefObject<HTMLDivElement | null>): Stage | null {
  const [stage, setStage] = useState<Stage | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      return; // No WebGL: the host stays empty and whatever sits behind it shows through.
    }
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);

    let tick: Tick | null = null;
    let raf = 0;
    let last = 0;
    let visible = false;
    let seenAt = -1;

    const draw = (dt: number) => {
      const since = still ? Number.POSITIVE_INFINITY : seenAt < 0 ? 0 : (performance.now() - seenAt) / 1000;
      tick?.(dt, since);
      renderer.render(scene, camera);
    };
    const loop = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      draw(Math.min((now - last) / 1000, 0.05));
      last = now;
      raf = requestAnimationFrame(loop);
    };
    const wake = () => {
      if (still || raf || !visible || document.hidden) return;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h, false);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      fitLens(camera, w / Math.max(1, h));
      if (!raf) draw(0);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        // The reveal clock starts the first time the field is actually seen.
        if (visible && seenAt < 0) seenAt = performance.now();
        wake();
      },
      { threshold: 0.15 },
    );
    io.observe(host);
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    document.addEventListener("visibilitychange", wake);
    resize();

    setStage({
      renderer,
      scene,
      camera,
      host,
      dpr,
      compact: host.clientWidth < COMPACT_BELOW,
      still,
      setTick: (next) => {
        tick = next;
      },
      invalidate: () => {
        if (!raf) draw(0);
      },
    });

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", wake);
      renderer.dispose();
      canvas.remove();
      setStage(null);
    };
  }, [hostRef]);

  return stage;
}

/* ------------------------------------------------------------------ */
/* Scene: the field of points                                          */
/* ------------------------------------------------------------------ */

function buildField(stage: Stage, amplitude: number, accent: string) {
  const { compact, dpr } = stage;
  const { cols, rows } = compact ? FIELD.gridCompact : FIELD.grid;
  const nearZ = compact ? FIELD.nearCompact : FIELD.near;
  const pos = new Float32Array(cols * rows * 3);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = (r * cols + c) * 3;
      pos[i] = (c / (cols - 1) - 0.5) * FIELD.halfWidth * 2;
      pos[i + 2] = nearZ - (r / (rows - 1)) * FIELD.depth;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));

  const uniforms = {
    uTime: { value: MOTION.timeOffset },
    uAmp: { value: amplitude },
    uSize: { value: compact ? FIELD.pointSizeCompact : FIELD.pointSize },
    uPixelRatio: { value: dpr },
    uReveal: { value: stage.still ? 1 : 0 },
    uNearZ: { value: nearZ },
    uPointer: { value: new THREE.Vector2(0, -50) },
    uPointerStrength: { value: 0 },
    uRippleAge: { value: -1 },
    uRippleAt: { value: new THREE.Vector2(0, -50) },
    uBase: { value: new THREE.Color(COLOR.base) },
    uCrest: { value: new THREE.Color(COLOR.crest) },
    uTrough: { value: new THREE.Color(COLOR.trough) },
    uAccent: { value: new THREE.Color(accent) },
    uNear: { value: FIELD.fogNear },
    uFar: { value: FIELD.fogFar },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: FIELD_VERT,
    fragmentShader: FIELD_FRAG,
    transparent: true,
    depthWrite: false,
    // Additive: dense crests bloom without a post-processing pass.
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  return {
    points,
    uniforms,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}

type FieldUniforms = ReturnType<typeof buildField>["uniforms"];

/** Ray-casts the pointer onto the y=0 plane: a mound follows it, a press drops a ring. */
function bindPointer(stage: Stage, uniforms: FieldUniforms) {
  const { host, camera } = stage;
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const ndc = new THREE.Vector2();
  const target = new THREE.Vector2(0, -50);
  let want = 0;

  const toField = (e: PointerEvent) => {
    const r = host.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(plane, hit);
  };
  const onMove = (e: PointerEvent) => {
    if (!toField(e)) return;
    target.set(hit.x, hit.z);
    want = 1;
  };
  const onLeave = () => {
    want = 0;
  };
  const onDown = (e: PointerEvent) => {
    if (!toField(e)) return;
    uniforms.uRippleAt.value.set(hit.x, hit.z);
    uniforms.uRippleAge.value = 0;
  };
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerleave", onLeave);
  host.addEventListener("pointerdown", onDown);

  return {
    /** Eases the mound toward the pointer; rates are per 60 fps frame, scaled by dt. */
    update(dt: number) {
      const f = dt * 60;
      uniforms.uPointer.value.lerp(target, 1 - Math.pow(1 - MOTION.follow, f));
      uniforms.uPointerStrength.value += (want - uniforms.uPointerStrength.value) * (1 - Math.pow(1 - MOTION.strengthEase, f));
      if (uniforms.uRippleAge.value >= 0) uniforms.uRippleAge.value += dt;
      if (uniforms.uRippleAge.value > MOTION.rippleLife) uniforms.uRippleAge.value = -1;
    },
    dispose() {
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("pointerdown", onDown);
    },
  };
}

function useWaveField(stage: Stage | null, { accent, amplitude, speed, interactive }: Required<Omit<ThreeWaveFieldProps, "className">>) {
  const uniformsRef = useRef<FieldUniforms | null>(null);
  // The loop reads these each frame, so changing them never rebuilds the field.
  const live = useRef({ accent, amplitude, speed });
  live.current = { accent, amplitude, speed };

  useEffect(() => {
    if (!stage) return;
    const field = buildField(stage, live.current.amplitude, live.current.accent);
    const { uniforms } = field;
    uniformsRef.current = uniforms;
    stage.scene.add(field.points);
    const pointer = interactive && !stage.still ? bindPointer(stage, uniforms) : null;

    stage.setTick((dt, sinceReveal) => {
      uniforms.uTime.value += dt * live.current.speed;
      uniforms.uAmp.value = live.current.amplitude;
      uniforms.uReveal.value = Math.min(1, sinceReveal / MOTION.reveal);
      pointer?.update(dt);
    });
    stage.invalidate();

    return () => {
      stage.setTick(null);
      pointer?.dispose();
      stage.scene.remove(field.points);
      field.dispose();
      uniformsRef.current = null;
    };
  }, [stage, interactive]);

  // Prop changes write uniforms; a still frame picks them up under reduced motion.
  useEffect(() => {
    uniformsRef.current?.uAccent.value.set(accent);
    stage?.invalidate();
  }, [stage, accent, amplitude]);
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function ThreeWaveField({ accent = COLOR.accent, amplitude = 1, speed = 1, interactive = true, className = "" }: ThreeWaveFieldProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stage = useRenderer(hostRef);
  useWaveField(stage, { accent, amplitude, speed, interactive });
  return <div ref={hostRef} className={`relative h-full w-full touch-pan-y ${className}`} />;
}

/* ------------------------------------------------------------------ */
/* Demo: the field on a black stage with a buoy readout                */
/* ------------------------------------------------------------------ */

/** `tight` units (°, %) sit against the number instead of after a space. */
type Reading = { label: string; value: number; decimals: number; unit: string; tight?: boolean };

const READINGS: Reading[] = [
  { label: "Swell", value: 2.4, decimals: 1, unit: "m" },
  { label: "Period", value: 11.2, decimals: 1, unit: "s" },
  { label: "Heading", value: 248, decimals: 0, unit: "°", tight: true },
];

// The caption follows the sea: eyebrow, then each reading, then the hint.
const CAPTION = { start: 0.35, step: 0.06, count: 0.9 } as const;

const rise: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(8px)" },
  show: (i: number) => ({ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: EASE_OUT, delay: CAPTION.start + i * CAPTION.step } }),
};
const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
};

/** Counts from zero to `value` once `run` turns true, clearing a light blur as it lands. */
function CountUp({ value, decimals, delay, run }: { value: number; decimals: number; delay: number; run: boolean }) {
  const reduce = useReducedMotion() ?? false;
  const n = useMotionValue(reduce ? value : 0);
  const settle = useMotionValue(reduce ? 1 : 0);
  const format = useMemo(() => new Intl.NumberFormat("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }), [decimals]);
  const text = useTransform(n, (v) => format.format(v));
  const filter = useTransform(settle, [0, 1], ["blur(4px)", "blur(0px)"]);

  useEffect(() => {
    if (reduce) {
      n.set(value);
      settle.set(1);
      return;
    }
    if (!run) return;
    const count = animate(n, value, { duration: CAPTION.count, delay, ease: EASE_OUT });
    const clear = animate(settle, 1, { duration: CAPTION.count * 0.8, delay, ease: EASE_OUT });
    return () => {
      count.stop();
      clear.stop();
    };
  }, [value, delay, run, reduce, n, settle]);

  return <motion.span style={{ filter }}>{text}</motion.span>;
}

function BuoyReadout() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const reduce = useReducedMotion() ?? false;
  const variants = reduce ? fade : rise;
  const state = inView ? "show" : "hidden";

  return (
    <div ref={ref} className="pointer-events-none flex flex-col gap-4 @2xl:flex-row @2xl:items-end @2xl:justify-between">
      <div>
        <motion.p custom={0} variants={variants} initial="hidden" animate={state} className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/45">
          Tidewater buoy 41 · Rockall Trough
        </motion.p>
        <dl className="mt-3 flex gap-7 @md:gap-10">
          {READINGS.map((r, i) => (
            <motion.div key={r.label} custom={i + 1} variants={variants} initial="hidden" animate={state}>
              <dt className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/40">{r.label}</dt>
              <dd className="mt-1.5 font-display text-[clamp(1.5rem,1.2rem+1.4cqi,2.25rem)] font-medium leading-none tracking-[-0.04em] text-white tabular-nums">
                <CountUp value={r.value} decimals={r.decimals} delay={CAPTION.start + (i + 1) * CAPTION.step + 0.1} run={inView} />
                <span className={r.tight ? "text-white/45" : "ml-1 text-[0.55em] tracking-[-0.01em] text-white/45"}>{r.unit}</span>
              </dd>
            </motion.div>
          ))}
        </dl>
      </div>
      <motion.p custom={READINGS.length + 1} variants={variants} initial="hidden" animate={state} className="text-balance font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/35">
        <span className="[@media(hover:none)]:hidden">Move to lift the swell · click to drop a stone</span>
        <span className="hidden [@media(hover:none)]:inline">Tap to drop a stone</span>
      </motion.p>
    </div>
  );
}

export default function ThreeWaveFieldDemo() {
  return (
    <section className="@container relative isolate h-[760px] w-full overflow-hidden bg-black text-white">
      <div className="absolute inset-0">
        <ThreeWaveField />
      </div>
      {/* Keeps the readout legible over the moving field. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black via-black/70 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 px-6 pb-7 @md:px-10 @md:pb-9">
        <BuoyReadout />
      </div>
    </section>
  );
}
