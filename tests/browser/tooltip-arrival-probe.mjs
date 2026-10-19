import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const browser = await launchChromium();
const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const fixture = `
function Fixture(){
 const [visible,setVisible]=useState(true);const [label,setLabel]=useState('Long destination label');
 window.remove=()=>setVisible(false);window.rename=()=>setLabel('Renamed destination');window.events=[];
 return <Subject.TooltipGroup defaultActive="first" delay={160} onTimingEvent={e=>window.events.push(e)} style={{padding:80,background:'#111'}}>
   <Subject.Tooltip id="first" label="First tool"><button>First</button></Subject.Tooltip>
   {visible&&<Subject.Tooltip id="second" label={label}><button>Second</button></Subject.Tooltip>}
   <Subject.Tooltip id="third" label="Third tool"><button>Third</button></Subject.Tooltip>
 </Subject.TooltipGroup>
}createRoot(document.getElementById('root')).render(<Fixture/>);`;
async function coldHover(target, label) {
  await page.evaluate(() => {
    window.frames = [];
    window.collect = true;
    const read = () => {
      const tip = document.querySelector("[role=tooltip]");
      const described = document
        .querySelector("[aria-describedby]")
        ?.closest("[data-tg-trigger]")?.dataset.tgTrigger;
      let opacity = tip ? 1 : 0;
      for (let node = tip; node; node = node.parentElement) {
        opacity *= Number(getComputedStyle(node).opacity);
      }
      const visible = !!tip && getComputedStyle(tip).visibility === "visible" && opacity > 0.01;
      window.frames.push({
        active: described,
        visible,
        labels: tip ? [...tip.querySelectorAll(".absolute.inset-0")]
          .filter((e) => Number(getComputedStyle(e).opacity) > 0.01)
          .map((e) => e.textContent) : [],
      });
      if (window.collect) requestAnimationFrame(read);
    };
    requestAnimationFrame(read);
  });
  await page.getByRole("button", { name: target, exact: true }).hover();
  await page.waitForTimeout(400);
  const frames = await page.evaluate(() => {
    window.collect = false;
    return window.frames;
  });
  const active = target.toLowerCase();
  const arrival = frames.filter(
    (f) => f.active === active && f.visible && f.labels.length,
  );
  assert.ok(arrival.length > 3, "A real tooltip arrival was sampled");
  assert.ok(
    arrival.every((f) => f.labels.every((text) => text === label)),
    `Stale content flashed on ${target}: ${JSON.stringify(arrival)}`,
  );
  return frames;
}
try {
  await mountFixture(page, "tooltip-group", "free", fixture);
  await page.waitForTimeout(300);
  const pinned = await coldHover("Second", "Long destination label");
  await page.mouse.move(0, 0);
  await page.waitForTimeout(450);
  const third = await coldHover("Third", "Third tool");
  await page.mouse.move(0, 0);
  await page.waitForTimeout(450);
  await coldHover("First", "First tool");
  await page.getByRole("button", { name: "Second", exact: true }).hover();
  await page.waitForTimeout(350);
  assert.equal(
    (await page.evaluate(() => window.events)).findLast(
      (e) => e.type === "open",
    ).via,
    "skip",
  );
  await page.evaluate(() => window.rename());
  await page.waitForTimeout(250);
  assert.equal(
    await page.getByRole("tooltip").textContent(),
    "Renamed destination",
  );
  await page.evaluate(() => window.remove());
  await page.waitForTimeout(160);
  assert.equal(
    await page.getByRole("tooltip").count(),
    0,
    "Unmounting the active trigger closes its tooltip",
  );
  await page.mouse.move(0, 0);
  await page.waitForTimeout(450);
  await page.getByRole("button", { name: "Third", exact: true }).focus();
  await page.waitForTimeout(220);
  assert.equal(await page.getByRole("tooltip").textContent(), "Third tool");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(130);
  assert.equal(await page.getByRole("tooltip").count(), 0);
  if (process.env.POLISH_OUT) {
    fs.writeFileSync(
      `${process.env.POLISH_OUT}/tooltip-arrival-frames.json`,
      JSON.stringify({ pinned, third }, null, 2),
    );
    await page.screenshot({
      path: `${process.env.POLISH_OUT}/tooltip-closed.png`,
    });
  }
  await checkWarmDescriptions();
  assert.deepEqual(errors, []);
  console.log(
    "Tooltip pinned handoff, cold arrivals, warm neighbour glide, updated labels, unmount and focus/Escape pass.",
  );
} catch (error) {
  const folder = process.env.POLISH_OUT || "test-results/tooltip-arrival";
  fs.mkdirSync(folder, { recursive: true });
  const failure = `${folder}/failure-${Date.now()}`;
  const snapshot = await page.evaluate(() => ({
    frames: Array.isArray(window.frames) ? window.frames : [],
    events: Array.isArray(window.events) ? window.events : [],
    tooltips: [...document.querySelectorAll('[role="tooltip"]')].map(node => ({
      text: node.textContent,
      html: node.outerHTML,
      opacity: getComputedStyle(node).opacity,
      visibility: getComputedStyle(node).visibility,
    })),
  }));
  fs.writeFileSync(`${failure}.json`, JSON.stringify({
    message: error.message, actual: error.actual, expected: error.expected, snapshot, errors,
  }, null, 2));
  await page.screenshot({ path: `${failure}.png` });
  throw error;
} finally {
  await browser.close();
}

async function checkWarmDescriptions() {
  const session = await page.context().newCDPSession(page);
  for (const theme of ["dark", "light"]) {
    for (const reducedMotion of ["no-preference", "reduce"]) {
      await page.emulateMedia({ reducedMotion });
      await mountFixture(page, "tooltip-group", "free", `
        createRoot(document.getElementById('root')).render(
          <Subject.TooltipGroup theme="${theme}" delay={0} style={{padding:80,background:'${theme === "dark" ? "#111" : "#fff"}'}}>
            <Subject.Tooltip id="first" label="First tool"><button>First</button></Subject.Tooltip>
            <Subject.Tooltip id="second" label="Second tool"><button>Second</button></Subject.Tooltip>
          </Subject.TooltipGroup>);
      `);
      await page.keyboard.press("Tab");
      await page.waitForTimeout(300);
      await page.keyboard.press("Tab");
      await page.waitForFunction(() =>
        document.querySelector('[data-tg-trigger="second"] button').hasAttribute("aria-describedby"),
      );
      const accessibility = await session.send("Accessibility.getFullAXTree");
      const second = accessibility.nodes.find(node => node.role?.value === "button" && node.name?.value === "Second");
      assert.equal(second?.description?.value, "Second tool", "An outgoing label cannot describe the current trigger");
      const tipId = await page.getByRole("button", { name: "Second", exact: true }).getAttribute("aria-describedby");
      assert.equal(await page.locator(`[id=${JSON.stringify(tipId)}]`).count(), 1, "The tooltip ID remains unique");
      assert.equal(await page.getByRole("tooltip").count(), 1);
      console.log(`PASS warm tooltip description ${theme} ${reducedMotion}`);
    }
  }
}
