export function preserveRejectedCapture(options: {
  reportDir: string;
  slug: string;
  candidateFile: string;
  nativeFile?: string;
  frames: { file?: string; t: number; sourceAt?: number; origin?: string }[];
  startTime: number;
  endTime: number;
  problems: readonly string[];
  metrics: Record<string, unknown>;
}): string;
