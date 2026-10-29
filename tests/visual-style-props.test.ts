import {describe,expect,it} from "vitest";
import {materialDefaultProps} from "../lib/visual-style-props";
describe("material defaults",()=>{
 const defaults=JSON.stringify([{prop:"inkA",role:"ink",value:"#ededef"},{prop:"inkB",role:"page",value:"#0b0b0c"}]);
 it("updates canvas inks with the selected palette, including initial control defaults",()=>{
  expect(materialDefaultProps(defaults,{ink:"#171719",page:"#fafafa"},{inkA:"#ededef",inkB:"#0b0b0c"})).toEqual({inkA:"#171719",inkB:"#fafafa"});
  expect(materialDefaultProps(defaults,{ink:"#ededef",page:"#000000"},{})).toEqual({inkA:"#ededef",inkB:"#000000"});
 });
 it("preserves a caller's edited ink and ignores malformed settings",()=>{
  expect(materialDefaultProps(defaults,{ink:"#171719",page:"#fafafa"},{inkA:"#a03b27"})).toEqual({inkB:"#fafafa"});
  expect(materialDefaultProps("broken",{},{})).toEqual({});
  expect(materialDefaultProps('[{"prop":"__proto__","role":"ink"}]',{ink:"#171719"},{})).toEqual({});
 });
});
