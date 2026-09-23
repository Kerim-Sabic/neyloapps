import test from 'node:test';
import assert from 'node:assert/strict';
import { bam, createPlan, instructions, parseBam, reportSent, validBosnianIban, validName, validNote } from '../../src/features/payments/domain';
import { assertExecutionAvailable, paymentCapabilities } from '../../src/features/payments/provider';
import { GET } from '../../src/app/api/payments/capabilities/route';

const fixture = { name: 'Test Recipient', iban: 'BA39 1290 0794 0102 8494', amount: '25,10', note: 'Shared meal' };
const id = '31b811bf-54ba-4b86-a9e4-bd8e06275471';
const time = '2026-09-23T12:00:00.000Z';

test('BAM parsing is exact and rejects ambiguous, fractional and out-of-range amounts', () => {
  for (const [value, expected] of [['1', 100], ['1.01', 101], ['25,10', 2510], ['100.00', 10000], ['10.1', 1010]] as const) assert.equal(parseBam(value), expected);
  for (const value of ['0', '-1', '0.99', '100.01', '101', '1e2', '1.001', '1,000', '1 00', 'NaN', 'Infinity', '', '1.', '1,2.3', '1000000000000']) assert.equal(parseBam(value), null, value);
  assert.equal(bam(101), '1.01 BAM');
  assert.throws(() => bam(1.1));
});

test('Bosnian IBAN enforces country, length, prefix and checksum, not just a regex', () => {
  assert.equal(validBosnianIban(fixture.iban), true);
  assert.equal(validBosnianIban('ba39 1990 4400 0120 0279'), true);
  for (const value of ['BA391290079401028495', 'BA39129007940102849', 'BA390000000000000000', 'DE89370400440532013000', 'BA39<290079401028494']) assert.equal(validBosnianIban(value), false, value);
});

test('recipient and purpose preserve local letters but reject control-character instruction injection', () => {
  assert.equal(validName('Željka Šabić'), true);
  for (const name of ['', 'A', '1234', 'Test\nStatus: completed', 'A\u202eB', '<script>']) assert.equal(validName(name), false);
  assert.equal(validNote('Dinner, Friday'), true);
  assert.equal(validNote('A'.repeat(101)), false);
  assert.equal(validNote('Dinner\nStatus: complete'), false);
});

test('plans snapshot validated input without account ownership or payment execution claims', () => {
  const input = { ...fixture };
  const plan = createPlan(input, id, time);
  input.name = 'Changed recipient';
  assert.equal(plan.recipient.name, fixture.name);
  assert.equal(plan.amountMinor, 2510);
  assert.equal(plan.recipient.iban, 'BA391290079401028494');
  assert.throws(() => createPlan({ ...fixture, amount: '1e2' }, id, time));
  assert.throws(() => createPlan({ ...fixture, iban: 'BA391290079401028495' }, id, time));
  assert.throws(() => createPlan(fixture, id, 'bad date'));
});

test('personal reports and downloaded plans never become bank confirmation', () => {
  const plan = createPlan(fixture, id, time);
  assert.equal(reportSent('prepared'), 'reported_sent');
  assert.equal(reportSent('reported_sent'), 'reported_sent');
  for (const status of ['prepared', 'reported_sent'] as const) {
    const text = instructions(plan, status);
    assert.match(text, /Not proof of payment/);
    assert.match(text, /Recipient \(entered by you\)/);
    assert.match(text, /not a bank reference/);
    assert.match(text, /not confirmed by Neylo/);
  }
  assert.match(instructions(plan, 'reported_sent'), /not bank-confirmed/);
});

test('capabilities fail closed independently of arbitrary environment flags', async () => {
  const previous = process.env.PAYMENTS_ENABLED;
  process.env.PAYMENTS_ENABLED = 'true';
  try {
    assert.throws(() => assertExecutionAvailable(), /not available/);
    assert.equal(paymentCapabilities.execution, false);
    assert.equal(Object.isFrozen(paymentCapabilities.funding), true);
    const response = GET();
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store, max-age=0');
    const body = await response.json();
    assert.equal(body.execution, false);
    assert.equal(body.recipientVerification, false);
    assert.deepEqual(body.payout, []);
    assert.equal(body.mode, 'bank_instructions');
  } finally {
    if (previous === undefined) delete process.env.PAYMENTS_ENABLED;
    else process.env.PAYMENTS_ENABLED = previous;
  }
});
