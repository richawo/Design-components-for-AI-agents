"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export type ThreeWaveFieldProps = {
  /** Base dot colour, crest highlight, and the deepest trough. */
  colors?: [string, string, string];
  /** Wave height multiplier. */
  amplitude?: number;
  /** Animation speed multiplier. */
  speed?: number;
  /** Ripple from the pointer's position on the field. */
  interactive?: boolean;
  className?: string;
};

const NOISE = /* glsl */ `
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

const VERTEX = /* glsl */ `
uniform float uTime;
uniform float uAmp;
uniform float uSize;
uniform float uPixelRatio;
uniform vec2 uPointer;
uniform float uPointerStrength;
uniform float uRippleAge;
uniform vec2 uRippleAt;
varying float vHeight;
varying float vDepth;
varying float vEdge;
varying float vSpot;
${NOISE}
void main(){
  vec3 p = position;
  float t = uTime;
  // Two long swells and a fine chop, drifting toward the viewer.
  float h = sin(p.x * 0.55 + t * 0.6) * 0.18
          + sin(p.z * 0.8 - t * 0.9 + p.x * 0.2) * 0.14
          + snoise(vec2(p.x * 0.35, p.z * 0.35 - t * 0.25)) * 0.32
          + snoise(vec2(p.x * 1.1 + t * 0.2, p.z * 1.1)) * 0.06;
  // The pointer lifts a soft mound that follows it.
  float d = distance(p.xz, uPointer);
  h += exp(-d * d * 1.6) * 0.38 * uPointerStrength;
  // A click or tap sends a ring outward.
  float rd = distance(p.xz, uRippleAt);
  float ring = rd - uRippleAge * 3.2;
  h += exp(-ring * ring * 6.0) * 0.32 * exp(-uRippleAge * 1.1) * step(0.0, uRippleAge);
  p.y += h * uAmp;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  vHeight = h;
  vDepth = -mv.z;
  // Fade the left/right edges so the field has no hard border.
  vEdge = 1.0 - smoothstep(0.62, 1.0, abs(position.x) / FIELD_HALF_W);
  // A soft spotlight down the middle gives the field a focal point.
  vSpot = 0.45 + 0.55 * exp(-position.x * position.x / 18.0);
  gl_PointSize = uSize * uPixelRatio / -mv.z;
}`;

const FRAGMENT = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uCrest;
uniform vec3 uTrough;
uniform float uNear;
uniform float uFar;
varying float vHeight;
varying float vDepth;
varying float vEdge;
varying float vSpot;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float soft = smoothstep(0.5, 0.0, d);
  float crest = smoothstep(0.04, 0.42, vHeight);
  float trough = smoothstep(0.05, -0.4, vHeight);
  vec3 col = mix(uBase, uCrest, crest);
  col = mix(col, uTrough, trough * 0.8);
  float fog = 1.0 - smoothstep(uNear, uFar, vDepth);
  float near = smoothstep(0.4, 1.6, vDepth);
  float a = soft * fog * near * vEdge * vSpot * (0.75 + crest * 0.7);
  gl_FragColor = vec4(col, a);
}`;

const HALF_W = 9;
const DEPTH = 14;

