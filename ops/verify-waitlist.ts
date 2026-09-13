import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { campaignSchema } from '../src/lib/domain';

const origin=process.argv[2]??'https://neylo.xyz';
assert.ok(['https://neylo.xyz','http://127.0.0.1:3102'].includes(origin));
const routes=['/','/terms','/terms?version=founding-v1','/privacy','/signin','/app/demo','/demo/nadin','/demo/kerim','/pitch'];
const assets=new Set<string>();
const pages=await Promise.all(routes.map(async path=>{
  const response=await fetch(origin+path);const html=await response.text();assert.equal(response.status,200,path);
  for(const match of html.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+)"/g))if(match[1])assets.add(match[1]);
  if(path==='/'){assert.match(html,/Join the waitlist/);assert.doesNotMatch(html,/Claim my|Your first 100/);}
  if(path==='/terms'){assert.match(html,/Waitlist terms/);assert.match(html,/Promotion closed/);}
  if(path.includes('?version=')){assert.match(html,/Historical campaign terms/);assert.match(html,/previously published version/);}
  return {path,status:response.status};
}));
assert.ok(assets.size>0);
const paths=[...assets];
for(let i=0;i<paths.length;i+=5)await Promise.all(paths.slice(i,i+5).map(async path=>{const response=await fetch(new URL(path,origin));assert.equal(response.status,200,path);await response.arrayBuffer();}));
const enrollment=await(await fetch(origin+'/api/campaign')).json() as {ready:boolean;campaign:unknown};
const campaign=campaignSchema.parse(enrollment.campaign);
assert.equal(enrollment.ready,true);assert.equal(campaign.open,true);assert.ok(campaign.rewardsEndedAt);assert.equal(campaign.remaining,0);
for(const path of ['/api/admin/accounts','/api/admin/metrics','/api/account'])assert.equal((await fetch(origin+path)).status,401,path);
const report={at:new Date().toISOString(),origin,pages,assetsChecked:assets.size,enrollmentReady:true,enrollmentOpen:true,rewardsEndedAt:campaign.rewardsEndedAt,privateApis:'401 without authentication'};
await writeFile('test-results/waitlist-production.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
