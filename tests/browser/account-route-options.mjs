import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { launchChromium } from "../../scripts/lib/browser.mjs";

const base = process.env.TEST_BASE || "http://127.0.0.1:4189";
const out = process.env.TEST_OUT || "test-results/site-performance/account-options";
fs.mkdirSync(out, { recursive: true });
const browser = await launchChromium();
const reports = [];
try {
  for (const scenario of ["signed-out-plan", "signed-in-plan", "welcome", "pending", "unavailable", "duplicate-plan"]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    let reads = 0;
    const errors = [], writes = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (request.method() !== "GET") writes.push({ method: request.method(), pathname: new URL(request.url()).pathname }); });
    await page.route("**/api/account", async route => {
      reads++;
      if (scenario === "unavailable") return route.fulfill({ status: 503, json: { error: "Fixture connection unavailable" } });
      const active = scenario === "welcome";
      return route.fulfill({ json: {
        user: scenario === "signed-out-plan" || scenario === "duplicate-plan" ? null : { email: "reader@example.test" },
        hasBilling: false, pendingCheckout: scenario === "pending",
        licences: active ? [{ id: "fixture", plan: "pro-lifetime", seats: 1, owner: true, active: true, status: "active", expiresAt: null, token: "fixture-token", members: [] }] : [],
      } });
    });
    await page.route("**/api/license/me", route => route.fulfill({ json: { active: false } }));
    const query = scenario === "welcome" ? "welcome=1" : scenario === "pending" ? "pending=1" : scenario === "duplicate-plan" ? "plan=pro-yearly&plan=team-lifetime" : "plan=pro-yearly";
    const html = await (await fetch(`${base}/account?${query}`)).text();
    assert.ok(html.includes("Loading your account"), "the shared account HTML contains only the loading shell");
    assert.ok(!html.includes("reader@example.test") && !html.includes("fixture-token"), "identity and licence data never enter shared HTML");
    await page.goto(`${base}/account?${query}`, { waitUntil: "load" });
    if (scenario === "signed-out-plan") {
      await page.getByRole("heading", { name: "Pro yearly", exact: true }).waitFor();
      await page.getByText("$99 USD per year, renewed annually.", { exact: false }).waitFor();
    } else if (scenario === "signed-in-plan") {
      await page.getByRole("heading", { name: "Continue with Pro yearly.", exact: true }).waitFor();
      await page.getByRole("button", { name: "Continue to checkout", exact: true }).waitFor();
    } else if (scenario === "welcome") {
      await page.getByRole("status").filter({ hasText: "Your library is ready." }).waitFor();
      await page.getByText("dfa_••••••••••••••••••••••••", { exact: true }).waitFor();
    } else if (scenario === "pending") {
      await page.getByRole("heading", { name: "Your payment is being confirmed.", exact: true }).waitFor();
      await page.waitForTimeout(3200);
      assert.ok(reads > 1, "pending payment keeps the existing refresh behavior");
    } else if (scenario === "unavailable") {
      await page.getByRole("heading", { name: "Your account couldn't load.", exact: true }).waitFor();
    } else {
      await page.getByRole("heading", { name: "Make something worth shipping.", exact: true }).waitFor();
    }
    assert.deepEqual(writes, [], "navigation never starts checkout or another account mutation");
    assert.deepEqual(errors, []);
    if (scenario === "signed-in-plan") await page.screenshot({ path: path.join(out, "selected-plan.png") });
    reports.push({ scenario, reads, writes, errors, ok: true });
    await page.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(out, "results.json"), JSON.stringify({ ok: true, reports }, null, 2) + "\n");
console.log("Account shell: plan selection, welcome, pending refresh, service failure and duplicate-query handling pass with private data loaded only through mocked authenticated APIs.");
