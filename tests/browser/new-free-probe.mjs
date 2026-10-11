import assert from "node:assert/strict";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const b = await launchChromium();
const p = await b.newPage({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await mountFixture(
  p,
  "dropdown-menu-nested",
  "free",
  `window.selected=[];createRoot(document.getElementById('root')).render(<Subject.DropdownMenuNested triggerLabel="Actions" items={[{kind:'action',id:'disabled',label:'Disabled',disabled:true},{kind:'submenu',id:'more',label:'More',items:[{kind:'action',id:'pick',label:'Pick this'}]},{kind:'checkbox',id:'check',label:'Show details'}]} onSelect={id=>window.selected.push(id)} />);`,
);
const trigger = p.getByRole("button", { name: "Actions" });
await trigger.focus();
await p.keyboard.press("ArrowDown");
await p.waitForTimeout(200);
assert.equal(
  await p.evaluate(() => document.activeElement.textContent.trim()),
  "More",
);
await p.keyboard.press("ArrowRight");
await p.waitForTimeout(250);
await p.getByRole("menuitem", { name: "Pick this" }).press("Enter");
await p.waitForTimeout(200);
assert.deepEqual(await p.evaluate(() => window.selected), ["pick"]);
assert.ok(await trigger.evaluate((e) => e === document.activeElement));
await trigger.press("ArrowDown");
await p.waitForTimeout(100);
await p.keyboard.press("Escape");
assert.ok(await trigger.evaluate((e) => e === document.activeElement));
await mountFixture(
  p,
  "input-search-scoped",
  "free",
  `window.submitted=[];createRoot(document.getElementById('root')).render(<Subject.ScopedSearch operators={[{key:'in',label:'Search in',hint:'A place',values:[{id:'docs',label:'Docs'}]}]} onSubmit={v=>window.submitted.push(v)} />);`,
);
const input = p.getByRole("combobox");
await input.fill("in:docs launch");
await input.press("Enter");
await p.waitForTimeout(150);
assert.deepEqual(await p.evaluate(() => window.submitted.at(-1)), {
  query: "launch",
  scopes: [{ key: "in", value: "docs" }],
});
await mountFixture(
  p,
  "tooltip-group",
  "free",
  `createRoot(document.getElementById('root')).render(<Subject.TooltipGroup style={{padding:80}}><Subject.Tooltip label="Bold text"><button>Bold</button></Subject.Tooltip></Subject.TooltipGroup>);`,
);
await p.getByRole("button", { name: "Bold", exact: true }).focus();
await p.waitForTimeout(100);
assert.ok(await p.getByRole("tooltip").isVisible());
const described = await p
  .getByRole("button", { name: "Bold", exact: true })
  .getAttribute("aria-describedby");
assert.ok(described);
await p.keyboard.press("Escape");
await p.waitForTimeout(200);
assert.equal(await p.getByRole("tooltip").count(), 0);
await mountFixture(
  p,
  "card-profile-stats",
  "free",
  `window.follow=[];createRoot(document.getElementById('root')).render(<Subject.ProfileStatsCard followed={false} onFollowChange={v=>window.follow.push(v)} />);`,
);
await p
  .getByRole("button", { name: "Follow Mara Okonkwo", exact: true })
  .click();
assert.deepEqual(await p.evaluate(() => window.follow), [true]);
assert.equal(
  await p
    .getByRole("button", { name: "Follow Mara Okonkwo", exact: true })
    .getAttribute("aria-pressed"),
  "false",
);
assert.equal(await p.getByRole("status").textContent(), "");
assert.deepEqual(errors, []);
console.log(
  "Nested menu keyboard selection/focus, scoped submission, tooltip focus/Escape, and controlled following pass.",
);
await b.close();
