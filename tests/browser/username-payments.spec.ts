import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const recipient={handle:'nadin',accountName:'Example Recipient',bankName:'Example Bank',last4:'8494',version:'31b811bf-54ba-4b86-a9e4-bd8e06275471',verification:'self_declared',currency:'BAM'};
const destination={accountName:recipient.accountName,bankName:recipient.bankName,version:recipient.version,verification:'self_declared',currency:'BAM',iban:'BA391290079401028494',bic:'',discoverable:true};

test('username lookup masks details until preparation and automatically fills instructions',async({page})=>{
  let revealCount=0;
  await page.route('**/api/payments/recipient',async route=>{
    expect(route.request().postDataJSON()).toEqual({handle:'nadin'});
    await route.fulfill({json:{recipient}});
  });
  await page.route('**/api/payments/recipient/prepare',async route=>{
    revealCount++;
    expect(route.request().postDataJSON()).toEqual({handle:'nadin',version:recipient.version});
    await route.fulfill({json:{destination}});
  });
  await page.goto('/pay');
  await expect(page.getByLabel('Bosnian IBAN')).toHaveCount(0);
  await page.getByLabel('Recipient’s username').fill('@Nadin');
  await page.getByRole('button',{name:'Find recipient',exact:true}).click();
  await expect(page.getByRole('region', {name:'Prepare a bank payment'}).getByText('@nadin',{exact:true})).toBeVisible();
  await expect(page.getByText('BA391290079401028494',{exact:false})).toHaveCount(0);
  expect(revealCount).toBe(0);
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'25 BAM',exact:true}).click();
  await page.getByRole('button',{name:'Review payment',exact:true}).click();
  await page.getByText('View receiving route',{exact:true}).click();
  await expect(page.getByText('Example Recipient · Example Bank · account ending 8494')).toBeVisible();
  const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(audit.violations).toEqual([]);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:`test-results/username-review-${test.info().project.name}.png`,fullPage:true});
  await page.getByRole('checkbox',{name:'I checked'}).check();
  await page.getByRole('button',{name:'Prepare bank instructions'}).click();
  await expect(page.getByText('BA39 1290 0794 0102 8494',{exact:true})).toBeVisible();
  await expect(page.getByText('Prepared · not sent',{exact:true})).toBeVisible();
  expect(revealCount).toBe(1);
});

test('changed destination blocks preparation and changing username clears old selection',async({page})=>{
  await page.route('**/api/payments/recipient',route=>route.fulfill({json:{recipient}}));
  await page.route('**/api/payments/recipient/prepare',route=>route.fulfill({status:409,json:{error:{code:'DESTINATION_CHANGED',message:'These bank details changed. Look up the recipient again.',requestId:'test'}}}));
  await page.goto('/pay');
  await page.getByLabel('Recipient’s username').fill('nadin');
  await page.getByRole('button',{name:'Find recipient',exact:true}).click();
  await expect(page.getByRole('region', {name:'Prepare a bank payment'}).getByText('@nadin',{exact:true})).toBeVisible();
  await page.getByLabel('Recipient’s username').fill('different');
  await expect(page.getByRole('region', {name:'Prepare a bank payment'}).getByText('@nadin',{exact:true})).toHaveCount(0);
  await page.getByLabel('Recipient’s username').fill('nadin');
  await page.getByRole('button',{name:'Find recipient',exact:true}).click();
  await expect(page.getByRole('region', {name:'Prepare a bank payment'}).getByText('@nadin',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'25 BAM',exact:true}).click();
  await page.getByRole('button',{name:'Review payment',exact:true}).click();
  await page.getByRole('checkbox',{name:'I checked'}).check();
  await page.getByRole('button',{name:'Prepare bank instructions'}).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('bank details changed');
  await expect(page.getByRole('button',{name:'Download payment plan'})).toHaveCount(0);
});

test('live username endpoints require authentication; preview never invokes them',async({page,request})=>{
  const response=await request.post('/api/payments/recipient',{headers:{Origin:'http://127.0.0.1:3100'},data:{handle:'nadin'}});
  expect(response.status()).toBe(401);
  let requests=0;
  page.on('request',req=>{if(req.url().includes('/api/payments/recipient'))requests++;});
  await page.goto('/pay/preview');
  await expect(page.getByText('DESIGN PREVIEW',{exact:false})).toBeVisible();
  await page.getByLabel('Recipient’s username').fill('nadin');
  await page.getByRole('button',{name:'Find recipient',exact:true}).click();
  await expect(page.getByRole('region', {name:'Prepare a bank payment'}).getByText('@nadin',{exact:true})).toBeVisible();
  expect(requests).toBe(0);
});

