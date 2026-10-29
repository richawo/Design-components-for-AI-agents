// Generic preview hook. Original scenes never dispatch without an active style.
const {parse}=require("@babel/parser");
function sceneBridgeEdits(source){
  if(!/from\s*["']three["']/.test(source))return [];
  const ast=parse(source,{sourceType:"module",plugins:["typescript","jsx"]});
  const declaration=ast.program.body.find(node=>node.type==="ImportDeclaration"&&node.source.value==="three");
  const namespace=declaration?.specifiers.find(node=>node.type==="ImportNamespaceSpecifier")?.local.name;
  if(!namespace)return [];
  const edits=[];
  const stable=node=>node?.type==="Identifier"||node?.type==="MemberExpression"&&!node.computed&&node.property.type==="Identifier"&&stable(node.object);
  function walk(node){
    if(!node||typeof node!=="object")return;
    if(node.type==="CallExpression"&&node.callee.type==="MemberExpression"&&node.callee.property.name==="render"&&node.arguments.length===2){
      const object=node.callee.object,safe=stable(object);
      if(safe){const renderer=source.slice(object.start,object.end),scene=source.slice(node.arguments[0].start,node.arguments[0].end),camera=source.slice(node.arguments[1].start,node.arguments[1].end);
        const types=["EdgesGeometry","LineSegments","LineBasicMaterial","SphereGeometry"].map(name=>name+":"+namespace+"."+name).join(",");
        const canvas=renderer+'.domElement';
        const hook=canvas+'?.hasAttribute("data-dfa-ink-canvas")&&performance.now()-Number('+canvas+'.getAttribute("data-dfa-ink-at")||0)>250&&('+canvas+'.setAttribute("data-dfa-ink-at",String(performance.now())),'+canvas+'.dispatchEvent(new CustomEvent("dfa:scene-frame",{bubbles:true,detail:{scene:'+scene+',camera:'+camera+',types:{'+types+'}}})))';
        edits.push({at:node.start,end:node.end,text:"("+hook+","+source.slice(node.start,node.end)+")"});return;
      }
    }
    for(const[key,value]of Object.entries(node))if(!["loc","extra","comments"].includes(key)){if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==="object")walk(value);}
  }
  walk(ast.program);return edits;
}
function bridgeScene(source){let code=source;for(const edit of sceneBridgeEdits(source).sort((a,b)=>b.at-a.at))code=code.slice(0,edit.at)+edit.text+code.slice(edit.end);return code;}
module.exports={sceneBridgeEdits,bridgeScene};
