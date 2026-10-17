export async function check({ page, mount, assert }) {
  await mount(`window.scores=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.InterviewScorecard onSubmit={async p=>{window.scores.push(p);if(window.fail)throw Error('offline')}}/>);`);
  const submit = page.getByRole("button", { name: "Submit scorecard" });
  const calibration = page.getByRole("region", { name: "Panel calibration" });
  assert.equal(await submit.isDisabled(), true);
  // The panel's scores stay hidden while you rate.
  assert.match(await calibration.innerText(), /3 interviewers have submitted/);
  assert.equal(await calibration.getByRole("img").count(), 0);

  const evidence = {
    craft: "Clear type scale and keyboard paths designed up front in the billing work.",
    judgment: "Cut a three-step wizard to one screen after reading the support data.",
  };
  // Mouse: rate, and the evidence label follows the rating.
  await page.locator('[data-demo="rate-craft-3"]').click();
  assert.equal(await page.getByRole("radio", { name: "3 · Meets" }).first().getAttribute("aria-checked"), "true");
  await page.getByLabel("Evidence for “Meets”", { exact: true }).fill(evidence.craft);
  // Keyboard: arrows move along the anchored scale.
  await page.locator('[data-demo="rate-judgment-1"]').focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator('[data-demo="rate-judgment-4"]').getAttribute("aria-checked"), "true");
  assert.match(await page.locator("section").first().innerText(), /4 · Sustained evidence beyond the expected level/);
  await page.locator('[data-demo="evidence-judgment"]').fill(evidence.judgment);
  // Not observed needs no evidence.
  await page.locator('[data-demo="rate-collaboration-none"]').click();
  assert.match(await page.locator("section").first().innerText(), /Optional when not observed/);
  await page.locator('[data-demo="rec-no"]').focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(await page.locator('[data-demo="rec-yes"]').getAttribute("aria-checked"), "true");
  assert.equal(await submit.isDisabled(), true);
  await page.getByLabel("Summary for the debrief", { exact: true }).fill("Strong craft, clear product thinking; collaboration not covered today.");
  assert.equal(await submit.isDisabled(), false);

  // A failed submit keeps everything and keeps the panel hidden.
  await submit.click();
  await page.getByRole("status").filter({ hasText: "Couldn’t submit" }).waitFor();
  assert.equal(await page.locator('[data-demo="evidence-craft"]').inputValue(), evidence.craft);
  assert.equal(await calibration.getByRole("img").count(), 0);
  await page.evaluate(() => (window.fail = false));
  await submit.click();
  await page.getByRole("status").filter({ hasText: "Scorecard submitted · Yes" }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.scores[1]), {
    candidate: "Alex Morgan",
    role: "Senior Product Designer",
    interviewer: "Maya Chen",
    ratings: [
      { competencyId: "craft", rating: 3, evidence: evidence.craft },
      { competencyId: "judgment", rating: 4, evidence: evidence.judgment },
      { competencyId: "collaboration", rating: "not-observed", evidence: "" },
    ],
    recommendation: "yes",
    summary: "Strong craft, clear product thinking; collaboration not covered today.",
  });
  // Now calibration reveals, with the disagreement flagged.
  assert.match(await calibration.getByRole("img", { name: /^Product judgment/ }).getAttribute("aria-label"), /Sofia Marin 2, You 4/);
  assert.match(await calibration.innerText(), /Spread of 2/);
  assert.equal(await page.locator('[data-demo="rate-craft-2"]').isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Submit scorecard" }).count(), 0);

  // Duplicate and empty competency lists; a first scorecard with no panel yet.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.InterviewScorecard competencies={[{id:'a',name:'Craft',prompt:'Detail.'},{id:'a',name:'Craft again',prompt:'Detail.'}]} panel={[]}/>);`);
  assert.match(await page.getByRole("alert").innerText(), /appears twice/);
  assert.match(await calibration.innerText(), /appear here once you submit/);
  await mount(`createRoot(document.getElementById('root')).render(<Subject.InterviewScorecard competencies={[]}/>);`);
  assert.match(await page.locator("section").first().innerText(), /No competencies on this scorecard/);
  assert.equal(await page.getByRole("button", { name: "Submit scorecard" }).isDisabled(), true);
}
