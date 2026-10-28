// Build-time only. Premium material lives in the private repository, while
// this public transform preserves the existing component API and behavior.
import {parse} from '@babel/parser';

const domTags = new Set('div section article main form header footer nav aside button a label fieldset ul ol li figure details summary span p input textarea select table h1 h2 h3 h4 h5 h6 em strong b i time svg canvas audio video output dialog picture dl dt dd'.split(' '));
function domRoot(element){
  const name=element.openingElement?.name;
  return name?.type==='JSXIdentifier'&&domTags.has(name.name)||name?.type==='JSXMemberExpression'&&name.object?.name==='motion'&&domTags.has(name.property?.name);
}
function returnedRoots(fn){
  const roots=[];
  const expression=node=>{
    if(!node)return;
    if(node.type==='JSXElement')roots.push(node);
    else if(node.type==='JSXFragment')node.children.forEach(expression);
    else if(node.type==='ConditionalExpression'){expression(node.consequent);expression(node.alternate);}
    else if(node.type==='LogicalExpression')expression(node.right);
    else if(node.type==='ParenthesizedExpression')expression(node.expression);
    else if(node.type==='CallExpression'&&(node.callee?.name==='createPortal'||node.callee?.property?.name==='createPortal'))expression(node.arguments[0]);
  };
  if(fn.type==='ArrowFunctionExpression'&&fn.body.type!=='BlockStatement')expression(fn.body);
  else{
    const walk=node=>{
      if(!node||typeof node!=='object')return;
      if(node!==fn&&['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(node.type))return;
      if(node.type==='ReturnStatement'){expression(node.argument);return;}
      for(const [key,value]of Object.entries(node)){
        if(['loc','start','end','extra','comments'].includes(key))continue;
        if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);
      }
    };walk(fn);
  }
  return roots;
}
export function styleRoots(meta,code){
  if(meta.platform!=='web')return [];
  const ast=parse(code,{sourceType:'module',plugins:['typescript','jsx']});
  const exported=new Set(),definitions=new Map();
  for(const statement of ast.program.body){
    const d=statement.declaration??statement;
    if(d.type==='FunctionDeclaration'&&d.id)definitions.set(d.id.name,d);
    if(d.type==='VariableDeclaration')for(const item of d.declarations)if(item.id?.name)definitions.set(item.id.name,item.init);
    if(statement.type==='ExportNamedDeclaration'){
      if(d.id?.name)exported.add(d.id.name);
      for(const item of d.declarations??[])if(item.id?.name)exported.add(item.id.name);
      for(const item of statement.specifiers??[])if(item.local?.name)exported.add(item.local.name);
    }
    if(statement.type==='ExportDefaultDeclaration'){
      if(d.type==='Identifier')exported.add(d.name);
      else if(d.id?.name)exported.add(d.id.name);
      else definitions.set('__demo',d),exported.add('__demo');
    }
  }
  const roots=[];
  for(const name of exported){
    if(!/^[A-Z]/.test(name)&&name!=='__demo')continue;
    const node=definitions.get(name);if(!node)continue;
    const functions=['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression'].includes(node.type)?[node]:node.type==='CallExpression'?node.arguments.filter(a=>['FunctionExpression','ArrowFunctionExpression'].includes(a.type)):[];
    for(const fn of functions)roots.push(...returnedRoots(fn));
  }
  return [...new Map(roots.map(r=>[r.start,r])).values()];
}

function roleFor(token){
  const s=token.replace(/^--/,'').replace(/([a-z])([A-Z])/g,'$1-$2').toLowerCase();
  if(/(?:^|-)(?:on-ink|on-accent|on|inverse)$/.test(s))return'onInk';
  if(/(?:^|-)(?:border|line|rule|edge|stroke)(?:-(?:hover|strong|soft))?$/.test(s))return'line';
  if(/(?:^|-)(?:bg|background|canvas|page|base|stage|shell)$/.test(s))return'page';
  if(/(?:^|-)(?:surface|panel|card|popover|input|well|field|paper|sunken|glass|tile)$/.test(s))return'surface';
  if(/(?:^|-)(?:raised|elevated|soft)$/.test(s))return'raised';
  if(/(?:^|-)(?:ink|fg|foreground|text|label|heading|title|body)$/.test(s))return'ink';
  if(/(?:^|-)(?:muted|dim|subtle|secondary|faint|sub|placeholder)$/.test(s))return'muted';
  if(/(?:^|-)(?:border|line|rule|edge|stroke)$/.test(s))return'line';
  if(/(?:^|-)(?:accent|active|primary|brand|signal|hot)$/.test(s))return'accent';
  if(/(?:^|-)(?:up|positive|success|good|ok)$/.test(s))return'positive';
  if(/(?:^|-)(?:down|negative|danger|error|err|bad)$/.test(s))return'negative';
  return null;
}
export function materialCss(code,pack){
  const variables=[...new Set([...code.matchAll(/--[a-zA-Z][\w-]*/g)].map(m=>m[0]))];
  const mapped=variables.flatMap(token=>{const role=roleFor(token);return role&&role!=='accent'&&!/on-accent$/.test(token)&&pack.palette[role]?[[token,pack.palette[role]]]:[];});
  const scope='[data-dfa-style="crayon"]';
  const bindings=mapped.map(([token,value])=>scope+','+scope+' [style*="'+token+'"]{'+token+':'+value+'!important}').join('\n');
  return pack.css+'\n'+bindings;
}
export function makeStyledSource(meta,source,pack){
  if(meta.platform==='mobile')return makeNativeStyledSource(meta,source,pack);
  const roots=styleRoots(meta,source.code);if(!roots.length)return null;
  const css=materialCss(source.code,pack),edits=[];
  for(const root of roots){
    const open=root.openingElement;
    if(open.attributes.some(a=>a.name?.name==='data-dfa-style'))throw Error(meta.slug+': existing visual style root');
    const direct=domRoot(root);
    edits.push({at:root.start,text:'<><style>{DFA_LICENSED_VISUAL_CSS}</style>'+(direct?'':'<div data-dfa-style="crayon" style={{display:"contents"}}>')});
    edits.push({at:root.end,text:(direct?'':'</div>')+'</>'});
    if(direct)edits.push({at:open.end-(open.selfClosing?2:1),text:' data-dfa-style="crayon"'});
  }
  edits.sort((a,b)=>b.at-a.at);
  let code=source.code;for(const edit of edits)code=code.slice(0,edit.at)+edit.text+code.slice(edit.at);
  code+='\n\n// Crayon visual style: Design for AI Pro licence. The base component keeps its original licence.\nconst DFA_LICENSED_VISUAL_CSS = '+JSON.stringify(css)+';\n';
  parse(code,{sourceType:'module',plugins:['typescript','jsx']});
  const brief=source.prompt.trim()+'\n\n## Crayon visual style (Pro)\n\n'+pack.prompt.trim();
  const json=JSON.parse(source.promptJson);
  return{...source,code,prompt:brief,promptJson:JSON.stringify({...json,visualStyle:{id:'crayon',tier:'pro',appearance:pack.appearance,typography:pack.font,palette:pack.palette,preserve:'Component API, callbacks, content, semantic controls and reduced motion.'}},null,2),visualStyle:'crayon',styleCss:css,font:pack.font};
}

// React Native variants keep native primitives and callbacks. No DOM wrappers,
// CSS tags or web-only dependencies are introduced into downloadable source.
function makeNativeStyledSource(meta,source,pack){
 const ast=parse(source.code,{sourceType:'module',plugins:['typescript','jsx']}),edits=[];
 const neutral=value=>{
  let rgb;
  if(/^#[a-f0-9]{3,8}$/i.test(value)){let hex=value.slice(1);if(hex.length===3||hex.length===4)hex=hex.split('').map(c=>c+c).join('');rgb=[0,2,4].map(at=>parseInt(hex.slice(at,at+2),16));}
  else if(/^rgba?\(/.test(value))rgb=value.match(/[\d.]+/g)?.slice(0,3).map(Number);
  return rgb?.length===3&&Math.max(...rgb)-Math.min(...rgb)<22;
 };
 const font='DFAStylePlatform.select({ios:"Chalkboard SE",android:"casual",default:"DFA Crayon"}) ?? "System"';
 const walk=node=>{
  if(!node||typeof node!=='object')return;
  if(node.type==='ObjectProperty'){
   const key=node.key?.name??node.key?.value,value=node.value;
   if(['colors','image','art'].includes(key))return;
   if(['card','chip','control'].includes(key)&&value?.type==='ArrayExpression')for(const item of value.elements)if(item?.type==='StringLiteral'&&neutral(item.value))edits.push({at:item.start,end:item.end,text:JSON.stringify(pack.palette.surface)});
   if(typeof key==='string'&&value?.type==='StringLiteral'&&neutral(value.value)){
    const role=key==='backgroundColor'?'surface':key==='ground'?'page':key==='soft'?'muted':key==='borderColor'?'line':key==='color'?'ink':roleFor('--'+key);
    if(role&&role!=='accent'&&key!=='shadowColor'&&pack.palette[role])edits.push({at:value.start,end:value.end,text:JSON.stringify(pack.palette[role])});
   }
  }
  if(node.type==='ObjectExpression'){
   const properties=node.properties.filter(p=>p.type==='ObjectProperty');
   const size=properties.find(p=>(p.key.name??p.key.value)==='fontSize')?.value;
   if(size?.type==='NumericLiteral'&&size.value>=22){
    const family=properties.find(p=>(p.key.name??p.key.value)==='fontFamily');
    if(family&&!/mono|code/i.test(source.code.slice(family.value.start,family.value.end)))edits.push({at:family.value.start,end:family.value.end,text:font});
    else if(!family){const comma=source.code.slice(node.start,node.end-1).trimEnd().endsWith(',')?'':',';edits.push({at:node.end-1,end:node.end-1,text:comma+'fontFamily: '+font});}
   }
  }
  for(const[key,value]of Object.entries(node))if(!['loc','extra','comments'].includes(key)){if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}
 };
 walk(ast.program);edits.sort((a,b)=>b.at-a.at);let code=source.code;
 for(const e of edits)code=code.slice(0,e.at)+e.text+code.slice(e.end);
 code+='\n\n// Crayon visual style: Design for AI Pro. Native primitives and component API are preserved.\nimport {Platform as DFAStylePlatform} from "react-native";\n';
 parse(code,{sourceType:'module',plugins:['typescript','jsx']});
 const nativeBrief=pack.prompt+'\n\nReact Native: retain native views, gestures and callbacks. Use the paper palette. Heading fallbacks use Chalkboard SE on iOS and casual on Android. Load the included Caveat font as DFA Crayon for identical custom typography if the host app supports custom fonts.';
 return{...source,code,prompt:source.prompt.trim()+'\n\n## Crayon visual style (Pro)\n\n'+nativeBrief,promptJson:JSON.stringify({...JSON.parse(source.promptJson),visualStyle:{id:'crayon',tier:'pro',platform:'mobile',palette:pack.palette,typography:pack.font}},null,2),visualStyle:'crayon',styleCss:materialCss(source.code,pack),font:pack.font};
}
