import {readFile,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import assert from 'node:assert/strict';

// Deliberate production release operation. Run only after operator approval of published terms.
const env=JSON.parse(await readFile('.env.production.secrets.json','utf8'));
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL,'https://tfphopejudgbfrucdxsy.supabase.co');
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const checks=[];
for(const path of ['/','/terms','/privacy','/support','/scc','/api/health','/api/campaign']){
  const r=await fetch(`https://neylo.xyz${path}`);
  assert.equal(r.status,200,path);assert.match(r.headers.get('cache-control')||'',/private.*no-store/);
  assert.ok(r.headers.get('strict-transport-security'));assert.equal(r.headers.get('x-frame-options'),'DENY');
  checks.push({path,status:r.status,privateCache:true,securityHeaders:true});
  if(path==='/'){
    const html=await r.text();
    const assets=[...new Set([...html.matchAll(/(?:src|href)="([^\"]+\.(?:css|js)[^\"]*)"/g)].map(m=>m[1]).filter((value):value is string=>!!value))];
    assert.ok(assets.length>2,'HTML must expose stylesheet and hydration assets');
    for(const asset of assets){const a=await fetch(new URL(asset,'https://neylo.xyz'));assert.equal(a.status,200,asset);assert.match(a.headers.get('content-type')||'',asset.includes('.css')?/text\/css/:/javascript/);}
    checks.push({path:'HTML stylesheet and JavaScript dependencies',assets:assets.length,status:200});
  }
}
for(const path of ['/api/account','/api/admin/metrics','/api/admin/export','/api/admin/readiness']){
  const r=await fetch(`https://neylo.xyz${path}`);assert.equal(r.status,401,path);checks.push({path,status:r.status});
}
for(const source of ['http://neylo.xyz/i/test?utm_source=qr','https://www.neylo.xyz/i/test?utm_source=qr']){
  const r=await fetch(source,{redirect:'manual'});assert.equal(r.status,308);assert.equal(r.headers.get('location'),'https://neylo.xyz/i/test?utm_source=qr');checks.push({source,status:r.status,location:r.headers.get('location')});
}
const invalidOrigin=await fetch('https://neylo.xyz/api/signup/start',{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:'{}'});
assert.equal(invalidOrigin.status,403);checks.push({check:'Untrusted signup origin denied',status:invalidOrigin.status});
const {data:users,error:usersError}=await db.auth.admin.listUsers({perPage:1000});if(usersError)throw usersError;
const owner=users.users.find(u=>u.email==='kerim@horalix.com');assert.ok(owner?.email_confirmed_at);
const {error:tagError}=await db.from('participant_tags').upsert({email:'kerim.sabic@gmail.com',cohort:'test',reason:'Second external inbox explicitly authorized for deployment verification; excluded from rewards and participant metrics'},{onConflict:'email'});if(tagError)throw tagError;
const {data:before,error:campaignError}=await db.rpc('neylo_campaign');if(campaignError)throw campaignError;assert.equal(before.version,'founding-v1');assert.ok(before.publishedAt);
if(!before.open){const {error}=await db.rpc('neylo_pause',{p_actor:owner.id,p_paused:false,p_reason:'Owner approved published founding-v1 terms and support inbox. Managed SMTP delivery, owner verification, deployed HTTPS, origin and permission checks passed. Opening authorized public enrollment.'});if(error)throw error;}
const r=await fetch('https://neylo.xyz/api/campaign');const after=await r.json();assert.equal(after.ready,true);assert.equal(after.campaign.open,true);
await writeFile('test-results/production-release.json',JSON.stringify({at:new Date().toISOString(),version:'b222952c-a66d-4f68-b385-a1e00cbb6f85',checks,enrollmentOpen:true,termsVersion:after.campaign.version,remainingFounders:after.campaign.remaining},null,2));
console.log(`Production checks passed. Enrollment open; ${after.campaign.remaining} founding places remain. Authorized second inbox tagged as test before signup.`);
