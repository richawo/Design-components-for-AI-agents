import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

export async function check({ page, mount, assert }) {
  const viewport = page.viewportSize();
  const reduce = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const out = process.env.CALL_CONTROL_CONTRAST_OUT ?? "test-results/call-controls-contrast";
  fs.mkdirSync(out, { recursive: true });
  const results = [];
  const luminance = rgb => rgb.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const theme of ["dark", "light"]) {
      await mount(`createRoot(document.getElementById('root')).render(<div data-contrast-host style={{width:900,padding:40,background:'${theme === "dark" ? "#0b0b0c" : "#f4f4f5"}'}}><Subject.CallControls theme="${theme}" onLeave={()=>{}} onMicrophoneChange={()=>{}} onCameraChange={()=>{}} onHandChange={()=>{}}/></div>);`);
      await page.evaluate(() => document.fonts.ready);
      await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
      const leave = page.getByRole("button", { name: "Leave room", exact: true });
      for (const state of ["idle", "hover"]) {
        if (state === "hover") await leave.hover(); else await page.mouse.move(0, 0);
        await page.waitForTimeout(250);
        const box = await leave.boundingBox();
        const style = await leave.evaluate(node => ({ color: getComputedStyle(node).color, filter: getComputedStyle(node).filter }));
        const brightness = Number(style.filter.match(/brightness\(([\d.]+)\)/)?.[1] ?? 1);
        if (state === "hover") assert.ok(brightness > 1, "Measure the actual hover treatment");
        const foreground = style.color.match(/[\d.]+/g).slice(0, 3).map(value => Math.min(255, Number(value) * brightness));
        const pixel = await sharp(await page.screenshot()).extract({ left: Math.round(box.x) + 8, top: Math.round(box.y + box.height / 2), width: 1, height: 1 }).removeAlpha().raw().toBuffer();
        const background = [...pixel];
        const light = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
        const ratio = (light[0] + .05) / (light[1] + .05);
        const violations = await page.evaluate(async () => (await axe.run(document.body, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })).violations.map(violation => ({ id: violation.id, targets: violation.nodes.map(node => node.target) })));
        await page.locator("[data-contrast-host]").screenshot({ path: path.join(out, `${theme}-${state}.png`) });
        results.push({ theme, state, foreground, paintedBackground: background, filter: style.filter, ratio, violations });
      }
    }
    fs.writeFileSync(path.join(out, "proof.json"), JSON.stringify({ results, minimumContrast: 4.5 }, null, 2) + "\n");
    assert.deepEqual(results.filter(result => result.ratio < 4.5 || result.violations.length), [], "Leave text must retain AA contrast in both actual painted states and themes");
    console.log("PASS CallControls painted idle/hover contrast and accessibility in both themes");
  } finally {
    if (viewport) await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: reduce ? "reduce" : "no-preference" });
  }
}
