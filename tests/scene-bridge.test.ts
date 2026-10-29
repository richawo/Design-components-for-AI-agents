import {describe,expect,it,vi} from "vitest";
import {createRequire} from "node:module";
import {Script} from "node:vm";
const bridge=createRequire(import.meta.url)("../scripts/lib/scene-bridge.cjs") as {bridgeScene:(source:string)=>string;sceneBridgeEdits:(source:string)=>{at:number;end:number;text:string}[]};
describe("optional scene material hook",()=>{
 it("leaves ordinary components and React root rendering unchanged",()=>{
  for(const source of ['export function Widget(){return <button>Run</button>}','import * as THREE from "three"; root.render(<Widget/>);'])expect(bridge.bridgeScene(source)).toBe(source);
 });
 it("supports renderer rigs without changing calls with computed receivers",()=>{
  const imports='import * as THREE from "three";';
  expect(bridge.bridgeScene(imports+'rig.renderer.render(scene,camera);')).toContain('rig.renderer.domElement');
  expect(bridge.bridgeScene(imports+'rig[choose()].render(scene,camera);')).toBe(imports+'rig[choose()].render(scene,camera);');
 });
 it("never dispatches for Original, preserves every render and throttles active material inspection",()=>{
  const source='import * as THREE from "three";renderer.render(scene,camera);',code=bridge.bridgeScene(source).replace(/^import[^;]+;/,""),events:unknown[]=[],order:string[]=[];
  let enabled=false,clock=1000;const attrs=new Map<string,string>(),scene={},camera={};
  const render=vi.fn(()=>order.push("render")),renderer={render,domElement:{hasAttribute:()=>enabled,getAttribute:(key:string)=>attrs.get(key)??null,setAttribute:(key:string,value:string)=>attrs.set(key,value),dispatchEvent:(event:unknown)=>{events.push(event);order.push("material");return true;}}};
  class FixtureEvent{constructor(public type:string,public init:unknown){}}
  const script=new Script(code),context={renderer,scene,camera,THREE:{EdgesGeometry:1,LineSegments:2,LineBasicMaterial:3,SphereGeometry:4},performance:{now:()=>clock},CustomEvent:FixtureEvent};
  script.runInNewContext(context);expect(events).toHaveLength(0);expect(render).toHaveBeenLastCalledWith(scene,camera);
  enabled=true;script.runInNewContext(context);expect(events).toHaveLength(1);expect(order.slice(-2)).toEqual(["material","render"]);
  clock+=100;script.runInNewContext(context);expect(events).toHaveLength(1);
  clock+=200;script.runInNewContext(context);expect(events).toHaveLength(2);expect(render).toHaveBeenCalledTimes(4);
 });
});
