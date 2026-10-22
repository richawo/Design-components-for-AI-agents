import {describe,it,expect} from "vitest";
import {validatePublicationBuildReceipt,BUILD_CHECKS} from "../scripts/lib/publication-build.mjs";
const identity={publicCommit:"a",privateCommit:"b",sourceInputsSha256:"c",rulebookSha256:"d",requestSha256:"e"};
const receipt=()=>({version:1,node:"v24.19.0",identity,finishedAt:"2026-10-22T10:00:00Z",checks:BUILD_CHECKS.map(id=>({id,exitCode:0}))});
describe("pre-deployment production receipts",()=>{
 it("accepts the completed matching check sequence",()=>expect(validatePublicationBuildReceipt(receipt(),identity)).toBeTruthy());
 it("refuses changed sources, rulebook or request after a successful build",()=>{for(const field of Object.keys(identity))expect(()=>validatePublicationBuildReceipt(receipt(),{...identity,[field]:"changed"})).toThrow("stale")});
 it("refuses failed, omitted, repeated or out-of-order check stages",()=>{for(const modify of [(r:ReturnType<typeof receipt>)=>r.checks[2].exitCode=1,(r:ReturnType<typeof receipt>)=>r.checks.pop(),(r:ReturnType<typeof receipt>)=>r.checks[1].id=r.checks[0].id,(r:ReturnType<typeof receipt>)=>r.checks.reverse()]){const r=receipt();modify(r);expect(()=>validatePublicationBuildReceipt(r,identity)).toThrow("did not pass")}});
 it("refuses an unsupported execution runtime",()=>expect(()=>validatePublicationBuildReceipt({...receipt(),node:"v22.0.0"},identity)).toThrow("missing or stale"));
});
