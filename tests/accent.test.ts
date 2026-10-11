import vm from "node:vm";
import { expect, it } from "vitest";
import { ACCENT_BOOTSTRAP, ACCENT_KEY, accentInk, parseAccent } from "@/lib/accent";
import { previewAccent } from "@/lib/preview-accent";

it("accepts arbitrary hex colours without accepting CSS or script", () => {
  expect(parseAccent(" #AbC ")).toBe("#aabbcc");
  expect(parseAccent("#0012aF")).toBe("#0012af");
  for (const invalid of [null, {}, "red", "#12345678", "#12345z", "#fff; color:red", "</style>"]) expect(parseAccent(invalid)).toBeNull();
});
it("chooses contrasting ink on either extreme", () => {
  expect(accentInk("#000000")).toBe("#ffffff");
  expect(accentInk("#ffffff")).toBe("#000000");
  expect(accentInk("#ff7a45")).toBe("#000000");
});
it("restores the colour before paint and tolerates unavailable storage", () => {
  const values = new Map();
  vm.runInNewContext(ACCENT_BOOTSTRAP, {localStorage:{getItem:(key:string)=>key === ACCENT_KEY ? "#123abc":null},document:{documentElement:{style:{setProperty:(key:string,value:string)=>values.set(key,value)}}}});
  expect(values.get("--color-site-accent")).toBe("#123abc");
  expect(values.get("--color-site-on-accent")).toBe("#ffffff");
  expect(() => vm.runInNewContext(ACCENT_BOOTSTRAP, {localStorage:{getItem:()=>{throw Error("blocked");}}})).not.toThrow();
});
it("maps brand properties and CSS tokens without remapping semantic colours", () => {
  expect(previewAccent('"--rd-accent": "#123456", "--rd-error": "#ff0000"', [{prop:"accent",label:"Accent",kind:"color",default:"#123456"}], [])).toEqual({prop:"accent",variables:["--rd-accent"]});
  expect(previewAccent('"--accent"', [], [{name:"accent",type:"string",description:"Brand colour"}])).toEqual({prop:"accent",variables:["--accent"]});
  expect(previewAccent('"--success"; "--error"; "--up"; "--down"', [{prop:"errorColor",kind:"color",label:"Error",default:"#ff0000"}], [])).toEqual({prop:undefined,variables:[]});
});
