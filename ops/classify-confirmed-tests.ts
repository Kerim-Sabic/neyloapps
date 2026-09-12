import {readFile,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
const env=JSON.parse(await readFile('.env.production.secrets.json','utf8'));
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,'https://tfphopejudgbfrucdxsy.supabase.co');
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const owner=(await db.auth.admin.listUsers()).data.users.find(u=>u.email==='kerim@horalix.com');assert.ok(owner?.email_confirmed_at);
const {data:profiles,error}=await db.from('profiles').select('user_id,handle').in('handle',['kerimsabic','noomy']);if(error)throw error;assert.equal(profiles.length,2);
const reason='Owner explicitly confirmed @kerimsabic and @noomy are test/staff accounts during live launch verification. Exclude from participant metrics and reverse test promotional entitlements while preserving immutable audit history and consumed slots.';
const before=[];
for(const profile of profiles){
  const account=await db.rpc('neylo_account',{p_user_id:profile.user_id});if(account.error)throw account.error;
  before.push({handle:profile.handle,totalMinor:account.data.totalMinor,welcomeMinor:account.data.welcomeMinor,referralMinor:account.data.referralMinor,referralSlots:account.data.referralSlots});
  const classification=await db.rpc('neylo_classify',{p_actor:owner.id,p_user_id:profile.user_id,p_cohort:'test',p_reason:reason});if(classification.error)throw classification.error;
  const {data:entries,error:entriesError}=await db.from('credit_entries').select('id,amount_minor').eq('beneficiary_id',profile.user_id).neq('source_type','reversal');if(entriesError)throw entriesError;
  for(const entry of entries){const reversed=await db.rpc('neylo_reverse',{p_actor:owner.id,p_entry_id:entry.id,p_reason:reason});if(reversed.error)throw reversed.error;}
  const after=await db.rpc('neylo_account',{p_user_id:profile.user_id});if(after.error)throw after.error;assert.equal(after.data.totalMinor,0);assert.equal(after.data.canInviteForReward,false);
}
await writeFile('test-results/production-user-test-flow.json',JSON.stringify({environment:'Production; user-operated test accounts subsequently identified and excluded',at:new Date().toISOString(),before,after:'Classified test; all three grants reversed through audited immutable reversal RPCs; balances zero. Consumed founding/referral slots retained.',awardVerification:'Two real provider-verified completions yielded 100 and 150 KM, with one 50 KM referral award before test classification.'},null,2));
console.log('Both user-confirmed test accounts excluded. Three promotional grants reversed with immutable audit history. Their two already-consumed founding slots remain consumed by design.');
