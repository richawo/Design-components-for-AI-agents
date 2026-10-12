import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const rows = ["free", "pro"].flatMap((tier) =>
  fs.readdirSync("registry/" + tier).flatMap((slug) => {
    const file = `registry/${tier}/${slug}/meta.json`;
    if (!fs.existsSync(file)) return [];
    const m = JSON.parse(fs.readFileSync(file));
    return m.platform === "mobile" ? [m] : [];
  }),
);
const b = await launchChromium();
const results = [];
try {
  for (const m of rows) {
    const p = await b.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    let errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    const code = fs.readFileSync(
      `registry/${m.tier}/${m.slug}/${m.slug}.tsx`,
      "utf8",
    );
    const name =
      /import\s*\{([^}]+)\}\s*from\s*["']@\/components\/design-for-ai\//
        .exec(m.usage)?.[1]
        .split(",")
        .map((s) => s.trim())
        .find((n) => new RegExp(`export (function|const) ${n}\\b`).test(code));
    const arrays = m.props
      .filter((p) => /\[\]$|^Array</.test(p.type) && !p.type.includes("=>"))
      .map((p) => p.name);
    const cases = [
      {
        name: "all-empty",
        props: Object.fromEntries(arrays.map((p) => [p, []])),
      },
      ...arrays.map((p) => ({ name: "empty-" + p, props: { [p]: [] } })),
    ];
    try {
      if (!name) throw Error("Missing named export");
      await mountFixture(
        p,
        m.slug,
        m.tier,
        `const root=createRoot(document.getElementById('root'));window.render=props=>root.render(<Subject.${name} {...props}/>);window.render({});`,
      );
      for (const c of cases) {
        errors = [];
        await p.evaluate((props) => window.render(props), c.props);
        await p.waitForTimeout(350);
        const captures = [...errors];
        await p.evaluate(() => window.render({}));
        await p.waitForTimeout(450);
        captures.push(...errors);
        results.push({
          slug: m.slug,
          name: c.name,
          errors: [...new Set(captures)],
        });
        console.log(
          (captures.length ? "FAIL" : "PASS") +
            " " +
            m.slug +
            " " +
            c.name +
            (captures.length ? " " + JSON.stringify(captures) : ""),
        );
      }
    } catch (e) {
      results.push({
        slug: m.slug,
        name: "mount",
        errors: [...errors, String(e)],
      });
      console.log("FAIL " + m.slug + " mount " + String(e));
    }
    await p.close();
  }
} finally {
  await b.close();
  if (process.env.NATIVE_CASES_OUTPUT)
    fs.writeFileSync(
      process.env.NATIVE_CASES_OUTPUT,
      JSON.stringify(results, null, 2),
    );
}
console.log(
  results.filter((r) => !r.errors.length).length +
    "/" +
    results.length +
    " native prop cases pass",
);
if (results.some((r) => r.errors.length)) process.exitCode = 1;
