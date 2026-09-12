import {spawnSync} from 'node:child_process';
// Build once with explicit production inputs; deploy that exact artifact without an implicit rebuild.
for(const args of [['node_modules/tsx/dist/cli.mjs','ops/build-production.ts'],['node_modules/wrangler/bin/wrangler.js','deploy','--config','dist/server/wrangler.json']]){
  const result=spawnSync(process.execPath,args,{stdio:'inherit',env:process.env});
  if(result.status!==0)process.exit(result.status??1);
}
