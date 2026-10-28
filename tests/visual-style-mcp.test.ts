import {describe,expect,it} from "vitest";
import {handleMessage,type Ctx,TOOLS} from "@/lib/mcp";
const anon:Ctx={license:{ok:false,reason:'missing'}};
const paid:Ctx={license:{ok:true,license:{v:1,id:'local-fixture',email:'qa@example.invalid',plan:'pro-lifetime',seats:1,iat:1,exp:null}}};
async function call(name:string,args:Record<string,unknown>,ctx=anon){const r=await handleMessage({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}},ctx) as {result:{content:{text:string}[];isError?:boolean}};return r.result;}
describe('Crayon in MCP',()=>{
 it('advertises paid styles in anonymous discovery',async()=>{const r=await call('search_components',{query:'hero',visualStyle:'crayon'});expect(r.content[0].text).toContain('Crayon (Pro)');expect(r.content[0].text).toContain('hero-swiss-grid');expect(r.content[0].text).not.toContain('DFA_LICENSED_VISUAL_CSS');});
 it('gates style source independently of the free base tier',async()=>{const r=await call('get_component',{slug:'hero-swiss-grid',visualStyle:'crayon'});expect(r.isError).toBe(true);expect(r.content[0].text).toContain('Pro style');expect(r.content[0].text).not.toContain('## Source');});
 it('returns the styled named component, prompt and installation to a paid agent',async()=>{const r=await call('get_component',{slug:'hero-swiss-grid',visualStyle:'crayon'},paid);const t=r.content[0].text;expect(r.isError).not.toBe(true);expect(t).toContain('DFA_LICENSED_VISUAL_CSS');expect(t).toContain('export function HeroSwissGrid');expect(t).toContain('data-dfa-style');expect(t).toContain('@design-for-ai-crayon/hero-swiss-grid');expect(t).toContain('## Crayon visual style (Pro)');expect(t).toContain('Style licence: Pro');});
 it('does not change original free retrieval and refuses unknown styles',async()=>{const free=await call('get_component',{slug:'hero-swiss-grid',include:['code']});expect(free.content[0].text).toContain('## Source');expect(free.content[0].text).not.toContain('DFA_LICENSED_VISUAL_CSS');const invalid=await call('get_component',{slug:'hero-swiss-grid',visualStyle:'unknown'},paid);expect(invalid.isError).toBe(true);});
 it('publishes one consistent style parameter on discovery, retrieval and install tools',()=>{for(const name of ['search_components','get_component','install_command']){const tool=TOOLS.find(t=>t.name===name)!;expect(tool.inputSchema).toMatchObject({properties:{visualStyle:{enum:['original','crayon']}}});}});
 it('retrieves dark Crayon without weakening the source gate or duplicating a theme pack',async()=>{
  const args={slug:'hero-swiss-grid',visualStyle:'crayon',theme:'dark',include:['code','json','install']};
  const locked=await call('get_component',args);expect(locked.isError).toBe(true);expect(locked.content[0].text).not.toContain('DFA_LICENSED_VISUAL_CSS');
  const result=await call('get_component',args,paid);expect(result.isError).not.toBe(true);expect(result.content[0].text).toContain('"appearance": "dark"');expect(result.content[0].text).toContain('json?theme=dark');
  expect((await call('get_component',{...args,theme:'unknown'},paid)).isError).toBe(true);
  for(const name of ['get_component','install_command'])expect(TOOLS.find(t=>t.name===name)!.inputSchema).toMatchObject({properties:{theme:{enum:['light','dark']}}});
 });
});
