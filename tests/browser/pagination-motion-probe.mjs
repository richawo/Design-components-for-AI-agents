import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const browser = await launchChromium();
const p = await browser.newPage({ viewport: { width: 1000, height: 800 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const base = process.env.PREVIEW_BASE || "http://localhost:3100";
try {
  await p.goto(`${base}/preview/navigation-pagination-window`);
  await p.waitForTimeout(700);
  for (let i = 0; i < 3; i++) {
    await p.getByRole("button", { name: "Next page", exact: true }).click();
    await p.waitForTimeout(330);
  }
  await p.evaluate(() => {
    window.frames = [];
    window.collect = true;
    const sample = () => {
      const rail = document.querySelector("ol");
      const item = document.querySelector("[data-demo=page-4]");
      window.frames.push({
        height: rail.getBoundingClientRect().height,
        x: item?.getBoundingClientRect().x,
      });
      if (window.collect) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await p.getByRole("button", { name: "Next page", exact: true }).click();
  await p.waitForTimeout(400);
  const frames = await p.evaluate(() => {
    window.collect = false;
    return window.frames;
  });
  assert.ok(
    frames.every((f) => Math.abs(f.height - 44) < 0.1),
    "The page rail must keep its height",
  );
  const positions = frames.map((f) => f.x).filter((x) => x !== undefined);
  const distance = Math.abs(positions.at(-1) - positions[0]);
  assert.ok(distance > 10, "The retained page moved when the window shifted");
  assert.ok(
    positions.some(
      (x) =>
        Math.abs(x - positions[0]) > 1 && Math.abs(x - positions.at(-1)) > 1,
    ),
    "Retained pages must animate through intermediate positions",
  );
  assert.equal(
    await p
      .getByRole("button", { name: "Page 5", exact: true })
      .getAttribute("aria-current"),
    "page",
  );
  await p.getByRole("button", { name: "Page 6", exact: true }).focus();
  await p.keyboard.press("Enter");
  await p.waitForTimeout(330);
  assert.equal(
    await p.evaluate(() => document.activeElement.getAttribute("aria-label")),
    "Page 6",
  );
  for (const width of [320, 390, 768, 1440]) {
    await p.setViewportSize({ width, height: 800 });
    await p.waitForTimeout(350);
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "No overflow",
    );
    assert.equal(
      await p.locator("ol").evaluate((e) => e.getBoundingClientRect().height),
      44,
    );
    await p.getByRole("button", { name: "Page 24", exact: true }).click();
    await p.waitForTimeout(330);
    assert.ok(
      await p
        .getByRole("button", { name: "Next page", exact: true })
        .isDisabled(),
    );
    await p.getByRole("button", { name: "Page 1", exact: true }).click();
    await p.waitForTimeout(330);
    assert.ok(
      await p
        .getByRole("button", { name: "Previous page", exact: true })
        .isDisabled(),
    );
  }
  if (process.env.POLISH_OUT) {
    fs.writeFileSync(
      `${process.env.POLISH_OUT}/pagination-frames.json`,
      JSON.stringify(frames, null, 2),
    );
    await p.screenshot({
      path: `${process.env.POLISH_OUT}/pagination-dark.png`,
    });
  }
  await mountFixture(
    p,
    "navigation-pagination-window",
    "free",
    `function Fixture(){const [count,setCount]=useState(24);window.count=setCount;window.destinations=[];return <Subject.PaginationWindow page={4} pageCount={count} theme="light" onPageChange={n=>window.destinations.push(n)}/>;}createRoot(document.getElementById('root')).render(<Fixture/>);`,
  );
  await p.getByRole("button", { name: "Next page", exact: true }).click();
  await p.waitForTimeout(100);
  assert.deepEqual(await p.evaluate(() => window.destinations), [5]);
  assert.equal(
    await p
      .getByRole("button", { name: "Page 4", exact: true })
      .getAttribute("aria-current"),
    "page",
  );
  await p.getByRole("button", { name: "Page 4", exact: true }).focus();
  await p.evaluate(() => window.count(2));
  await p.waitForTimeout(330);
  assert.equal(
    await p.evaluate(() => document.activeElement.getAttribute("aria-label")),
    "Page 2",
    "Removed page focus follows the clamped selection",
  );
  await p.evaluate(() => window.count(0));
  await p.waitForTimeout(330);
  assert.equal(await p.getByRole("button", { name: /^Page \d/ }).count(), 0);
  assert.ok(
    await p
      .getByRole("button", { name: "Previous page", exact: true })
      .isDisabled(),
  );
  assert.ok(
    await p
      .getByRole("button", { name: "Next page", exact: true })
      .isDisabled(),
  );
  await p.emulateMedia({ reducedMotion: "reduce" });
  await mountFixture(
    p,
    "navigation-pagination-window",
    "free",
    `createRoot(document.getElementById('root')).render(<Subject.PaginationWindow defaultPage={4}/>);`,
  );
  await p.getByRole("button", { name: "Next page", exact: true }).click();
  await p.waitForTimeout(160);
  assert.equal(
    await p
      .getByRole("button", { name: "Page 5", exact: true })
      .getAttribute("aria-current"),
    "page",
  );
  assert.deepEqual(errors, []);
  console.log(
    "Pagination window interpolation, stable rail, responsive bounds, focus, controlled state, empty data and reduced motion pass.",
  );
} finally {
  await browser.close();
}
