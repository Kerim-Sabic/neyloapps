import pg from 'pg';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {metricsSchema,accountSchema} from '../src/lib/domain';
import {metricsCsv} from '../src/features/admin/csv';
const db=new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:55422/postgres'});
await db.connect();
try{
  const identities=await db.query("select id,email,email_confirmed_at from auth.users where email in ('sapphire-a@example.test','sapphire-b@example.test') order by email");
  assert.equal(identities.rows.length,2);assert.ok(identities.rows.every(row=>row.email_confirmed_at));
  const owner=identities.rows[0].id;
  await db.query("insert into public.admin_memberships(user_id,role) values($1,'operator') on conflict(user_id) do nothing",[owner]);
  const a=accountSchema.parse((await db.query('select public.neylo_account($1) as value',[owner])).rows[0].value);
  const b=accountSchema.parse((await db.query('select public.neylo_account($1) as value',[identities.rows[1].id])).rows[0].value);
  const metrics=metricsSchema.parse((await db.query("select public.neylo_metrics($1,'2026-01-01','2100-01-01','participants') as value",[owner])).rows[0].value);
  assert.equal(a.totalMinor,15000);assert.equal(a.referralSlots,1);assert.equal(b.totalMinor,10000);
  assert.equal(metrics.verifiedCompleted,2);assert.equal(metrics.creditedReferrals,1);assert.equal(metrics.reservedMinor,25000);
  const retries=await db.query("select count(*)::int as count from public.credit_entries where beneficiary_id=$1 and source_type='referral'",[owner]);assert.equal(retries.rows[0].count,1);
  await mkdir('test-results',{recursive:true});
  await writeFile('test-results/browser-data.json',JSON.stringify({environment:'Isolated local Supabase Auth + Postgres, real emailed codes captured by local Mailpit; not production participants',at:new Date().toISOString(),identities:identities.rows,accountA:a,accountB:b,metrics},null,2));
  await writeFile('test-results/local-validation.csv',metricsCsv(metrics));
  console.log('Provider-verified browser accounts reconcile: A 150 KM, B 100 KM, two completed accounts, one referral award.');
}finally{await db.end();}
