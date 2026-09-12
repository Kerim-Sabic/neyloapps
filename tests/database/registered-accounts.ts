import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile,writeFile } from 'node:fs/promises';
import pg from 'pg';
import { registeredAccountsSchema } from '../../src/features/admin/accounts-domain';
const client=new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:55422/postgres'});
const checks:string[]=[];
await client.connect();
try{
  const exists=await client.query("select to_regprocedure('public.neylo_registered_accounts(uuid,text,text,integer,integer)') as fn");
  if(!exists.rows[0]?.fn)await client.query(await readFile('supabase/migrations/202609120006_operator_accounts.sql','utf8'));
  await client.query('begin');
  const tag=`list-${randomUUID().slice(0,8)}`,operator=randomUUID(),presenter=randomUUID(),ordinary=randomUUID(),unverified=randomUUID(),incomplete=randomUUID();
  for(const [index,id] of [operator,presenter,ordinary,unverified,incomplete].entries()){
    await client.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,case when $3 then now() else null end)",[id,`${tag}-${index}@example.test`,id!==unverified]);
    if(id!==incomplete)await client.query("insert into public.profiles(user_id,handle,verified_at,cohort,source) values($1,$2,now(),'test','direct')",[id,`${tag.replaceAll('-','_')}_${index}`]);
  }
  await client.query("insert into public.admin_memberships(user_id,role) values($1,'operator'),($2,'presenter')",[operator,presenter]);
  async function list(actor=operator,page=1,size=25,search=tag,cohort='all'){
    const result=await client.query('select public.neylo_registered_accounts($1,$2,$3,$4,$5) as value',[actor,search,cohort,page,size]);
    return registeredAccountsSchema.parse(result.rows[0]?.value);
  }
  const result=await list();assert.equal(result.total,3);assert.equal(result.accounts.length,3);assert.ok(result.accounts.every(row=>row.email.includes(tag)));checks.push('Operator sees only completed accounts with confirmed Auth email');
  const first=await list(operator,1,1),second=await list(operator,2,1),third=await list(operator,3,1);assert.equal(new Set([...first.accounts,...second.accounts,...third.accounts].map(row=>row.id)).size,3);checks.push('Stable pagination returns each matching account once');
  assert.equal((await list(operator,1,25,tag.toUpperCase())).total,3);assert.equal((await list(operator,1,25,'%')).total,0);assert.equal((await list(operator,1,25,`${tag}-0@example.test`)).total,1);checks.push('Case-insensitive exact-substring email search treats SQL wildcards literally');
  assert.equal((await list(operator,1,25,tag,'participants')).total,0);checks.push('Participant filter excludes test accounts');
  async function rejected(run:()=>Promise<unknown>,pattern:RegExp){await client.query('savepoint boundary');await assert.rejects(run,pattern);await client.query('rollback to savepoint boundary');}
  for(const actor of [presenter,ordinary,incomplete,unverified])await rejected(()=>list(actor),/FORBIDDEN/);checks.push('Presenter, ordinary, unverified and non-admin identities cannot read emails');
  for(const role of ['anon','authenticated'])await rejected(async()=>{await client.query(`set local role ${role}`);return list();},/permission denied/);checks.push('Direct anonymous and authenticated RPC execution denied even with an operator UUID');
  await rejected(()=>list(operator,0),/INVALID_INPUT/);await rejected(()=>list(operator,1,101),/INVALID_INPUT/);checks.push('Database enforces pagination bounds');
  await client.query('rollback');
  await writeFile('test-results/registered-accounts.json',JSON.stringify({at:new Date().toISOString(),checks,passed:checks.length,fixtureTransaction:'rolled back; existing local accounts preserved'},null,2));
  console.log({passed:checks.length,checks});
}finally{await client.query('rollback').catch(()=>{});await client.end();}
