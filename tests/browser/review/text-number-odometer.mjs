// Exact formatting, keyboard periods, live reduced motion and invalid formatter fallback.
export async function check({page,mount,assert}) {
 await page.emulateMedia({reducedMotion:'reduce'});
 await mount(`function Host(){const[value,setValue]=React.useState(-1234.5);window.setAmount=setValue;return <p id="amount" style={{fontSize:48}}><Subject.TextNumberOdometer value={value} currency="GBP" locale="en-GB" live prefix="Balance: " suffix=" net"/></p>};createRoot(document.getElementById('root')).render(<Host/>);`);
 const spoken=()=>page.locator('#amount .sr-only').innerText();
 assert.equal(await spoken(),'Balance: '+new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(-1234.5)+' net');
 assert.equal(await page.locator('#amount [aria-live="polite"]').count(),1);
 for(const value of [0,10000.01,-0.25]){await page.evaluate(value=>window.setAmount(value),value);await page.waitForFunction(expected=>document.querySelector('#amount .sr-only')?.textContent===expected,'Balance: '+new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(value)+' net');}
 await mount(`createRoot(document.getElementById('root')).render(<Subject.default/>);`);
 const seven=page.getByRole('radio',{name:'7D',exact:true});await seven.focus();await seven.press('Enter');
 assert.equal(await seven.getAttribute('aria-checked'),'true');
 assert.equal(await page.locator('[data-demo="volume"] .sr-only').innerText(),new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(312906.45));
 await seven.press('ArrowRight');assert.equal(await page.getByRole('radio',{name:'30D',exact:true}).getAttribute('aria-checked'),'true');
 assert.equal(await page.getByRole('radio',{name:'30D',exact:true}).evaluate(node=>node===document.activeElement),true);
 assert.equal(await page.locator('[data-demo="volume"] .sr-only').innerText(),new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(1284330.12));
 await page.emulateMedia({reducedMotion:'no-preference'});
 await mount(`createRoot(document.getElementById('root')).render(<p id="delayed" style={{fontSize:48}}><Subject.TextNumberOdometer value={100} from={0} delay={5000} currency="GBP" locale="en-GB"/></p>);`);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForFunction(()=>document.querySelector('#delayed [data-value]')?.getAttribute('data-value')==='£100.00',{}, {timeout:700});
 await mount(`createRoot(document.getElementById('root')).render(<p id="fallback"><Subject.TextNumberOdometer value={1234.5} locale="not_a_locale" currency="!"/></p>);`);
 assert.doesNotMatch(await page.locator('#fallback .sr-only').innerText(),/NaN|Infinity|undefined/);
 assert.equal(await page.locator('#fallback .sr-only').innerText(),new Intl.NumberFormat('en-GB').format(1234.5));
}
