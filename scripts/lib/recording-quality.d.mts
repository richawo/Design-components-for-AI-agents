export function captureQuality(timestamps: number[], windows?: number[][]): { frames: number; durationMs: number; activeSamples: number; activeFps: number; p50GapMs: number; p95GapMs: number; maxGapMs: number; stallsOver100Ms: number };
export function gallerySteps<T extends { cmd: string; ms?: number }>(steps: T[]): T[];
