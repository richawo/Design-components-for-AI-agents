import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {loadBlogSource,corpusUnits,readJson,stableSlugs} from '/Users/richardawoyemi/ai-prototypes/design-components-for-ai-agents/scripts/lib/blog-source.mjs';
import {encode,SEPARATOR,splitBatch} from '/Users/richardawoyemi/ai-prototypes/design-components-for-ai-agents/scripts/lib/translation-tokens.mjs';
import {isUntouched,protectedIntact} from '/Users/richardawoyemi/ai-prototypes/design-components-for-ai-agents/scripts/lib/translation-quality.mjs';
import {LOCALES} from '/Users/richardawoyemi/ai-prototypes/design-components-for-ai-agents/lib/blog/locales.mjs';

function numberedParts(output,count){
 const marks=[...output.matchAll(/ZXQ([0-9]{3})QXZ/gi)];
 if(marks.length!==count||new Set(marks.map(m=>Number(m[1]))).size!==count)return null;
 const parts=Array(count).fill(null);
 for(let i=0;i<marks.length;i++){const id=Number(marks[i][1]);if(id>=count)return null;parts[id]=output.slice(marks[i].index+marks[i][0].length,i+1<marks.length?marks[i+1].index:output.length).trim();}
 return parts.every(Boolean)?parts:null;
}

const source=loadBlogSource('/Users/richardawoyemi/ai-prototypes/design-components-for-ai-agents');
const keys=corpusUnits(source),queue=[],token=crypto.randomBytes(12).toString('hex');
const dictionaries={};let serial=0,done=0,accepted=0;
function save(locale){
 const file=path.join(source.base,'i18n','strings',locale.code+'.json');
 const d=dictionaries[locale.code];
 fs.writeFileSync(file,JSON.stringify(Object.fromEntries(keys.filter(k=>d[k]).map(k=>[k,d[k]])),null,2)+'\n');
 if(keys.every(k=>d[k])){
  const slugFile=path.join(source.base,'i18n','slugs',locale.code+'.json');
  fs.writeFileSync(slugFile,JSON.stringify(stableSlugs(source,locale,d,readJson(slugFile)),null,2)+'\n');
 }
}
function job(locale,group,attempt=0){return {id:String(serial++),locale:locale.code,target:locale.translateAs,language:locale.name,text:group.length===1?encode(group[0]).text:group.map((k,i)=>'ZXQ'+String(i).padStart(3,'0')+'QXZ\n'+encode(k).text).join('\n\n'),group,attempt}}
for(const locale of LOCALES.filter(l=>l.code!=='en')){
 const d=readJson(path.join(source.base,'i18n','strings',locale.code+'.json'));dictionaries[locale.code]=d;
 const missing=keys.filter(k=>!d[k]||isUntouched(k,d[k])||!protectedIntact(k,d[k]));
 let group=[],size=0;
 for(const key of missing){const n=encode(key).text.length+18;if(group.length&&size+n>3900){queue.push(job(locale,group));group=[];size=0}group.push(key);size+=n}
 if(group.length)queue.push(job(locale,group));
}
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function render(status='Ready'){
 const next=queue[0];const view=next?{id:next.id,locale:next.locale,target:next.target,language:next.language,text:next.text}:null;
 return '<!doctype html><html><head><title>Blog translation workbench</title><style>body{font:16px system-ui;max-width:900px;margin:40px auto}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eee;padding:16px}textarea{width:100%;height:160px}input{display:block}</style></head><body><h1>Blog translation workbench</h1><section aria-label="Status"><p>'+escape(status)+'; '+done+' batches completed; '+accepted+' units saved; '+queue.length+' batches remaining.</p></section><section aria-label="Work item"><pre>'+escape(JSON.stringify(view))+'</pre></section><form method="POST" action="/'+token+'/result"><label>Job ID<input name="job" aria-label="Job ID"></label><label>Translation result<textarea name="result" aria-label="Translation result"></textarea></label><button>Save translation</button></form></body></html>'
}
http.createServer((req,res)=>{
 if(!req.url.startsWith('/'+token)){res.writeHead(404);return res.end('Not found')}
 const respond=status=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'"});res.end(render(status))};
 if(req.method==='GET')return respond();
 if(req.method!=='POST'||req.headers.origin!=='http://127.0.0.1:8786'){res.writeHead(403);return res.end('Forbidden')}
 let body='';req.on('data',chunk=>{body+=chunk;if(body.length>200000)req.destroy()});req.on('end',()=>{
  const fields=new URLSearchParams(body),task=queue[0];
  if(!task||fields.get('job')!==task.id)return respond('Wrong job; nothing saved');
  const output=fields.get('result')||'',parts=task.group.length===1?[output]:numberedParts(output,task.group.length);
  const failures=[];
  for(let i=0;i<task.group.length;i++){
   const key=task.group[i],restored=parts?encode(key).restore(parts[i]):null;
   if(!restored||isUntouched(key,restored)||!protectedIntact(key,restored)||/\[\[\[|\]\]\]/.test(restored))failures.push(key);
   else {dictionaries[task.locale][key]=restored.replace(/\s*\u2014\s*/g,': ');accepted++}
  }
  if(task.group.length===1&&failures.length&&task.attempt>=2)return respond('Needs manual repair; result rejected');
  queue.shift();done++;const locale=LOCALES.find(l=>l.code===task.locale);save(locale);
  if(failures.length)queue.unshift(...failures.map(k=>job(locale,[k],task.attempt+1)));
  respond(failures.length?'Accepted valid units; retrying '+failures.length+' failed units':'Accepted');
 });
}).listen(8786,'127.0.0.1',()=>console.log('http://127.0.0.1:8786/'+token+' | '+queue.length+' batches queued'));
