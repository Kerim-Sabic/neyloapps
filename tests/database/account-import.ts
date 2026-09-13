import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile,writeFile } from 'node:fs/promises';
import pg from 'pg';
import { accountImportSql } from '../../ops/account-import-sql';
import { accountSchema } from '../../src/lib/domain';

const client=new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:55422/postgres'});
const checks:string[]=[];
await client.connect();
try{
  await client.query('begin');
  await client.query(await readFile('supabase/migrations/202609130007_imported_consent.sql','utf8'));
  const tag=randomUUID().replaceAll('-','').slice(0,8),actor=randomUUID(),a=randomUUID(),b=randomUUID();
  for(const [index,id] of [actor,a,b].entries())await client.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,`import-${tag}-${index}@example.test`]);
  await client.query("insert into public.admin_memberships(user_id,role) values($1,'operator')",[actor]);
  const rows=[a,b].map((id,index)=>({user_id:id,email:`import-${tag}-${index+1}@example.test`,handle:`import_${tag}_${index}`,completed_at:'2026-09-12T14:08:00.000Z',cohort:'independent' as const,source:index?'invitation':'direct'}));
  const batch=`import_test_${tag}`,input={actor,batch,rows};
  const sql=accountImportSql(input).replace(/^begin;\n/,'').replace(/commit;\n$/,'');
  const baseline=(await client.query("select allocated_founders,(select count(*) from public.credit_entries) as credits,(select count(*) from public.referrals) as referrals from public.campaign_state where id='founding'")).rows;
  await client.query(sql);
  for(const row of rows){
    const account=accountSchema.parse((await client.query('select public.neylo_account($1) as value',[row.user_id])).rows[0]?.value);
    assert.equal(account.handle,row.handle);assert.equal(account.email,row.email);assert.equal(account.acceptedAt,null);assert.equal(account.eligibility,'review_required');assert.equal(account.totalMinor,0);assert.equal(account.canInviteForReward,false);assert.equal(account.founderOrdinal,null);
  }
  checks.push('Imported verified identities have readable, persistent accounts and reserved handles without invented consent');
  const after=(await client.query("select allocated_founders,(select count(*) from public.credit_entries) as credits,(select count(*) from public.referrals) as referrals from public.campaign_state where id='founding'")).rows;
  assert.deepEqual(after,baseline);checks.push('Founding capacity, credit ledger and referral relationships remain unchanged');
  await client.query(sql);
  assert.equal((await client.query("select count(*)::int n from public.admin_audit_log where action='account_import' and details->>'batch'=$1",[batch])).rows[0]?.n,2);
  checks.push('Repeated identical import creates no duplicate accounts or audit entries');
  async function rejects(sqlText:string,values:unknown[],pattern:RegExp){await client.query('savepoint rejection');await assert.rejects(()=>client.query(sqlText,values),pattern);await client.query('rollback to savepoint rejection');}
  await rejects("select public.neylo_review($1,$2,'eligible','Local review test')",[actor,a],/enrollment_consent_before_eligibility/);
  checks.push('Eligibility approval is blocked by the database when campaign consent is absent');
  await rejects(accountImportSql({...input,rows:rows.map(r=>({...r,source:'direct'}))}).replace(/^begin;\n/,'').replace(/commit;\n$/,''),[],/IDEMPOTENCY_CONFLICT/);
  await rejects(accountImportSql({...input,batch:`different_${tag}`}).replace(/^begin;\n/,'').replace(/commit;\n$/,''),[],/EXISTING_ACCOUNT_CONFLICT/);
  checks.push('Modified retry payloads and conflicting existing accounts fail without overwrites');
  await rejects(accountImportSql({...input,actor:a,batch:`forbidden_${tag}`}).replace(/^begin;\n/,'').replace(/commit;\n$/,''),[],/FORBIDDEN/);
  checks.push('A non-operator cannot execute an import');
  await client.query('rollback');
  await writeFile('test-results/account-import.json',JSON.stringify({at:new Date().toISOString(),passed:checks.length,checks,fixtureTransaction:'rolled back; pre-existing local records and schema preserved'},null,2));
  console.log(JSON.stringify({passed:checks.length,checks}));
}finally{await client.query('rollback').catch(()=>{});await client.end();}
