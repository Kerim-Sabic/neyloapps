import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';

const origin='http://127.0.0.1:3100';
const evidence:string[]=[];
async function otp(email:string,after=0){
  let code='';
  await expect.poll(async()=>{
    const list=await (await fetch('http://127.0.0.1:55424/api/v1/messages')).json();
    const message=list.messages.find((m:{To:{Address:string}[];Created:string})=>m.To.some(to=>to.Address===email)&&Date.parse(m.Created)>after);
    if(!message)return false;
    const body=await (await fetch(`http://127.0.0.1:55424/api/v1/message/${message.ID}`)).json();
    code=(body.Text??'').match(/\b\d{6}\b/)?.[0]??'';
    return Boolean(code);
  },{timeout:20_000,message:'Local verification email arrives'}).toBe(true);
  return code;
}
async function enroll(page:Page,handle:string){
  const email=`${handle}@example.test`;
  await page.goto('/');
  await page.getByLabel('Your handle',{exact:true}).fill(handle);
  await page.getByLabel('Email',{exact:true}).fill(email);
  await page.getByRole('checkbox',{name:'I agree to the'}).check();
  await page.getByRole('button',{name:'Join the waitlist',exact:true}).click();
  await expect(page.getByLabel('Verification code')).toBeVisible();
  await page.getByLabel('Verification code').fill(await otp(email));
  await page.getByRole('button',{name:'Verify & join the waitlist',exact:true}).click();
  await expect(page).toHaveURL(/\/account$/);
  const account=await (await page.request.get('/api/account')).json();
  expect(account.handle).toBe(handle);expect(account.totalMinor).toBe(0);
  return email;
}
const post=(context:BrowserContext,path:string,data:unknown)=>context.request.post(`/api/${path}`,{headers:{Origin:origin},data});

