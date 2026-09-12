import pg from 'pg';
import { readFile,writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
const client=new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:55422/postgres'});
await client.connect();
try{const {rows}=await client.query<{count:string}>('select count(*) from public.profiles');if(rows[0]?.count!=='0')throw new Error('Reset this isolated local project before preparing browser QA.');await client.query(await readFile('ops/publish-approved-campaign.sql','utf8'));await client.query("update public.campaign_state set paused=false where id='founding'");}finally{await client.end();}
const c=z.object({API_URL:z.url(),PUBLISHABLE_KEY:z.string(),SECRET_KEY:z.string()}).parse(JSON.parse(await readFile('.env.local-status.json','utf8')));
const values={APP_STAGE:'development',APP_ORIGIN:'http://127.0.0.1:3100',PUBLIC_ENROLLMENT_ENABLED:'true',TERMS_APPROVED:'true',SMTP_VERIFIED:'true',SUPPORT_EMAIL:'kerim@horalix.com',OPERATOR_NAME:'Horalix d.o.o.',OPERATOR_ADDRESS:'Maglajska 1, Sarajevo, Bosnia and Herzegovina',NEXT_PUBLIC_SUPABASE_URL:c.API_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:c.PUBLISHABLE_KEY,SUPABASE_SECRET_KEY:c.SECRET_KEY,RATE_LIMIT_SECRET:randomBytes(32).toString('hex')};
const env=Object.entries(values).map(([key,value])=>`${key}=${JSON.stringify(value)}`).join('\n');await writeFile('.env.local',env);await writeFile('.dev.vars',env);
console.log('Prepared isolated local browser QA with provider-managed Auth and Mailpit capture. SMTP_VERIFIED here means local capture only; no external delivery claim.');
