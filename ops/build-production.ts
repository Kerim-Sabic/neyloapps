import { readFile,writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
const path='.env.production.secrets.json';
const secrets=z.record(z.string(),z.string()).parse(JSON.parse(await readFile(path,'utf8')));
if(secrets.NEXT_PUBLIC_SUPABASE_URL!=='https://tfphopejudgbfrucdxsy.supabase.co')throw new Error('Wrong production project');
secrets.RATE_LIMIT_SECRET??=randomBytes(32).toString('hex');
await writeFile(path,JSON.stringify(secrets));
const vars={APP_STAGE:'production',APP_ORIGIN:'https://neylo.xyz',PUBLIC_ENROLLMENT_ENABLED:'true',TERMS_APPROVED:'true',SMTP_VERIFIED:'true',OPERATOR_NAME:'Horalix d.o.o.',OPERATOR_ADDRESS:'Maglajska 1, Sarajevo, Bosnia and Herzegovina',SUPPORT_EMAIL:'kerim@horalix.com'};
const result=spawnSync(process.execPath,['node_modules/vinext/dist/cli.js','build'],{stdio:'inherit',env:{...process.env,...secrets,...vars}});
if(result.status!==0)process.exit(result.status??1);

