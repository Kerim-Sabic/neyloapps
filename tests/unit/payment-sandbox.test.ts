import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { PaymentSandbox, sign, type BankEvent } from '../../ops/payment-sandbox/engine';
import { startSandbox } from '../../ops/payment-sandbox/server';

const secret='isolated-test-secret-never-production-0123456789';
const input={recipient:'@bob',amountMinor:5000,currency:'BAM'};
async function deliver(s:PaymentSandbox,e:BankEvent){const raw=JSON.stringify(e),ts=String(Date.now());return s.webhook(raw,ts,sign(raw,ts,secret),secret);}

test('Payment contract: durable funding, disbursement, uncertainty and refund',async t=>{
  await mkdir('work',{recursive:true});const dir=await mkdtemp('work/payment-test-');
  let s=new PaymentSandbox(dir);await s.init();
  try {
    await t.test('Concurrent identical intents produce one transfer; conflicting payload and forged sender fail',async()=>{
      const rows=await Promise.all(Array.from({length:12},()=>s.create('alice','repeat-key',input)));
      assert.equal(new Set(rows.map(r=>r.id)).size,1);
      await assert.rejects(()=>s.create('alice','repeat-key',{...input,amountMinor:1000}),/IDEMPOTENCY_CONFLICT/);
      await assert.rejects(()=>s.create('bob','other-key',input),/UNAUTHENTICATED/);
      for(const amountMinor of [0,-1,1.1,10001,Number.MAX_SAFE_INTEGER])await assert.rejects(()=>s.create('alice',randomUUID(),{...input,amountMinor}));
      await assert.rejects(()=>s.create('alice',randomUUID(),{...input,recipient:'@mallory'}));
      await assert.rejects(()=>s.get(rows[0]!.id,'mallory'),/NOT_FOUND/);
    });
    const payment=await s.create('alice',randomUUID(),input);
    await t.test('Funding is mandatory; signed but wrong or out-of-order events cannot post',async()=>{
      await assert.rejects(()=>s.dispatch(payment.id,secret),/NO_WORK/);
      const e=await s.simulateProvider(payment.id,'funding');
      await assert.rejects(()=>deliver(s,{...e,amountMinor:1}),/EVENT_MISMATCH/);
      await assert.rejects(()=>deliver(s,{...e,reference:'wrong'}),/REFERENCE_MISMATCH/);
      await assert.rejects(()=>deliver(s,{...e,type:'recipient_credited',reference:`${payment.id}:payout`}),/INVALID_TRANSITION/);
      const ts=String(Date.now()),raw=JSON.stringify(e);
      await assert.rejects(()=>s.webhook(raw,ts,'0'.repeat(64),secret),/INVALID_SIGNATURE/);
      const stale=String(Date.now()-600000);await assert.rejects(()=>s.webhook(raw,stale,sign(raw,stale,secret),secret),/INVALID_SIGNATURE/);
      assert.equal((await s.get(payment.id)).state,'awaiting_funding');
      await deliver(s,e);assert.equal((await s.get(payment.id)).state,'payout_pending');
      assert.equal((await s.reconcile()).pendingMinor,5000);
      assert.deepEqual(await deliver(s,e),{duplicate:true});
      await assert.rejects(()=>deliver(s,{...e,amountMinor:100}),/EVENT_CONFLICT/);
      await assert.rejects(()=>deliver(s,{...e,id:randomUUID()}),/INVALID_TRANSITION/);
    });
    await t.test('Accepted payout with lost response remains unknown; restart and retry do not double-pay',async()=>{
      await s.dispatch(payment.id,secret,{loseResponse:true});
      assert.equal((await s.get(payment.id)).state,'payout_unknown');
      assert.equal((await s.reconcile()).matched,false);
      await s.db.close();s=new PaymentSandbox(dir);await s.init();
      assert.equal((await s.get(payment.id)).state,'payout_unknown');
      await Promise.all([s.dispatch(payment.id,secret),s.dispatch(payment.id,secret)]);
      assert.equal((await s.get(payment.id)).state,'completed');
      assert.equal((await s.db.query<{n:number}>("select count(*)::integer n from sandbox.provider_operations where reference=$1",[`${payment.id}:payout`])).rows[0]!.n,1);
      assert.equal((await s.reconcile()).matched,true);
      assert.equal((await s.reconcile()).pendingMinor,0);
    });
    await t.test('Rejected payout preserves the liability until an independently confirmed refund',async()=>{
      const p=await s.create('alice',randomUUID(),{...input,amountMinor:1000});await deliver(s,await s.simulateProvider(p.id,'funding'));
      await s.dispatch(p.id,secret,{fail:true});assert.equal((await s.get(p.id)).state,'refund_pending');assert.equal((await s.reconcile()).pendingMinor,1000);
      await s.dispatch(p.id,secret,{loseResponse:true});assert.equal((await s.get(p.id)).state,'refund_pending');
      await s.dispatch(p.id,secret);assert.equal((await s.get(p.id)).state,'refunded');assert.equal((await s.reconcile()).matched,true);
      const paid=await s.simulateProvider(p.id,'payout');assert.equal(paid.type,'payout_failed');
      await assert.rejects(()=>deliver(s,{...paid,id:randomUUID(),type:'recipient_credited'}),/INVALID_TRANSITION/);
    });
    await t.test('Ledger and audit cannot be rewritten; each journal contains equal debit and credit',async()=>{
      await assert.rejects(()=>s.db.query('update sandbox.journals set amount_minor=1'),/IMMUTABLE/);
      await assert.rejects(()=>s.db.query('delete from sandbox.audit'),/IMMUTABLE/);
      await assert.rejects(()=>s.db.query("insert into sandbox.journals values('bad',$1,'cash','cash',1,'BAM')",[payment.id]),/check constraint/);
      const r=await s.db.query<{n:number}>('select count(*)::integer n from sandbox.journals');assert.equal(r.rows[0]!.n,4);
    });
    await t.test('Transaction failure rolls back inbox, ledger, status and outbox together',async()=>{
      const p=await s.create('alice',randomUUID(),input),e=await s.simulateProvider(p.id,'funding');
      await s.db.exec(`create function sandbox.inject_failure() returns trigger language plpgsql as $$ begin raise exception 'INJECTED_FAILURE'; end $$;
        create trigger injected before insert on sandbox.outbox for each row execute function sandbox.inject_failure();`);
      await assert.rejects(()=>deliver(s,e),/INJECTED_FAILURE/);
      assert.equal((await s.get(p.id)).state,'awaiting_funding');
      assert.equal((await s.db.query<{n:number}>('select count(*)::integer n from sandbox.inbox where id=$1',[e.id])).rows[0]!.n,0);
      await s.db.exec('drop trigger injected on sandbox.outbox');
      await deliver(s,e);await s.dispatch(p.id,secret);assert.equal((await s.reconcile()).matched,true);
    });
    await t.test('Real HTTP flow enforces sessions, origin and signature; completion comes after payout',async()=>{
      const app=await startSandbox(s);
      try {
        const home=await fetch(app.origin);assert.match(await home.text(),/SIMULATED MONEY ONLY/);
        const cookie=home.headers.get('set-cookie')!.split(';')[0]!;
        const headers={'Cookie':cookie,'Origin':app.origin,'Content-Type':'application/json','Idempotency-Key':randomUUID()};
        const post=(path:string,body:unknown,h=headers)=>fetch(app.origin+path,{method:'POST',headers:h,body:JSON.stringify(body)});
        assert.equal((await post('/transfers',input,{...headers,Origin:'https://attacker.test'})).status,403);
        assert.equal((await post('/transfers',input,{...headers,Cookie:''})).status,401);
        assert.equal((await post('/webhook',{})).status,401);
        assert.equal((await post('/transfers',{...input,padding:'x'.repeat(5000)})).status,413);
        const p=await(await post('/transfers',input)).json();assert.equal(p.state,'awaiting_funding');
        assert.equal((await(await post('/simulate',{id:p.id,action:'fund'})).json()).state,'payout_pending');
        assert.equal((await(await post('/simulate',{id:p.id,action:'lose-response'})).json()).state,'payout_unknown');
        assert.equal((await(await post('/simulate',{id:p.id,action:'recover'})).json()).state,'completed');
        assert.equal((await(await fetch(app.origin+'/reconciliation',{headers:{Cookie:cookie}})).json()).matched,true);
      } finally {await app.close();}
    });
    await t.test('No live mode is configurable',()=>assert.throws(()=>new PaymentSandbox(undefined,'live'),/LIVE_MODE_NOT_IMPLEMENTED/));
  } finally {await s.db.close();}
});
