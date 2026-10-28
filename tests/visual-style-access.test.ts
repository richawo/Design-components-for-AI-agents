import { beforeEach,describe,expect,it,vi } from "vitest";
const f=vi.hoisted(()=>({license:vi.fn(),source:vi.fn()}));
vi.mock('@/lib/registry',()=>({getComponent:(slug:string)=>slug==='missing'?undefined:{slug,name:'Example',theme:'light',props:[],controls:[],usage:'<Example/>',tier:slug==='paid'?'pro':'free',platform:'web',dependencies:[],visualStyles:slug==='unsupported'?['original']:['original','crayon']}}));
vi.mock('@/lib/commerce/licences',()=>({requireCommerceLicense:f.license}));
vi.mock('@/lib/visual-style-source',()=>({readVisualSource:f.source,styleRegistryItem:(_e:unknown,s:unknown)=>({source:s})}));
vi.mock('@/lib/highlight',()=>({highlight:async(s:string)=>s}));
import {GET as source} from '@/app/api/pro/source/[slug]/route';
import {GET as registry} from '@/app/api/registry/[slug]/route';
import {GET as preview} from '@/app/api/styles/[slug]/route';
import {GET as install} from '@/app/r/styles/crayon/[slug]/route';
beforeEach(()=>{vi.resetAllMocks();f.license.mockResolvedValue({ok:false,reason:'missing'});f.source.mockResolvedValue({code:'PRIVATE_CODE',prompt:'PRIVATE_BRIEF',promptJson:'{}',styleCss:'PRIVATE_CSS',font:{family:'Hand',url:'/font.woff2',weight:'400 700'}})});
const req=(path:string)=>new Request('https://design.yaps.ai'+path);
const params=(slug='free')=>({params:Promise.resolve({slug})});
describe('style entitlement is separate from component tier',()=>{
 it('never serves Crayon code or preview material anonymously, including on a free component',async()=>{
  for(const[handler,path]of [[source,'/api/pro/source/free?visualStyle=crayon'],[registry,'/api/registry/free?visualStyle=crayon'],[preview,'/api/styles/free']] as const){const response=await handler(req(path),params());expect(await response.text()).not.toMatch(/PRIVATE_(CODE|BRIEF|CSS)/);expect(response.headers.get('Cache-Control')).toContain('no-store');}
  expect(f.source).not.toHaveBeenCalled();
 });
 it.each(['expired','revoked','signature'])('rejects %s licences before loading material',async(reason)=>{f.license.mockResolvedValue({ok:false,reason});expect((await registry(req('/api/registry/free?visualStyle=crayon'),params())).status).toBe(403);expect(f.source).not.toHaveBeenCalled();});
 it('returns licensed variants to paid users with private caching',async()=>{f.license.mockResolvedValue({ok:true});for(const[handler,path]of [[source,'/api/pro/source/free?visualStyle=crayon'],[registry,'/api/registry/free?visualStyle=crayon'],[preview,'/api/styles/free']] as const){const response=await handler(req(path),params());expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('private, no-store');}expect(f.source).toHaveBeenCalledWith('free','crayon');});
 it('keeps original free source available and rejects unsupported style requests',async()=>{expect((await registry(req('/api/registry/free'),params())).status).toBe(200);expect(f.license).not.toHaveBeenCalled();f.source.mockClear();expect((await registry(req('/api/registry/free?visualStyle=anything'),params())).status).toBe(400);expect((await registry(req('/api/registry/unsupported?visualStyle=crayon'),params('unsupported'))).status).toBe(400);expect(f.source).not.toHaveBeenCalled();});
 it('protects the install route even for a free base and rejects malformed paths',async()=>{expect((await install(req('/r/styles/crayon/free.json'),params('free.json'))).status).toBe(401);expect(f.source).not.toHaveBeenCalled();expect((await install(req('/r/styles/crayon/invalid'),params('../free'))).status).toBe(404);f.license.mockResolvedValue({ok:true});const response=await install(req('/r/styles/crayon/free.json'),params('free.json'));expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('private, no-store');});
 it('retains paid source guards for either theme and passes a validated installation default',async()=>{
  for(const [handler,path] of [[source,'/api/pro/source/free?visualStyle=crayon&theme=dark'],[registry,'/api/registry/free?visualStyle=crayon&theme=dark'],[install,'/r/styles/crayon/free.json?theme=dark']] as const){
   const p=path.startsWith('/r/')?params('free.json'):params();
   expect(await (await handler(req(path),p)).text()).not.toContain('PRIVATE_CODE');
   expect(f.source).not.toHaveBeenCalled();
   f.license.mockResolvedValue({ok:true});
   const response=await handler(req(path),p);expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toBe('private, no-store');
   expect(f.source).toHaveBeenLastCalledWith('free','crayon','dark');
   if(path.startsWith('/api/registry/'))expect((await response.json()).theme).toBe('dark');
   f.source.mockClear();f.license.mockResolvedValue({ok:false,reason:'missing'});
  }
  expect((await registry(req('/api/registry/free?visualStyle=crayon&theme=unexpected'),params())).status).toBe(400);
  expect(f.source).not.toHaveBeenCalled();
 });
});
