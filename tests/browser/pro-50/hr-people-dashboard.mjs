export async function check({page,mount,assert,choose}){
 await mount(`createRoot(document.getElementById('root')).render(<Subject.PeopleDashboard/>);`);
 assert.match(await page.locator('dl').first().innerText(),/People in scope\n6/);assert.match(await page.locator('section').innerText(),/One-year anniversary/);
 await choose(page.getByLabel('Department',{exact:true}), 'Product');assert.match(await page.locator('dl').first().innerText(),/People in scope\n2/);assert.match(await page.locator('section').innerText(),/No milestones in this scope/);
 await page.getByLabel('Search people',{exact:true}).fill('Maya');assert.equal(await page.getByRole('button',{name:/Maya Chen/}).count(),1);assert.match(await page.locator('dl').first().innerText(),/People in scope\n2/);assert.match(await page.getByRole('complementary',{name:'Employee details'}).innerText(),/Avery Kim/);
 await choose(page.getByLabel('Location',{exact:true}), 'Bristol');assert.match(await page.locator('section').innerText(),/No people match/);
 await mount(`createRoot(document.getElementById('root')).render(<Subject.PeopleDashboard referenceDate="2026-02-30"/>);`);assert.match(await page.getByRole('alert').innerText(),/valid reference date/);
}
