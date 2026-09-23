import test from 'node:test';
import assert from 'node:assert/strict';
import { bankCountries, bankFormats, parseMoney, planAmount, formatMoney, validInternationalIban } from '../../src/features/payments/international';
import { createPlan, instructions } from '../../src/features/payments/domain';
import { destinationInputSchema } from '../../src/features/payments/receiving-domain';
import { assertExecutionAvailable, paymentCapabilities } from '../../src/features/payments/provider';

test('money follows currency precision without rounding or implicit FX',()=>{
  assert.equal(parseMoney('25.10','USD'),2510);
  assert.equal(parseMoney('25','JPY'),25);
  assert.equal(parseMoney('25.1','JPY'),null);
  assert.equal(parseMoney('1,001','KWD'),1001);
  assert.equal(parseMoney('1.0001','KWD'),null);
  assert.equal(formatMoney(1001,'KWD'),'1.001 KWD');
  assert.equal(formatMoney(25,'JPY'),'25 JPY');
  for(const value of ['1e2','-1','NaN','Infinity','1,000.00','1 000','1.','0'])assert.equal(parseMoney(value,'USD'),null);
  assert.equal(planAmount('100.001','KWD'),null);
  assert.equal(planAmount('100','JPY'),100);
});

test('all reviewed IBAN formats enforce their own country, structure and checksum',()=>{
  for(const country of bankCountries){
    const iban=bankFormats[country].example;
    assert.equal(validInternationalIban(iban,country),true,country);
    assert.equal(validInternationalIban(iban.slice(0,2)+'00'+iban.slice(4),country),false,country);
    assert.equal(validInternationalIban(iban+'0',country),false,country);
    assert.equal(validInternationalIban(iban,country==='BA'?'DE':'BA'),false,country);
  }
  assert.equal(validInternationalIban('US123456','US'),false);
});

test('international plans retain declared currency and never manufacture local account numbers',()=>{
  const input={name:'Example Recipient',iban:bankFormats.GB.example,bankCountry:'GB' as const,currency:'USD' as const,amount:'25.10',note:''};
  const plan=createPlan(input,'31b811bf-54ba-4b86-a9e4-bd8e06275471','2026-09-24T00:00:00Z');
  assert.equal(plan.currency,'USD');assert.equal(plan.amountMinor,2510);
  assert.doesNotMatch(instructions(plan,'prepared'),/Domestic account number/);
  assert.match(instructions(plan,'prepared'),/25.10 USD/);
  assert.match(instructions(plan,'prepared'),/No FX quote/);
  assert.throws(()=>createPlan({...input,bankCountry:'BA'},plan.id,plan.createdAt));
  assert.equal(destinationInputSchema.safeParse({accountName:input.name,iban:input.iban,bankCountry:'GB',currency:'USD',bankName:'Example Bank',bic:'NWBKGB2L',discoverable:true,version:null}).success,true);
});

test('format and currency support never authorize an unapproved corridor',()=>{
  const corridor={senderCountry:'DE',recipientCountry:'GB',bankCountry:'GB',currency:'GBP' as const};
  assert.throws(()=>assertExecutionAvailable(paymentCapabilities,corridor));
  const enabled={...paymentCapabilities,execution:true,recipientVerification:true,funding:['bank_authorization'] as const,payout:['bank_account'] as const,corridors:[corridor]};
  assert.doesNotThrow(()=>assertExecutionAvailable(enabled,corridor));
  assert.throws(()=>assertExecutionAvailable(enabled,{...corridor,senderCountry:'US'}));
  assert.throws(()=>assertExecutionAvailable(enabled,{...corridor,currency:'USD'}));
});
