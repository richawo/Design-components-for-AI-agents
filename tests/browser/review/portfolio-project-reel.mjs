export async function check({ page, mount, assert }) {
  await mount(`window.reelProjects=[];const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><path fill="#555" d="M0 0h600v400H0z"/><path fill="#bbb" d="M150 100h300v200H150z"/></svg>');createRoot(document.getElementById('root')).render(<Subject.PortfolioProjectReel projects={[1,2,3].map(n=>({id:'project-'+n,client:'Studio '+n,title:'Project '+n,discipline:'Design',year:'2026',summary:'A complete local case study '+n,image,imageAlt:'Monochrome project '+n,results:[]}))} defaultProject="project-1" onProjectChange={id=>window.reelProjects.push(id)}/>);`);
  const next = page.locator('[data-demo="reel-next"]');
  await next.focus();
  await next.press('Space');
  await page.waitForFunction(() => window.reelProjects.at(-1) === 'project-2');
  await next.press('Enter');
  await page.waitForFunction(() => window.reelProjects.at(-1) === 'project-3');
  assert.equal(await next.isDisabled(), true);
  const track = page.locator('[aria-label="Projects. Use the arrow keys to move between them."]');
  await track.focus();
  await track.press('ArrowLeft');
  await page.waitForFunction(() => window.reelProjects.at(-1) === 'project-2');
  assert.equal(await track.evaluate(node => node === document.activeElement), true);
  await track.press('Home');
  await page.waitForFunction(() => window.reelProjects.at(-1) === 'project-1');
  await mount(`createRoot(document.getElementById('root')).render(<Subject.PortfolioProjectReel projects={[]}/>);`);
  assert.equal(await page.locator('[data-demo^="card-"]').count(), 0);
  assert.equal(await page.locator('[data-demo="reel-next"]:enabled').count(), 0);
}
