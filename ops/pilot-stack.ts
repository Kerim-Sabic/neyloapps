import {spawnSync} from 'node:child_process';
const network='neylo-local-pilot';
const inspect=spawnSync('docker',['network','inspect',network,'--format','{{index .Options "com.docker.network.bridge.host_binding_ipv4"}}'],{encoding:'utf8'});
if(inspect.status===0&&inspect.stdout.trim()!=='127.0.0.1')throw new Error('Existing pilot network is not restricted to loopback.');
if(inspect.status!==0){
  const created=spawnSync('docker',['network','create','-o','com.docker.network.bridge.host_binding_ipv4=127.0.0.1',network],{encoding:'utf8'});
  if(created.status!==0)throw new Error('Docker must be running to start the local pilot.');
}
console.log('Starting the isolated local Supabase stack. First run may download container images.');
// Supabase prints local secret keys on success. Do not forward its output to CI logs.
const started=spawnSync(process.execPath,['node_modules/supabase/dist/supabase.js','start','--network-id',network],{encoding:'utf8',maxBuffer:32*1024*1024,timeout:600_000});
if(started.status!==0)throw new Error('Local Supabase failed to start. Inspect Docker locally; CLI output is withheld because it may include keys. No database reset was attempted.');
console.log('Local Supabase ready. Run npm run pilot:test or npm run pilot:local.');
