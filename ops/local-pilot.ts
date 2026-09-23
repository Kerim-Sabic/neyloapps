import {spawn,spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import pg from 'pg';

// This runner deliberately accepts no database URL or hosted-project argument.
if(process.env.APP_STAGE==='production')throw new Error('Local pilot cannot run in production.');
const mode=process.argv[2]??'serve';
if(!['serve','test'].includes(mode))throw new Error('Use serve or test.');
const result=spawnSync(process.execPath,['node_modules/supabase/dist/supabase.js','status','-o','json'],{encoding:'utf8'});
if(result.status!==0)throw new Error('Start the local Supabase stack first; see docs/local-pilot.md.');
const status=JSON.parse(result.stdout);
if(status.API_URL!=='http://127.0.0.1:55421'||status.DB_URL!=='postgresql://postgres:postgres@127.0.0.1:55422/postgres'||status.MAILPIT_URL!=='http://127.0.0.1:55424')throw new Error('Refusing a different Supabase environment.');
const config=await readFile('supabase/config.toml','utf8');
if(!/^project_id = "neyloapps"$/m.test(config))throw new Error('Unexpected local project.');
const pool=new pg.Pool({connectionString:status.DB_URL});
try{
  await pool.query('begin');
  const {rows}=await pool.query("select active_version,rewards_ended_at from campaign_state where id='founding' for update");
  if(!['founding-draft-v1','local-pilot-v1'].includes(rows[0]?.active_version))throw new Error('Local database has another campaign. Refusing to change it or reopen rewards.');
  await pool.query(`insert into campaign_versions(id,welcome_minor,referral_minor,referral_cap,founder_cap,terms_body,privacy_body,eligibility_region,starts_at,published_at)
    values('local-pilot-v1',10000,5000,3,100,'LOCAL TEST ONLY. No financial service or public offer.','LOCAL TEST ONLY. Use fictional data. Email stays in local Mailpit.','Local fictional-account testing',now()-interval '1 day',now()) on conflict(id) do nothing`);
  await pool.query("update campaign_state set active_version='local-pilot-v1',paused=false,rewards_ended_at=coalesce(rewards_ended_at,now()) where id='founding'");
  await pool.query('select currency,bank_country from receiving_accounts limit 0');
  await pool.query('commit');
}catch(error){await pool.query('rollback');throw error;}finally{await pool.end();}
const env={...process.env,APP_STAGE:'development',APP_ORIGIN:'http://127.0.0.1:3100',LOCAL_PILOT:'true',
  NEXT_PUBLIC_SUPABASE_URL:status.API_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:status.PUBLISHABLE_KEY??status.ANON_KEY,
  SUPABASE_SECRET_KEY:status.SECRET_KEY??status.SERVICE_ROLE_KEY,RATE_LIMIT_SECRET:randomBytes(32).toString('hex'),
  RECEIVING_ACCOUNTS_ENABLED:'true',PUBLIC_ENROLLMENT_ENABLED:'true',TERMS_APPROVED:'true',SMTP_VERIFIED:'true',
  OPERATOR_NAME:'Neylo local test operator',OPERATOR_ADDRESS:'Local test environment',SUPPORT_EMAIL:'support@example.test'};
console.log('LOCAL PILOT ONLY — fictional accounts, real local Auth/Postgres, no bank or money movement.');
console.log('App: http://127.0.0.1:3100 | Local email inbox: http://127.0.0.1:55424');
const args=mode==='test'?['node_modules/@playwright/test/cli.js','test','--config','playwright.pilot.config.ts']:['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3100'];
const child=spawn(process.execPath,args,{env,stdio:'inherit',windowsHide:true});
for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>child.kill(signal));
child.on('error',()=>{console.error('Local pilot process could not start.');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
