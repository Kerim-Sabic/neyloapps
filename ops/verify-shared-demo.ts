import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {snapshotSchema,tokenSchema} from '../src/features/demo/shared/domain';
const origin=process.argv[2]??'http://localhost:3102';
assert.ok(['http://localhost:3102','https://neylo.xyz'].includes(origin));
const checks:string[]=[];let transportRetries=0;
async function request(path:string,token='',body?:unknown,overrides:Record<string,string>={}){
  const run=()=>fetch(`${origin}/api/demo-room${path}`,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',...(token?{'X-Neylo-Demo-Room':token}:{}),...overrides},...(body===undefined?{}:{body:JSON.stringify(body)})});
  let response=await run();
  for(let attempt=0;response.status>=500&&path!=='/create'&&attempt<2;attempt++){transportRetries++;await response.text();response=await run();}
  return response;
}
const created=await request('/create','',{});assert.equal(created.status,200);const first=await created.json() as Record<string,unknown>;const token=tokenSchema.parse(first.token);
const other=await(await request('/create','',{})).json() as Record<string,unknown>;const otherToken=tokenSchema.parse(other.token);assert.notEqual(token,otherToken);
assert.equal((await request('')).status,401);
assert.equal((await request('/send',token,{key:randomUUID(),sender:'nadin',amount:'10'},{Origin:'https://example.org'})).status,403);
assert.equal((await request('/send',token,{key:randomUUID(),sender:'nadin',amount:'10',feeMinor:0})).status,400);
checks.push('Room capability, same-origin mutation and strict financial input boundaries enforced');
const key=randomUUID(),start=Date.now();
const replies=await Promise.all(Array.from({length:8},async()=>{const response=await request('/send',token,{key,sender:'nadin',amount:'25'});assert.equal(response.status,200);return snapshotSchema.parse(await response.json());}));
const id=replies[0]!.room.transfers[0]!.id;assert.ok(replies.every(r=>r.room.transfers.length===1&&r.room.transfers[0]!.id===id));
assert.equal(replies[0]!.room.transfers[0]!.completedAt,null);checks.push('Eight concurrent confirmations return one persistent transfer ID');
assert.equal((await request('/send',token,{key,sender:'nadin',amount:'30'})).status,409);
const early=snapshotSchema.parse(await(await request('',token)).json());assert.equal(early.room.transfers[0]?.completedAt,null);
// Both clients disconnect. The durable alarm, not a browser timer, owns arrival.
await new Promise(resolve=>setTimeout(resolve,16_000));
const receiver=snapshotSchema.parse(await(await request('',token)).json());const sender=snapshotSchema.parse(await(await request('',token)).json());
assert.deepEqual(receiver.room,sender.room);const transfer=receiver.room.transfers[0]!;
assert.equal(transfer.id,id);assert.equal(transfer.completedAt,transfer.startedAt+15_000);assert.equal(transfer.receivedMinor,2490);assert.equal(transfer.feeMinor,10);checks.push('Independent clients restore the same completed receipt after disconnecting for the arrival window');
const retry=snapshotSchema.parse(await(await request('/send',token,{key,sender:'nadin',amount:'25'})).json());assert.equal(retry.room.transfers.length,1);assert.equal(retry.room.transfers[0]?.completedAt,transfer.completedAt);checks.push('Retry after arrival preserves the original receipt without a duplicate');
const isolated=snapshotSchema.parse(await(await request('',otherToken)).json());assert.equal(isolated.room.transfers.length,0);checks.push('Another paired session remains empty and isolated');
const report={at:new Date().toISOString(),origin,passed:checks.length,checks,transportRetries,transferId:id,configuredArrivalMs:15000,completionOffsetMs:transfer.completedAt!-transfer.startedAt,observedAfterMs:Date.now()-start,sentMinor:2500,feeMinor:10,receivedMinor:2490,actualBankExecution:false};
await writeFile(`test-results/shared-${origin.startsWith('https')?'production':'local'}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
