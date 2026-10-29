import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const names=['manifest.json','prompt.md','style.css'];
const runtimeNames=['web.ts','native.tsx'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function styleSourcePin(root){
 const file=path.join(root,'registry/style-source.json');
 if(!fs.existsSync(file))return null;
 const pin=JSON.parse(fs.readFileSync(file,'utf8'));
 if(pin.previewVersion!==undefined&&(!Number.isSafeInteger(pin.previewVersion)||pin.previewVersion<2))throw Error('Invalid visual-style preview version');
 if(pin.repository!=='richawo/Design-for-AI'||!/^[a-f0-9]{40}$/.test(pin.commit)||!Array.isArray(pin.files)||![3,5].includes(pin.files.length)||new Set(pin.files.map(f=>f.path)).size!==pin.files.length||names.some(name=>!pin.files.some(f=>f.path==='_styles/crayon/'+name))||pin.files.some(f=>![...names,...runtimeNames].some(name=>f.path==='_styles/crayon/'+name)||!/^[a-f0-9]{64}$/.test(f.sha256)))throw Error('Invalid private visual-style source pin');
 return pin;
}
export function materializeStyleSource(root,privateRoot,pin){
 const blobs=pin.files.map(file=>{
  const bytes=execFileSync('git',['-C',privateRoot,'show',pin.commit+':'+file.path],{maxBuffer:2*1024*1024});
  if(sha(bytes)!==file.sha256)throw Error('Private visual-style source hash mismatch: '+file.path);
  return[file.path.split('/').at(-1),bytes];
 });
 const dir=path.join(root,'registry/__generated__/style-inputs/crayon');fs.mkdirSync(dir,{recursive:true});
 for(const[name,bytes]of blobs){const target=path.join(dir,name);if(fs.existsSync(target)&&fs.readFileSync(target).equals(bytes))continue;const tmp=target+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,bytes);fs.renameSync(tmp,target);}
 return dir;
}
export function loadStylePack(root){
 const pin=styleSourcePin(root);
 const bases=[path.join(root,'registry/__generated__/style-inputs/crayon'),path.join(root,'registry/pro/_styles/crayon')];
 const expected=pin?pin.files.map(file=>path.basename(file.path)):names;
 const base=bases.find(dir=>expected.every(name=>fs.existsSync(path.join(dir,name))));
 if(!base)return null;
 if(pin)for(const file of pin.files)if(sha(fs.readFileSync(path.join(base,path.basename(file.path))))!==file.sha256)throw Error('Visual-style inputs differ from their committed pin');
 const manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.json'),'utf8'));
 if(manifest.id!=='crayon'||manifest.tier!=='pro'||manifest.appearance!=='light')throw Error('Invalid licensed visual-style material');
 if(manifest.version>=2&&(!manifest.themes||['light','dark'].some(theme=>!manifest.themes[theme]||Object.keys(manifest.palette).some(role=>!/^#[a-f0-9]{6}$/i.test(manifest.themes[theme][role]??'')))))throw Error('Licensed visual style requires complete light and dark palettes');
 if(manifest.version>=4&&runtimeNames.some(name=>!expected.includes(name)||!fs.existsSync(path.join(base,name))))throw Error('Licensed drawing material requires pinned web and native runtimes');
 const webRuntime=manifest.version>=4?fs.readFileSync(path.join(base,'web.ts'),'utf8'):null;
 const transform=webRuntime?createRequire(import.meta.url)('esbuild').transformSync:null;
 return {...manifest,css:fs.readFileSync(path.join(base,'style.css'),'utf8'),prompt:fs.readFileSync(path.join(base,'prompt.md'),'utf8'),...(webRuntime?{webRuntime,webModule:transform(webRuntime,{loader:'ts',format:'esm',target:'es2022',sourcefile:'crayon-web.ts'}).code,nativeRuntime:fs.readFileSync(path.join(base,'native.tsx'),'utf8')}:{})};
}
export function styleSourceIdentity(root){
 const pin=styleSourcePin(root);if(!pin)return null;
 const material=loadStylePack(root);
 return {commit:pin.commit,pinSha256:sha(fs.readFileSync(path.join(root,'registry/style-source.json'))),available:Boolean(material)};
}
