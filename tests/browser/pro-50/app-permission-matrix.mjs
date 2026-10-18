import { assertCheckboxContrast } from "../control-contrast.mjs";

export async function check({ page, mount, assert, capture = async () => {} }) {
  // A tall fixture misses the focus-driven scroll jump that can cancel a checkbox press.
  await page.setViewportSize({ width: 390, height: 900 });
  await mount(
    `window.policies=[];window.fail=true;createRoot(document.getElementById('root')).render(<Subject.PermissionMatrix onSave={async grants=>{window.policies.push(structuredClone(grants));if(window.fail)throw Error('The policy service is offline.');grants.reviewer.push('invite');return new Promise(resolve=>window.finishPolicy=resolve)}}/>);`,
  );
  await assertCheckboxContrast(page);
  const box = (name) => page.getByRole("checkbox", { name, exact: true });
  assert.equal(await box("View documents for Owner").isDisabled(), true);
  const grantAll = page.getByRole("button", { name: "Grant all permissions to Reviewer", exact: true });
  const clear = page.getByRole("button", { name: "Clear permissions for Reviewer", exact: true });
  for (const action of [grantAll, clear]) {
    const target = await action.boundingBox();
    assert.ok(target.width >= 44 && target.height >= 44, "Bulk policy actions have 44px targets");
  }
  await grantAll.click();
  for (const action of [
    "View documents",
    "Edit documents",
    "Export documents",
    "Approve revisions",
    "Invite collaborators",
  ])
    assert.equal(await box(action + " for Reviewer").isChecked(), true);
  await capture("role-granted", { audit: true });
  await clear.click();
  for (const action of [
    "View documents",
    "Edit documents",
    "Export documents",
    "Approve revisions",
    "Invite collaborators",
  ])
    assert.equal(await box(action + " for Reviewer").isChecked(), false);
  assert.equal(await box("View documents for Owner").isChecked(), true);
  await capture("role-cleared", { audit: true });
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await box("Approve revisions for Reviewer").check();
  assert.equal(await box("Edit documents for Reviewer").isChecked(), true);
  assert.equal(await box("View documents for Reviewer").isChecked(), true);
  assert.match(
    await page.getByRole("complementary", { name: "Permission details", exact: true }).innerText(),
    /Also included: Edit documents/,
  );
  await capture("dependencies-added", { audit: true });
  await box("View documents for Reviewer").uncheck();
  assert.equal(await box("Edit documents for Reviewer").isChecked(), false);
  assert.equal(await box("Approve revisions for Reviewer").isChecked(), false);
  await capture("dependants-removed", { audit: true });
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  assert.equal(await box("View documents for Reviewer").isChecked(), true);
  assert.equal(await box("Edit documents for Reviewer").isChecked(), false);
  await box("Export documents for Reviewer").press("Space");
  assert.equal(await box("Export documents for Reviewer").isChecked(), true);
  await page.getByRole("button", { name: "Save policy", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "The policy service is offline." }).waitFor();
  assert.equal(await box("Export documents for Reviewer").isChecked(), true);
  await capture("save-failed", { audit: true });
  await page.evaluate(() => (window.fail = false));
  await page.getByRole("button", { name: "Save policy", exact: true }).click();
  assert.equal(await box("Export documents for Reviewer").isDisabled(), true);
  assert.equal(await page.getByRole("button", { name: "Reset", exact: true }).isDisabled(), true);
  assert.equal(
    await page.getByRole("button", { name: "Grant all permissions to Reviewer", exact: true }).isDisabled(),
    true,
  );
  await page.locator('[data-demo="save-policy"]').evaluate((node) => node.click());
  assert.equal(await page.evaluate(() => window.policies.length), 2);
  assert.deepEqual(await page.evaluate(() => window.policies[1]), {
    owner: ["view", "edit", "export", "approve", "invite"],
    counsel: ["view", "edit"],
    reviewer: ["view", "export"],
  });
  await capture("pending", { audit: true });
  await page.evaluate(() => window.finishPolicy());
  await page.getByRole("status").filter({ hasText: "Access policy saved · 1 change" }).waitFor();
  assert.equal(await page.getByRole("alert").count(), 0, "Earlier policy failures retire after acknowledgement");
  assert.equal(
    await box("Invite collaborators for Reviewer").isChecked(),
    false,
    "Host callback mutation cannot change the retained policy",
  );
  await capture("saved", { audit: true });
  await box("Edit documents for Reviewer").focus();
  await page
    .getByRole("complementary", { name: "Permission details", exact: true })
    .getByRole("heading", { name: "Edit documents", exact: true })
    .waitFor();
  await page.keyboard.press("Tab");
  assert.equal(await box("Export documents for Counsel").evaluate((node) => node === document.activeElement), true);
  await page
    .getByRole("complementary", { name: "Permission details", exact: true })
    .getByRole("heading", { name: "Export documents", exact: true })
    .waitFor();

  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.PermissionMatrix permissions={[{id:'a',name:'A',group:'Test',description:'A',requires:['b']},{id:'b',name:'B',group:'Test',description:'B',requires:['a']}]}/>);`,
  );
  assert.match(await page.getByRole("alert").innerText(), /cycle/);
  assert.equal(await page.getByRole("button", { name: "Save policy", exact: true }).isDisabled(), true);
  await capture("invalid-schema", { audit: true });
  await mount(
    `createRoot(document.getElementById('root')).render(<Subject.PermissionMatrix roles={[]} permissions={[]} defaultGrants={{}}/>);`,
  );
  assert.match(await page.locator("section").innerText(), /Add roles and permissions/);
  await capture("empty", { audit: true });

  await mount(
    `window.rawPolicies=[];createRoot(document.getElementById('root')).render(<Subject.PermissionMatrix roles={[{id:'__proto__',name:'Raw role',description:'Raw'}]} permissions={[{id:'constructor',name:'Raw action',group:'Raw',description:'Opaque identifiers'}]} defaultGrants={Object.fromEntries([['__proto__',[]]])} onSave={grants=>window.rawPolicies.push(grants)}/>);`,
  );
  assert.match(await page.locator("section").innerText(), /1 role · 1 permission\b/);
  await page.getByRole("checkbox", { name: "Raw action for Raw role", exact: true }).check();
  await page.getByRole("button", { name: "Save policy", exact: true }).click();
  assert.deepEqual(await page.evaluate(() => window.rawPolicies[0].__proto__), ["constructor"]);
  assert.equal(await page.evaluate(() => Object.hasOwn(window.rawPolicies[0], "__proto__")), true);

  await mount(
    `function Host(){const [grants,setGrants]=React.useState({owner:['view','edit','export','approve','invite'],counsel:['view','edit'],reviewer:['view']});window.replacePolicy=()=>setGrants({owner:['view','edit','export','approve','invite'],counsel:['view','edit'],reviewer:['view','edit']});return <Subject.PermissionMatrix defaultGrants={grants} onSave={()=>new Promise(resolve=>window.oldPolicy=resolve)}/>}createRoot(document.getElementById('root')).render(<Host/>);`,
  );
  await box("Export documents for Reviewer").check();
  await page.getByRole("button", { name: "Save policy", exact: true }).click();
  await page.evaluate(() => window.replacePolicy());
  await page.waitForFunction(() =>
    [...document.querySelectorAll("input[type=checkbox]")].some(
      (input) => input.getAttribute("aria-label") === "Edit documents for Reviewer" && input.checked,
    ),
  );
  await page.evaluate(() => window.oldPolicy());
  assert.doesNotMatch(await page.locator("section").innerText(), /Access policy saved/);

  // A host may echo the exact accepted snapshot before resolving its save.
  {
    await mount(
      `function Host(){const [grants,setGrants]=React.useState({owner:['view','edit','export','approve','invite'],counsel:['view','edit'],reviewer:['view']});return <Subject.PermissionMatrix defaultGrants={grants} onSave={async next=>{await new Promise(resolve=>window.finishEcho=resolve);setGrants(next)}}/>}createRoot(document.getElementById('root')).render(<Host/>);`,
    );
    await page.getByRole("checkbox", { name: "Export documents for Reviewer", exact: true }).check();
    await page.getByRole("button", { name: "Save policy", exact: true }).click();
    await page.evaluate(() => window.finishEcho());
    await page.getByText("Access policy saved · 1 change", { exact: true }).waitFor();
    assert.equal(
      await page.getByRole("checkbox", { name: "Export documents for Reviewer", exact: true }).isChecked(),
      true,
    );
    assert.equal(await page.getByRole("button", { name: "Saved", exact: true }).isDisabled(), true);

    await capture("host-echo", { audit: true });
  }
}
