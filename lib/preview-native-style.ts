/** Adapt the browser rendering of native primitives without replacing gestures or native source. */
export function applyNativePreviewStyle(root:HTMLElement,palette:Record<string,string>,font:string){
 const last=new WeakMap<HTMLElement,string>();let stopped=false,frame=0;
 const signature=(node:HTMLElement)=>["color","background-color","background-image","border-color","font-family"].map(key=>node.style.getPropertyValue(key)).join("|");
 const paper=(value:string,role:string,solid=false)=>{
  const values=value.match(/[\d.]+/g)?.map(Number);if(!values||values.length<3||Math.max(...values.slice(0,3))-Math.min(...values.slice(0,3))>22||values[3]===0)return null;
  const target=palette[role];if(!target)return null;
  if(!solid&&values[3]!==undefined&&values[3]<1){const hex=target.slice(1);return `rgba(${[0,2,4].map(at=>parseInt(hex.slice(at,at+2),16)).join(",")},${values[3]})`;}
  return target;
 };
 const apply=(node:HTMLElement)=>{
  if(node.namespaceURI!=="http://www.w3.org/1999/xhtml"||node.closest("svg,canvas,picture")||["IMG","VIDEO","STYLE","SCRIPT"].includes(node.tagName))return;
  const before=signature(node);if(last.get(node)===before)return;
  const css=getComputedStyle(node);
  const panel=parseFloat(css.borderRadius)>=12;
  if(css.backgroundImage.includes("gradient(")&&!css.backgroundImage.includes("url(")){const colors=css.backgroundImage.match(/rgba?\([^)]*\)/g)??[];if(colors.length&&colors.every(value=>paper(value,"page")))node.style.setProperty("background-image",css.backgroundImage.replace(/rgba?\([^)]*\)/g,value=>paper(value,"surface",true)!),"important");}
  const paints:[[string,string],...Array<[string,string]>]=[["color","ink"],["background-color",node===root?"page":"surface"],["border-color","line"]];
  for(const[key,role]of paints){const value=paper(css.getPropertyValue(key),role,panel&&key==="background-color");if(value)node.style.setProperty(key,value,"important");}
  if(parseFloat(css.fontSize)>=22&&!/mono/i.test(css.fontFamily))node.style.setProperty("font-family",`"${font}",cursive`,"important");
  last.set(node,signature(node));
 };
 const visit=(node:HTMLElement)=>{apply(node);node.querySelectorAll<HTMLElement>("div,span,p,button,a,input,textarea,section,main,header").forEach(apply);};
 const pending=new Set<HTMLElement>();
 const queue=(node:HTMLElement)=>{pending.add(node);if(frame)return;frame=requestAnimationFrame(()=>{frame=0;if(stopped)return;for(const node of pending)visit(node);pending.clear();});};
 visit(root);
 const observer=new MutationObserver(records=>{for(const change of records){if(change.type==="attributes"){const node=change.target as HTMLElement;if(last.get(node)!==signature(node))queue(node);}else for(const node of change.addedNodes)if(node instanceof HTMLElement)queue(node);}});
 observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:["style","class"]});
 return()=>{stopped=true;observer.disconnect();cancelAnimationFrame(frame);pending.clear();};
}
