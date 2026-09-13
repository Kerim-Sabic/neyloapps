import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { metricsAreStale,opportunityModel,pitchMetricsSchema } from '../../src/features/pitch/metrics';

test('Pitch projection counts completed participants, preserves provenance and exposes no identity data',async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid,email_confirmed_at timestamptz);
      create table profiles(user_id uuid,cohort text,source text,completed_at timestamptz,verified_at timestamptz);
      create table admin_audit_log(action text,target_id text);
      create table pending_signups(finalized_user_id uuid);
      create table enrollments(user_id uuid,founder_ordinal int);
      create table referrals(invitee_id uuid,qualified_at timestamptz);
      create table qualification_answers(user_id uuid,pilot_interest boolean);
      create table handle_registry(user_id uuid);
      insert into auth.users select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,case when n=7 then null else now() end from generate_series(1,9) n;
      insert into profiles select id,case when right(id::text,1)='2' then 'founder_assisted' when right(id::text,1)='5' then 'test' when right(id::text,1)='6' then 'staff' else 'independent' end,
        case when right(id::text,1)='2' then 'invitation' when right(id::text,1)='4' then 'outreach' else 'direct' end,
        case when right(id::text,1)='8' then now()+interval '1 day' else now() end,now() from auth.users where right(id::text,1)<>'9';
      insert into pending_signups select id from auth.users where right(id::text,1) in ('1','2','5','6','7','8');
      insert into admin_audit_log select 'account_import',id::text from auth.users where right(id::text,1)='3';
      insert into enrollments select id,1 from auth.users where right(id::text,1) in ('1','2','5');
      insert into referrals select id,now() from auth.users where right(id::text,1)='2';
      insert into qualification_answers select id,true from auth.users where right(id::text,1)='1';
      insert into handle_registry select id from auth.users;
    `);
    await db.exec(await readFile('supabase/migrations/202609130008_pitch_metrics.sql','utf8'));
    const raw=await db.query<{value:unknown}>('select neylo_pitch_metrics() as value');
    const result=pitchMetricsSchema.parse(raw.rows[0]?.value);
    assert.equal(result.registered,4);assert.equal(result.neyloVerified,2);assert.equal(result.imported,1);assert.equal(result.otherVerified,1);
    assert.equal(result.independent,3);assert.equal(result.founderAssisted,1);assert.equal(result.founding,2);assert.equal(result.qualifiedReferrals,1);assert.equal(result.handles,4);assert.equal(result.pilotInterest,1);
    assert.deepEqual(result.sources,{direct:2,invitation:1,outreach:1,scc:0,social:0});
    assert.ok(!JSON.stringify(result).includes('00000000-'));assert.ok(!JSON.stringify(result).includes('email'));
    assert.throws(()=>pitchMetricsSchema.parse({...result,email:'private@example.com'}));
    assert.throws(()=>pitchMetricsSchema.parse({...result,registered:99}));
    await db.exec('set role anon');await assert.rejects(()=>db.query('select public.neylo_pitch_metrics()'),/permission denied/);
    await db.exec('reset role; set role service_role');assert.equal((await db.query('select public.neylo_pitch_metrics()')).rows.length,1);
  }finally{await db.close();}
});

test('Pitch freshness never labels an old snapshot as current',()=>{
  assert.equal(metricsAreStale('2026-09-13T04:00:00Z',Date.parse('2026-09-13T04:01:29Z')),false);
  assert.equal(metricsAreStale('2026-09-13T04:00:00Z',Date.parse('2026-09-13T04:01:31Z')),true);
});

test('Bottom-up opportunity model calculates gross fee revenue from explicit assumptions',()=>{
  assert.deepEqual(opportunityModel(1000,2,150,50),{volumeMinor:30_000_000,revenueMinor:150_000});
  assert.equal(opportunityModel(10000,2,150,50).revenueMinor,1_500_000);
  for(const n of [-1,NaN,1.2,1_000_001])assert.throws(()=>opportunityModel(n,2,150,50));
});
