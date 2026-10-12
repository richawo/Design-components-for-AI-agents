/** Exercise public prop contracts with empty arrays and multiple instances. Requires the preview server. */
import fs from "node:fs";
import { launchChromium } from "./lib/browser.mjs";
import { mountFixture } from "./lib/component-fixture.mjs";
const args = process.argv.slice(2);
const selected = args.filter((a) => !a.startsWith("--"));
const since = args.find((a) => a.startsWith("--since="))?.slice(8) ?? "";
const dir =
  args.find((a) => a.startsWith("--out="))?.slice(6) ??
  "test-results/component-data";
fs.mkdirSync(dir, { recursive: true });
const rows = ["free", "pro"].flatMap((tier) =>
  fs.existsSync(`registry/${tier}`)
    ? fs
        .readdirSync(`registry/${tier}`)
        .filter((s) => !s.startsWith("_") && !s.startsWith("."))
        .flatMap((slug) => {
          const p = `registry/${tier}/${slug}/meta.json`;
          if (!fs.existsSync(p)) return [];
          const meta = JSON.parse(fs.readFileSync(p));
          return meta.platform === "web" &&
            (!since || meta.added >= since) &&
            (!selected.length || selected.includes(slug))
            ? [meta]
            : [];
        })
    : [],
);
for (const slug of selected)
  if (!rows.some((m) => m.slug === slug))
    throw new Error(`No local web component matched ${slug}`);
if (!rows.length) throw new Error("No local web components matched.");
const browser = await launchChromium();
let next = 0;
const results = [];
await Promise.all(
  Array.from({ length: 2 }, async () => {
    while (next < rows.length) {
      const meta = rows[next++];
      const code = fs.readFileSync(
        `registry/${meta.tier}/${meta.slug}/${meta.slug}.tsx`,
        "utf8",
      );
      const named =
        /import\s*\{([^}]+)\}\s*from\s*["']@\/components\/design-for-ai\//
          .exec(meta.usage)?.[1]
          .split(",")
          .map((s) => s.trim())
          .find((s) =>
            new RegExp(`export (function|const) ${s}\\b`).test(code),
          );
      if (!named) {
        results.push({
          slug: meta.slug,
          passed: false,
          errors: ["Cannot find named export"],
        });
        continue;
      }
      const arrays = meta.props
        .filter(
          (p) =>
            /(?:\[\]\s*$|^(?:Readonly)?Array<)/.test(p.type.trim()) &&
            !p.type.includes("=>"),
        )
        .map((p) => p.name);
      const empty = Object.fromEntries(arrays.map((name) => [name, []]));
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
        reducedMotion: "reduce",
      });
      let errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const result = { slug: meta.slug, arrays, errors: [], cases: [] };
      try {
        await mountFixture(
          page,
          meta.slug,
          meta.tier,
          `const root=createRoot(document.getElementById('root'));window.renderAudit=(props={},count=1)=>root.render(<React.Fragment key={JSON.stringify(props)+count}>{Array.from({length:count},(_,i)=><div key={i} style={{marginBottom:48}}><Subject.${named} {...props}/></div>)}</React.Fragment>);window.renderAudit({},2);`,
        );
        result.duplicateIds = await page.evaluate(() => {
          const ids = [...document.querySelectorAll("[id]")].map((e) => e.id);
          return ids.filter((id, i) => ids.indexOf(id) !== i);
        });
        result.errors.push(...errors);
        errors = [];
        const cases = arrays.length
          ? [
              { name: "all-empty", props: empty },
              ...arrays.map((name) => ({
                name: `empty-${name}`,
                props: { [name]: [] },
              })),
            ]
          : [];
        for (const c of cases) {
          await page.evaluate((props) => window.renderAudit(props), c.props);
          await page.waitForTimeout(250);
          const visible = await page.locator("#root").innerText();
          result.cases.push({
            name: c.name,
            errors: [...errors],
            empty:
              !visible.trim() &&
              (await page.locator("#root svg, #root canvas").count()) === 0,
            overflow: await page.evaluate(() =>
              Math.max(0, document.documentElement.scrollWidth - innerWidth),
            ),
          });
          errors = [];
        }
      } catch (e) {
        result.errors.push(String(e));
      }
      await page.close();
      result.passed =
        !result.errors.length &&
        !result.duplicateIds?.length &&
        result.cases.every((c) => !c.errors.length);
      results.push(result);
      fs.writeFileSync(
        `${dir}/results.json`,
        JSON.stringify(results, null, 2) + "\n",
      );
      console.log(
        `${result.passed ? "PASS" : "FAIL"} ${meta.slug}: two instances and ${result.cases.length} empty-data cases`,
      );
    }
  }),
);
await browser.close();
console.log(
  `${results.filter((r) => r.passed).length}/${results.length} passed`,
);
if (results.some((r) => !r.passed)) process.exitCode = 1;
