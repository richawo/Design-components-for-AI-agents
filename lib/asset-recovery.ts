// Installed before framework scripts, including inside preview documents. A
// release can replace hashed assets between HTML and lazy-chunk requests.
// Retry only that failure, once per asset, with a per-tab cooldown. Blocked
// storage means no automatic retry: an in-memory guard cannot survive reloads.
export const ASSET_RECOVERY_BOOTSTRAP = `(()=>{
function recover(value){
 try{
  const url=new URL(value,location.href);
  if(url.origin!==location.origin||!url.pathname.startsWith('/_next/static/chunks/')||! /\\.(?:js|css)$/.test(url.pathname))return;
  const key='dfa:asset-recovery',now=Date.now(),last=JSON.parse(sessionStorage.getItem(key)||'null');
  if(last&&(last.path===url.pathname||now-last.at<60000))return;
  sessionStorage.setItem(key,JSON.stringify({path:url.pathname,at:now}));
  location.reload();
 }catch{}
}
addEventListener('error',event=>{
 const target=event.target;
 if(target&&target.tagName==='SCRIPT')recover(target.src);
 else if(target&&target.tagName==='LINK'&&target.rel==='stylesheet')recover(target.href);
},true);
addEventListener('unhandledrejection',event=>{
 const message=String(event.reason&&event.reason.message||event.reason||'');
 const chunk=/Failed to load chunk (\\/\\_next\\/static\\/chunks\\/[^\\s]+\\.(?:js|css))(?:\\s|$)/.exec(message);
 if(chunk)recover(chunk[1]);
});
})();`;
