import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { ARRIVAL_MS,snapshotSchema,tokenSchema } from '../src/features/demo/shared/domain';

// This script writes one synthetic transfer to the public presentation only.
// It does not have a Supabase client, account credentials or financial provider.
const origin=process.argv[2]??'http://localhost:3102';
assert.ok(['http://localhost:3102','https://neylo.xyz'].includes(origin));
const endpoint=`${origin}/api/demo-room`;
async function stage(){const response=await fetch(endpoint+'/stage',{cache:'no-store'});assert.equal(response.status,200);return snapshotSchema.extend({token:tokenSchema}).parse(await response.json());}
const [a,b]=await Promise.all([stage(),stage()]);
assert.equal(a.token,b.token);
assert.ok(!a.room.transfers.some(t=>t.completedAt===null),'A presentation is already in progress; do not interrupt it.');
const key=randomUUID(),headers={'Content-Type':'application/json',origin,'X-Neylo-Demo-Room':a.token};
const request=()=>fetch(endpoint+'/send',{method:'POST',headers,body:JSON.stringify({key,sender:'nadin',amount:'30'})});
const responses=await Promise.all(Array.from({length:5},request));
assert.ok(responses.every(response=>response.ok));
const snapshots=await Promise.all(responses.map(async response=>snapshotSchema.parse(await response.json())));
const transfers=snapshots.map(snapshot=>snapshot.room.transfers.find(t=>t.key===key)!);
assert.equal(new Set(transfers.map(transfer=>transfer.id)).size,1);
const sent=transfers[0]!;assert.equal(sent.receivedMinor,2990);assert.equal(sent.completedAt,null);
assert.equal(sent.arrivesAt-sent.startedAt,ARRIVAL_MS);
const observed=await stage();assert.equal(observed.room.transfers.find(t=>t.id===sent.id)?.completedAt,null);
await new Promise(resolve=>setTimeout(resolve,Math.max(0,sent.arrivesAt-Date.now())+1200));
const [afterA,afterB]=await Promise.all([stage(),stage()]);
const receiptA=afterA.room.transfers.find(t=>t.id===sent.id),receiptB=afterB.room.transfers.find(t=>t.id===sent.id);
assert.deepEqual(receiptA,receiptB);assert.equal(receiptA?.completedAt,sent.arrivesAt);
const retried=snapshotSchema.parse(await (await request()).json());
assert.equal(retried.room.transfers.filter(t=>t.key===key).length,1);
const report={at:new Date().toISOString(),origin,passed:6,checks:['Independent clients automatically resolve the same public room','Five concurrent confirmations create exactly one transfer','Incoming state stays incomplete before the canonical deadline','Canonical arrival is exactly 15000 ms after confirmation','Both independent clients restore the identical receipt','Retry after arrival preserves the same transfer'],transferId:sent.id,sentMinor:sent.sentMinor,feeMinor:sent.feeMinor,receivedMinor:sent.receivedMinor,completionOffsetMs:receiptA!.completedAt!-sent.startedAt,actualFinancialExecution:false};
await writeFile(`test-results/public-stage-${origin.startsWith('https')?'production':'local'}.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
