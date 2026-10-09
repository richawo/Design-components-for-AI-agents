/** Fields of white light, at these strengths, from brightest to faintest. */
const LIGHTS = [0.34, 0.2, 0.12];

/**
 * Generative cover art, seeded by the slug: soft pools of white light on
 * near-black, with one accent point where the light gathers. Monochrome by
 * design, so a wall of covers reads as one series. No image files.
 */
export function Cover({ seed }: { seed: string }) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = () => (h = (h * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const id = `cv${h.toString(36)}`;
  const pools = LIGHTS.map((o) => ({ cx: 18 + rand() * 64, cy: 18 + rand() * 64, r: 14 + rand() * 14, o }));
  const [focus] = pools;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
      <defs>
        <filter id={`${id}-b`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <pattern id={`${id}-d`} width="3" height="3" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="0.22" fill="#fff" fillOpacity="0.07" />
        </pattern>
        <radialGradient id={`${id}-v`} cx="50%" cy="50%" r="70%">
          <stop offset="55%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.85" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" className="fill-site-sunken" />
      <g filter={`url(#${id}-b)`}>
        {pools.map((p, i) => (
          <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill="#fff" opacity={p.o} />
        ))}
      </g>
      <rect width="100" height="100" fill={`url(#${id}-d)`} />
      <rect width="100" height="100" fill={`url(#${id}-v)`} />
      <circle cx={focus.cx} cy={focus.cy} r="5" fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="0.2" />
      <circle cx={focus.cx} cy={focus.cy} r="0.9" className="fill-site-accent" />
    </svg>
  );
}
