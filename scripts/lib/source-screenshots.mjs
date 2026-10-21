/**
 * Chrome's damage-driven screencast can omit a frame when a DOM tween writes
 * subpixel values or commits an already-presented Web Animation's final styles.
 * Capture the actual owned surface during those gaps. Never synthesize a frame,
 * omit source mutations, or change the recorder's source/moving-frame limits.
 */
export function startChangedSourceScreenshots({ page, cdp, getLatestFrameTime, onFrame, quality = 92 }) {
  let stopped = false;
  let pending;
  const captures = [];
  const errors = [];

  const sample = async () => {
    const previousFrameAt = getLatestFrameTime();
    // Leave room in the 100ms delivery budget for the 20ms polling phase,
    // renderer IPC and the real image request. A 60ms trigger can deliver an
    // otherwise healthy 25ms capture after the limit.
    const quietSeconds = 0.04;
    if (!Number.isFinite(previousFrameAt) || !previousFrameAt || Date.now() / 1000 - previousFrameAt < quietSeconds) return;
    const changedAt = await page.evaluate(() => window.__dfaCDPSourceEvidence?.sourceChanges.at(-1));
    // A normal frame may have arrived while the renderer answered the probe.
    if (
      stopped ||
      !Number.isFinite(changedAt) ||
      changedAt <= getLatestFrameTime() ||
      Date.now() / 1000 - getLatestFrameTime() < quietSeconds
    )
      return;

    const requestedAt = Date.now() / 1000;
    const screenshot = await cdp.send("Page.captureScreenshot", {
      format: "jpeg",
      quality,
      fromSurface: true,
      captureBeyondViewport: false,
      // Favor image delivery over compression work at the same JPEG quality.
      optimizeForSpeed: true,
    });
    const capturedAt = Date.now() / 1000;
    if (typeof screenshot?.data !== "string" || !screenshot.data.length)
      throw new Error("Owned source screenshot returned no image.");
    // The image was exposed between request and response. Only changes before
    // the request are known to be represented; delivery latency ends at response.
    onFrame({ data: screenshot.data, t: capturedAt, sourceAt: requestedAt, origin: "owned-screenshot" });
    captures.push({
      changedAt,
      previousFrameAt,
      requestedAt,
      capturedAt,
      durationMs: (capturedAt - requestedAt) * 1000,
    });
  };

  const timer = setInterval(() => {
    if (stopped || pending) return;
    pending = sample()
      .catch((error) => {
        errors.push(error instanceof Error ? error.message : String(error));
        stopped = true;
        clearInterval(timer);
      })
      .finally(() => {
        pending = undefined;
      });
  }, 20);

  return {
    async stop() {
      stopped = true;
      clearInterval(timer);
      // A requested real image belongs to the capture. Finish it before the
      // recorder stamps its end time or closes the owned browser context.
      await pending;
      return { captures, errors };
    },
  };
}
