// Build-only reuse. No filesystem or cache state enters the Worker runtime.
import {createHash} from "node:crypto";
import {packContent,unpackContent} from "./content-pack.mjs";

const sha=value=>createHash("sha256").update(value).digest("hex");
export function packCachedContent(content,{previous=null,receipt=null,codecIdentity,encode=packContent}={}){
  if(typeof codecIdentity!=="string"||!codecIdentity)throw Error("A content encoder identity is required");
  const serialized=JSON.stringify(content),inputSha256=sha(serialized);
  if(previous&&receipt?.version===1&&receipt.inputSha256===inputSha256&&receipt.codecIdentity===codecIdentity){
    try{
      const packedSha256=sha(JSON.stringify(previous));
      if(receipt.packedSha256===packedSha256&&JSON.stringify(unpackContent(previous))===serialized)return{packed:previous,receipt,reused:true};
    }catch{/* Damaged cache data is rebuilt from the current authoritative inputs. */}
  }
  const packed=encode(content);
  return{packed,receipt:{version:1,inputSha256,codecIdentity,packedSha256:sha(JSON.stringify(packed))},reused:false};
}
