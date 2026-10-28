import { expect, it } from "vitest";
import { parse } from "@babel/parser";
import { makeStyledSource } from "../scripts/lib/component-styles.mjs";
import { selectStyleTheme } from "../scripts/lib/style-theme.mjs";
import { parseStyleTheme, styleInstallText, visualStyleQuery } from "../lib/visual-styles";

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

it("keeps the theme separate from the style and preserves it in preview and installation URLs",()=>{
 expect(parseStyleTheme(null)).toBe("light");expect(parseStyleTheme("dark")).toBe("dark");expect(parseStyleTheme("sepia")).toBeNull();
 expect(visualStyleQuery("crayon","dark")).toBe("?visualStyle=crayon&theme=dark");
 expect(visualStyleQuery("original","dark")).toBe("");
 expect(styleInstallText({slug:"example"},"dark")).toContain('/{name}.json?theme=dark');
 expect(styleInstallText({slug:"example",platform:"mobile"},"dark")).toContain('visualStyle=crayon&theme=dark&format=raw');
});
