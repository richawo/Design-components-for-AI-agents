import { describe, expect, it } from "vitest";
import { parse } from "@babel/parser";
import { makeStyledSource, styleRoots } from "../scripts/lib/component-styles.mjs";
import fs from "node:fs";
import path from "node:path";
const material={css:'/* private material fixture */',prompt:'Keep the keyboard interaction.',appearance:'light',font:{family:'Hand',url:'https://example.invalid/font.woff2',weight:'400 700'},palette:{page:'#fff8e7',ink:'#2d3027',onInk:'#fff8e7',surface:'#fff8e7'}};
const meta={slug:'test',platform:'web',usage:'import { Widget } from "./test";\n<Widget />'};
describe('licensed style compilation',()=>{
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
 it('keeps generated styled sources out of public registry files',()=>{
  const files=fs.readdirSync(path.resolve('public/r')).filter(f=>f.endsWith('.json'));
  expect(files.length).toBeGreaterThan(50);
  for(const name of files)expect(fs.readFileSync(path.resolve('public/r',name),'utf8')).not.toContain('DFA_LICENSED_VISUAL_CSS');
 });
});
