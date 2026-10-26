import {describe,expect,it,vi} from 'vitest';
import {deploymentMatches,notificationHttpError,retryNotification,runConfirmedNotification,TransientNotificationError} from '../scripts/lib/indexnow-notification.mjs';

const options=()=>({pause:vi.fn(async()=>{}),log:vi.fn()});
describe('IndexNow notification failures after deployment',()=>{
  it('retries a transient timeout and retains the uncertain attempt',async()=>{
    let calls=0;const opts=options();
    expect(await retryNotification('submission',async()=>{if(++calls===1)throw new DOMException('timed out','TimeoutError');return 202;},opts)).toBe(202);
    expect(calls).toBe(2);expect(opts.pause).toHaveBeenCalledWith(2000);expect(opts.log).toHaveBeenCalledWith(expect.stringContaining('may have been received'));
  });
  it('bounds retries and reports the failed stage',async()=>{
    const operation=vi.fn(async()=>{throw new TypeError('fetch failed');});const opts=options();
    await expect(retryNotification('sitemap discovery',operation,opts)).rejects.toThrow(/sitemap discovery deferred after 3/);
    expect(operation).toHaveBeenCalledTimes(3);expect(opts.pause).toHaveBeenCalledTimes(2);
  });
  it('respects short Retry-After without hammering a long server deferral',async()=>{
    const opts=options();let calls=0;
    await retryNotification('key',async()=>{if(++calls===1)throw notificationHttpError('key',new Response('',{status:429,headers:{'Retry-After':'8'}}));return true;},opts);
    expect(opts.pause).toHaveBeenCalledWith(8000);
    const long=options();const operation=vi.fn(async()=>{throw notificationHttpError('key',new Response('',{status:503,headers:{'Retry-After':'120'}}));});
    await expect(retryNotification('key',operation,long)).rejects.toBeInstanceOf(TransientNotificationError);
    expect(operation).toHaveBeenCalledTimes(1);expect(long.pause).not.toHaveBeenCalled();
  });
  it('does not retry malformed or permanently rejected input',async()=>{
    for(const error of [new Error('Off-site sitemap'),notificationHttpError('submission',new Response('',{status:403}))]){
      const operation=vi.fn(async()=>{throw error;});await expect(retryNotification('submission',operation,options())).rejects.toBe(error);expect(operation).toHaveBeenCalledTimes(1);
    }
  });
  it('defers only transient notification failure after confirmation',async()=>{
    const confirm=vi.fn(async()=>{});const error=new TransientNotificationError('submission timed out');
    const result=await runConfirmedNotification(confirm,async()=>{throw error;},{allowDeferred:true});
    expect(confirm).toHaveBeenCalledTimes(1);expect(result.status).toBe('deferred');
    if(result.status!=='deferred')throw Error('Expected explicit deferral');
    expect(result.publication).toContain('do not redeploy');
  });
  it('keeps manual notification and permanent failures strict',async()=>{
    await expect(runConfirmedNotification(async()=>{},async()=>{throw new TransientNotificationError('timeout');})).rejects.toThrow('timeout');
    await expect(runConfirmedNotification(async()=>{},async()=>{throw new Error('incorrect key');},{allowDeferred:true})).rejects.toThrow('incorrect key');
  });
  it('never swallows failed deployment verification',async()=>{
    const notify=vi.fn(async()=>{});await expect(runConfirmedNotification(async()=>{throw new TransientNotificationError('marker unavailable');},notify,{allowDeferred:true})).rejects.toThrow('marker unavailable');expect(notify).not.toHaveBeenCalled();
  });
  it('requires exact public, private, request and fingerprint identities',()=>{
    const request={privateContentCommit:'private',requestId:'request',sourceInputsSha256:'fingerprint'};
    const marker={publicCommit:'public',privateContentCommit:'private',editorialRequest:{...request}};
    expect(deploymentMatches(marker,'public',request)).toBe(true);
    expect(deploymentMatches(marker,'different',request)).toBe(false);
    expect(deploymentMatches({...marker,privateContentCommit:'newer'},'public',request)).toBe(false);
    for(const key of ['privateContentCommit','requestId','sourceInputsSha256'])expect(deploymentMatches({...marker,editorialRequest:{...request,[key]:'wrong'}},'public',request)).toBe(false);
  });
});
