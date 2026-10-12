import assert from 'node:assert/strict';
import {launchChromium} from '../../scripts/lib/browser.mjs';
import {mountFixture} from '../../scripts/lib/component-fixture.mjs';
const browser=await launchChromium();const page=await browser.newPage({reducedMotion:'reduce'});
try{
 await mountFixture(page,'pixel-matrix-display','free',`function Fixture(){const [visible,setVisible]=useState(true);window.hide=()=>setVisible(false);return visible ? <Subject.PixelMatrixDisplay/> : <p>Unmounted</p>};createRoot(document.getElementById('root')).render(<Fixture/>);`);
 await page.evaluate(()=>{window.stopped=0;window.contexts=0;Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:()=>new Promise(resolve=>{window.resolveMic=()=>resolve({getTracks:()=>[{stop:()=>window.stopped++}]});})}});window.AudioContext=class{constructor(){window.contexts++}};});
 await page.getByRole('button',{name:'Drive the equaliser with your microphone'}).click();
 await page.evaluate(()=>window.hide());await page.getByText('Unmounted',{exact:true}).waitFor();
 await page.evaluate(()=>window.resolveMic());
 assert.equal(await page.evaluate(()=>window.stopped),1,'late permission result releases the microphone');
 assert.equal(await page.evaluate(()=>window.contexts),0,'unmounted visualizer never opens an audio context');
 console.log('PASS late microphone permission cleanup');
}finally{await browser.close()}
