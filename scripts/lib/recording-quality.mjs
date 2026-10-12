/** Timestamp quality belongs to the capture, not the nominal encoded fps. */
export function captureQuality(timestamps, windows = []) {
  const times = [...new Set(timestamps.filter(Number.isFinite))].sort((a, b) => a - b);
  const active = windows.length ? windows : [[times[0], times.at(-1)]];
  const gaps = [];
  for (let i = 1; i < times.length; i++) {
    if (active.some(([start, end]) => times[i - 1] >= start && times[i] <= end)) gaps.push((times[i] - times[i - 1]) * 1000);
  }
  const sorted = [...gaps].sort((a, b) => a - b);
  const percentile = (p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0;
  return {
    frames: times.length,
    durationMs: times.length > 1 ? (times.at(-1) - times[0]) * 1000 : 0,
    activeSamples: gaps.length,
    activeFps: gaps.length ? 1000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length) : 0,
    p50GapMs: percentile(.5), p95GapMs: percentile(.95), maxGapMs: sorted.at(-1) ?? 0,
    stallsOver100Ms: gaps.filter((gap) => gap > 100).length,
  };
}

/** A gallery loop starts on the interaction; an ambient-only script still runs. */
export function gallerySteps(steps) {
  const firstAction = steps.findIndex((step) => step.cmd !== "wait");
  if (firstAction < 0) return steps;
  const result = steps.slice(firstAction);
  let held = false;
  return result.map((step, index) => {
    if (step.cmd === "down") held = true;
    if (step.cmd === "up") held = false;
    // Keep waits that complete a hold or an async flow. Only trim the idle tail.
    return step.cmd === "wait" && index === result.length - 1 && !held ? { ...step, ms: Math.min(step.ms, 1300) } : step;
  });
}
