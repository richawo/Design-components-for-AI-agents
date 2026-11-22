import type {PackedContent} from "./content-pack.mjs";
export interface ContentPackReceipt {
  version:1;
  inputSha256:string;
  codecIdentity:string;
  packedSha256:string;
}
export function packCachedContent<T = PackedContent>(content:unknown,options?:{
  previous?:unknown;
  receipt?:Partial<ContentPackReceipt>|null;
  codecIdentity?:string;
  encode?:(content:unknown)=>T;
}):{packed:T;receipt:ContentPackReceipt;reused:boolean};
