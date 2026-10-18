import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { captureQuality } from "../../scripts/lib/recording-quality.mjs";
import { sourceChangeQuality } from "../../scripts/lib/tab-recording.mjs";
import { startChangedSourceScreenshots } from "../../scripts/lib/source-screenshots.mjs";

const out = process.env.RECORDING_SOURCE_OUT ?? "test-results/recording-source";
fs.mkdirSync(out, { recursive: true });
const browser = await launchChromium({ args: [] });
try {
  for (const mode of ["quiet-before", "quiet-after", "blocked-ui", "blocked-capture"]) {
    const page = await browser.newPage({ viewport: { width: 720, height: 480 } });
    const cdp = await page.context().newCDPSession(page);
    const frames = [];
    let fallback;
    let pause;
    try {
      await page.setContent(`<!doctype html><html lang="en"><head><title>Owned capture regression</title></head>
        <body style="margin:0;background:#111;color:white;font:18px Arial"><main id="root" style="padding:40px">
        <h1>Owned capture fixture</h1><p id="state">Ready</p>
        <div style="width:300px;height:4px;background:#333"><div id="bar" style="width:83.3333%;height:4px;background:white"></div></div>
        </main></body></html>`);
      if (mode === "blocked-capture")
        await page.exposeFunction("__pauseOwnedCapture", () => {
          const start = Date.now() / 1000;
          pause = { start, end: start + 0.22 };
        });
      await page.evaluate(() => {
        const sourceFrames = [],
          sourceChanges = [];
        let raf;
        const sample = () => {
          sourceFrames.push(Date.now() / 1000);
          raf = requestAnimationFrame(sample);
        };
        raf = requestAnimationFrame(sample);
        const observer = new MutationObserver(() => sourceChanges.push(Date.now() / 1000));
        observer.observe(document.getElementById("root"), {
          subtree: true,
          attributes: true,
          childList: true,
          characterData: true,
        });
        window.__dfaCDPSourceEvidence = {
          sourceFrames,
          sourceChanges,
          stop() {
            cancelAnimationFrame(raf);
            observer.disconnect();
          },
        };
      });

      let opening;
      const opened = new Promise((resolve) => {
        opening = resolve;
      });
      cdp.on("Page.screencastFrame", (event) => {
        void cdp.send("Page.screencastFrameAck", { sessionId: event.sessionId }).catch(() => {});
        if (pause && Date.now() / 1000 < pause.end) return;
        frames.push({ t: event.metadata.timestamp, data: event.data, origin: "screencast" });
        opening();
      });
      await cdp.send("Page.startScreencast", {
        format: "jpeg",
        quality: 92,
        everyNthFrame: 1,
        maxWidth: 720,
        maxHeight: 480,
      });
      await Promise.race([
        opened,
        page.waitForTimeout(2000).then(() => {
          throw Error("No owned opening frame");
        }),
      ]);
      if (mode !== "quiet-before")
        fallback = startChangedSourceScreenshots({
          page,
          cdp: {
            async send(method, params) {
              if (pause && Date.now() / 1000 < pause.end)
                await new Promise((resolve) => setTimeout(resolve, (pause.end - Date.now() / 1000) * 1000));
              return cdp.send(method, params);
            },
          },
          getLatestFrameTime: () => frames.reduce((latest, frame) => Math.max(latest, frame.sourceAt ?? frame.t), 0),
          onFrame: (frame) => frames.push(frame),
        });

      await page.evaluate((mode) => {
        const state = document.getElementById("state"),
          bar = document.getElementById("bar");
        if (mode.startsWith("quiet")) {
          // Same rendered width after Blink's layout quantization. Attribute
          // writes continue, but no new picture is required by the screencast.
          for (let i = 1; i <= 12; i++)
            setTimeout(
              () => {
                bar.style.width = `${83.3333 + i * 0.000001}%`;
              },
              120 + i * 10,
            );
          setTimeout(() => {
            state.textContent = "Done";
          }, 650);
        } else if (mode === "blocked-ui") {
          setTimeout(() => {
            state.textContent = "Saving";
            const until = performance.now() + 220;
            while (performance.now() < until) {}
            state.textContent = "Done";
          }, 120);
        } else {
          setTimeout(() => {
            void window.__pauseOwnedCapture();
            state.textContent = "Saving";
          }, 120);
          for (let i = 1; i <= 6; i++)
            setTimeout(
              () => {
                bar.style.width = `${40 + i * 7}%`;
                state.textContent = `Moving ${i}`;
              },
              140 + i * 20,
            );
          setTimeout(() => {
            state.textContent = "Done";
          }, 650);
        }
      }, mode);
      await page.waitForTimeout(850);
      const screenshots = (await fallback?.stop()) ?? { captures: [], errors: [] };
      const source = await page.evaluate(() => {
        const evidence = window.__dfaCDPSourceEvidence;
        evidence.stop();
        return { sourceFrames: evidence.sourceFrames, sourceChanges: evidence.sourceChanges };
      });
      await cdp.send("Page.stopScreencast");
      const sourceQuality = captureQuality(source.sourceFrames);
      const changeQuality = sourceChangeQuality(
        frames.filter((frame) => frame.origin !== "owned-screenshot").map((frame) => frame.t),
        source.sourceChanges,
        screenshots.captures,
      );
      const report = {
        mode,
        sourceQuality,
        changeQuality,
        screenshots,
        pause,
        source,
        frames: frames.map(({ data, ...timing }) => timing),
      };
      fs.writeFileSync(`${out}/${mode}.json`, JSON.stringify(report, null, 2));
      for (const [index, frame] of frames
        .filter((frame, index) => index === 0 || index === frames.length - 1 || frame.origin === "owned-screenshot")
        .entries())
        fs.writeFileSync(`${out}/${mode}-${index + 1}.jpg`, Buffer.from(frame.data, "base64"));
      assert.deepEqual(screenshots.errors, []);
      if (mode === "quiet-before") {
        assert.equal(sourceQuality.stallsOver100Ms, 0);
        assert.ok(changeQuality.stallsOver100Ms > 0, "Baseline must reproduce the omitted quiet frames");
      } else if (mode === "quiet-after") {
        assert.equal(sourceQuality.stallsOver100Ms, 0);
        assert.equal(changeQuality.stallsOver100Ms, 0);
        assert.ok(screenshots.captures.length > 0, "A real owned image resolves the source gap");
      } else if (mode === "blocked-ui")
        assert.ok(sourceQuality.stallsOver100Ms > 0, "A blocked UI must still be rejected");
      else {
        assert.equal(sourceQuality.stallsOver100Ms, 0);
        assert.ok(
          changeQuality.stallsOver100Ms > 0,
          "Delayed delivery must still be rejected while the UI remains live",
        );
      }
      console.log(`PASS owned capture ${mode}`);
    } finally {
      await fallback?.stop();
      await page.close();
    }
  }
} finally {
  await browser.close();
}
