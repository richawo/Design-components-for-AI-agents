export type SourceScreenshot = {
  changedAt: number;
  previousFrameAt: number;
  requestedAt: number;
  capturedAt: number;
  durationMs: number;
};
export type SourceScreenshotFrame = { data: string; t: number; sourceAt: number; origin: "owned-screenshot" };
export type SourceScreenshotEvidence = { captures: SourceScreenshot[]; errors: string[] };
export function startChangedSourceScreenshots(options: {
  page: { evaluate(callback: () => number | undefined): Promise<number | undefined> };
  cdp: { send(method: "Page.captureScreenshot", options: {
    format: "jpeg"; quality: number; fromSurface: true; captureBeyondViewport: false;
  }): Promise<{ data: string }> };
  getLatestFrameTime(): number | undefined;
  onFrame(frame: SourceScreenshotFrame): void;
  quality?: number;
}): { stop(): Promise<SourceScreenshotEvidence> };
