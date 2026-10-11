import assert from "node:assert/strict";
import fs from "node:fs";
import { launchChromium } from "../../scripts/lib/browser.mjs";
import { mountFixture } from "../../scripts/lib/component-fixture.mjs";
const specs = [
  {
    slug: "commerce-operations-dashboard",
    steps: [
      "wait:500",
      "click:@channel-1",
      "wait:900",
      "click:@period-1",
      "wait:1000",
    ],
  },
  {
    slug: "commerce-fulfilment-desk",
    steps: [
      "wait:350",
      "click:@action-0",
      "click:@note",
      "type:Address verified",
      "click:@review",
      "wait:350",
      "click:@confirm",
      "wait:900",
    ],
  },
  {
    slug: "commerce-purchase-order",
    steps: [
      "wait:450",
      "click:@review",
      "wait:800",
      "click:@save",
      "wait:1100",
    ],
  },
  {
    slug: "commerce-promotion-builder",
    steps: [
      "wait:500",
      "click:@customer-1",
      "wait:600",
      "click:@save",
      "wait:1200",
    ],
  },
  {
    slug: "commerce-shipping-estimator",
    steps: [
      "wait:450",
      "click:@sort-speed",
      "wait:500",
      "click:@service-0",
      "click:@select",
      "wait:1100",
    ],
  },
  {
    slug: "commerce-bundle-builder",
    steps: ["wait:450", "click:@add-1", "wait:650", "click:@save", "wait:1200"],
  },
  {
    slug: "commerce-backorder-allocation",
    steps: [
      "wait:400",
      "click:@fill",
      "wait:550",
      "click:@review",
      "wait:450",
      "click:@save",
      "wait:1000",
    ],
  },
  {
    slug: "commerce-customer-timeline",
    steps: [
      "wait:450",
      "click:@event-1",
      "wait:800",
      "click:@filter-2",
      "wait:1000",
    ],
  },
  {
    slug: "fashion-merchandising-dashboard",
    steps: [
      "wait:450",
      "click:@style-1",
      "wait:800",
      "click:@category-2",
      "wait:1000",
    ],
  },
  {
    slug: "fashion-collection-line-plan",
    steps: [
      "wait:400",
      "click:@category-1",
      "click:@add-style",
      "wait:650",
      "click:@save",
      "wait:1100",
    ],
  },
  {
    slug: "fashion-size-guide",
    steps: [
      "wait:400",
      "click:@measure-1",
      "wait:500",
      "click:@unit-in",
      "wait:650",
      "click:@save",
      "wait:1000",
    ],
  },
  {
    slug: "fashion-preorder-planner",
    steps: [
      "wait:350",
      "click:@suggest",
      "wait:500",
      "click:@review",
      "wait:450",
      "click:@save",
      "wait:1100",
    ],
  },
  {
    slug: "fashion-exchange-selector",
    steps: [
      "wait:350",
      "click:@color-1",
      "click:@variant-1",
      "wait:500",
      "click:@review",
      "wait:400",
      "click:@request",
      "wait:1100",
    ],
  },
  {
    slug: "fashion-assortment-planner",
    steps: [
      "wait:350",
      "click:@fill-0",
      "click:@fill-1",
      "wait:450",
      "click:@fill-2",
      "click:@save",
      "wait:1100",
    ],
  },
  {
    slug: "fashion-launch-calendar",
    steps: [
      "wait:450",
      "click:@day-20",
      "wait:900",
      "click:@day-28",
      "wait:1000",
    ],
  },
  {
    slug: "fashion-wholesale-order",
    steps: [
      "wait:350",
      "click:@add-0",
      "click:@add-1",
      "wait:450",
      "click:@review",
      "wait:350",
      "click:@submit",
      "wait:1100",
    ],
  },
  {
    slug: "finance-cashflow-dashboard",
    steps: [
      "wait:400",
      "click:@account-0",
      "wait:450",
      "click:@movement-1",
      "wait:1100",
    ],
  },
  {
    slug: "finance-close-checklist",
    steps: [
      "wait:350",
      "click:@task-accrual",
      "wait:650",
      "click:@task-bank",
      "click:@evidence",
      "type:Bank statement reconciled.",
      "click:@complete",
      "wait:1000",
    ],
  },
  {
    slug: "finance-expense-review",
    steps: [
      "wait:400",
      "click:@expense-1",
      "wait:700",
      "click:@expense-0",
      "click:@approve",
      "wait:450",
      "click:@confirm",
      "wait:1000",
    ],
  },
  {
    slug: "finance-budget-variance",
    steps: [
      "wait:350",
      "click:@line-subscription",
      "wait:750",
      "click:@line-events",
      "wait:1100",
    ],
  },
  {
    slug: "finance-invoice-composer",
    steps: [
      "wait:350",
      "click:@review",
      "wait:900",
      "click:@save",
      "wait:1100",
    ],
  },
  {
    slug: "finance-receivables-aging",
    steps: [
      "wait:400",
      "click:@bucket-2",
      "wait:650",
      "click:@review",
      "wait:600",
      "click:@create",
      "wait:1000",
    ],
  },
  {
    slug: "finance-scenario-forecast",
    steps: [
      "wait:350",
      "click:@input-4",
      "key:Home",
      "key:Delete",
      "type:8",
      "wait:500",
      "click:@save",
      "wait:1000",
    ],
  },
  {
    slug: "finance-payment-run",
    steps: [
      "wait:350",
      "click:@invoice-0",
      "click:@invoice-1",
      "click:@review",
      "wait:650",
      "click:@create",
      "wait:1000",
    ],
  },
  {
    slug: "hr-people-dashboard",
    steps: [
      "wait:350",
      "click:@person-2",
      "wait:750",
      "click:@person-4",
      "wait:1100",
    ],
  },
  {
    slug: "hr-leave-approval",
    steps: [
      "wait:350",
      "click:@request-2",
      "wait:650",
      "click:@request-0",
      "click:@approve",
      "wait:450",
      "click:@confirm",
      "wait:1000",
    ],
  },
  {
    slug: "hr-employee-onboarding",
    steps: [
      "wait:350",
      "click:@phase-2",
      "wait:900",
      "click:@phase-1",
      "wait:1100",
    ],
  },
  {
    slug: "hr-interview-scorecard",
    steps: [
      "wait:350",
      "click:@rating-3",
      "wait:650",
      "click:@competency-1",
      "click:@rating-2",
      "wait:1000",
    ],
  },
  {
    slug: "hr-policy-acknowledgement",
    steps: [
      "wait:400",
      "click:@statement-0",
      "click:@statement-1",
      "wait:500",
      "click:@acknowledge",
      "wait:1100",
    ],
  },
  {
    slug: "hr-org-explorer",
    steps: [
      "wait:350",
      "click:@report-0",
      "wait:650",
      "click:@report-0",
      "wait:1000",
    ],
  },
  {
    slug: "hr-compensation-review",
    steps: [
      "wait:350",
      "click:@rate-0",
      "key:Home",
      "key:Delete",
      "type:3",
      "wait:850",
      "click:@employee-1",
      "wait:1000",
    ],
  },
  {
    slug: "hr-shift-coverage",
    steps: [
      "wait:350",
      "click:@candidate-0",
      "click:@shift-1",
      "click:@candidate-1",
      "wait:450",
      "click:@save",
      "wait:1000",
    ],
  },
  {
    slug: "legal-matter-dashboard",
    steps: [
      "wait:400",
      "click:@matter-1",
      "wait:1000",
      "click:@matter-2",
      "wait:1200",
    ],
  },
  {
    slug: "legal-matter-intake",
    steps: ["wait:400", "click:@next", "wait:700", "click:@next", "wait:1000"],
  },
  {
    slug: "legal-obligation-tracker",
    steps: [
      "wait:350",
      "click:@obligation-1",
      "wait:750",
      "click:@filter-complete",
      "wait:1200",
    ],
  },
  {
    slug: "legal-signature-request",
    steps: [
      "wait:350",
      "click:@up-1",
      "wait:600",
      "click:@review",
      "wait:1200",
    ],
  },
  {
    slug: "legal-clause-library",
    steps: [
      "wait:400",
      "click:@clause-1",
      "wait:700",
      "click:@insert",
      "wait:1200",
    ],
  },
  {
    slug: "legal-evidence-index",
    steps: [
      "wait:350",
      "click:@include-0",
      "click:@include-1",
      "click:@review",
      "wait:1300",
    ],
  },
  {
    slug: "legal-renewal-planner",
    steps: [
      "wait:350",
      "click:@contract-1",
      "wait:750",
      "click:@scope-all",
      "click:@contract-2",
      "wait:1000",
    ],
  },
  {
    slug: "legal-document-requests",
    steps: [
      "wait:400",
      "click:@request-1",
      "wait:950",
      "click:@request-2",
      "wait:1200",
    ],
  },
  {
    slug: "saas-workspace-dashboard",
    steps: [
      "wait:350",
      "click:@day-4",
      "wait:550",
      "click:@project-1",
      "wait:1300",
    ],
  },
  {
    slug: "saas-notification-inbox",
    steps: [
      "wait:350",
      "click:@notification-1",
      "wait:550",
      "click:@toggle-read",
      "wait:1200",
    ],
  },
  {
    slug: "saas-audit-trail",
    steps: [
      "wait:350",
      "click:@event-2",
      "wait:700",
      "click:@changed-only",
      "wait:1200",
    ],
  },
  {
    slug: "saas-integration-manager",
    steps: [
      "wait:350",
      "click:@consent",
      "click:@connect",
      "wait:650",
      "click:@integration-1",
      "wait:1000",
    ],
  },
  {
    slug: "saas-access-requests",
    steps: [
      "wait:400",
      "click:@request-1",
      "wait:900",
      "click:@request-0",
      "wait:1000",
    ],
  },
  {
    slug: "saas-saved-views",
    steps: [
      "wait:350",
      "click:@view-1",
      "wait:550",
      "click:@apply",
      "wait:1200",
    ],
  },
  {
    slug: "saas-support-triage",
    steps: [
      "wait:350",
      "click:@ticket-1",
      "wait:850",
      "click:@ticket-2",
      "wait:1200",
    ],
  },
  {
    slug: "saas-report-scheduler",
    steps: [
      "wait:350",
      "click:@section-2",
      "wait:400",
      "click:@review",
      "click:@save",
      "wait:1100",
    ],
  },
  {
    slug: "saas-usage-policy",
    steps: [
      "wait:350",
      "click:@metric-1",
      "wait:700",
      "click:@review",
      "wait:1200",
    ],
  },
  {
    slug: "saas-customer-health",
    steps: [
      "wait:350",
      "click:@customer-1",
      "wait:900",
      "click:@customer-2",
      "wait:1100",
    ],
  },
];
const browser = await launchChromium();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1400 },
  reducedMotion: "no-preference",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const selected = new Set(process.argv.slice(2));
