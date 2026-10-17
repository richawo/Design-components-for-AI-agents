export async function check({ page, mount, assert }) {
  const d = (name) => page.locator(`[data-demo="${name}"]`);
  const dialog = () => page.getByRole("dialog");
  await mount(
    `window.calls=[];window.revokes=[];window.fail=true;window.failRevoke=true;createRoot(document.getElementById('root')).render(<Subject.IntegrationManager onAuthorize={async p=>{window.calls.push(p);if(window.fail)throw Error('access_denied: admin approval required');return {expiresAt:'2027-01-15T09:42:00Z'}}} onDisconnect={async id=>{window.revokes.push(id);if(window.failRevoke)throw Error('Provider unreachable.')}}/>);`,
  );
  // The expired connection opens first, with its problem stated.
  assert.match(await page.getByRole("heading", { name: "Salesforce", exact: true }).innerText(), /Salesforce/);
  assert.match(await page.locator("section").innerText(), /revoked the refresh token/);
  // The consent sheet lists exactly what will flow; an optional scope can be added.
  await d("primary").click();
  await dialog().getByText("Reconnect Salesforce").waitFor();
  await d("scope-sf-cases-read").check();
  await d("authorize").click();
  await dialog().getByRole("alert").filter({ hasText: "access_denied" }).waitFor();
  assert.match(await dialog().innerText(), /3 chosen permissions are kept/);
  // Retry from the failure keeps the same scopes.
  await page.evaluate(() => (window.fail = false));
  await dialog().getByRole("button", { name: "Try again", exact: true }).click();
  await dialog().getByText("Reconnected").waitFor();
  assert.deepEqual(await page.evaluate(() => window.calls[1]), {
    integrationId: "salesforce",
    mode: "reconnect",
    scopes: ["sf-crm-read", "sf-activity-write", "sf-cases-read"],
  });
  assert.match(await dialog().innerText(), /Token valid until 15 Jan 2027/);
  await dialog().getByRole("button", { name: "Done", exact: true }).click();
  await dialog().waitFor({ state: "detached" });
  assert.match(await page.locator("article").innerText(), /Healthy/);
  // Escape closes the sheet and focus returns to the action that opened it.
  await d("primary").click();
  await dialog().waitFor();
  await page.keyboard.press("Escape");
  await dialog().waitFor({ state: "detached" });
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-demo") === "primary");
  // Arrow keys walk the board; problems sort first, so the reconnected app now follows Zendesk.
  await d("tile-zendesk").focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.activeElement?.getAttribute("data-demo") === "tile-salesforce");
  await page.keyboard.press("ArrowRight");
  await page.getByRole("heading", { name: "Snowflake", exact: true }).waitFor();
  // A refused disconnect keeps the app connected; a retry moves it to Available.
  await d("tile-slack").click();
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await d("confirm-disconnect").click();
  await page.getByRole("alert").filter({ hasText: "Provider unreachable" }).waitFor();
  assert.match(await page.locator("footer").innerText(), /still connected/);
  await page.evaluate(() => (window.failRevoke = false));
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await d("confirm-disconnect").click();
  await page.getByRole("button", { name: "Connect Slack", exact: true }).waitFor();
  assert.deepEqual(await page.evaluate(() => window.revokes), ["slack", "slack"]);
  assert.match(await page.getByRole("list", { name: "Available" }).innerText(), /Slack/);

  // Empty and invalid data.
  await mount(`createRoot(document.getElementById('root')).render(<Subject.IntegrationManager integrations={[]}/>);`);
  assert.match(await page.locator("section").innerText(), /No apps to connect/);
  await mount(
    `const a={id:'x',name:'Alpha',category:'CRM',status:'available',scopes:[{id:'r',access:'read',objects:['Rows'],purpose:'Read rows.',required:true}]};createRoot(document.getElementById('root')).render(<Subject.IntegrationManager integrations={[a,{...a,name:'Beta'}]}/>);`,
  );
  assert.match(await page.getByRole("alert").innerText(), /repeats an id/);
  assert.doesNotMatch(await page.locator("section").innerText(), /Beta/);
}
