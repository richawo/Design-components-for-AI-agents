/** Generative cover art: soft light fields seeded by the slug, on a fine grid. No image files. */
export function Cover({ seed }: { seed: string }) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = () => (h = (h * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const palette = ["#ff7a45", "#ff4d6d", "#ffb38a", "#ffe7d1", "#8a5cff"];
  const id = `cv${(h >>> 0).toString(36)}`;
  const blobs = Array.from({ length: 4 }, (_, i) => ({
    cx: 15 + rand() * 70,
    cy: 15 + rand() * 70,
    r: 22 + rand() * 26,
    c: palette[i === 3 ? (rand() > 0.7 ? 4 : 3) : Math.floor(rand() * 3)],
    o: 0.45 + rand() * 0.4,
  }));
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
      <defs>
        <filter id={`${id}-b`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <pattern id={`${id}-g`} width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M6 0H0V6" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.15" />
        </pattern>
        <radialGradient id={`${id}-v`} cx="50%" cy="50%" r="70%">
          <stop offset="60%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.8" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill="#050505" />
      <g filter={`url(#${id}-b)`}>
        {blobs.map((b, i) => (
          <circle key={i} cx={b.cx} cy={b.cy} r={b.r / 2} fill={b.c} opacity={b.o} />
        ))}
      </g>
      <rect width="100" height="100" fill={`url(#${id}-g)`} />
      <rect width="100" height="100" fill={`url(#${id}-v)`} />
      <circle cx={blobs[0].cx} cy={blobs[0].cy} r="0.9" fill="#fff" opacity="0.9" />
      <circle cx={blobs[0].cx} cy={blobs[0].cy} r="3.2" fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="0.2" />
    </svg>
  );
}
