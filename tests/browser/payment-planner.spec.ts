import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

async function recipient(page: Page) {
  if(await page.getByRole('button',{name:'Use bank details instead',exact:true}).isVisible()) await page.getByRole('button',{name:'Use bank details instead',exact:true}).click();
  await page.getByLabel('Recipient’s full name').fill('Test Recipient');
  // Published IBAN-format example, not an account to send money to.
  await page.getByLabel('Bosnian IBAN').fill('BA39 1290 0794 0102 8494');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make it the right amount.' })).toBeVisible();
}

async function review(page: Page) {
  await recipient(page);
  await page.getByRole('button', { name: '25 BAM', exact: true }).click();
  await page.getByLabel('Payment purpose').fill('Shared meal');
  await page.getByRole('button', { name: 'Review payment' }).click();
  await expect(page.getByRole('heading', { name: 'One last look.' })).toBeVisible();
}

test('complete planner flow stays private and never claims execution', async ({ page, context }) => {
  const outbound: string[] = [];
  const errors: string[] = [];
  page.on('request', request => outbound.push(request.url() + (request.postData() || '')));
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/pay');
  await review(page);
  await page.getByRole('button', { name: 'Prepare bank instructions' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Confirm that you checked');
  await page.getByRole('checkbox', { name: 'I checked' }).check();
  await page.getByRole('button', { name: 'Prepare bank instructions' }).click();
  await expect(page.getByText('Prepared · not sent', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark as sent by me' })).toBeDisabled();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Copy iban', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('BA391290079401028494');
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations).toEqual([]);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download payment plan' }).click();
  const download = await downloadPromise;
  const text = await readFile((await download.path())!, 'utf8');
  expect(text).toContain('Not proof of payment');
  expect(text).toContain('25.00 BAM');
  expect(text).toContain('Domestic account number: 1290079401028494');
  await page.getByRole('checkbox', { name: 'I have already authorized' }).check();
  await page.getByRole('button', { name: 'Mark as sent by me' }).click();
  await expect(page.getByText('You marked this as sent', { exact: true })).toBeVisible();
  await expect(page.getByText('This is your own record.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Undo my status' }).click();
  await expect(page.getByRole('status')).toContainText('does not cancel');
  expect(outbound.join('\n')).not.toMatch(/1290079401028494|1290%20|Test%20Recipient|Test Recipient|Shared meal/);
  const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
  expect(storage).not.toMatch(/1290|Test Recipient|Shared meal/);
  expect(errors).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `test-results/planner-instructions-${test.info().project.name}.png`, fullPage: true });
  await page.reload();
  await expect(page.getByLabel('Recipient’s username')).toHaveValue('');
});

test('validation and editing do not preserve stale recipient confirmation', async ({ page }) => {
  await page.goto('/pay');
  await page.getByRole('button',{name:'Use bank details instead',exact:true}).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toBeFocused();
  await recipient(page);
  await page.getByLabel('Payment amount').fill('1e2');
  await page.getByRole('button', { name: 'Review payment' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('1 to 100 BAM');
  await page.getByLabel('Payment amount').fill('25,10');
  await page.getByRole('button', { name: 'Review payment' }).click();
  await page.getByRole('checkbox', { name: 'I checked' }).check();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByLabel('Recipient’s full name').fill('Different Recipient');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Review payment' }).click();
  await expect(page.getByRole('checkbox', { name: 'I checked' })).not.toBeChecked();
  await page.getByRole('button', { name: 'Clear & start again' }).click();
  await page.getByRole('button', { name: 'Keep plan' }).click();
  await expect(page.getByText('25.10 BAM', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Clear & start again' }).click();
  await page.getByRole('button', { name: 'Yes, clear plan' }).click();
  await expect(page.getByLabel('Recipient’s full name')).toHaveValue('');
});

test('accessible recipient and review screens fit the viewport', async ({ page }) => {
  await page.goto('/pay');
  await expect(page.getByRole('heading', { name: 'Who’s it for?' })).toBeVisible();
  for (const screen of ['recipient', 'review'] as const) {
    if (screen === 'review') await review(page);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(audit.violations).toEqual([]);
    await page.getByRole('heading', { level: 2 }).focus();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `test-results/planner-${screen}-${test.info().project.name}.png`, fullPage: true });
  }
});

test('navigation exposes planner and capabilities cannot claim a live connection', async ({ page, request }) => {
  const hydrationErrors: string[] = [];
  page.on('console', message => { if (message.type() === 'error' && /hydrat|didn.t match/i.test(message.text())) hydrationErrors.push(message.text()); });
  await page.goto('/');
  await page.getByRole('link', { name: 'Payment planner', exact: true }).click();
  await expect(page).toHaveURL(/\/pay$/);
  const response = await request.get('/api/payments/capabilities');
  expect(response.status()).toBe(200);
  const capabilities = await response.json();
  expect(capabilities.execution).toBe(false);
  expect(capabilities.recipientVerification).toBe(false);
  expect(capabilities.funding).toEqual([]);
  expect(capabilities.payout).toEqual([]);
  expect(hydrationErrors).toEqual([]);
});