test('real signup, two users, saved route, autofill and privacy/security lifecycle',async({browser})=>{
  const suffix=randomBytes(4).toString('hex');
  const owner=await browser.newContext({baseURL:origin}),sender=await browser.newContext({baseURL:origin});
  const ownerPage=await owner.newPage(),senderPage=await sender.newPage();
  try{
    const started=Date.now();
    const ownerEmail=await enroll(ownerPage,`owner_${suffix}`);
    await enroll(senderPage,`sender_${suffix}`);
    evidence.push('Two separate users completed real signup and email OTP; no promotional money was created.');
    await ownerPage.getByRole('link',{name:'Set up receiving account'}).click();
    await ownerPage.getByLabel('Account holder’s full name').fill('Local Example Recipient');
    await ownerPage.getByRole('combobox',{name:'Bank',exact:true}).selectOption('Other bank');
    await ownerPage.getByLabel('Bank’s legal name').fill('Local Example Bank');
    await ownerPage.getByLabel('IBAN',{exact:true}).fill('BA391290079401028494');
    await ownerPage.getByRole('button',{name:`Link to @owner_${suffix}`,exact:true}).click();
    await expect(ownerPage.getByText('Saved privately.',{exact:false})).toBeVisible();
    expect((await (await post(sender,'payments/recipient',{handle:`owner_${suffix}`})).json()).recipient).toBeNull();
    await ownerPage.getByRole('checkbox',{name:'Allow signed-in Neylo users'}).check();
    await ownerPage.getByRole('button',{name:'Update receiving account',exact:true}).click();
    await expect(ownerPage.getByText(`Linked to @owner_${suffix}.`,{exact:false})).toBeVisible();
    const stored=await (await owner.request.get('/api/account/receiving')).json();
    expect(stored.destination.iban).toBe('BA391290079401028494');
    const other=await (await sender.request.get('/api/account/receiving')).json();expect(other.destination).toBeNull();
    const lookup=await post(sender,'payments/recipient',{handle:`owner_${suffix}`});
    const selected=(await lookup.json()).recipient;
    expect(selected.last4).toBe('8494');expect(selected.iban).toBeUndefined();expect(lookup.headers()['cache-control']).toContain('no-store');
    evidence.push('Saved account persists, is private by default and exposes only masked details with consent.');

    await senderPage.goto('/pay');
    await senderPage.getByLabel('Recipient’s username').fill(`owner_${suffix}`);
    await senderPage.getByRole('button',{name:'Find recipient',exact:true}).click();
    await expect(senderPage.getByRole('region',{name:'Prepare a bank payment'}).getByText(`@owner_${suffix}`,{exact:true})).toBeVisible();
    await senderPage.getByRole('button',{name:'Continue',exact:true}).click();
    await senderPage.getByRole('button',{name:'25 BAM',exact:true}).click();
    await senderPage.getByRole('button',{name:'Review payment',exact:true}).click();
    await senderPage.getByRole('checkbox',{name:'I checked'}).check();
    await senderPage.getByRole('button',{name:'Prepare bank instructions',exact:true}).click();
    await expect(senderPage.getByText('BA39 1290 0794 0102 8494',{exact:true})).toBeVisible();
    await expect(senderPage.getByText('Prepared · not sent',{exact:true})).toBeVisible();
    const audit=await new AxeBuilder({page:ownerPage}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations).toEqual([]);
    evidence.push('Sender prepared bank instructions without typing an IBAN; no payment success was claimed. Receiving settings passed automated accessibility checks.');

    await ownerPage.getByLabel('Account currency',{exact:true}).selectOption('EUR');
    const changedResponse=ownerPage.waitForResponse(r=>r.url().endsWith('/api/account/receiving')&&r.request().method()==='POST');
    await ownerPage.getByRole('button',{name:'Update receiving account',exact:true}).click();
    expect((await changedResponse).ok()).toBe(true);
    expect((await post(sender,'payments/recipient/prepare',{handle:`owner_${suffix}`,version:selected.version})).status()).toBe(409);
    expect((await post(owner,'account/receiving',{...stored.destination,userId:'00000000-0000-4000-8000-000000000001'})).status()).toBe(400);
    expect((await owner.request.post('/api/account/receiving/remove',{headers:{Origin:'https://untrusted.example'},data:{version:stored.destination.version}})).status()).toBe(403);
    const withoutRecent=await browser.newContext({baseURL:origin});
    await withoutRecent.addCookies((await owner.cookies()).filter(c=>c.name!=='neylo_reauth'));
    expect((await post(withoutRecent,'account/receiving/remove',{version:stored.destination.version})).status()).toBe(403);
    await withoutRecent.close();
    evidence.push('Stale revisions, injected identity fields, cross-origin writes and missing recent authentication were rejected.');

    await ownerPage.getByRole('checkbox',{name:'Allow signed-in Neylo users'}).uncheck();
    const privateResponse=ownerPage.waitForResponse(r=>r.url().endsWith('/api/account/receiving')&&r.request().method()==='POST');
    await ownerPage.getByRole('button',{name:'Update receiving account',exact:true}).click();await privateResponse;
    expect((await (await post(sender,'payments/recipient',{handle:`owner_${suffix}`})).json()).recipient).toBeNull();
    await ownerPage.getByRole('button',{name:'Remove receiving account',exact:true}).click();
    await ownerPage.getByRole('button',{name:'Remove account',exact:true}).click();
    await expect(ownerPage.getByText('Receiving account removed.',{exact:false})).toBeVisible();
    expect((await (await owner.request.get('/api/account/receiving')).json()).destination).toBeNull();
    const capabilities=await (await sender.request.get('/api/payments/capabilities')).json();expect(capabilities.execution).toBe(false);
    evidence.push('Opt-out stops lookup; removal persists; all execution capabilities remain off.');
    await post(owner,'auth/signout',{});
    await ownerPage.goto('/account/receiving');
    await expect(ownerPage).toHaveURL(/\/signin\?next=/);
    // Respect the real provider's resend cooldown; do not bypass OTP or mutate auth records.
    await expect.poll(()=>Date.now()-started,{timeout:70_000,intervals:[1000]}).toBeGreaterThan(65_000);
    await ownerPage.getByLabel('Email',{exact:true}).fill(ownerEmail);
    const requestedAt=Date.now();
    await ownerPage.getByRole('button',{name:'Send sign-in code',exact:true}).click();
    await expect(ownerPage.getByLabel('Verification code')).toBeVisible();
    await ownerPage.getByLabel('Verification code').fill(await otp(ownerEmail,requestedAt));
    await ownerPage.getByRole('button',{name:'Verify & sign in',exact:true}).click();
    await expect(ownerPage).toHaveURL(/\/account\/receiving$/);
    await expect(ownerPage.getByLabel('IBAN',{exact:true})).toHaveValue('');
    evidence.push('Real sign-out and fresh email-OTP sign-in restore the intended receiving-account page.');
    await mkdir('test-results/pilot',{recursive:true});
    await writeFile('test-results/pilot/summary.json',JSON.stringify({environment:'local Supabase only',passed:true,at:new Date().toISOString(),checks:evidence},null,2));
  }finally{await owner.close();await sender.close();}
});

