import { requireCommerceLicense } from "@/lib/commerce/licences";
import { getComponent } from "@/lib/registry";
import { readVisualSource, type StyledSource } from "@/lib/visual-style-source";
import { supportsVisualStyle } from "@/lib/visual-styles";

/** The preview receives only the selected component's material, after a live licence check. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = getComponent(slug);
  const headers = { "Cache-Control": "private, no-store" };
  if (!entry || !supportsVisualStyle(entry, "crayon")) return Response.json({ error: "Style not available" }, { status: 404, headers });
  const access = await requireCommerceLicense(req);
  if (!access.ok) return Response.json({ locked: true, reason: access.reason }, { headers });
  const source = await readVisualSource(slug, "crayon") as StyledSource | null;
  if (!source) return Response.json({ error: "Style not available in this build" }, { status: 404, headers });
  if(new URL(req.url).searchParams.get("format")==="module"){
    if(!source.styleRuntime)return new Response("",{status:404,headers});
    const requested=new URL(req.url).searchParams.get("v");
    if(requested&&requested!==source.styleRuntimeSha256)return new Response("",{status:409,headers});
    return new Response(source.styleRuntime,{headers:{...headers,"Content-Type":"text/javascript; charset=utf-8","X-Content-Type-Options":"nosniff","X-DFA-Style-Runtime":source.styleRuntimeSha256??""}});
  }
  return Response.json({ visualStyle: "crayon", css: source.styleCss, font: source.font, palette: JSON.parse(source.promptJson).visualStyle?.palette ?? {}, themes: JSON.parse(source.promptJson).visualStyle?.themes, ...(source.styleRuntime?{runtimeUrl:"/api/styles/"+encodeURIComponent(slug)+"?format=module&v="+source.styleRuntimeSha256,runtimeSha256:source.styleRuntimeSha256,runtimeOptions:source.styleOptions}:{}) }, { headers });
}