try {
  for (const { slug, steps } of specs.filter(
    (s) =>
      fs.existsSync("registry/pro/" + s.slug) &&
      (!selected.size || selected.has(s.slug)),
  )) {
    const meta = JSON.parse(
      fs.readFileSync("registry/pro/" + slug + "/meta.json"),
    );
    await mountFixture(
      page,
      slug,
      "pro",
      `import {DemoPlayer} from './lib/demo/player';import {parseSteps} from './lib/demo/schema.mjs';createRoot(document.getElementById('root')).render(<Subject.default/>);window.play=steps=>new DemoPlayer(window,{move(){},show(){},press(){},pulse(){}},new AbortController().signal).play(parseSteps(steps));`,
    );
    await page.locator("#root").evaluate((el) => {
      el.style.maxWidth = "none";
      el.style.padding = "0";
    });
    await page.setViewportSize({ width: 1440, height: meta.previewHeight });
    await page.waitForTimeout(200);
    const before = await page.locator("section").first().innerText();
    await page.evaluate((steps) => window.play(steps), steps);
    await page.waitForTimeout(100);
    const last = steps
      .filter((s) => s.startsWith("click:@"))
      .at(-1)
      ?.slice(7);
    const target = page.locator('[data-demo="' + last + '"]');
    const notice = await page.getByRole("status").allTextContents();
    if (notice.some((s) => s.trim() && !s.startsWith("Connect "))) {
      assert.doesNotMatch(notice.join(" "), /failed|Connect the host/);
    } else if (
      (await target.count()) &&
      (await target.getAttribute("aria-pressed")) !== null
    ) {
      assert.equal(await target.getAttribute("aria-pressed"), "true");
    } else {
      assert.notEqual(
        await page.locator("section").first().innerText(),
        before,
        slug + " replay must change the displayed workflow",
      );
    }
    assert.deepEqual(errors, [], slug);
    console.log("PASS live replay " + slug);
  }
} finally {
  await browser.close();
}
