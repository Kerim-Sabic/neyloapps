import {defineConfig,devices} from '@playwright/test';
if(process.env.LOCAL_PILOT!=='true'||process.env.NEXT_PUBLIC_SUPABASE_URL!=='http://127.0.0.1:55421')throw new Error('Run npm run pilot:test against the isolated local stack.');
export default defineConfig({
  testDir:'./tests/pilot',workers:1,fullyParallel:false,retries:0,timeout:120_000,
  reporter:'list',outputDir:'test-results/pilot',
  // Auth tokens/OTP responses must not be persisted in traces or shared artifacts.
  use:{baseURL:'http://127.0.0.1:3100',trace:'off',screenshot:'off',video:'off'},
  projects:[{name:'local-two-account',use:{...devices['Desktop Chrome']}}],
  webServer:{command:'node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100',url:'http://127.0.0.1:3100',reuseExistingServer:false,timeout:120_000},
});
