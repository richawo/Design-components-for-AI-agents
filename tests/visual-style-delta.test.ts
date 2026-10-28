import {describe,expect,it} from "vitest";
import {makeStyledSource} from "../scripts/lib/component-styles.mjs";
import {packStyleSource,restoreStyleSource} from "../scripts/lib/style-delta.mjs";
const material={css:"/* licensed material */",prompt:"Keep interactions.",appearance:"light",font:{family:"Hand",url:"https://example.invalid/font",weight:"400 700"},palette:{surface:"#fff8e7",page:"#f6edda",ink:"#2d3027",muted:"#675b49"}};
describe("small, source-bound style packs",()=>{
 it.each(["web","mobile"])("restores the exact %s source and briefs without storing another complete component",platform=>{
  const code=platform==="web"?'export const Widget=({onClick})=> <button onClick={onClick}>Click</button>':'import {View,Text,StyleSheet} from "react-native"; export function Widget(){return <View><Text style={s.heading}>Hello</Text></View>} const s=StyleSheet.create({heading:{fontSize:28,color:"#fff"}});';
  const base={slug:"test",code,prompt:"Original brief.\n",promptJson:'{"purpose":"Test"}'};
  const variant=makeStyledSource({slug:"test",platform,usage:"<Widget/>"},base,material)!;
  const delta=packStyleSource(base,variant),restored=restoreStyleSource(base,delta);
  for(const field of ["code","prompt","promptJson","styleCss","font"] as const)expect(restored[field]).toEqual(variant[field]);
  expect(JSON.stringify(delta)).not.toContain('export function Widget');
 });
 it("rejects a patch for another component version instead of returning corrupted source",()=>{
  const base={slug:"test",code:'export function Widget(){return <section>Hello</section>}',prompt:"Base",promptJson:"{}"};
  const delta=packStyleSource(base,makeStyledSource({slug:"test",platform:"web",usage:"<Widget/>"},base,material)!);
  expect(()=>restoreStyleSource({...base,code:base.code+"\n"},delta)).toThrow("does not match");
  expect(()=>restoreStyleSource({...base,slug:"other"},delta)).toThrow("does not match");
  expect(()=>restoreStyleSource(base,{...delta,codeEdits:[{at:-1,end:0,text:"bad"}]})).toThrow("Invalid compiled style edit");
 });
});
