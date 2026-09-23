import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('euro username preview fills a German IBAN and keeps the account currency',async({page})=>{
  await page.goto('/pay/preview');
  await page.getByLabel('Recipient’s username').fill('alex');
  await page.getByRole('button',{name:'Find recipient',exact:true}).click();
  await page.getByText('Receiving route · EUR bank account').click();
  await expect(page.getByText('Example German bank · ending 3000')).toBeVisible();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('button',{name:'25 EUR',exact:true}).click();
  await page.getByRole('button',{name:'Review payment',exact:true}).click();
  await expect(page.getByText('25.00 EUR',{exact:true}).first()).toBeVisible();
  await expect(page.getByText('No FX quote · confirm with your bank')).toBeVisible();
  const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(audit.violations).toEqual([]);
  await page.screenshot({path:`test-results/international-review-${test.info().project.name}.png`,fullPage:true});
  await page.getByRole('checkbox',{name:'I checked'}).check();
  await page.getByRole('button',{name:'Prepare bank instructions'}).click();
  await expect(page.getByText('DE89 3704 0044 0532 0130 00')).toBeVisible();
  await expect(page.getByRole('button',{name:'Copy domestic account'})).toHaveCount(0);
  await expect(page.getByText('Amount (EUR)',{exact:true})).toBeVisible();
});

test('manual currency precision is enforced and changing country clears stale bank details',async({page})=>{
  await page.goto('/pay');
  await page.getByRole('button',{name:'Use bank details instead'}).click();
  await page.getByLabel('Bank country',{exact:true}).selectOption('GB');
  await expect(page.getByLabel('Account currency',{exact:true})).toHaveValue('GBP');
  await page.getByLabel('Account currency',{exact:true}).selectOption('JPY');
  await page.getByLabel('Recipient’s full name').fill('Example Recipient');
  await page.getByLabel('IBAN',{exact:true}).fill('GB29NWBK60161331926819');
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByLabel('Payment amount').fill('25.10');
  await page.getByRole('button',{name:'Review payment',exact:true}).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('0 decimal places');
  await page.getByLabel('Payment amount').fill('25');
  await page.getByRole('button',{name:'Review payment',exact:true}).click();
  await expect(page.getByText('25 JPY',{exact:true}).first()).toBeVisible();
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.getByLabel('Bank country',{exact:true}).selectOption('DE');
  await expect(page.getByLabel('IBAN',{exact:true})).toHaveValue('');
  await expect(page.getByLabel('Account currency',{exact:true})).toHaveValue('EUR');
  await page.getByLabel('Bank country',{exact:true}).selectOption('unsupported');
  await expect(page.getByText('This account format is not available yet.',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('selected bank country');
});
