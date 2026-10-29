import { describe, expect, it } from "vitest";
import { parse } from "@babel/parser";
import { makeStyledSource, materialCss, materialCanvasClasses, styleRoots } from "../scripts/lib/component-styles.mjs";
import fs from "node:fs";
import path from "node:path";
const material={css:'/* private material fixture */',prompt:'Keep the keyboard interaction.',appearance:'light',font:{family:'Hand',url:'https://example.invalid/font.woff2',weight:'400 700'},palette:{page:'#fff8e7',ink:'#2d3027',onInk:'#fff8e7',surface:'#fff8e7'}};
const meta={slug:'test',platform:'web',usage:'import { Widget } from "./test";\n<Widget />'};
describe('licensed style compilation',()=>{
 it('changes private engine defaults with the theme while preserving explicit caller values',()=>{
  const source={slug:'test',code:'"use client";const DEFAULTS={inkA:"#ededef",inkB:"#0b0b0c"} as const;export function Widget({inkA=DEFAULTS.inkA}){return <div style={{color:inkA}}>Hello</div>}',prompt:'base',promptJson:'{}'};
  const value=makeStyledSource(meta,source,{...material,themes:{light:{ink:'#171719',page:'#fafafa'},dark:{ink:'#ededef',page:'#000000'}},defaults:{test:{inkA:{binding:'DEFAULTS',role:'ink'},inkB:{binding:'DEFAULTS',role:'page'}}}})!;
  expect(value.code).toContain('inkA:(DFA_CRAYON_THEME === "dark" ? "#ededef" : "#171719")');
  expect(value.code).toContain('inkA=DEFAULTS.inkA');expect(value.code).toContain('color:inkA');
 });
 it('styles named and demo exports while preserving component callbacks and imports',()=>{
  const source={slug:'test',code:'"use client";\nexport function Widget({onClick}:{onClick:()=>void}) { const vars={"--w-bg":"#000","--w-ink":"#fff"}; return <button style={vars} onClick={onClick}>Run</button>; }\nexport default function Demo(){ return <div><Widget onClick={()=>{}} /></div>; }',prompt:'Base brief.',promptJson:'{}'};
  const value=makeStyledSource(meta,source,material)!;
  expect(value.code).toContain('onClick={onClick}');expect(value.code).toContain('data-dfa-style="crayon"');expect(value.code).toContain('--w-bg:#fff8e7!important');expect(value.code).toContain('--w-ink:#2d3027!important');expect(value.code).toContain('export function Widget');expect(value.code).toContain('export default function Demo');expect(value.prompt).toContain('Base brief.');expect(JSON.parse(value.promptJson).visualStyle.tier).toBe('pro');
  expect(()=>parse(value.code,{sourceType:'module',plugins:['typescript','jsx']})).not.toThrow();expect(source.code).not.toContain('data-dfa-style');
 });
 it('leaves empty states, nested functions, source media and existing values intact',()=>{
  const source={slug:'test',code:'export function Widget(){ if (!open) return null; const helper=()=> <span>Helper</span>; return <section><img src="/real-product.png" />{helper()}</section> }',prompt:'base',promptJson:'{}'};
  const value=makeStyledSource(meta,source,material)!;expect(value.code.match(/data-dfa-style/g)).toHaveLength(1);expect(value.code).toContain('return null;');expect(value.code).toContain('src="/real-product.png"');expect(value.code).toContain('()=> <span>Helper</span>');
 });
 it('covers SVG, portals, aliased exports and custom component roots',()=>{
  expect(styleRoots(meta,'export function Widget(){return <svg/>}')).toHaveLength(1);
  expect(styleRoots(meta,'export function Widget(){return createPortal(<div/>, document.body)}')).toHaveLength(1);
  expect(styleRoots(meta,'function Widget(){return <Provider><div/></Provider>} export {Widget};')).toHaveLength(1);
 });
 it('keeps React Native exports native while adapting surfaces and heading typography',()=>{
  const source={slug:'test',code:'import {View,Text,StyleSheet} from "react-native"; export function Widget(){return <View style={s.card}><Text style={s.heading}>Hello</Text></View>} const s=StyleSheet.create({card:{backgroundColor:"#111111"},heading:{color:"#ffffff",fontSize:28}});',prompt:'base',promptJson:'{}'};
  const value=makeStyledSource({...meta,platform:'mobile'},source,material)!;
  expect(value.code).toContain('backgroundColor:"#fff8e7"');expect(value.code).toContain('fontFamily: DFAStylePlatform.select');
  expect(value.code).not.toContain('<style>');expect(value.code).not.toContain('data-dfa-style');expect(value.code).toContain('<View style={s.card}>');
  expect(()=>parse(value.code,{sourceType:'module',plugins:['typescript','jsx']})).not.toThrow();
 });
 it('keeps native avatar initials legible when their neutral gradient is adapted',()=>{
  const source={slug:'test',code:'import {View,Text} from "react-native";const THEMES={light:{avatar:["#222222","#111111"],avatarInk:"#ffffff"}};export function Widget(){return <View><Text>IM</Text></View>}',prompt:'Base',promptJson:'{}'};
  const result=makeStyledSource({...meta,platform:'mobile'},source,material)!;
  expect(result.code).toContain('avatar:["#fff8e7","#fff8e7"]');expect(result.code).toContain('avatarInk:"#2d3027"');
 });
 it('adapts neutral native backdrop stops while retaining meaningful coloured stops',()=>{
  const source={slug:'test',code:'import {View} from "react-native";import {LinearGradient} from "expo-linear-gradient";const C={bgTop:"#191919",bg:"#000000",block:["#191919","#090909"] as const};export function Widget(){return <View><LinearGradient colors={[C.bgTop,"#0b0b0b","#e78040",C.bg,"rgba(32,32,32,0.6)"]}/></View>}',prompt:'Base',promptJson:'{}'};
  const result=makeStyledSource({...meta,platform:'mobile'},source,material)!;
  expect(result.code).toContain('block:["#fff8e7","#fff8e7"]');expect(result.code).toContain('bgTop:"#fff8e7"');expect(result.code).toContain('colors={[C.bgTop,"#fff8e7","#e78040",C.bg,("#fff8e7" + "99")]}');
 });
 it('styles dynamically bound palette tokens without overriding an explicit accent',()=>{
  const source={slug:'test',code:'export function Widget({accent="red"}){const palette={field:"#111",label:"#ddd"}; return <form style={Object.fromEntries(Object.entries(palette).map(([k,v])=>["--w-"+k,v]))}><label className="text-[var(--w-label)]">Email</label><input className="bg-[var(--w-field)]"/><button style={{"--w-accent":accent}} className="bg-[var(--w-accent)]">Continue</button></form>}',prompt:'base',promptJson:'{}'};
  const value=makeStyledSource(meta,source,{...material,palette:{...material.palette,accent:'#b74e28'}})!;
  expect(value.styleCss).toContain('--w-label:#2d3027!important');
  expect(value.styleCss).toContain('--w-field:#fff8e7!important');
  expect(value.styleCss).not.toContain('--w-accent:#b74e28!important');
  expect(value.code).toContain('"--w-accent":accent');
 });
 it('preserves the foreground calculated for an unchanged accent fill',()=>{
  const source={slug:'test',code:'export function Widget({accent="#1d4ed8"}){const vars={"--w-ink":"#111111","--w-accent":accent,"--w-accent-ink":"#ffffff","--w-accent-text":"#ffffff","--w-onAccent":"#ffffff","--on-brand":"#ffffff"};return <button style={vars} className="bg-[var(--w-accent)] text-[var(--w-accent-ink)]">Hold dates</button>}',prompt:'base',promptJson:'{}'};
  const value=makeStyledSource(meta,source,material)!;
  for(const token of ['--w-accent','--w-accent-ink','--w-accent-text','--w-onAccent','--on-brand'])expect(value.styleCss).not.toContain(token+':');
  expect(value.styleCss).toContain('--w-ink:#2d3027!important');
  expect(value.code).toContain('"--w-accent-ink":"#ffffff"');
 });
 it('still adapts inverse text when its neutral ink fill changes',()=>{
  const source={slug:'test',code:'export function Widget(){const vars={"--w-ink":"#111111","--w-on-ink":"#ffffff"};return <button style={vars} className="bg-[var(--w-ink)] text-[var(--w-on-ink)]">Continue</button>}',prompt:'base',promptJson:'{}'};
  const value=makeStyledSource(meta,source,material)!;
  expect(value.styleCss).toContain('--w-ink:#2d3027!important');
  expect(value.styleCss).toContain('--w-on-ink:#fff8e7!important');
 });
 it('keeps authored receipt paper and its contrasting ink together in both themes',()=>{
  const source={slug:'test',code:'export function Widget(){const vars={"--print-paper":"#f3efe4","--print-receipt":"#f4f0e5","--print-ink":"#24221c","--print-cta-ink":"#111111","--ui-ink":"#111111"};return <section style={vars}><div className="bg-(--print-receipt) text-(--print-ink)">Printed receipt</div><button className="bg-(--print-paper) text-(--print-cta-ink)">Buy</button></section>}',prompt:'base',promptJson:'{}'};
  const value=makeStyledSource(meta,source,{...material,themes:{light:material.palette,dark:{...material.palette,ink:'#ededef',surface:'#0a0a0b'}}})!;
  for(const token of ['--print-paper','--print-receipt','--print-ink','--print-cta-ink'])expect(value.styleCss).not.toContain(token+':var(--dfa-crayon-');
  expect(value.styleCss).toContain('--ui-ink:var(--dfa-crayon-ink)!important');
  expect(value.styleCss).toContain('[class~="bg-(--print-receipt)"]');
  expect(value.styleCss).toContain('--dfa-ink-pencil:var(--print-ink)');
  expect(value.code).toContain('"--print-ink":"#24221c"');
 });
 it('retains a calculated foreground on an unchanged caller-selected accent',()=>{
  const source={slug:'test',code:'export function Widget({accent="#000000"}){const fill=accent;const ink=inkOn(fill);const vars={"--button-accent":fill,"--button-ink":ink,"--ui-ink":"#111111"};return <button style={vars}>Start building</button>}',prompt:'base',promptJson:'{}'};
  const value=makeStyledSource(meta,source,material)!;
  expect(value.styleCss).not.toContain('--button-ink:');
  expect(value.styleCss).toContain('--ui-ink:#2d3027!important');
  expect(value.code).toContain('const ink=inkOn(fill)');
 });
 it('keeps white overlay ink on fixed dark shader artwork without changing the host palette',()=>{
  const source={slug:'test',code:'const shader="vec3 ink = vec3(0.027, 0.027, 0.031);";export function Widget(){return <div className="bg-[#070708]"><h2 className="text-white">The light moves.</h2></div>}',prompt:'base',promptJson:'{}'};
  const value=makeStyledSource(meta,source,{...material,themes:{light:material.palette,dark:{ink:'#ededef',page:'#000000',onInk:'#000000'}}})!;
  expect(value.styleCss).toContain('[class~="bg-[#070708]"]{--dfa-crayon-scheme:dark;');
  expect(value.styleCss).toContain('--dfa-crayon-ink:#ededef;');
  expect(value.code).toContain('vec3 ink = vec3(0.027, 0.027, 0.031)');
 });
 it('keeps drawn overlays readable over an opaque black canvas but lets transparent canvases follow their host',()=>{
  const source='renderer.setClearColor(0x000000, 1); export function Scene(){return <div className="bg-black text-white"><h2>Survey sheet</h2></div>}';
  const pack={...material,themes:{light:material.palette,dark:{ink:'#ededef',page:'#000000',onInk:'#000000'}}};
  expect(materialCss(source,pack)).toContain('[class~="bg-black"]{--dfa-crayon-scheme:dark;');
  expect(materialCanvasClasses(source,pack)).toEqual(['bg-black']);
  expect(materialCanvasClasses(source.replace('0x000000, 1','0x000000, 0'),pack)).toEqual([]);
  expect(materialCss(source.replace('0x000000, 1','0x000000, 0'),pack)).not.toContain('[class~="bg-black"]{--dfa-crayon-scheme:dark;');
 });
 it('keeps generated styled sources out of public registry files',()=>{
  const files=fs.readdirSync(path.resolve('public/r')).filter(f=>f.endsWith('.json'));
  expect(files.length).toBeGreaterThan(50);
  for(const name of files)expect(fs.readFileSync(path.resolve('public/r',name),'utf8')).not.toContain('DFA_LICENSED_VISUAL_CSS');
 });
 it('includes drawing in standalone exports without replacing their event handlers or native primitives',()=>{
  const pack={...material,webRuntime:'export function DFAMountCrayon(root:Element){return ()=>{}}',webModule:'export function DFAMountCrayon(root){return ()=>{}}',nativeRuntime:'function DFAInkSurface(props:unknown){return null} function DFAInkWriting(props:unknown){return null}'};
  const base={slug:'test',prompt:'Base',promptJson:'{}'};
  const web=makeStyledSource(meta,{...base,code:'export function Widget({onClick}){return <button onClick={onClick}>Run</button>}'},pack)!;
  expect(web.code).toContain('<DFAInkMaterial/>');expect(web.code).toContain('DFAMountCrayon(root,');expect(web.code).toContain('onClick={onClick}');expect(web.styleRuntime).toBe(pack.webModule);
  const native=makeStyledSource({...meta,platform:'mobile'},{...base,code:'import {View,Text,Pressable,StyleSheet} from "react-native";export function Widget({onPress}){return <View style={s.card}><Text style={s.heading}>Title</Text><Pressable style={s.button} onPress={onPress}><Text>Run</Text></Pressable></View>}const s=StyleSheet.create({card:{borderRadius:12},heading:{fontSize:28},button:{backgroundColor:"#ffffff"}});'},pack)!;
  expect(native.code).toContain('<DFAInkSurface as={View}');expect(native.code).toContain('<DFAInkSurface as={Pressable}');expect(native.code).toContain('<DFAInkWriting as={Text}');expect(native.code).toContain('onPress={onPress}');expect(native.code).not.toContain('<div');
  for(const code of [web.code,native.code])expect(()=>parse(code,{sourceType:'module',plugins:['typescript','jsx']})).not.toThrow();
 });
});
