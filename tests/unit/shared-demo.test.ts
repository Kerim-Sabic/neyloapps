import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { advanceRoom,ARRIVAL_MS,newRoom,projectTransfer,RoomError,sendInRoom } from '../../src/features/demo/shared/domain';
import { DemoRoom,sharedDemoRequest } from '../../src/features/demo/shared/room-worker';

test('Shared transfer derives fee and recipient amount through the existing quote engine',()=>{
  const room=sendInRoom(newRoom(1000),{key:randomUUID(),sender:'nadin',amount:'100,00'},2000,randomUUID());
  const t=room.transfers[0]!;assert.equal(t.sentMinor,10000);assert.equal(t.feeMinor,10);assert.equal(t.receivedMinor,9990);assert.equal(t.recipient,'kerim');assert.equal(t.arrivesAt-t.startedAt,15000);assert.equal(t.completedAt,null);
  assert.equal(projectTransfer(t,3000).quote.route.nodes[0]?.detail,'@nadin · source');
});
test('Canonical arrival happens once at 15 seconds; interpolation cannot invent completion',()=>{
  const room=sendInRoom(newRoom(0),{key:randomUUID(),sender:'nadin',amount:'10'},0,randomUUID());
  assert.equal(advanceRoom(room,14999),room);assert.equal(projectTransfer(room.transfers[0]!,90000).status,'running');
  const done=advanceRoom(room,15000);assert.equal(done.transfers[0]?.completedAt,15000);assert.equal(done.revision,2);assert.equal(advanceRoom(done,16000),done);assert.equal(projectTransfer(done.transfers[0]!,16000).status,'completed');
});
test('Retries deduplicate and changed intent cannot reuse a request key',()=>{
  const key=randomUUID(),input={key,sender:'nadin',amount:'10'},room=sendInRoom(newRoom(0),input,1,randomUUID());
  assert.equal(sendInRoom(room,input,2,randomUUID()),room);
  assert.throws(()=>sendInRoom(room,{...input,amount:'20'},3,randomUUID()),/IDEMPOTENCY_CONFLICT/);
  assert.throws(()=>sendInRoom(room,{...input,key:randomUUID()},3,randomUUID()),/TRANSFER_IN_PROGRESS/);
});
test('Invalid and forged requests never become financial records',()=>{
  for(const amount of ['0','-10','0.50','1.111','10001','1e3','NaN'])assert.throws(()=>sendInRoom(newRoom(0),{key:randomUUID(),sender:'nadin',amount},1,randomUUID()));
  assert.throws(()=>sendInRoom(newRoom(0),{key:randomUUID(),sender:'nadin',amount:'10',receivedMinor:99999},1,randomUUID()));
  assert.throws(()=>advanceRoom(newRoom(0),24*60*60*1000),/SESSION_EXPIRED/);
});
test('Separate rooms stay isolated; received funds and a return journey agree',()=>{
  const a=newRoom(0),b=newRoom(0),sent=sendInRoom(a,{key:randomUUID(),sender:'nadin',amount:'20'},0,randomUUID());
  assert.equal(b.transfers.length,0);
  const returned=sendInRoom(advanceRoom(sent,ARRIVAL_MS),{key:randomUUID(),sender:'kerim',amount:'5'},ARRIVAL_MS,randomUUID());
  assert.equal(returned.transfers[1]?.recipient,'nadin');assert.equal(returned.transfers[1]?.receivedMinor,490);assert.equal(returned.transfers[0]?.receivedMinor,1990);
});

function memoryContext(){
  const values=new Map<string,unknown>();let tail:Promise<unknown>=Promise.resolve(),alarm=0;
  return {storage:{async get<T>(key:string){return structuredClone(values.get(key)) as T|undefined;},async put(key:string,value:unknown){values.set(key,structuredClone(value));},async setAlarm(time:number){alarm=time;},async deleteAll(){values.clear();}},blockConcurrencyWhile<T>(fn:()=>Promise<T>):Promise<T>{const next=tail.then(async()=>{try{return await fn();}catch{throw new Error('UNCAUGHT_LOCK_ERROR');}});tail=next.catch(()=>{});return next;},getAlarm:()=>alarm};
}
test('Durable adapter serializes concurrent confirmations and schedules a single arrival',async()=>{
  const context=memoryContext(),object=new DemoRoom(context);await object.fetch(new Request('https://demo.internal/create',{method:'POST',body:'{}'}));
  const key=randomUUID(),responses=await Promise.all(Array.from({length:12},()=>object.fetch(new Request('https://demo.internal/send',{method:'POST',body:JSON.stringify({key,sender:'nadin',amount:'10'})}))));
  const snapshots=await Promise.all(responses.map(r=>r.json())) as {room:{transfers:{id:string;arrivesAt:number}[]}}[];
  assert.equal(new Set(snapshots.map(s=>s.room.transfers[0]?.id)).size,1);assert.ok(snapshots.every(s=>s.room.transfers.length===1));assert.equal(context.getAlarm(),snapshots[0]?.room.transfers[0]?.arrivesAt);
  const stored=await context.storage.get<ReturnType<typeof newRoom>>('room');assert.ok(stored);await context.storage.put('room',{...stored,transfers:stored.transfers.map(t=>({...t,arrivesAt:Date.now()-1}))});
  await object.alarm();await object.alarm();const finished=await context.storage.get<ReturnType<typeof newRoom>>('room');assert.equal(finished?.transfers.length,1);assert.notEqual(finished?.transfers[0]?.completedAt,null);
});
test('Public session API enforces origins, room capability, methods and body limits',async()=>{
  const objects=new Map<string,DemoRoom>();const env={DEMO_ROOMS:{getByName(name:string){if(!objects.has(name))objects.set(name,new DemoRoom(memoryContext()));return objects.get(name)!;}}};
  const base='https://neylo.xyz/api/demo-room';
  assert.equal((await sharedDemoRequest(new Request(base),env)).status,401);
  assert.equal((await sharedDemoRequest(new Request(base+'/create',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:'{}'}),env)).status,403);
  const created=await sharedDemoRequest(new Request(base+'/create',{method:'POST',headers:{origin:'https://neylo.xyz','content-type':'application/json'},body:'{}'}),env);
  const room=await created.json() as {token:string};assert.match(room.token,/^[a-f0-9]{48}$/);
  const headers={'X-Neylo-Demo-Room':room.token,origin:'https://neylo.xyz','content-type':'application/json'};
  assert.equal((await sharedDemoRequest(new Request(base,{headers}),env)).status,200);
  assert.equal((await sharedDemoRequest(new Request(base+'/send',{headers}),env)).status,405);
  assert.equal((await sharedDemoRequest(new Request(base+'/send',{method:'POST',headers,body:JSON.stringify({key:randomUUID(),sender:'nadin',amount:'10',feeMinor:0})}),env)).status,400);
  assert.equal((await sharedDemoRequest(new Request(base+'/send',{method:'POST',headers,body:'x'.repeat(3000)}),env)).status,413);
});
