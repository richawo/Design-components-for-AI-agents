import { expect, it } from "vitest";
import { parse } from "@babel/parser";
import { makeStyledSource } from "../scripts/lib/component-styles.mjs";
import { selectStyleTheme } from "../scripts/lib/style-theme.mjs";
import { parseStyleTheme, styleInstallText, visualStyleQuery, withStyleTheme } from "../lib/visual-styles";
import type { RegistryEntry } from "../lib/registry-types";

const light={page:"#fff8e7",surface:"#fffbed",ink:"#2d3027",onInk:"#fff8e7"};
const dark={page:"#191a18",surface:"#242622",ink:"#f5eedc",onInk:"#20221d"};
const material={css:'[data-dfa-style="crayon"]{color:var(--dfa-crayon-ink)}',prompt:"Preserve interactions in both themes.",appearance:"light",font:{family:"Hand",url:"https://example.invalid/font.woff2",weight:"400 700"},palette:light,themes:{light,dark}};
const source={slug:"test",code:'export function Widget({onClick}:{onClick:()=>void}){return <button style={{"--w-bg":"#000","--w-ink":"#fff"}} onClick={onClick}>Run</button>}',prompt:"Base brief.",promptJson:"{}"};
const meta={slug:"test",platform:"web",usage:"<Widget />"};

it("uses theme variables while keeping component actions and source-bound edits intact",()=>{
 const compiled=makeStyledSource(meta,source,material)!;
 expect(compiled.styleCss).toContain('--w-bg:var(--dfa-crayon-page)!important');
 expect(compiled.styleCss).toContain('--w-ink:var(--dfa-crayon-ink)!important');
 expect(compiled.code).toContain('onClick={onClick}');
 expect(selectStyleTheme(compiled,"light")).toBe(compiled);
 const selected=selectStyleTheme(compiled,"dark");
 expect(selected.styleCss).toContain('--dfa-crayon-page:#191a18;');
 expect(selected.code).toContain(JSON.stringify(selected.styleCss));
 expect(JSON.parse(selected.promptJson).visualStyle).toMatchObject({appearance:"dark",palette:dark,themes:{light,dark}});
 expect(()=>parse(selected.code,{sourceType:"module",plugins:["typescript","jsx"]})).not.toThrow();
 expect(compiled.styleCss).not.toContain('--dfa-crayon-page:#191a18;');
});

it("keeps a web component's JavaScript theme default consistent with its selected material",()=>{
 const web={...source,code:'function dataSource(theme="dark"){return theme} export function Widget({theme="dark"}:{theme?:"light"|"dark"}){return <div>{theme}{dataSource()}</div>}'};
 const compiled=makeStyledSource(meta,web,material)!;
 expect(compiled.code).toContain('theme=DFA_CRAYON_THEME');
 expect(compiled.code).toContain('const DFA_CRAYON_THEME = "light" as "light" | "dark";');
 expect(compiled.code).toContain('function dataSource(theme="dark")');
 expect(selectStyleTheme(compiled,"dark").code).toContain('const DFA_CRAYON_THEME = "dark" as "light" | "dark";');
});

it("offers native light and dark installations without web wrappers or changing callback contracts",()=>{
 const native={...source,code:'import {View,Text,StyleSheet} from "react-native"; export function Widget({onPress}:{onPress:()=>void}){return <View onTouchEnd={onPress} style={s.card}><Text style={s.heading}>Hello</Text></View>} const s=StyleSheet.create({card:{backgroundColor:"#111111"},heading:{color:"#ffffff",fontSize:28}});'};
 const compiled=makeStyledSource({...meta,platform:"mobile"},native,material)!;
 expect(compiled.code.indexOf('const DFA_CRAYON_COLORS')).toBeLessThan(compiled.code.indexOf('const s=StyleSheet.create'));
 expect(compiled.code).toContain('backgroundColor:DFA_CRAYON_COLORS.surface');
 expect(compiled.code).toContain('onTouchEnd={onPress}');
 const selected=selectStyleTheme(compiled,"dark");
 expect(selected.code).toContain('const DFA_CRAYON_THEME = "dark" as "light" | "dark";');
 expect(selected.code).not.toContain('<style>');
 expect(()=>parse(selected.code,{sourceType:"module",plugins:["typescript","jsx"]})).not.toThrow();
});

it("preserves an existing native theme prop instead of flattening both palette branches",()=>{
 const native={...source,code:'import {View} from "react-native"; const PALETTE={light:{bg:"#ffffff",ink:"#111111"},dark:{bg:"#111111",ink:"#ffffff"}}; export function Widget({theme="dark",onPress}:{theme?:"dark"|"light";onPress:()=>void}){return <View onTouchEnd={onPress} style={{backgroundColor:PALETTE[theme].bg}}/>}'};
 const compiled=makeStyledSource({...meta,platform:"mobile"},native,material)!;
 expect(compiled.code).toContain('light:{bg:DFA_CRAYON_PALETTES.light.page,ink:DFA_CRAYON_PALETTES.light.ink}');
 expect(compiled.code).toContain('dark:{bg:DFA_CRAYON_PALETTES.dark.page,ink:DFA_CRAYON_PALETTES.dark.ink}');
 expect(compiled.code).toContain('theme=DFA_CRAYON_THEME');
 expect(compiled.code).toContain('backgroundColor:PALETTE[theme].bg');
 const selected=selectStyleTheme(compiled,"dark");expect(selected.code).toContain('DFA_CRAYON_PALETTES.light.page');
 expect(()=>parse(selected.code,{sourceType:"module",plugins:["typescript","jsx"]})).not.toThrow();
});

it("keeps the theme separate from the style and preserves it in preview and installation URLs",()=>{
 expect(parseStyleTheme(null)).toBe("light");expect(parseStyleTheme("dark")).toBe("dark");expect(parseStyleTheme("sepia")).toBeNull();
 expect(visualStyleQuery("crayon","dark")).toBe("?visualStyle=crayon&theme=dark");
 expect(visualStyleQuery("crayon","light")).toBe("?visualStyle=crayon&theme=light");
 expect(visualStyleQuery("original","dark")).toBe("");
 expect(styleInstallText({slug:"example"},"dark")).toContain('/{name}.json?theme=dark');
 expect(styleInstallText({slug:"example",platform:"mobile"},"dark")).toContain('visualStyle=crayon&theme=dark&format=raw');
});

it("describes the installed theme without mutating the original component metadata",()=>{
 const original={theme:"dark",usage:'<Widget theme="dark"/>',props:[{name:"theme",type:'"light" | "dark"',default:'"dark"',description:"Surface theme"}],controls:[{prop:"theme",kind:"segmented",label:"Theme",default:"dark",options:["light","dark"]}]} as RegistryEntry;
 const selected=withStyleTheme(original,"light");
 expect(selected.theme).toBe("light");expect(selected.props[0].default).toBe('"light"');expect(selected.controls?.[0].default).toBe("light");
 expect(selected.usage).toBe('<Widget theme="light"/>');expect(original.usage).toBe('<Widget theme="dark"/>');
 expect(original.theme).toBe("dark");expect(original.props[0].default).toBe('"dark"');
});
