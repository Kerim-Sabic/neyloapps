import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes,randomUUID } from 'node:crypto';
import { readFile,readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { accountSchema,campaignSchema } from '../../src/lib/domain';

test('Waitlist closure preserves earned credits and prevents every new award path',async t=>{
  const db=new PGlite();
  const one=async(sql:string,args:unknown[]=[]) => (await db.query<{value:unknown}>(sql,args)).rows[0]?.value;
  const version='local-promotion-v1';
  // PGlite has no Supabase Auth or pgcrypto service. These isolated fixtures supply
  // identity rows and random-byte generation only; production uses its real providers.
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function extensions.digest(text,text) returns bytea language sql as $$ select sha256(convert_to($1,'UTF8')) $$;
    create function extensions.gen_random_bytes(integer) returns bytea language sql as $$ select decode(substr(repeat(replace(gen_random_uuid()::text,'-',''),10),1,$1*2),'hex') $$;
  `);
  try{
    for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')&&f<'202609130009').sort()){
      await db.exec((await readFile('supabase/migrations/'+file,'utf8')).replace('create extension if not exists pgcrypto with schema extensions;',''));
    }
    await db.query(`insert into public.campaign_versions(id,welcome_minor,referral_minor,referral_cap,founder_cap,terms_body,privacy_body,eligibility_region,starts_at,published_at)
      values($1,10000,5000,3,100,'Historical promotion terms','Existing privacy notice','Worldwide 18+',now(),now());`,[version]);
    await db.query("update public.campaign_state set active_version=$1,paused=false where id='founding'",[version]);
    async function identity(handle:string,email=handle+'@example.test',verified=true){const id=randomUUID(),token=randomBytes(32).toString('hex');await db.query('insert into auth.users values($1,$2,case when $3 then now() else null end)',[id,email,verified]);return {id,email,token,handle};}
    type Identity=Awaited<ReturnType<typeof identity>>;
    const hold=(u:Identity,invite='',terms=version)=>one('select public.neylo_hold($1,$2,$3,$4,$5,$6,$7,$8) as value',[u.token,u.email,u.handle,terms,invite,'direct','local-waitlist-test',terms===version]);
    const finish=async(u:Identity,key=randomUUID())=>accountSchema.parse(await one('select public.neylo_finalize($1,$2,$3) as value',[u.id,u.token,key]));
    const account=async(u:Identity)=>accountSchema.parse(await one('select public.neylo_account($1) as value',[u.id]));
    const ledger=async()=>await db.query('select * from public.credit_entries order by id');
    const owner=await identity('founderx','kerim@horalix.com');await hold(owner);let founder=await finish(owner);
    await db.query("insert into public.admin_memberships(user_id,role) values($1,'operator')",[owner.id]);
    const oldFriend=await identity('oldfriend');await hold(oldFriend,founder.inviteCode);await finish(oldFriend);founder=await account(owner);assert.equal(founder.totalMinor,15000);
    const review=await identity('reviewfriend');await db.query("insert into participant_tags(email,cohort,review_required,reason) values($1,'independent',true,'Local fixture')",[review.email]);await hold(review,founder.inviteCode);await finish(review);
    const pending=await identity('unfinished');await hold(pending,founder.inviteCode);
    const before=await ledger();
    await db.exec(await readFile('supabase/migrations/202609130009_waitlist_rewards.sql','utf8'));
    const closure=await readFile('ops/end-rewards.sql','utf8');await db.exec(closure);
    const current=campaignSchema.parse(await one('select neylo_campaign() as value'));

    await t.test('Closure preserves the complete ledger and leaves waitlist enrollment open',async()=>{
      assert.deepEqual(await ledger(),before);assert.equal(current.open,true);assert.equal(current.remaining,0);assert.ok(current.rewardsEndedAt);
      assert.equal(current.version,'waitlist-2026-09-13-v1');assert.match(current.terms,/does not earn new promotional credits/);
      assert.equal((await account(owner)).totalMinor,15000);assert.equal((await account(owner)).canInviteForReward,false);
      assert.equal(await one('select neylo_invitation($1)->\'mayEarn\' as value',[founder.inviteCode]),false);
      await db.exec(closure);assert.equal(await one("select count(*)::int as value from admin_audit_log where action='rewards_ended'"),1);
    });
    await t.test('Unfinished claims require renewed consent and complete without new awards',async()=>{
      await assert.rejects(()=>finish(pending),/TERMS_CHANGED/);
      await assert.rejects(()=>hold(pending,founder.inviteCode),/TERMS_CHANGED/);
      await hold(pending,founder.inviteCode,current.version);
      const accounts=await Promise.all(Array.from({length:12},()=>finish(pending)));
      assert.ok(accounts.every(a=>a.totalMinor===0&&a.founderOrdinal===null&&a.termsVersion===current.version));
      assert.equal(await one('select count(*)::int as value from profiles where user_id=$1',[pending.id]),1);
      assert.deepEqual(await ledger(),before);
    });
    await t.test('New direct and invited accounts reserve handles without reward or founder allocation',async()=>{
      for(const name of ['newdirect','newinvited']){const u=await identity(name);await hold(u,name==='newinvited'?founder.inviteCode:'',current.version);const a=await finish(u);assert.equal(a.totalMinor,0);assert.equal(a.founderOrdinal,null);assert.equal(a.handle,name);}
      assert.equal(await one("select allocated_founders as value from campaign_state where id='founding'"),2);
      const a=await account(owner);assert.equal(a.totalMinor,15000);assert.equal(a.referralSlots,1);assert.ok(a.referrals.some(r=>r.reason==='promotion_ended'));
    });
    await t.test('Eligibility review cannot create delayed referral awards after closure',async()=>{
      await one("select neylo_review($1,$2,'eligible','Local review after promotion ended') as value",[owner.id,review.id]);
      assert.deepEqual(await ledger(),before);assert.equal((await account(owner)).referralSlots,1);
    });
    await t.test('Database guard rejects direct grants, cutoff reopening and forged verification',async()=>{
      await assert.rejects(()=>db.query("insert into credit_entries(beneficiary_id,terms_version,amount_minor,source_type,source_key) values($1,$2,10000,'welcome',$3)",[owner.id,version,'welcome:'+owner.id]),/REWARDS_ENDED/);
      await assert.rejects(()=>db.exec("update campaign_state set rewards_ended_at=null"),/REWARD_CUTOFF_IMMUTABLE/);
      await assert.rejects(()=>db.exec('update credit_entries set amount_minor=1'),/IMMUTABLE/);
      const u=await identity('unverified','unverified@example.test',false);await hold(u,'',current.version);await assert.rejects(()=>finish(u),/VERIFIED_IDENTITY_REQUIRED/);
    });
    await t.test('Historical policy stays readable; anonymous RPC and private data stay protected',async()=>{
      assert.equal(await one("select neylo_policy($1)->>'terms' as value",[version]),'Historical promotion terms');
      await db.exec('set role anon');await assert.rejects(()=>db.query('select neylo_policy($1)',[version]),/permission denied/);await assert.rejects(()=>db.query('select * from credit_entries'),/permission denied/);await db.exec('reset role');
    });
    await t.test('Pausing and reopening signup cannot restart the reward promotion',async()=>{
      await one("select neylo_pause($1,true,'Local test pause') as value",[owner.id]);await one("select neylo_pause($1,false,'Local test reopening') as value",[owner.id]);
      assert.ok(campaignSchema.parse(await one('select neylo_campaign() as value')).rewardsEndedAt);assert.equal((await account(owner)).canInviteForReward,false);
    });
    await t.test('Legitimate audited reversals remain available without rewriting past grants',async()=>{
      const grant=founder.entries.find(e=>e.type==='referral')!;
      await one("select neylo_reverse($1,$2,'Isolated fixture correction') as value",[owner.id,grant.id]);
      const a=await account(owner);assert.equal(a.totalMinor,10000);assert.equal(a.referralSlots,1);assert.equal(a.entries.find(e=>e.id===grant.id)?.amountMinor,5000);
    });
  }finally{await db.close();}
});
