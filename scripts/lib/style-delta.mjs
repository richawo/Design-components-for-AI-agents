import {createHash} from "node:crypto";

const hash=code=>createHash("sha256").update(code).digest("hex");
export function packStyleSource(base,variant){
 if(!Array.isArray(variant.codeEdits))throw new Error("Styled source is missing its compiled edits");
 const delta={
  format:"dfa-style-delta-v1",slug:base.slug,baseCodeSha256:hash(base.code),
  codeEdits:variant.codeEdits,promptSuffix:variant.prompt.slice(base.prompt.trim().length),
  visualStyle:JSON.parse(variant.promptJson).visualStyle,styleCss:variant.styleCss,font:variant.font,
 };
 const restored=restoreStyleSource(base,delta);
 for(const field of ["code","prompt","promptJson"])if(restored[field]!==variant[field])throw new Error("Compiled style does not restore exactly: "+base.slug+" "+field);
 return delta;
}
export function restoreStyleSource(base,delta){
 if(delta.format!=="dfa-style-delta-v1"||delta.slug!==base.slug||hash(base.code)!==delta.baseCodeSha256)throw new Error("Styled source does not match its component source");
 let code=base.code;
 for(const edit of [...delta.codeEdits].sort((a,b)=>b.at-a.at)){
  if(!Number.isInteger(edit.at)||!Number.isInteger(edit.end)||edit.at<0||edit.end<edit.at||edit.end>base.code.length||typeof edit.text!=="string")throw new Error("Invalid compiled style edit");
  code=code.slice(0,edit.at)+edit.text+code.slice(edit.end);
 }
 return{...base,code,prompt:base.prompt.trim()+delta.promptSuffix,promptJson:JSON.stringify({...JSON.parse(base.promptJson),visualStyle:delta.visualStyle},null,2),visualStyle:delta.visualStyle.id,styleCss:delta.styleCss,font:delta.font};
}
