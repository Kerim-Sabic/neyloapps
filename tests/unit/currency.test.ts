import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchCurrencyQuote } from '../../src/features/currency/rates';
import { countryCurrency,currencyChoice,defaultDisplay,bamPerEuro,formatDisplayCredit,validRate } from '../../src/features/currency/domain';
test('Country currency mapping covers home, euro area, USA and regional currencies',()=>{
  for(const [country,code] of [['BA','BAM'],['US','USD'],['DE','EUR'],['HR','EUR'],['BG','EUR'],['GB','GBP'],['RS','RSD'],['PL','PLN'],['JP','JPY'],['CA','CAD'],['AU','AUD']])assert.equal(countryCurrency(country!),code);
  assert.equal(countryCurrency('XX'),'BAM');assert.equal(countryCurrency(null),'BAM');assert.equal(currencyChoice('forged'),'auto');
});
test('Display conversion preserves actual 100, 50 and 250 KM entitlements',()=>{
  const eur={...defaultDisplay,currency:'EUR',rate:1/bamPerEuro};
  assert.equal(formatDisplayCredit(10000,eur),'≈ €51.13');assert.equal(formatDisplayCredit(5000,eur),'≈ €25.56');assert.equal(formatDisplayCredit(25000,eur),'≈ €127.82');
  assert.equal(formatDisplayCredit(10000,defaultDisplay),'100 KM');assert.equal(formatDisplayCredit(0,eur),'€0.00');
  assert.equal(formatDisplayCredit(-5000,eur),'≈ -€25.56');
  // Example rate is a test fixture, never a production fallback.
  const usd={...defaultDisplay,currency:'USD',rate:1.2/bamPerEuro};assert.equal(formatDisplayCredit(10000,usd),'≈ $61.36');
});
test('Only positive, correct-pair, recent, non-future rates can be shown',()=>{
  const now=Date.parse('2026-09-12T12:00:00Z'),rate={date:'2026-09-11',base:'EUR',quote:'USD',rate:1.2};
  assert.ok(validRate(rate,'USD',now));
  for(const changes of [{date:'2026-08-01'},{date:'2026-09-13'},{rate:-2},{rate:0},{rate:Infinity},{quote:'GBP'},{base:'USD'}])assert.equal(validRate({...rate,...changes},'USD',now),null);
});
test('Provider failure, timeout, malformed and stale responses fall back without inventing a rate',async()=>{
  const now=Date.parse('2026-09-12T12:00:00Z');
  for(const fetcher of [async()=>{throw new Error('Timeout');},async()=>new Response('',{status:503}),async()=>Response.json({}),async()=>Response.json({date:'2026-08-01',base:'EUR',quote:'USD',rate:1.2})])assert.equal(await fetchCurrencyQuote('USD',fetcher,now),null);
  const quote=await fetchCurrencyQuote('USD',async(url,options)=>{assert.equal(String(url),'https://api.frankfurter.dev/v2/rate/eur/usd?date=2026-09-12');assert.equal(options?.headers,undefined);assert.ok(options?.signal);return Response.json({date:'2026-09-11',base:'EUR',quote:'USD',rate:1.2});},now);
  assert.equal(quote?.rate,1.2/bamPerEuro);
});
