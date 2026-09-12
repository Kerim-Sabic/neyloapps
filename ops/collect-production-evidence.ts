import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';
import {metricsSchema,accountSchema} from '../src/lib/domain';
import {metricsCsv} from '../src/features/admin/csv';
const env=JSON.parse(await readFile('.env.production.secrets.json','utf8'));
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,'https://tfphopejudgbfrucdxsy.supabase.co');
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:users,error}=await db.auth.admin.listUsers({perPage:1000});if(error)throw error;
const owner=users.users.find(u=>u.email==='kerim@horalix.com'),test=users.users.find(u=>u.email==='kerim.sabic@gmail.com');assert.ok(owner?.email_confirmed_at);assert.ok(test?.email_confirmed_at);
const {data:ownerData,error:ownerError}=await db.rpc('neylo_account',{p_user_id:owner.id});if(ownerError)throw ownerError;const a=accountSchema.parse(ownerData);
const {data:testData,error:testError}=await db.rpc('neylo_account',{p_user_id:test.id});if(testError)throw testError;const b=accountSchema.parse(testData);
assert.equal(a.cohort,'staff');assert.equal(b.cohort,'test');assert.equal(a.totalMinor,0);assert.equal(b.totalMinor,0);
const {data:referral,error:referralError}=await db.from('referrals').select('inviter_id,status,reason_code').eq('invitee_id',test.id).single();if(referralError)throw referralError;assert.equal(referral.inviter_id,owner.id);assert.equal(referral.status,'ineligible');
const {data:raw,error:metricsError}=await db.rpc('neylo_metrics',{p_actor:owner.id,p_from:'2026-01-01T00:00:00.000Z',p_to:'2100-01-01T00:00:00.000Z',p_cohort:'participants'});if(metricsError)throw metricsError;const metrics=metricsSchema.parse(raw);
const {data:reconciliation,error:reconcileError}=await db.rpc('neylo_reconcile',{p_actor:owner.id});if(reconcileError)throw reconcileError;assert.ok(Object.values(reconciliation).every(Boolean));
const clientFiles=await readdir('dist/client',{recursive:true});let scanned=0;
for(const file of clientFiles.filter(f=>/\.(js|css|html|json)$/.test(f))){const text=await readFile(`dist/client/${file}`,'utf8');assert.ok(!text.includes(env.SUPABASE_SECRET_KEY),`Server secret leaked to ${file}`);assert.ok(!text.includes(env.RATE_LIMIT_SECRET),`Rate secret leaked to ${file}`);assert.ok(!text.includes('127.0.0.1:55421'),`Local backend leaked to ${file}`);scanned++;}
const timings=[];for(let i=0;i<6;i++){const start=performance.now();const r=await fetch('https://neylo.xyz/api/campaign');assert.equal(r.status,200);await r.json();timings.push(Math.round(performance.now()-start));}
const report={environment:'Production',at:new Date().toISOString(),owner:{handle:a.handle,cohort:a.cohort,verified:true,totalMinor:a.totalMinor},secondInbox:{handle:b.handle,cohort:b.cohort,verified:true,totalMinor:b.totalMinor},invitation:{attributionPersisted:true,status:referral.status,reason:referral.reason_code},metrics,reconciliation,clientSecretScan:{files:scanned,passed:true},campaignRequestTimingsMs:timings,timingCaveat:'Six sequential live API requests from the deployment machine; no simulated mobile network or performance score.'};
await writeFile('test-results/production-data.json',JSON.stringify(report,null,2));await writeFile('test-results/production-validation.csv',metricsCsv(metrics));
console.log({completedParticipants:metrics.verifiedCompleted,lifetimeAccounts:metrics.lifetimeVerified,remainingFounders:metrics.remainingFounders,reconciliation,clientFilesScanned:scanned,productionAttribution:'persisted; correctly ineligible test referral',timings});
