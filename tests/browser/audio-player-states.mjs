import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";

const browser = await launchChromium({ args: ["--mute-audio"] });
const errors = [],
  results = [];
const out = process.env.POLISH_OUT;
try {
  const page = await browser.newPage({
    viewport: { width: 1000, height: 900 },
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/broken-audio.wav", (route) =>
    route.fulfill({ status: 404, body: "missing" }),
  );
  await page.route("**/broken-artwork.png", (route) =>
    route.fulfill({ status: 404, body: "missing" }),
  );
  await mountFixture(
    page,
    "media-audio-transport",
    "pro",
    `
   const first=Subject.createAudioPreview(),second=Subject.createAudioPreview(2);
   window.firstTrack={id:'one',title:'Paper Lanterns',artist:'Mara Vale',album:'Night windows',src:first,duration:12};
   window.secondTrack={id:'two',title:'A slower hour',artist:'Theo Arlen',src:second,duration:12};
   window.playbackEvents=[];window.nextCalls=0;
   function Fixture(){const [state,setState]=useState({track:window.firstTrack,theme:'dark',variant:'studio'});window.configure=patch=>setState(s=>({...s,...patch}));return <Subject.AudioPlayer {...state} defaultMuted onPlaybackChange={value=>window.playbackEvents.push(value)} onNext={()=>{window.nextCalls++;setState(s=>({...s,track:window.secondTrack}));}}/>;}
   createRoot(document.getElementById('root')).render(<Fixture/>);
 `,
  );
  const media = () => page.locator("audio");
  await page
    .getByRole("button", { name: "Play Paper Lanterns", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelector("audio").currentTime > 0.2,
  );
  results.push("actual audio advances after play");
  await page
    .getByRole("combobox", { name: "Playback speed", exact: true })
    .selectOption("1.5");
  assert.equal(await media().evaluate((a) => a.playbackRate), 1.5);
  await page
    .getByRole("button", { name: "Pause Paper Lanterns", exact: true })
    .click();
  const pausedTime = await media().evaluate((a) => a.currentTime);
  await page.waitForTimeout(150);
  assert.equal(await media().evaluate((a) => a.currentTime), pausedTime);
  await page.evaluate(() => window.configure({ track: window.secondTrack }));
  await page.waitForTimeout(150);
  assert.equal(await media().evaluate((a) => a.paused), true);
  assert.equal(await media().evaluate((a) => a.playbackRate), 1.5);
  results.push(
    "paused source changes preserve pause and actual playback speed",
  );
  await page
    .getByRole("slider", { name: "Playback position", exact: true })
    .press("ArrowRight");
  const next = await media().evaluate((a) => a.currentTime);
  await page
    .getByRole("slider", { name: "Playback position", exact: true })
    .press("ArrowLeft");
  assert.ok((await media().evaluate((a) => a.currentTime)) < next);
  results.push("keyboard seeking moves immediately in both directions");
  await page
    .getByRole("button", { name: "Restore audio volume", exact: true })
    .click();
  assert.ok((await media().evaluate((a) => a.volume)) > 0.5);
  await page.getByRole("button", { name: "Mute audio", exact: true }).click();
  assert.equal(await media().evaluate((a) => a.muted), true);
  results.push("mute and restore control real volume");
  await page.evaluate(() =>
    window.configure({
      track: { ...window.secondTrack, src: "/broken-audio.wav" },
    }),
  );
  await page.getByRole("alert").waitFor();
  assert.equal(await media().evaluate((a) => a.paused), true);
  assert.equal(await page.evaluate(() => window.playbackEvents.at(-1)), false);
  results.push("failed media reports failure and clears host playing state");
  await page.evaluate(() =>
    window.configure({
      track: { ...window.firstTrack, artwork: "/broken-artwork.png" },
    }),
  );
  await page.waitForTimeout(250);
  assert.equal(await page.locator("img").count(), 0);
  assert.ok((await page.locator("svg circle").count()) > 0);
  assert.equal(await page.getByRole("alert").count(), 0);
  results.push(
    "source recovery clears errors and broken artwork uses the original cover fallback",
  );
  await page
    .getByRole("button", { name: "Play Paper Lanterns", exact: true })
    .click();
  await page
    .getByRole("slider", { name: "Playback position", exact: true })
    .press("End");
  await page.waitForFunction(() => window.nextCalls === 1);
  assert.ok((await media().getAttribute("src")) !== null);
  results.push("natural ending advances a configured queue once");
  await page.evaluate(() => window.configure({ track: undefined }));
  await page.waitForTimeout(100);
  assert.equal(
    await page
      .getByRole("button", { name: "Play audio", exact: true })
      .isEnabled(),
    false,
  );
  results.push("no-source state offers an honest disabled play control");
  for (const width of [320, 390, 768, 1440])
    for (const theme of ["light", "dark"])
      for (const variant of ["studio", "compact"]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(
          ({ theme, variant }) =>
            window.configure({ track: window.firstTrack, theme, variant }),
          { theme, variant },
        );
        await page.waitForTimeout(100);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `${width}, ${theme}, ${variant}`,
        );
      }
  results.push("both layouts and themes fit all four viewport sizes");
  assert.deepEqual(errors, []);
  if (out) {
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(
      `${out}/audio-player-states.json`,
      JSON.stringify({ results, errors }, null, 2),
    );
    await page.screenshot({ path: `${out}/audio-player.png` });
  }
  console.log(`${results.length} audio behavior and layout checks pass.`);
} finally {
  await browser.close();
}
