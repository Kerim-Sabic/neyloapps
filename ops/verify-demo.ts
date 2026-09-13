import { readFile, readdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const origin = process.argv[2] ?? 'https://neylo.xyz';
const output = process.argv[3] ?? 'work/demo-production-verification.json';
const page = await fetch(`${origin}/app/demo`);
const html = await page.text();
assert.equal(page.status, 200);
assert.match(html, /Where to next\?/);
assert.match(html, /data-neylo-demo/);
assert.match(html, /https:\/\/neylo.xyz\/app\/demo/);
const assets = [...new Set([...html.matchAll(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+)"/g)].map(match => match[1]).filter((url): url is string => Boolean(url)))];
assert.ok(assets.length > 0);
const assetResults: { path: string; status: number }[] = [];
for (let index = 0; index < assets.length; index += 5) {
  assetResults.push(...await Promise.all(assets.slice(index, index + 5).map(async path => {
    const result = await fetch(new URL(path, origin)); await result.arrayBuffer();
    assert.equal(result.status, 200, path); return { path, status: result.status };
  })));
}
const home = await fetch(origin); const homeHtml = await home.text();
assert.equal(home.status, 200); assert.match(homeHtml, /Claim my/); assert.doesNotMatch(homeHtml, /data-neylo-demo/);
const admin = await fetch(`${origin}/api/admin/accounts`); assert.equal(admin.status, 401);
const campaign = await fetch(`${origin}/api/campaign`); const campaignBody: unknown = await campaign.json();
assert.equal(campaign.status, 200);
const sourceFiles = await readdir('src/features/demo');
for (const file of sourceFiles) {
  const source = await readFile(`src/features/demo/${file}`, 'utf8');
  assert.doesNotMatch(source, /\bfetch\s*\(|supabase|api\/events|removeItem|localStorage\.clear/, `Isolation: ${file}`);
}
const result = { at: new Date().toISOString(), origin, route: { path: '/app/demo', status: page.status }, assets: assetResults,
  homepage: home.status, privateAdminApi: admin.status, campaign: campaignBody,
  isolation: 'No backend/analytics requests or other storage mutations in demo feature source', filesAudited: sourceFiles.length };
await writeFile(output, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ route: `${origin}/app/demo`, status: page.status, assets: assetResults.length, home: home.status, privateAdmin: admin.status, output }));
