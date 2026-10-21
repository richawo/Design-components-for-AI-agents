import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startChangedSourceScreenshots } from "../scripts/lib/source-screenshots.mjs";

describe("owned source screenshot fallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-18T06:00:00Z"));
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });
  const setup = () => {
    const started = Date.now() / 1000;
    const frames: { t: number }[] = [{ t: started }];
    const page = { evaluate: vi.fn(async () => started + 0.001) };
    const cdp = { send: vi.fn(async () => ({ data: "actual-owned-surface" })) };
    const onFrame = vi.fn((frame: { t: number; data: string; sourceAt: number; origin: string }) => {
      frames.push({ t: frame.sourceAt });
    });
    return { started, frames, page, cdp, onFrame, getLatestFrameTime: () => frames.at(-1)?.t };
  };

  it("captures a real image for a source change omitted by a quiet screencast", async () => {
    const state = setup();
    const capture = startChangedSourceScreenshots(state);
    await vi.advanceTimersByTimeAsync(160);
    const evidence = await capture.stop();
    expect(state.cdp.send).toHaveBeenCalledOnce();
    expect(state.cdp.send).toHaveBeenCalledWith("Page.captureScreenshot", {
      format: "jpeg",
      quality: 92,
      fromSurface: true,
      captureBeyondViewport: false,
      optimizeForSpeed: true,
    });
    expect(state.onFrame).toHaveBeenCalledWith({
      data: "actual-owned-surface",
      origin: "owned-screenshot",
      sourceAt: evidence.captures[0].requestedAt,
      t: evidence.captures[0].capturedAt,
    });
    expect(evidence.captures).toHaveLength(1);
    expect(evidence.errors).toEqual([]);
    expect((evidence.captures[0].capturedAt - state.started) * 1000).toBeLessThan(100);
  });

  it("leaves opening-frame and unchanged-reading holds to the normal recorder", async () => {
    const state = setup();
    state.frames.length = 0;
    const capture = startChangedSourceScreenshots(state);
    await vi.advanceTimersByTimeAsync(200);
    expect(state.page.evaluate).not.toHaveBeenCalled();
    state.frames.push({ t: state.started });
    state.page.evaluate.mockResolvedValue(state.started);
    await vi.advanceTimersByTimeAsync(200);
    expect(state.cdp.send).not.toHaveBeenCalled();
    expect((await capture.stop()).captures).toEqual([]);
  });

  it("adds no screenshot work while normal frames keep arriving", async () => {
    const state = setup();
    const capture = startChangedSourceScreenshots({ ...state, getLatestFrameTime: () => Date.now() / 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(state.page.evaluate).not.toHaveBeenCalled();
    expect(state.cdp.send).not.toHaveBeenCalled();
    await capture.stop();
  });

  it("leaves time for image delivery after a polling interval and a 25ms capture", async () => {
    const state = setup();
    state.cdp.send.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
      return { data: "delivered-owned-surface" };
    });
    const capture = startChangedSourceScreenshots(state);
    await vi.advanceTimersByTimeAsync(160);
    const evidence = await capture.stop();
    expect(evidence.captures).toHaveLength(1);
    expect((evidence.captures[0].capturedAt - (state.started + 0.001)) * 1000).toBeLessThanOrEqual(100);
  });

  it("rechecks a normal frame received while the source probe was pending", async () => {
    const state = setup();
    let finish!: (value: number) => void;
    state.page.evaluate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const capture = startChangedSourceScreenshots(state);
    await vi.advanceTimersByTimeAsync(80);
    state.frames.push({ t: Date.now() / 1000 });
    finish(state.started + 0.001);
    await vi.advanceTimersByTimeAsync(0);
    expect(state.cdp.send).not.toHaveBeenCalled();
    await capture.stop();
  });

  it("starts no image request after stopping a pending source probe", async () => {
    const state = setup();
    let finish!: (value: number) => void;
    state.page.evaluate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const capture = startChangedSourceScreenshots(state);
    await vi.advanceTimersByTimeAsync(80);
    const stopping = capture.stop();
    finish(state.started + 0.001);
    expect((await stopping).captures).toEqual([]);
    expect(state.cdp.send).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("finishes an already requested image before stamping the capture's end", async () => {
    const state = setup();
    let finish!: (value: { data: string }) => void;
    state.cdp.send.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const capture = startChangedSourceScreenshots(state);
    await vi.advanceTimersByTimeAsync(80);
    const stopping = capture.stop();
    await vi.advanceTimersByTimeAsync(10);
    finish({ data: "completed-owned-image" });
    const evidence = await stopping;
    expect(evidence.captures).toHaveLength(1);
    expect(state.onFrame.mock.calls[0][0].data).toBe("completed-owned-image");
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["unavailable", "empty"])("reports %s capture failure instead of inventing a frame", async (kind) => {
    const state = setup();
    if (kind === "unavailable") state.cdp.send.mockRejectedValue(Error("Capture unavailable"));
    else state.cdp.send.mockResolvedValue({ data: "" });
    const capture = startChangedSourceScreenshots(state);
    await vi.advanceTimersByTimeAsync(200);
    const evidence = await capture.stop();
    expect(evidence.errors).toHaveLength(1);
    expect(evidence.captures).toEqual([]);
    expect(state.onFrame).not.toHaveBeenCalled();
    expect(state.cdp.send).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
