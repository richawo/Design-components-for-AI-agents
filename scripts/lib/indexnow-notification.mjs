import {setTimeout as delay} from 'node:timers/promises';

export class TransientNotificationError extends Error {}

export function notificationHttpError(stage,response) {
  const error=new Error(`${stage}: HTTP ${response.status}`);
  if(response.status===429||response.status>=500){
    error.transient=true;
    const value=response.headers?.get('retry-after');
    if(value){const seconds=Number(value);error.retryAfterMs=Number.isFinite(seconds)?seconds*1000:Math.max(0,Date.parse(value)-Date.now());}
  }
  return error;
}

const transient=error=>error?.transient||['TimeoutError','AbortError'].includes(error?.name)||(error instanceof TypeError&&/fetch|network/i.test(error.message));

export async function retryNotification(stage,operation,{pause=delay,log=console.warn,attempts=3}={}) {
  for(let attempt=1;attempt<=attempts;attempt++){
    try{return await operation();}catch(error){
      if(!transient(error))throw error;
      log(`${stage}: attempt ${attempt}/${attempts} unavailable (${error.message}). A timed-out notification may have been received; this is not a deployment failure.`);
      const wait=Math.max(2000*attempt,error.retryAfterMs||0);
      if(attempt===attempts||wait>60_000)throw new TransientNotificationError(`${stage} deferred after ${attempt} attempt(s): ${error.message}`,{cause:error});
      await pause(wait);
    }
  }
}

export function deploymentMatches(marker,publicCommit,request) {
  if(marker?.publicCommit!==publicCommit)return false;
  if(!request)return true;
  return marker.privateContentCommit===request.privateContentCommit&&marker.editorialRequest?.requestId===request.requestId&&marker.editorialRequest?.privateContentCommit===request.privateContentCommit&&marker.editorialRequest?.sourceInputsSha256===request.sourceInputsSha256;
}

export async function runConfirmedNotification(confirm,notify,{allowDeferred=false}={}) {
  // Marker verification remains mandatory and cannot be converted to a warning.
  await confirm();
  try{return {status:'received',result:await notify()};}catch(error){
    if(!allowDeferred||!(error instanceof TransientNotificationError))throw error;
    return {status:'deferred',reason:error.message,publication:'Expected deployment already confirmed. Retry only blog:index; do not redeploy the Worker to retry a notification.'};
  }
}
