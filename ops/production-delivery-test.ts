import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

// A separate HTTP cookie session exercises the actual deployed application API.
// The inbox was authorized by the owner and tagged `test` before any signup.
const file='.env.delivery-test.json';
let session:{cookies:Record<string,string>;invitation?:string;started?:boolean}={cookies:{}};
try{session=JSON.parse(await readFile(file,'utf8'));}catch{}
async function request(path:string,body?:unknown){
  const r=await fetch(`https://neylo.xyz/api/${path}`,{method:body?'POST':'GET',headers:{Origin:'https://neylo.xyz','Content-Type':'application/json',Cookie:Object.entries(session.cookies).map(([k,v])=>`${k}=${v}`).join('; ')},body:body?JSON.stringify(body):undefined});
  for(const cookie of r.headers.getSetCookie()){const pair=cookie.split(';')[0];if(!pair)continue;const split=pair.indexOf('=');session.cookies[pair.slice(0,split)]=pair.slice(split+1);}
  await writeFile(file,JSON.stringify(session));
  return {status:r.status,body:await r.json()};
}
const action=process.argv[2];
if(action==='start'){
  assert.ok(!session.started,'A code was already requested. Use verify or intentionally restart after inspecting state.');
  const campaign=await request('campaign');assert.equal(campaign.body.campaign.open,true);
  const invitation=process.argv[3];
  const result=await request('signup/start',{handle:'qa_delivery',email:'kerim.sabic@gmail.com',termsVersion:campaign.body.campaign.version,accepted:true,source:invitation?'invitation':'direct',campaignTag:'deployment-check',offerDisplayed:true,...(invitation?{invitation}:{})});
  assert.equal(result.status,200,JSON.stringify(result.body));session.started=true;session.invitation=invitation;await writeFile(file,JSON.stringify(session));
  console.log('Production provider accepted the verification request for the authorized second inbox. Awaiting the actual inbox code; delivery is not inferred.');
}else if(action==='verify'){
  // Read the short-lived user-supplied code from an ignored file, never from logs.
  const code=(await readFile('.env.delivery-code','utf8')).trim();assert.match(code,/^\d{6}$/);
  const result=await request('signup/verify',{code,key:crypto.randomUUID()});assert.equal(result.status,200,JSON.stringify(result.body));
  const account=await request('account');assert.equal(account.status,200);assert.equal(account.body.cohort,'test');assert.equal(account.body.totalMinor,0);
  const retry=await request('signup/finalize',{key:crypto.randomUUID()});assert.equal(retry.status,200);
  const again=await request('account');assert.equal(again.body.handle,account.body.handle);assert.equal(again.body.totalMinor,0);
  const denied=await request('admin/metrics');assert.equal(denied.status,403);
  const report={environment:'Production neylo.xyz, provider-managed OTP supplied from owner-controlled external Gmail inbox',at:new Date().toISOString(),verified:true,persistentAccount:true,handle:account.body.handle,cohort:account.body.cohort,totalMinor:account.body.totalMinor,finalizeRetryStatus:retry.status,nonAdminDenied:denied.status,invitationAttributed:!!session.invitation};
  await writeFile('test-results/production-delivery.json',JSON.stringify(report,null,2));console.log(report);
}else throw Error('Use start [invitation] or verify.');
