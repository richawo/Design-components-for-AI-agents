import { describe, expect, it } from "vitest";
import { captureQuality, gallerySteps, concatFrameList, framedCropFilter } from "../scripts/lib/recording-quality.mjs";
import { sourceChangeQuality } from "../scripts/lib/tab-recording.mjs";

describe("changed source presentation", () => {
  it("keeps the existing encoded-frame deadline", () => {
    expect(sourceChangeQuality([1,1.05,1.3],[1.01,1.1]).stallsOver100Ms).toBe(1);
  });
  it("counts real screenshot delivery after the source change", () => {
    const result=sourceChangeQuality([1,1.5],[1.01],[{requestedAt:1.06,capturedAt:1.08}]);
    expect(result.maxDelayMs).toBeCloseTo(70);expect(result.stallsOver100Ms).toBe(0);
  });
  it("cannot acknowledge a change made after an image was requested", () => {
    const result=sourceChangeQuality([1,1.5],[1.1],[{requestedAt:1.06,capturedAt:1.12}]);
    expect(result.maxDelayMs).toBeCloseTo(400);expect(result.stallsOver100Ms).toBe(1);
  });
  it("still rejects a delayed screenshot even when it was requested promptly", () => {
    const result=sourceChangeQuality([1,1.5],[1.01],[{requestedAt:1.02,capturedAt:1.25}]);
    expect(result.maxDelayMs).toBeCloseTo(240);expect(result.stallsOver100Ms).toBe(1);
  });
  it("uses an earlier normal delivery while a screenshot is in flight", () => {
    const result=sourceChangeQuality([1,1.04,1.5],[1.01],[{requestedAt:1.02,capturedAt:1.25}]);
    expect(result.maxDelayMs).toBeCloseTo(30);expect(result.stallsOver100Ms).toBe(0);
  });
  it("ignores invalid image timings and changes outside the recorded surface", () => {
    const result=sourceChangeQuality([1,1.5],[.5,1.1,2],[{requestedAt:1.2,capturedAt:1.1},{requestedAt:NaN,capturedAt:1.2}]);
    expect(result.changes).toBe(1);expect(result.maxDelayMs).toBeCloseTo(400);
    expect(sourceChangeQuality([], [1])).toEqual({changes:0,maxDelayMs:0,stallsOver100Ms:0});
  });
});

describe("recording frame quality", () => {
  it("measures captured cadence rather than the encoded frame-rate label", () => {
    const smooth = captureQuality(Array.from({ length: 61 }, (_, i) => i / 60));
    expect(smooth.activeFps).toBeCloseTo(60);
    expect(smooth.p95GapMs).toBeLessThan(17);
    // Negative control: a nominal 60fps encoder cannot repair a 6fps capture.
    const dropped = captureQuality(Array.from({ length: 7 }, (_, i) => i / 6));
    expect(dropped.activeFps).toBeCloseTo(6);
    expect(dropped.stallsOver100Ms).toBe(6);
  });
  it("excludes a deliberate reading pause from active-motion gaps", () => {
    const result = captureQuality([0, .02, .04, 2, 2.02, 2.04], [[0, .05], [2, 2.05]]);
    expect(result.maxGapMs).toBeCloseTo(20);
    expect(result.stallsOver100Ms).toBe(0);
  });
  it("drops the idle lead-in but preserves the integration authorization wait", () => {
    // The provider takes 1.4s, followed by a 320ms token step. A 1.3s cap
    // cuts the film off before the recorded Reconnected receipt can arrive.
    const steps = [{ cmd: "wait", ms: 700 }, { cmd: "click", target: "primary" }, { cmd: "wait", ms: 900 }, { cmd: "click", target: "authorize" }, { cmd: "wait", ms: 2600 }];
    expect(gallerySteps(steps)).toEqual([{ cmd: "click", target: "primary" }, { cmd: "wait", ms: 900 }, { cmd: "click", target: "authorize" }, { cmd: "wait", ms: 2600 }]);
    expect(steps[0].ms).toBe(700);
    expect(steps.at(-1)?.ms).toBe(2600);
  });
  it("preserves a held-button wait that completes the interaction", () => {
    expect(gallerySteps([{ cmd: "down" }, { cmd: "wait", ms: 3000 }])).toEqual([{ cmd: "down" }, { cmd: "wait", ms: 3000 }]);
  });
  it("keeps ambient demonstrations that contain only waits", () => {
    expect(gallerySteps([{ cmd: "wait", ms: 4000 }])).toEqual([{ cmd: "wait", ms: 4000 }]);
  });
});

describe("recording crop bounds", () => {
  it("avoids allocating invisible stage pixels for an in-bounds crop", () => {
    expect(framedCropFilter(1440, 900, { cw: 600, ch: 400, cx: 400, cy: 200, bg: "0x050505" })).toBe("crop=600:400:400:200");
  });
  it("adds the exact missing edges without shifting the source chroma grid", () => {
    expect(framedCropFilter(1440, 900, { cw: 1500, ch: 1000, cx: -31, cy: -21, bg: "0x050505" })).toBe("pad=1502:1002:32:22:color=0x050505,crop=1500:1000:1:1");
  });
});


describe("capture encoding timestamps", () => {
  it("preserves 10ms frame spacing and applies the precise time base to the tail", () => {
    const list = concatFrameList([{ file: "/a.jpg", t: 0 }, { file: "/b.jpg", t: .01 }, { file: "/c.jpg", t: .02 }], 0, .03);
    expect(list.match(/option framerate 1000/g)).toHaveLength(4);
    expect(list.match(/duration 0.010000/g)).toHaveLength(3);
    expect(list).toContain("file '/c.jpg'\noption framerate 1000\n");
  });
});
