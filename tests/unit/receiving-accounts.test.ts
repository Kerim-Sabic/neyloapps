import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { destinationInputSchema,handleLookupSchema,receivingForm } from '../../src/features/payments/receiving-domain';

test('receiving input normalizes identifiers and forbids forged verification or foreign BICs',()=>{
  const input={accountName:'Željka Šabić',iban:'ba39 1290 0794 0102 8494',bankName:'Example Bank',bic:'',discoverable:true,version:null};
  const saved={...input,version:'00000000-0000-4000-8000-000000000001',verification:'self_declared' as const,currency:'BAM' as const};
  assert.equal(destinationInputSchema.safeParse({...receivingForm(saved),version:saved.version}).success,true);
  assert.equal(destinationInputSchema.parse(input).iban,'BA391290079401028494');
  assert.equal(handleLookupSchema.parse({handle:' @Nadin '}).handle,'nadin');
  assert.equal(destinationInputSchema.safeParse({...input,verification:'verified'}).success,false);
  assert.equal(destinationInputSchema.safeParse({...input,bic:'DEUTDEFF'}).success,false);
  assert.equal(destinationInputSchema.safeParse({...input,iban:'BA391290079401028495'}).success,false);
});

test('receiving accounts enforce grants, consent, masking, revisions and removal',async()=>{
  const db=new PGlite();
  const alice='00000000-0000-4000-8000-000000000001',bob='00000000-0000-4000-8000-000000000002';
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create table public.profiles(user_id uuid primary key,handle text unique,review_required boolean default false);
      grant select,update on public.profiles to service_role;
      insert into profiles(user_id,handle) values('${alice}','alice'),('${bob}','bob');`);
    await db.exec(await readFile('supabase/migrations/20260923224458_receiving_accounts.sql','utf8'));
    const call=async(user:string,action:string,data:unknown={})=> (await db.query<{value:any}>('select public.neylo_receiving($1,$2,$3::jsonb) as value',[user,action,JSON.stringify(data)])).rows[0]!.value;
    for(const role of ['anon','authenticated']){
      await db.exec(`set role ${role}`);
      await assert.rejects(()=>call(bob,'get'),/permission denied/);
      await assert.rejects(()=>db.query('select * from receiving_accounts'),/permission denied/);
      await assert.rejects(()=>db.query('select * from receiving_account_events'),/permission denied/);
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    const input={accountName:'Bob Example',iban:'BA391290079401028494',bankName:'Example Bank',bic:'',discoverable:false,version:null};
    const saved=await call(bob,'save',input);
    assert.equal(saved.verification,'self_declared');
    assert.equal(await call(alice,'lookup',{handle:'bob'}),null);
    const enabled=await call(bob,'save',{...input,discoverable:true,version:saved.version});
    const lookup=await call(alice,'lookup',{handle:'bob'});
    assert.equal(lookup.last4,'8494');assert.equal(lookup.handle,'bob');
    assert.equal('iban' in lookup,false);assert.equal('bic' in lookup,false);assert.equal('user_id' in lookup,false);
    assert.equal(await call(bob,'lookup',{handle:'bob'}),null);
    const revealed=await call(alice,'prepare',{handle:'bob',version:enabled.version});
    assert.equal(revealed.iban,input.iban);
    await assert.rejects(()=>call(bob,'save',{...input,version:saved.version}),/DESTINATION_CHANGED/);
    const changed=await call(bob,'save',{...input,discoverable:true,version:enabled.version,bankName:'Updated Bank'});
    await assert.rejects(()=>call(alice,'prepare',{handle:'bob',version:enabled.version}),/DESTINATION_CHANGED/);
    await assert.rejects(()=>call(bob,'save',{...input,version:changed.version,iban:'BA391290079401028495'}),/INVALID_INPUT/);
    await call(bob,'remove',{version:changed.version});
    assert.equal(await call(alice,'lookup',{handle:'bob'}),null);
    assert.equal(await call(alice,'prepare',{handle:'bob',version:changed.version}),null);
    assert.equal(await call(bob,'get'),null);
    const audits=(await db.query<{action:string}>('select action from receiving_account_events')).rows;
    assert.equal(audits.filter(r=>r.action==='instructions_revealed').length,1);
    assert.equal(audits.at(-1)?.action,'removed');
  }finally{await db.close();}
});
