import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSchema,codeSchema,formatCredit,metricsFilterSchema,invitationCodeSchema,startSchema } from '../../src/lib/domain';
test('Handles normalize and reject reserved or ambiguous names',()=>{assert.equal(handleSchema.parse(' @KeRim_1 '),'kerim_1');for(const name of ['admin','foo-bar','ééé','a','x'.repeat(21)])assert.equal(handleSchema.safeParse(name).success,false);});
test('OTP accepts leading zeroes and rejects incomplete input',()=>{assert.equal(codeSchema.parse('001234'),'001234');assert.equal(codeSchema.safeParse('12345').success,false);});
test('Credits use integer minor units and consistent local display',()=>{assert.equal(formatCredit(10000),'100 KM');assert.equal(formatCredit(15000),'150 KM');assert.equal(formatCredit(25000),'250 KM');});
test('Input boundaries reject forged amounts, cohort and role claims',()=>{const valid={handle:'validname',email:'valid@example.test',termsVersion:'v1',accepted:true,offerDisplayed:true};assert.equal(startSchema.safeParse(valid).success,true);for(const payload of [{...valid,cohort:'staff'},{...valid,amountMinor:25000},{...valid,role:'operator'},{...valid,accepted:false}])assert.equal(startSchema.safeParse(payload).success,false);});
test('Filters and opaque invitations reject invalid values',()=>{assert.equal(metricsFilterSchema.safeParse({from:'2026-02-01T00:00:00.000Z',to:'2026-01-01T00:00:00.000Z'}).success,false);assert.equal(invitationCodeSchema.safeParse('../account').success,false);});