export function ThreeWaveField({
  colors = ["#e9e4dc", "#ff7a45", "#5b1a2e"],
  amplitude = 1,
  speed = 1,
  interactive = true,
  className = "",
}: ThreeWaveFieldProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [cBase, cCrest, cTrough] = colors;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.display = "block";
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
    camera.position.set(0, 1.2, 5.2);
    camera.lookAt(0, 0.75, -3);

    const small = host.clientWidth < 640;
    // Dense along x, spaced along z: the field reads as contour lines of swell.
    const cols = small ? 200 : 380;
    const rows = small ? 96 : 80;
    const pos = new Float32Array(cols * rows * 3);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = (r * cols + c) * 3;
        pos[i] = (c / (cols - 1) - 0.5) * HALF_W * 2;
        pos[i + 1] = 0;
        pos[i + 2] = (small ? 2.5 : 4) - (r / (rows - 1)) * DEPTH;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));

    const uniforms = {
      uTime: { value: 0 },
      uAmp: { value: amplitude },
      uSize: { value: small ? 13 : 15 },
      uPixelRatio: { value: dpr },
      uPointer: { value: new THREE.Vector2(0, -50) },
      uPointerStrength: { value: 0 },
      uRippleAge: { value: -1 },
      uRippleAt: { value: new THREE.Vector2(0, -50) },
      uBase: { value: new THREE.Color(cBase) },
      uCrest: { value: new THREE.Color(cCrest) },
      uTrough: { value: new THREE.Color(cTrough) },
      uNear: { value: 5 },
      uFar: { value: 16 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX.replace("FIELD_HALF_W", HALF_W.toFixed(1)),
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.Points(geo, mat));

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = `${w}px`;
      renderer.domElement.style.height = `${h}px`;
      camera.aspect = w / Math.max(1, h);
      // Narrow boxes: widen the lens a little so the field still spans the frame.
      camera.fov = camera.aspect < 1 ? 58 : 42;
      camera.updateProjectionMatrix();
      if (reduce) renderer.render(scene, camera);
    };

    // Project the pointer onto the y=0 plane.
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    const target = new THREE.Vector2(0, -50);
    let wantStrength = 0;
    const toField = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.ray.intersectPlane(plane, hit) ? new THREE.Vector2(hit.x, hit.z) : null;
    };
    const onMove = (e: PointerEvent) => {
      const p = toField(e);
      if (!p) return;
      target.copy(p);
      wantStrength = 1;
    };
    const onLeave = () => (wantStrength = 0);
    const onDown = (e: PointerEvent) => {
      const p = toField(e);
      if (!p) return;
      uniforms.uRippleAt.value.copy(p);
      uniforms.uRippleAge.value = 0;
    };
    if (interactive && !reduce) {
      host.addEventListener("pointermove", onMove);
      host.addEventListener("pointerleave", onLeave);
      host.addEventListener("pointerdown", onDown);
    }

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0 });
    io.observe(host);

    const clock = new THREE.Clock();
    let raf = 0;
    let t = 3;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.05);
      if (!visible || document.hidden) return;
      t += dt * speed;
      uniforms.uTime.value = t;
      uniforms.uPointer.value.lerp(target, 0.08);
      uniforms.uPointerStrength.value += (wantStrength - uniforms.uPointerStrength.value) * 0.05;
      if (uniforms.uRippleAge.value >= 0) uniforms.uRippleAge.value += dt;
      if (uniforms.uRippleAge.value > 5) uniforms.uRippleAge.value = -1;
      renderer.render(scene, camera);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    if (reduce) renderer.render(scene, camera);
    else frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("pointerdown", onDown);
      geo.dispose();
      mat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [cBase, cCrest, cTrough, amplitude, speed, interactive]);

  return <div ref={hostRef} className={`relative h-full w-full ${className}`} />;
}

/** Demo: a product hero with the field rolling in under the copy. */
export default function ThreeWaveFieldDemo() {
  return (
    <section className="relative isolate flex min-h-[760px] w-full flex-col overflow-hidden bg-black text-white">
      <div className="absolute inset-0 -z-10">
        <ThreeWaveField />
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[38%] -z-20 h-[40%] bg-[radial-gradient(50%_50%_at_50%_50%,rgba(255,122,69,0.14),transparent_70%)]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[50%] bg-gradient-to-b from-black via-black/85 to-transparent" />
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center px-6 pt-24 text-center sm:pt-32">
        <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-white/50">
          <span className="size-1.5 rounded-full bg-[#ff7a45]" aria-hidden="true" />
          Tidewater · Ocean telemetry
        </p>
        <h1 className="mt-6 max-w-[15ch] text-balance font-display text-[clamp(2.75rem,1.6rem+4.6vw,5.75rem)] font-semibold leading-[0.98] tracking-[-0.055em]">
          Read the sea <span className="text-white/45">before it reaches the shore.</span>
        </h1>
        <p className="mt-6 max-w-[46ch] text-balance text-[16px] leading-relaxed text-white/60 sm:text-[17px]">
          2,400 buoys streaming swell height, period and direction every four seconds, with forecasts your harbour master will trust.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <a href="#start" className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-[14px] font-medium text-black transition-colors hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            Open the live map
          </a>
          <a href="#docs" className="inline-flex h-11 items-center justify-center rounded-full px-5 text-[14px] font-medium text-white/80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] transition-colors hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
            Read the API docs
          </a>
        </div>
      </div>
      <p className="pointer-events-none mx-auto mb-6 mt-auto rounded-full bg-black/60 px-3.5 py-1.5 text-center font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/40 backdrop-blur-sm">
        <span className="[@media(hover:none)]:hidden">Move to lift the swell · click to drop a stone</span>
        <span className="hidden [@media(hover:none)]:inline">Tap to drop a stone</span>
      </p>
    </section>
  );
}
