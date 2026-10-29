import {createHash} from "node:crypto";

const hash=code=>createHash("sha256").update(code).digest("hex");
export function sharedStyleText(material){
 if(!material?.webRuntime)return null;
 return {css:material.css,cssLiteral:JSON.stringify(material.css).slice(1,-1),web:material.webRuntime,webBody:material.webRuntime.replace(/^export /m,''),webModule:material.webModule,native:material.nativeRuntime,nativeBody:material.nativeRuntime?.replace(/^export /gm,''),prompt:material.prompt};
}
function encodeText(text,shared){
 if(typeof text!=="string"||!shared)return text;
 const candidates=Object.entries(shared).filter(([,value])=>typeof value==="string"&&value.length>=32).sort((a,b)=>b[1].length-a[1].length),parts=[];let at=0;
 while(at<text.length){
  let next=null;for(const[key,value]of candidates){const found=text.indexOf(value,at);if(found>=0&&(!next||found<next.at))next={at:found,key,value};}
  if(!next){parts.push(text.slice(at));break;}
  if(next.at>at)parts.push(text.slice(at,next.at));parts.push({ref:next.key});at=next.at+next.value.length;
 }
 return parts.some(part=>typeof part!=="string")?{parts}:text;
}
function decodeText(value,shared){
 if(typeof value==="string")return value;
 if(!value||!Array.isArray(value.parts)||!shared)throw Error("Missing shared style text");
 return value.parts.map(part=>{if(typeof part==="string")return part;if(!part||Object.keys(part).length!==1||typeof part.ref!=="string"||!Object.hasOwn(shared,part.ref)||typeof shared[part.ref]!=="string")throw Error("Invalid shared style reference");return shared[part.ref];}).join("");
}
export function packStyleSource(base,variant,shared=null){
 if(!Array.isArray(variant.codeEdits))throw new Error("Styled source is missing its compiled edits");
 const delta={
  format:shared?"dfa-style-delta-v2":"dfa-style-delta-v1",slug:base.slug,baseCodeSha256:hash(base.code),
  codeEdits:variant.codeEdits.map(edit=>({...edit,text:encodeText(edit.text,shared)})),promptSuffix:encodeText(variant.prompt.slice(base.prompt.trim().length),shared),
  visualStyle:JSON.parse(variant.promptJson).visualStyle,styleCss:encodeText(variant.styleCss,shared),font:variant.font,
  ...(shared?{sharedSha256:hash(JSON.stringify(shared))}:{}),
  ...(variant.styleRuntime?{styleRuntime:encodeText(variant.styleRuntime,shared),styleRuntimeSha256:variant.styleRuntimeSha256,styleOptions:variant.styleOptions}:{}),
 };
 const restored=restoreStyleSource(base,delta,shared);
 for(const field of ["code","prompt","promptJson"])if(restored[field]!==variant[field])throw new Error("Compiled style does not restore exactly: "+base.slug+" "+field);
 return delta;
}
export function restoreStyleSource(base,delta,shared=null){
 if(!["dfa-style-delta-v1","dfa-style-delta-v2"].includes(delta.format)||delta.slug!==base.slug||hash(base.code)!==delta.baseCodeSha256)throw new Error("Styled source does not match its component source");
 if(delta.format==="dfa-style-delta-v2"&&(!shared||hash(JSON.stringify(shared))!==delta.sharedSha256))throw Error("Styled source does not match its shared material");
 let code=base.code;
 for(const edit of [...delta.codeEdits].sort((a,b)=>b.at-a.at)){
  if(!Number.isInteger(edit.at)||!Number.isInteger(edit.end)||edit.at<0||edit.end<edit.at||edit.end>base.code.length)throw new Error("Invalid compiled style edit");
  code=code.slice(0,edit.at)+decodeText(edit.text,shared)+code.slice(edit.end);
 }
 return{...base,code,prompt:base.prompt.trim()+decodeText(delta.promptSuffix,shared),promptJson:JSON.stringify({...JSON.parse(base.promptJson),visualStyle:delta.visualStyle},null,2),visualStyle:delta.visualStyle.id,styleCss:decodeText(delta.styleCss,shared),font:delta.font,...(delta.styleRuntime?{styleRuntime:decodeText(delta.styleRuntime,shared),styleRuntimeSha256:delta.styleRuntimeSha256,styleOptions:delta.styleOptions}:{})};
}
