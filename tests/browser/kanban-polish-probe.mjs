import assert from "node:assert/strict";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const browser = await launchChromium();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const mount = (code) => mountFixture(page, "data-kanban-compact", "pro", code);
try {
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.CompactKanban/>);`,
  );
  await page.locator("#root").evaluate((el) => {
    el.style.maxWidth = "1200px";
  });
  const move = page.getByRole("combobox", {
    name: "Move Tighten the type scale",
    exact: true,
  });
  await move.click();
  await page.getByRole("option", { name: "In progress", exact: true }).click();
  await page.waitForTimeout(200);
  assert.equal(
    await page
      .getByRole("region", { name: "In progress", exact: true })
      .getByText("Tighten the type scale", { exact: true })
      .count(),
    1,
  );
  assert.equal(
    await move.evaluate((el) => el === document.activeElement),
    true,
  );
  await move.press("ArrowDown");
  await move.press("Home");
  await move.press("Enter");
  assert.equal(
    await page
      .getByRole("region", { name: "Ready", exact: true })
      .getByText("Tighten the type scale", { exact: true })
      .count(),
    1,
  );
  await move.click();
  await move.press("End");
  await move.press("Escape");
  assert.match(await move.innerText(), /Ready/);
  await move.click();
  await move.press("i");
  await move.press("Enter");
  assert.match(await move.innerText(), /In progress/);
  await move.click();
  await page.getByRole("heading", { name: "Interface sprint" }).click();
  assert.equal(await move.getAttribute("aria-expanded"), "false");
  const handle = page.getByRole("button", {
    name: "Move Tighten the type scale with keyboard or pointer",
  });
  await handle.focus();
  await handle.press("Space");
  await handle.press("ArrowRight");
  await handle.press("Enter");
  assert.equal(
    await page
      .getByRole("region", { name: "Done", exact: true })
      .getByText("Tighten the type scale", { exact: true })
      .count(),
    1,
  );
  await handle.press("Space");
  await handle.press("ArrowLeft");
  await handle.press("Escape");
  assert.equal(
    await page
      .getByRole("region", { name: "Done", exact: true })
      .getByText("Tighten the type scale", { exact: true })
      .count(),
    1,
  );
  const rect = await handle.boundingBox(),
    target = await page
      .getByRole("region", { name: "Ready", exact: true })
      .boundingBox();
  await page.mouse.move(rect.x + 22, rect.y + 22);
  await page.mouse.down();
  await page.mouse.move(target.x + 40, target.y + target.height - 30, {
    steps: 12,
  });
  await page.mouse.up();
  await page.waitForTimeout(100);
  assert.equal(
    await page
      .getByRole("region", { name: "Ready", exact: true })
      .getByText("Tighten the type scale", { exact: true })
      .count(),
    1,
  );
  await page.getByRole("button", { name: "Add column" }).click();
  await page.getByLabel("Column name").fill("Ready");
  await page.getByRole("button", { name: "Create column" }).click();
  assert.match(await page.getByRole("alert").innerText(), /already exists/);
  await page.getByLabel("Column name").fill("Review");
  await page.getByRole("button", { name: "Create column" }).click();
  assert.equal(
    await page.getByRole("region", { name: "Review", exact: true }).count(),
    1,
  );
  await page
    .getByRole("button", { name: "Rename Review", exact: true })
    .click();
  await page.getByLabel("Column name").fill("QA");
  await page.getByRole("button", { name: "Save name" }).click();
  assert.equal(
    await page.getByRole("region", { name: "QA", exact: true }).count(),
    1,
  );
  await page.getByRole("button", { name: "Remove Ready", exact: true }).click();
  await page.getByRole("button", { name: "Confirm removal" }).click();
  assert.equal(
    await page.getByRole("region", { name: "Ready", exact: true }).count(),
    0,
  );
  assert.equal(await page.getByRole("listitem").count(), 3);
  await mount(
    `window.calls=[];function Fixture(){const [board,setBoard]=useState({columns:[{id:'only',title:'Only'}],items:[{id:'a',title:'Preserve this',description:'Important',owner:'Jo',columnId:'only'}]});return <Subject.CompactKanban {...board} onBoardChange={value=>{window.calls.push(value);setBoard(value)}}/>};createRoot(document.getElementById('root')).render(<Fixture/>);`,
  );
  await page.getByRole("button", { name: "Remove Only", exact: true }).click();
  await page.getByRole("button", { name: "Confirm removal" }).click();
  assert.equal(
    await page
      .getByRole("region", { name: "Unassigned", exact: true })
      .getByText("Preserve this", { exact: true })
      .count(),
    1,
  );
  assert.equal(await page.evaluate(() => window.calls[0].items.length), 1);
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.CompactKanban items={[]} columns={[]}/>);`,
  );
  assert.equal(
    await page.getByRole("button", { name: "Add column" }).isDisabled(),
    true,
  );
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.CompactKanban selectMode="native"/>);`,
  );
  await page.getByRole("combobox").first().selectOption("working");
  assert.equal(
    await page
      .getByRole("region", { name: "In progress", exact: true })
      .locator("[data-kanban-card]")
      .count(),
    2,
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  const touchContext = await browser.newContext({
    viewport: { width: 1100, height: 900 },
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const touchPage = await touchContext.newPage();
  touchPage.on("pageerror", (error) => errors.push(error.message));
  await mountFixture(
    touchPage,
    "data-kanban-compact",
    "pro",
    `createRoot(document.getElementById('root')).render(<Subject.CompactKanban/>);`,
  );
  const touchHandle = touchPage.getByRole("button", {
    name: "Move Tighten the type scale with keyboard or pointer",
  });
  const from = await touchHandle.boundingBox();
  const destination = await touchPage
    .getByRole("region", { name: "In progress", exact: true })
    .boundingBox();
  const client = await touchContext.newCDPSession(touchPage);
  const start = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  const finish = {
    x: destination.x + destination.width / 2,
    y: destination.y + destination.height - 24,
  };
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ ...start, id: 1 }],
  });
  for (let step = 1; step <= 12; step++) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: start.x + ((finish.x - start.x) * step) / 12,
          y: start.y + ((finish.y - start.y) * step) / 12,
          id: 1,
        },
      ],
    });
  }
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await touchPage
    .getByRole("region", { name: "In progress", exact: true })
    .getByText("Tighten the type scale", { exact: true })
    .waitFor();
  await touchPage
    .getByRole("region", { name: "Ready", exact: true })
    .getByText("Tighten the type scale", { exact: true })
    .waitFor({ state: "detached" });
  await touchContext.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS Kanban custom/native menus, keyboard/pointer/touch movement, cancellation, column CRUD, task preservation, atomic control and responsive widths.",
  );
} finally {
  await browser.close();
}
