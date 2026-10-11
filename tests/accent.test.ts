import { afterEach, expect, it, vi } from "vitest";
import { ACCENT_KEY, accentInk, parseAccent } from "@/lib/accent";
import { previewAccent } from "@/lib/preview-accent";

afterEach(() => vi.unstubAllGlobals());
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
it("keeps existing preview preferences and synchronizes changes without touching site styles", async () => {
  vi.resetModules();
  const values = new Map([[ACCENT_KEY, "#123abc"]]);
  const postMessage = vi.fn();
  vi.stubGlobal("localStorage", { getItem: (key:string) => values.get(key), setItem: (key:string,value:string) => values.set(key,value), removeItem: (key:string) => values.delete(key) });
  vi.stubGlobal("window", { dispatchEvent: vi.fn(), location: {origin:"https://design.yaps.ai"} });
  vi.stubGlobal("document", {
    get documentElement() { throw Error("A preview preference must not change site styles"); },
    querySelectorAll: () => [{contentWindow:{postMessage}}],
  });
  const { readAccent, setAccent } = await import("@/lib/accent-client");
  expect(readAccent()).toBe("#123abc");
  setAccent("#abc");
  expect(values.get(ACCENT_KEY)).toBe("#aabbcc");
  expect(readAccent()).toBe("#aabbcc");
  expect(postMessage).toHaveBeenLastCalledWith({channel:"dfa-accent-change",accent:"#aabbcc"}, "https://design.yaps.ai");
  setAccent(null);
  expect(values.has(ACCENT_KEY)).toBe(false);
  expect(readAccent()).toBeNull();
  expect(postMessage).toHaveBeenLastCalledWith({channel:"dfa-accent-change",accent:null}, "https://design.yaps.ai");
});
it("allows a session preview colour when browser storage is unavailable", async () => {
  vi.resetModules();
  const blocked = () => { throw Error("blocked"); };
  vi.stubGlobal("localStorage", {getItem:blocked,setItem:blocked,removeItem:blocked});
  vi.stubGlobal("window", {dispatchEvent:vi.fn(),location:{origin:"https://design.yaps.ai"}});
  vi.stubGlobal("document", {querySelectorAll:()=>[]});
  const { readAccent, setAccent } = await import("@/lib/accent-client");
  expect(readAccent()).toBeNull();
  setAccent("#3366cc");
  expect(readAccent()).toBe("#3366cc");
  setAccent(null);
  expect(readAccent()).toBeNull();
});
it("maps brand properties and CSS tokens without remapping semantic colours", () => {
  expect(previewAccent('"--rd-accent": "#123456", "--rd-error": "#ff0000"', [{prop:"accent",label:"Accent",kind:"color",default:"#123456"}], [])).toEqual({prop:"accent",variables:["--rd-accent"]});
  expect(previewAccent('"--accent"', [], [{name:"accent",type:"string",description:"Brand colour"}])).toEqual({prop:"accent",variables:["--accent"]});
  expect(previewAccent('"--success"; "--error"; "--up"; "--down"', [{prop:"errorColor",kind:"color",label:"Error",default:"#ff0000"}], [])).toEqual({prop:undefined,variables:[]});
});
