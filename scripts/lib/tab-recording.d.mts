import type { Page } from "playwright";

export type TabRecordingStart = { settings: MediaTrackSettings; startTime: number; mimeType: string };
export function startTabRecording(page: Page, options: { title: string; width: number; height: number }): Promise<TabRecordingStart>;
export function stopTabRecording(page: Page, directory: string, start: TabRecordingStart): Promise<{
  file: string;
  extension: "mp4" | "webm";
  frames: { t: number }[];
  evidence: {
    settings: MediaTrackSettings;
    startTime: number;
    timings: { timestamp: number; time: number; width: number; height: number }[];
    sourceFrames: number[];
    sourceChanges: number[];
    longTasks: { start: number; duration: number }[];
  };
}>;
export function sourceChangeQuality(timestamps: readonly number[], changes: readonly number[], screenshots?: readonly {
  requestedAt: number; capturedAt: number;
}[]): { changes: number; maxDelayMs: number; stallsOver100Ms: number };
